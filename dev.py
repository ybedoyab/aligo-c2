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
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

# NOTE: `lab_tls` pulls in `cryptography`, which is installed into ./venv by
# install_all(). It is imported lazily (inside the functions that need it) so a
# fresh launcher/venv can bootstrap dev.py — the top of this file stays stdlib-only.

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
    "agent": "http://localhost:8100/health",
    "chain_rpc": "http://localhost:8545",
}

URLS_TLS = {
    "dashboard": "https://127.0.0.1:5173",
    "api": "https://127.0.0.1:8000",
    "api_docs": "https://127.0.0.1:8000/docs",
    "health": "https://127.0.0.1:8000/health",
    "agent": "http://127.0.0.1:8100/health",
    "chain_rpc": "http://localhost:8545",
}

STACK_PORTS: dict[int, str] = {
    8545: "blockchain",
    8000: "backend",
    8100: "agent",
    5173: "frontend",
}

PROCS: list[tuple[str, subprocess.Popen[str]]] = []
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
        if os.name == "nt":
            # Windows os.execv does NOT replace the process in place — it leaves the
            # original interpreter as a stub, and the console delivers Ctrl+C to that
            # stub instead of the re-exec'd worker that owns the shutdown handler
            # (the stack then can't be stopped). Instead, run the venv python as a
            # child in this same console and wait on it: SIGINT reaches the child
            # cleanly while this supervisor ignores it and just forwards the exit code.
            signal.signal(signal.SIGINT, signal.SIG_IGN)
            child = subprocess.Popen([str(vp), *sys.argv])
            while True:
                try:
                    sys.exit(child.wait())
                except KeyboardInterrupt:
                    # Belt-and-suspenders: ignore here too; the child handles shutdown.
                    continue
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
    if os.name == "nt":
        # En Windows, evitar que shutil.which devuelva el script bash
        # sin extensión que el instalador de Node coloca para Cygwin/Git Bash.
        for ext in (".cmd", ".exe", ".bat"):
            found = shutil.which(name + ext)
            if found:
                return found
    found = shutil.which(name)
    if not found:
        die(f"'{name}' not found in PATH")
    return found


def load_env(*, use_tls: bool) -> dict[str, str]:
    env = os.environ.copy()
    if ENV_FILE.is_file():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    env["BLOCKCHAIN_RPC_URL"] = "http://127.0.0.1:8545"
    env.setdefault("NODE_SHARED_TOKEN", "change-me-lab-token")
    if use_tls:
        from lab_tls import ensure_lab_certs  # lazy: needs cryptography from venv

        cert, key = ensure_lab_certs()
        env["SSL_CERTFILE"] = str(cert)
        env["SSL_KEYFILE"] = str(key)
        env["C2_WS_URL"] = "wss://127.0.0.1:8000/ws/node"
        env["FRONTEND_URL"] = "https://127.0.0.1:5173"
        env["VITE_DEV_TLS"] = "true"
        env["VITE_API_URL"] = ""
    else:
        env.setdefault("C2_WS_URL", "ws://127.0.0.1:8000/ws/node")
    return env


def _http_opener(url: str) -> urllib.request.OpenerDirector:
    if url.startswith("https:"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
    return urllib.request.build_opener()


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
    npm = which_or_die("npm")
    subprocess.run([npm, "install", "--silent"], cwd=project_dir, check=True, shell=False)
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
    install_pip(ROOT / "agents" / "orchestrator" / "requirements.txt", "langgraph", "agent")
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
    opener = _http_opener(url)
    while time.time() < deadline:
        try:
            with opener.open(url, timeout=2) as resp:
                if 200 <= resp.status < 500:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.4)
    return False


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            check=False,
        )
        return str(pid) in result.stdout
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def ensure_port_free(port: int, label: str) -> None:
    """Kill listeners and abort startup if a stack port stays busy."""
    for attempt in range(5):
        if port_free(port):
            return
        for pid in pids_listening_on(port):
            if pid == os.getpid():
                continue
            log("SETUP", f"Stopping {label} on :{port} (PID {pid})")
            kill_process_tree(pid)
        if port == 8000:
            kill_stray_backend_workers()
        time.sleep(0.8 + attempt * 0.4)
    busy = [pid for pid in pids_listening_on(port) if _pid_alive(pid)]
    if port_free(port):
        return
    log(
        "SETUP",
        f"ERROR: port :{port} ({label}) still in use"
        + (f" (PIDs: {', '.join(map(str, busy))})" if busy else ""),
    )
    shutdown()


