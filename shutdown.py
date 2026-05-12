"""
Emergency shutdown — kills any process listening on a port that the launcher
manages, plus the launcher itself.

Run this when Ctrl+C spam left orphaned processes behind:

    python shutdown.py

Strategy:
  1. Build the list of ports from service_defs.py (single source of truth).
  2. For each port, ask `lsof` what PID(s) own it.
  3. Send SIGTERM. Wait briefly. Anyone still alive gets SIGKILL.

Requires `lsof` (preinstalled on macOS/Linux).
"""

import os
import signal
import subprocess
import sys
import time
from typing import Dict, List, Set

from service_defs import SERVICE_DEFS

LAUNCHER_PORT = int(os.environ.get("LAUNCHER_PORT", 8010))
GRACE_SECONDS = 2.0


def collect_ports() -> List[int]:
    ports: Set[int] = {LAUNCHER_PORT}
    for defn in SERVICE_DEFS.values():
        if "port" in defn:
            ports.add(defn["port"])
        for step in defn.get("steps", []) or []:
            if "port" in step:
                ports.add(step["port"])
    return sorted(ports)


def pids_on_port(port: int) -> List[int]:
    try:
        out = subprocess.check_output(
            ["lsof", "-ti", f":{port}"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        print("❌ `lsof` not found — install it or kill manually.", file=sys.stderr)
        sys.exit(2)
    except subprocess.CalledProcessError:
        return []
    return [int(p) for p in out.split() if p.strip().isdigit()]


def is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def signal_pid(pid: int, sig: int) -> None:
    try:
        os.kill(pid, sig)
    except ProcessLookupError:
        pass
    except PermissionError:
        print(f"   ⚠️  permission denied for PID {pid}")


def main() -> int:
    ports = collect_ports()
    print(f"🔍 Scanning {len(ports)} managed ports for survivors...")

    pid_to_ports: Dict[int, List[int]] = {}
    for port in ports:
        for pid in pids_on_port(port):
            pid_to_ports.setdefault(pid, []).append(port)

    if not pid_to_ports:
        print("✅ Nothing alive on managed ports. You're good.")
        return 0

    print(f"🛑 Found {len(pid_to_ports)} process(es):")
    for pid, owned in sorted(pid_to_ports.items()):
        print(f"   PID {pid:>6}  ports {owned}")

    print(f"→ SIGTERM, waiting {GRACE_SECONDS}s for graceful exit...")
    for pid in pid_to_ports:
        signal_pid(pid, signal.SIGTERM)
    time.sleep(GRACE_SECONDS)

    survivors = [pid for pid in pid_to_ports if is_alive(pid)]
    if survivors:
        print(f"⚠️  {len(survivors)} still alive — SIGKILL.")
        for pid in survivors:
            signal_pid(pid, signal.SIGKILL)
        time.sleep(0.3)

    leftover = [pid for pid in pid_to_ports if is_alive(pid)]
    if leftover:
        print(f"❌ Could not kill: {leftover}. Try `sudo kill -9 {' '.join(map(str, leftover))}`.")
        return 1

    print("✅ All clear.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
