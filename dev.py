#!/usr/bin/env python3
"""Start the full Aligo C2 lab stack with prefixed logging.

Usage:
    python dev.py                  # chain + deploy + back + front + 3 nodes
    python dev.py --node-count 1   # fewer simulated nodes
    python dev.py --no-nodes       # skip node processes
    python dev.py --skip-install   # skip dependency checks

Uses ./venv automatically (creates it if missing). On Windows you can also run start.bat.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_DIR = ROOT / "venv"
MARKER_DIR = ROOT / ".dev"
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"
DEPLOYMENT_JSON = ROOT / "deployment.json"

URLS = {
    "dashboard": "http://localhost:5173",
    "api": "http://localhost:8000",
    "api_docs": "http://localhost:8000/docs",
    "health": "http://localhost:8000/health",
    "chain_rpc": "http://localhost:8545",
}

STACK_PORTS: dict[int, str] = {
    8545: "blockchain",
    8000: "backend",
    5173: "frontend",
}

PROCS: list[subprocess.Popen[str]] = []
STOPPING = False
PYTHON: Path  # set in main() after ensure_venv()


def venv_python_path(venv_dir: Path = VENV_DIR) -> Path | None:
    """Return the venv interpreter if it exists."""
    if os.name == "nt":
        candidate = venv_dir / "Scripts" / "python.exe"
    else:
        candidate = venv_dir / "bin" / "python"
    return candidate if candidate.is_file() else None


def ensure_venv_python() -> Path:
    """Use ./venv for all Python work; create or re-exec if needed."""
    vp = venv_python_path()
    if vp is None:
        log("SETUP", "Creating virtualenv at ./venv …")
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
        vp = venv_python_path()
        if vp is None:
            log("SETUP", "ERROR: failed to create venv at ./venv")
            sys.exit(1)

    if Path(sys.executable).resolve() != vp.resolve():
        log("SETUP", f"Using venv Python: {vp}")
        os.execv(str(vp), [str(vp), *sys.argv])

    return vp


def venv_env(base: dict[str, str] | None = None) -> dict[str, str]:
    """Child-process env with venv bin/Scripts prepended to PATH."""
    env = (base or os.environ).copy()
    if os.name == "nt":
        bindir = str(VENV_DIR / "Scripts")
    else:
        bindir = str(VENV_DIR / "bin")
    env["PATH"] = bindir + os.pathsep + env.get("PATH", "")
    env["VIRTUAL_ENV"] = str(VENV_DIR)
    return env


def log(tag: str, msg: str) -> None:
    print(f"[{tag}] {msg}", flush=True)


def banner(tag: str, msg: str) -> None:
    print(f"\n[{tag}] {msg}\n", flush=True)


def which_or_die(name: str) -> str:
    path = shutil.which(name)
    if not path:
        log("SETUP", f"ERROR: '{name}' not found on PATH. Install it and retry.")
        sys.exit(1)
    return path


def load_env() -> dict[str, str]:
    env = os.environ.copy()
    if ENV_FILE.is_file():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    # Local dev always talks to localhost chain (docker-compose uses blockchain:8545).
    env["BLOCKCHAIN_RPC_URL"] = "http://127.0.0.1:8545"
    env.setdefault("NODE_SHARED_TOKEN", "change-me-lab-token")
    env.setdefault("C2_WS_URL", "ws://127.0.0.1:8000/ws/node")
    return env


def ensure_env_file() -> None:
    if ENV_FILE.is_file():
        return
    if not ENV_EXAMPLE.is_file():
        log("SETUP", "WARNING: .env missing and no .env.example to copy.")
        return
    text = ENV_EXAMPLE.read_text(encoding="utf-8")
    text = text.replace(
        "BLOCKCHAIN_RPC_URL=http://blockchain:8545",
        "BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545",
    )
    ENV_FILE.write_text(text, encoding="utf-8")
    log("SETUP", "Created .env from .env.example (local RPC URL).")


def marker_path(name: str) -> Path:
    MARKER_DIR.mkdir(exist_ok=True)
    return MARKER_DIR / f"{name}.ok"


def pip_deps_ok(req_file: Path, import_name: str) -> bool:
    if not req_file.is_file():
        return True
    marker = marker_path(f"pip-{req_file.parent.name}")
    try:
        if marker.stat().st_mtime >= req_file.stat().st_mtime:
            __import__(import_name)
            return True
    except (OSError, ImportError):
        pass
    return False


def install_pip(req_file: Path, import_name: str, label: str) -> None:
    if pip_deps_ok(req_file, import_name):
        log("SETUP", f"{label} Python deps OK")
        return
    log("SETUP", f"Installing {label} Python deps into venv…")
    subprocess.run(
        [str(PYTHON), "-m", "pip", "install", "-q", "-r", str(req_file)],
        cwd=req_file.parent,
        check=True,
        env=venv_env(),
    )
    __import__(import_name)
    marker_path(f"pip-{req_file.parent.name}").write_text("ok", encoding="utf-8")
    log("SETUP", f"{label} Python deps installed")


def install_npm(project_dir: Path, label: str) -> None:
    nm = project_dir / "node_modules"
    pkg = project_dir / "package.json"
    if not pkg.is_file():
        return
    marker = marker_path(f"npm-{project_dir.name}")
    if nm.is_dir() and marker.is_file() and marker.stat().st_mtime >= pkg.stat().st_mtime:
        log("SETUP", f"{label} npm deps OK")
        return
    log("SETUP", f"Installing {label} npm deps…")
    subprocess.run(["npm", "install", "--silent"], cwd=project_dir, check=True, shell=os.name == "nt")
    marker.write_text("ok", encoding="utf-8")
    log("SETUP", f"{label} npm deps installed")


def install_all(skip: bool) -> None:
    if skip:
        log("SETUP", "Skipping dependency checks (--skip-install)")
        return
    which_or_die("node")
    which_or_die("npm")
    which_or_die("npx")
    ensure_env_file()
    install_pip(ROOT / "server" / "requirements.txt", "fastapi", "server")
    install_pip(ROOT / "node" / "requirements.txt", "websockets", "node")
    install_npm(ROOT / "frontend", "frontend")
    install_npm(ROOT / "blockchain", "blockchain")


def wait_for_rpc(url: str, timeout: float = 90.0) -> bool:
    payload = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}
    ).encode()
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.4)
    return False


def wait_for_http(url: str, timeout: float = 90.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if 200 <= resp.status < 500:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.4)
    return False


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def pids_listening_on(port: int) -> list[int]:
    """Return PIDs with a LISTEN socket on the given local port."""
    found: set[int] = set()
    if os.name == "nt":
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        # TCP    127.0.0.1:8545    0.0.0.0:0    LISTENING    12345
        pat = re.compile(rf":{port}\s")
        for line in result.stdout.splitlines():
            if "LISTENING" not in line:
                continue
            if not pat.search(line):
                continue
            parts = line.split()
            if not parts:
                continue
            try:
                found.add(int(parts[-1]))
            except ValueError:
                continue
    else:
        result = subprocess.run(
            ["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
            check=False,
        )
        for token in result.stdout.split():
            try:
                found.add(int(token.strip()))
            except ValueError:
                continue
    return sorted(found)


def kill_process_tree(pid: int) -> bool:
    """Terminate a process and its children. Never kills the current dev.py PID."""
    if pid <= 0 or pid == os.getpid():
        return False
    if os.name == "nt":
        r = subprocess.run(
            ["taskkill", "/PID", str(pid), "/F", "/T"],
            capture_output=True,
            text=True,
            check=False,
        )
        return r.returncode == 0
    r = subprocess.run(["kill", "-TERM", str(pid)], capture_output=True, check=False)
    if r.returncode != 0:
        subprocess.run(["kill", "-9", str(pid)], capture_output=True, check=False)
    return True


def kill_stray_backend_workers() -> None:
    """Stop leftover uvicorn/FastAPI processes that may keep SQLite open."""
    my_pid = os.getpid()
    if os.name == "nt":
        script = (
            "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
            "Where-Object { "
            "$_.CommandLine -match 'uvicorn' -and "
            "($_.CommandLine -match 'app\\.main' -or $_.CommandLine -match 'app/main') "
            "} | Select-Object -ExpandProperty ProcessId"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            check=False,
        )
        pids = [int(x) for x in result.stdout.split() if x.strip().isdigit()]
    else:
        result = subprocess.run(
            ["pgrep", "-f", "uvicorn.*app\\.main"],
            capture_output=True,
            text=True,
            check=False,
        )
        pids = [int(x) for x in result.stdout.split() if x.strip().isdigit()]
    for pid in pids:
        if pid == my_pid:
            continue
        log("SETUP", f"Stopping stray backend worker (PID {pid})")
        kill_process_tree(pid)


def kill_stray_node_workers() -> None:
    """Stop leftover simulated node.py processes from prior dev sessions."""
    my_pid = os.getpid()
    if os.name == "nt":
        script = (
            "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
            "Where-Object { $_.CommandLine -match 'node\\.py' } | "
            "Select-Object -ExpandProperty ProcessId"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            check=False,
        )
        pids = [int(x) for x in result.stdout.split() if x.strip().isdigit()]
    else:
        result = subprocess.run(
            ["pgrep", "-f", "node\\.py"],
            capture_output=True,
            text=True,
            check=False,
        )
        pids = [int(x) for x in result.stdout.split() if x.strip().isdigit()]
    for pid in pids:
        if pid == my_pid:
            continue
        log("SETUP", f"Stopping stray node worker (PID {pid})")
        kill_process_tree(pid)


def free_stack_ports() -> set[int]:
    """Kill prior local dev sessions bound to stack ports. Returns ports that were freed."""
    log("SETUP", "Stopping any prior stack sessions on :8545, :8000, :5173 …")
    my_pid = os.getpid()
    killed_ports: set[int] = set()
    for port, label in STACK_PORTS.items():
        for pid in pids_listening_on(port):
            if pid == my_pid:
                continue
            log("SETUP", f"Stopping {label} on :{port} (PID {pid})")
            if kill_process_tree(pid):
                killed_ports.add(port)
    kill_stray_node_workers()
    kill_stray_backend_workers()
    if killed_ports:
        time.sleep(1.2)
    else:
        time.sleep(0.5)
    busy = [f":{p} ({name})" for p, name in STACK_PORTS.items() if not port_free(p)]
    if busy:
        log("SETUP", f"WARNING: ports still in use after cleanup: {', '.join(busy)}")
    return killed_ports


def sqlite_db_path(env: dict[str, str]) -> Path | None:
    url = env.get("DATABASE_URL", "sqlite:///./c2.db")
    if not url.startswith("sqlite"):
        return None
    raw = url.removeprefix("sqlite:///")
    if raw.startswith("./"):
        return (ROOT / "server" / raw[2:]).resolve()
    if len(raw) > 2 and raw[1] == ":":
        return Path(raw)
    return Path(raw)


def sqlite_sidecar_files(db: Path) -> list[Path]:
    """WAL/SHM files SQLite may leave beside the main database."""
    return [db, Path(f"{db}-wal"), Path(f"{db}-shm")]


def unlink_db_files(db: Path, *, attempts: int = 8) -> bool:
    """Remove SQLite database and sidecars; retry while another process releases the lock."""
    targets = sqlite_sidecar_files(db)
    for attempt in range(attempts):
        missing = [p for p in targets if p.is_file()]
        if not missing:
            return True
        try:
            for path in missing:
                path.unlink(missing_ok=True)
            return True
        except PermissionError:
            if attempt == 0:
                kill_stray_backend_workers()
            elif attempt == 1:
                free_stack_ports()
            wait = 0.4 + attempt * 0.35
            log(
                "SETUP",
                f"Database locked — waiting {wait:.1f}s before retry "
                f"({attempt + 1}/{attempts})",
            )
            time.sleep(wait)
        except OSError as exc:
            log("SETUP", f"Could not remove database ({exc})")
            return False
    log(
        "SETUP",
        f"ERROR: could not delete {db} — close other dev.py/uvicorn sessions and retry",
    )
    return False


def ensure_fresh_db(env: dict[str, str]) -> None:
    """Drop SQLite DB when schema is from an older revision (e.g. agent → node rename)."""
    db = sqlite_db_path(env)
    if db is None or not db.is_file():
        return
    stale = False
    try:
        conn = sqlite3.connect(db)
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        if "agents" in tables:
            stale = True
        if "missions" in tables:
            cols = {row[1] for row in conn.execute("PRAGMA table_info(missions)")}
            if "target_node_ids" not in cols:
                stale = True
        if "nodes" in tables:
            cols = {row[1] for row in conn.execute("PRAGMA table_info(nodes)")}
            if "policy_id" not in cols or "alias" not in cols or "public_key" not in cols:
                stale = True
            if "iot_snapshot" not in cols:
                stale = True
        if "tasks" in tables:
            cols = {row[1] for row in conn.execute("PRAGMA table_info(tasks)")}
            if "node_id" not in cols and "agent_id" in cols:
                stale = True
            if "policy_decision" not in cols:
                stale = True
        if "missions" in tables:
            cols = {row[1] for row in conn.execute("PRAGMA table_info(missions)")}
            if "merkle_root" not in cols:
                stale = True
        conn.close()
    except sqlite3.Error as exc:
        log("SETUP", f"Unreadable database ({exc}) — will reset")
        stale = True
    if stale:
        log("SETUP", f"Resetting stale database: {db}")
        kill_stray_backend_workers()
        time.sleep(0.8)
        if not unlink_db_files(db):
            log(
                "SETUP",
                "Continuing with existing database — schema migration may fail; "
                "use --keep-db or stop other stack processes",
            )


def check_ports() -> None:
    """Legacy alias — use free_stack_ports()."""
    free_stack_ports()


def spawn(
    tag: str,
    cmd: list[str],
    cwd: Path,
    env: dict[str, str] | None = None,
    *,
    shell: bool | None = None,
) -> subprocess.Popen[str]:
    use_shell = shell if shell is not None else os.name == "nt"
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=use_shell,
        creationflags=creationflags,
    )
    PROCS.append(proc)

    def pump() -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            if STOPPING:
                break
            print(f"[{tag}] {line.rstrip()}", flush=True)

    threading.Thread(target=pump, daemon=True).start()
    return proc


def deploy_contract(env: dict[str, str], force: bool) -> None:
    if DEPLOYMENT_JSON.is_file() and not force:
        try:
            data = json.loads(DEPLOYMENT_JSON.read_text(encoding="utf-8"))
            addr = data.get("address", "")
            if addr:
                log("CHAIN", f"Contract already deployed at {addr} (deployment.json)")
                return
        except (json.JSONDecodeError, OSError):
            pass

    log("CHAIN", "Deploying ExecutionLedger contract…")
    result = subprocess.run(
        ["npx", "hardhat", "run", "scripts/deploy.ts", "--network", "localhost"],
        cwd=ROOT / "blockchain",
        env=env,
        capture_output=True,
        text=True,
        shell=os.name == "nt",
    )
    if result.returncode != 0:
        log("CHAIN", "Deploy failed:")
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        return
    for line in result.stdout.splitlines():
        log("CHAIN", line)
    if DEPLOYMENT_JSON.is_file():
        addr = json.loads(DEPLOYMENT_JSON.read_text(encoding="utf-8")).get("address", "")
        if addr:
            log("CHAIN", f"Contract ready: {addr}")


def shutdown(*_args: object) -> None:
    global STOPPING
    if STOPPING:
        return
    STOPPING = True
    banner("DEV", "Shutting down… (Ctrl+C again to force)")
    for proc in reversed(PROCS):
        if proc.poll() is None:
            try:
                proc.terminate()
            except (ProcessLookupError, OSError):
                pass
    time.sleep(0.8)
    for proc in PROCS:
        if proc.poll() is None:
            proc.kill()
    sys.exit(0)


def print_urls(node_count: int) -> None:
    banner("DEV", "Stack is up — open these URLs")
    print(f"  Dashboard     {URLS['dashboard']}")
    print(f"  API           {URLS['api']}")
    print(f"  API docs      {URLS['api_docs']}")
    print(f"  Health        {URLS['health']}")
    print(f"  Chain RPC     {URLS['chain_rpc']}")
    if node_count > 0:
        print(f"  Nodes         {node_count} simulated worker(s) connected via WebSocket")
    print("\n  Press Ctrl+C to stop all services.\n", flush=True)


def main() -> None:
    global PYTHON

    parser = argparse.ArgumentParser(description="Start the full Aligo C2 dev stack")
    parser.add_argument("--skip-install", action="store_true", help="skip dependency install")
    parser.add_argument("--no-iot", action="store_true", help="do not start simulated IoT gateway")
    parser.add_argument("--no-nodes", action="store_true", help="do not start simulated computer nodes")
    parser.add_argument("--node-count", type=int, default=3, help="simulated nodes (default: 3)")
    parser.add_argument("--redeploy", action="store_true", help="redeploy smart contract")
    parser.add_argument(
        "--no-kill",
        action="store_true",
        help="do not stop processes already using stack ports",
    )
    parser.add_argument(
        "--keep-db",
        action="store_true",
        help="keep SQLite DB even if schema looks stale",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    banner("DEV", "Aligo Mission Ledger C2 — starting local stack")
    PYTHON = ensure_venv_python()
    log("SETUP", f"Python: {PYTHON}")
    install_all(args.skip_install)
    env = venv_env(load_env())
    freed_ports: set[int] = set()
    if not args.no_kill:
        freed_ports = free_stack_ports()
    if not args.keep_db:
        ensure_fresh_db(env)

    # 1) Blockchain
    log("CHAIN", "Starting Hardhat node on :8545…")
    spawn(
        "CHAIN",
        ["npx", "hardhat", "node", "--hostname", "127.0.0.1"],
        ROOT / "blockchain",
        env,
    )
    if not wait_for_rpc(env["BLOCKCHAIN_RPC_URL"]):
        log("CHAIN", "ERROR: Hardhat node did not become ready in time")
        shutdown()
    log("CHAIN", "Hardhat node ready")

    deploy_contract(env, force=args.redeploy or 8545 in freed_ports)

    # 2) Backend
    log("BACK", "Starting FastAPI server on :8000…")
    server_env = env.copy()
    server_env.setdefault("DATABASE_URL", "sqlite:///./c2.db")
    spawn(
        "BACK",
        [
            str(PYTHON),
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--reload",
        ],
        ROOT / "server",
        server_env,
    )
    if not wait_for_http(URLS["health"]):
        log("BACK", "ERROR: API did not become ready in time")
        shutdown()
    log("BACK", "API ready")

    # 3) Frontend
    log("FRONT", "Starting Vite dev server on :5173…")
    spawn(
        "FRONT",
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
        ROOT / "frontend",
        env,
    )
    if not wait_for_http(URLS["dashboard"]):
        log("FRONT", "WARNING: dashboard not responding yet (may still be compiling)")

    # 4) Simulated nodes
    node_count = 0 if args.no_nodes else max(0, args.node_count)
    if node_count > 0:
        log("NODE", f"Starting {node_count} simulated node(s)…")
        node_env = env.copy()
        spawn(
            "NODE",
            [str(PYTHON), "node.py", "--simulate-count", str(node_count)],
            ROOT / "node",
            node_env,
        )
        time.sleep(1.5)

    if not args.no_iot:
        log("IOT", "Starting simulated IoT gateway (gateway-sim-001)…")
        iot_env = env.copy()
        spawn(
            "IOT",
            [str(PYTHON), "iot_gateway.py", "--gateway-id", "gateway-sim-001"],
            ROOT / "node",
            iot_env,
        )
        time.sleep(1.0)

    print_urls(node_count)

    try:
        while True:
            time.sleep(1)
            for proc in PROCS:
                if proc.poll() is not None:
                    log("DEV", f"A process exited with code {proc.returncode}. Stopping stack.")
                    shutdown()
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