def wait_for_backend(
    proc: subprocess.Popen[str],
    url: str,
    *,
    expected_nonce: str,
    timeout: float = 90.0,
) -> bool:
    """Wait until our uvicorn child is listening — ignore stale servers on the same port."""
    opener = _http_opener(url)
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            log("BACK", f"Backend exited with code {proc.returncode} before ready")
            return False
        try:
            with opener.open(url, timeout=2) as resp:
                if not (200 <= resp.status < 500):
                    continue
                body = json.loads(resp.read().decode("utf-8"))
                if body.get("startup_nonce") != expected_nonce:
                    continue
                if proc.poll() is None:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            pass
        time.sleep(0.4)
    log("BACK", "Backend did not become ready in time")
    return False


def port_free(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False


def pids_listening_on(port: int) -> list[int]:
    """Return PIDs with a LISTEN socket on the given local port."""
    found: set[int] = set()
    if os.name == "nt":
        ps_script = (
            f"Get-NetTCPConnection -LocalPort {port} -State Listen "
            f"-ErrorAction SilentlyContinue | "
            f"Select-Object -ExpandProperty OwningProcess -Unique"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        for token in result.stdout.split():
            try:
                pid = int(token.strip())
                if pid > 0:
                    found.add(pid)
            except ValueError:
                continue
        alive = [pid for pid in found if _pid_alive(pid)]
        if alive:
            return sorted(alive)
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
    return sorted(pid for pid in found if _pid_alive(pid))


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
    shell: bool = False,
) -> subprocess.Popen[str]:
    """Launch a child process. Default shell=False (required for paths with spaces/commas on Windows)."""
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=shell,
        creationflags=creationflags,
    )
    PROCS.append((tag, proc))

    def pump() -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            if STOPPING:
                break
            print(f"[{tag}] {line.rstrip()}", flush=True)

    threading.Thread(target=pump, daemon=True).start()
    return proc


