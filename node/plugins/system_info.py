"""system_info plugin: report safe, local system facts."""

from __future__ import annotations

import getpass
import os
import platform
import socket
import sys
from typing import Any


def _total_memory_mb() -> int | None:
    """Best-effort total physical memory in MB, cross-platform, no extra deps."""
    try:
        if hasattr(os, "sysconf") and "SC_PHYS_PAGES" in os.sysconf_names:
            pages = os.sysconf("SC_PHYS_PAGES")
            page_size = os.sysconf("SC_PAGE_SIZE")
            return int(pages * page_size / (1024 * 1024))
    except (ValueError, OSError):
        pass
    try:  # Windows fallback via ctypes
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))  # type: ignore[attr-defined]
        return int(stat.ullTotalPhys / (1024 * 1024))
    except Exception:
        return None


def run(args: dict[str, Any]) -> dict[str, Any]:
    return {
        "os": platform.system(),
        "os_release": platform.release(),
        "os_version": platform.version(),
        "platform": platform.platform(),
        "hostname": socket.gethostname(),
        "username": getpass.getuser(),
        "python_version": sys.version.split()[0],
        "cpu_count": os.cpu_count(),
        "total_memory_mb": _total_memory_mb(),
        "architecture": platform.machine(),
    }