def _rpc_has_contract_bytecode(rpc_url: str, address: str) -> bool:
    """Return True when bytecode exists at address on the live chain."""
    try:
        payload = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "eth_getCode",
                "params": [address, "latest"],
                "id": 1,
            }
        ).encode()
        req = urllib.request.Request(
            rpc_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            result = json.loads(resp.read()).get("result", "0x")
        return bool(result and result not in ("0x", "0x0") and len(result) > 4)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return False


def deploy_contract(env: dict[str, str], force: bool) -> None:
    rpc = env.get("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
    if DEPLOYMENT_JSON.is_file() and not force:
        try:
            data = json.loads(DEPLOYMENT_JSON.read_text(encoding="utf-8"))
            addr = data.get("address", "")
            if addr and _rpc_has_contract_bytecode(rpc, addr):
                log(
                    "CHAIN",
                    f"Contract already deployed at {addr} (bytecode present on chain)",
                )
                return
            if addr:
                log(
                    "CHAIN",
                    f"No bytecode at {addr} — Hardhat chain was reset; redeploying…",
                )
        except (json.JSONDecodeError, OSError):
            pass

    log("CHAIN", "Deploying ExecutionLedger contract…")
    npx = which_or_die("npx")
    result = subprocess.run(
        [npx, "hardhat", "run", "scripts/deploy.ts", "--network", "localhost"],
        cwd=ROOT / "blockchain",
        env=env,
        capture_output=True,
        text=True,
        shell=False,
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
    banner("DEV", "Shutting down…")
    # Kill each managed process AND its child tree. terminate()/kill() only reach
    # the immediate child; services like vite (→ node), hardhat (→ node) and uvicorn
    # spawn grandchildren that would otherwise survive and hold ports. On Windows
    # `taskkill /F /T` (via kill_process_tree) tears down the whole tree at once.
    for _, proc in reversed(PROCS):
        if proc.poll() is None:
            if os.name == "nt":
                kill_process_tree(proc.pid)
            else:
                try:
                    proc.terminate()
                except (ProcessLookupError, OSError):
                    pass
    if os.name != "nt":
        time.sleep(0.8)
        for _, proc in PROCS:
            if proc.poll() is None:
                proc.kill()
    sys.exit(0)


def print_urls(node_count: int) -> None:
    banner("DEV", "Stack is up — open these URLs")
    print(f"  Dashboard     {URLS['dashboard']}")
    print(f"  API           {URLS['api']}")
    print(f"  API docs      {URLS['api_docs']}")
    print(f"  Health        {URLS['health']}")
    print(f"  Agent         {URLS['agent']}  (Console -> Ask AI)")
    print(f"  Chain RPC     {URLS['chain_rpc']}")
    if node_count > 0:
        transport = "WSS (TLS)" if URLS["api"].startswith("https") else "WebSocket"
        print(f"  Nodes         {node_count} simulated worker(s) via {transport}")
    if URLS["dashboard"].startswith("https"):
        print("  TLS           lab self-signed — accept browser warning on first open")
    print("\n  Press Ctrl+C to stop all services.\n", flush=True)


def main() -> None:
    global PYTHON

    # Never let a stray non-ASCII char in a log line crash the launcher: on Windows
    # stdout defaults to cp1252 (esp. when piped), which can't encode chars like
    # the arrow U+2192 used in some log lines.
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError):
            pass

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
    parser.add_argument(
        "--no-tls",
        action="store_true",
        help="use plain HTTP/WS instead of HTTPS/WSS (debug only)",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    use_tls = not args.no_tls
    global URLS
    if use_tls:
        URLS = dict(URLS_TLS)

    banner("DEV", "Aligo Mission Ledger C2 — starting local stack")
    PYTHON = ensure_venv_python()
    log("SETUP", f"Python: {PYTHON}")
    install_all(args.skip_install)
    if use_tls:
        from lab_tls import ensure_lab_certs  # lazy: cryptography is now installed in venv

        cert_path, key_path = ensure_lab_certs()
        log("SETUP", f"TLS lab cert ready ({cert_path.name})")
    env = venv_env(load_env(use_tls=use_tls))
    freed_ports: set[int] = set()
    if not args.no_kill:
        freed_ports = free_stack_ports()
    if not args.keep_db:
        ensure_fresh_db(env)

    # 1) Blockchain
    log("CHAIN", "Starting Hardhat node on :8545…")
    npx = which_or_die("npx")
    spawn(
        "CHAIN",
        [npx, "hardhat", "node", "--hostname", "127.0.0.1"],
        ROOT / "blockchain",
        env,
    )
    if not wait_for_rpc(env["BLOCKCHAIN_RPC_URL"]):
        log("CHAIN", "ERROR: Hardhat node did not become ready in time")
        shutdown()
    log("CHAIN", "Hardhat node ready")

    deploy_contract(env, force=args.redeploy or 8545 in freed_ports)

    # 2) Backend
    ensure_port_free(8000, "backend")
    log("BACK", "Starting FastAPI server on :8000…")
    server_env = env.copy()
    server_env.setdefault("DATABASE_URL", "sqlite:///./c2.db")
    startup_nonce = uuid.uuid4().hex
    server_env["DEV_STARTUP_NONCE"] = startup_nonce
    back_cmd = [
        str(PYTHON),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]
    if use_tls:
        back_cmd.extend(
            ["--ssl-keyfile", server_env["SSL_KEYFILE"], "--ssl-certfile", server_env["SSL_CERTFILE"]]
        )
        log("BACK", "Channel encryption: HTTPS + WSS (lab self-signed)")
    back_proc = spawn("BACK", back_cmd, ROOT / "server", server_env, shell=False)
    if not wait_for_backend(back_proc, URLS["health"], expected_nonce=startup_nonce):
        log("BACK", "ERROR: API did not become ready in time")
        shutdown()
    log("BACK", "API ready")

    # 2b) Agent (AI orchestrator) — a pure client of the C2 REST/WS surface.
    ensure_port_free(8100, "agent")
    log("AGENT", "Starting AI orchestrator on :8100…")
    agent_env = env.copy()
    if use_tls:
        agent_env["C2_BASE_URL"] = "https://127.0.0.1:8000"
        agent_env["C2_WS_URL"] = "wss://127.0.0.1:8000/ws/operator"
        agent_env["C2_VERIFY_TLS"] = "false"  # accept the self-signed lab cert
    else:
        agent_env["C2_BASE_URL"] = "http://127.0.0.1:8000"
        agent_env["C2_WS_URL"] = "ws://127.0.0.1:8000/ws/operator"
        agent_env["C2_VERIFY_TLS"] = "true"
    if not agent_env.get("ANTHROPIC_API_KEY"):
        log("AGENT", "WARNING: ANTHROPIC_API_KEY not set — chat path will be disabled "
                     "until you add it to .env (manual console still works).")
    spawn(
        "AGENT",
        [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8100"],
        ROOT / "agents" / "orchestrator",
        agent_env,
        shell=False,
    )
    if not wait_for_http("http://127.0.0.1:8100/health"):
        log("AGENT", "WARNING: agent backend not responding yet (chat may be unavailable)")
    else:
        log("AGENT", "Agent ready")

    # 3) Frontend
    ensure_port_free(5173, "frontend")
    log("FRONT", "Starting Vite dev server on :5173…")
    npm = which_or_die("npm")
    front_env = env.copy()
    if not use_tls:
        # Without TLS the Vite proxy block is inactive; point the browser at the
        # agent backend directly (its CORS already allows the http dev origin).
        front_env["VITE_AGENT_URL"] = "http://127.0.0.1:8100"
    spawn(
        "FRONT",
        [npm, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
        ROOT / "frontend",
        front_env,
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
            for tag, proc in PROCS:
                code = proc.poll()
                if code is not None:
                    log(
                        "DEV",
                        f"Process [{tag}] exited with code {code}. Stopping stack.",
                    )
                    shutdown()
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
