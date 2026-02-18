"""
Nami Launcher — Process Manager

Lives in director_ui/ and manages services in sibling folders.
Started automatically by `npm start` — you never need to run this manually.

Port: 8010  (avoids conflict with desktop_mon_gemini WebSocket on 8003)

Health check strategy:
  - HTTP services (FastAPI):  GET /health endpoint
  - GUI/WebSocket services:   TCP port probe (asyncio.open_connection)
  - Unmanaged services:       TCP port probe
"""

import asyncio
import subprocess
import sys
import os
import time
import threading
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from collections import deque
from typing import Optional, Dict, Any
import uvicorn

# ─────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────

UI_DIR     = os.path.dirname(os.path.abspath(__file__))   # director_ui/
PARENT_DIR = os.path.dirname(UI_DIR)                       # parent folder

LAUNCHER_PORT = 8010  # Changed from 8003 to avoid conflict with desktop_mon WebSocket

# ─────────────────────────────────────────────
# Service definitions
# ─────────────────────────────────────────────
#
# health_check: "http"  → GET {health_url}, expects status < 500
#               "tcp"   → asyncio TCP connect to {host}:{port}
#

def _conda_python(env_name: str) -> str:
    """
    Resolve the Python executable for a named conda environment.
    On macOS uses python.app (framework build) so tkinter works.
    Falls back to sys.executable if the env can't be found.
    """
    # CONDA_EXE is most reliable: e.g. /Users/x/miniconda3/bin/conda
    conda_exe = os.environ.get("CONDA_EXE", "")
    if conda_exe:
        conda_root = os.path.dirname(os.path.dirname(conda_exe))
    else:
        # CONDA_PREFIX can be base (/miniconda3) or named (/miniconda3/envs/foo)
        conda_prefix = os.environ.get("CONDA_PREFIX", "")
        if conda_prefix:
            parts = conda_prefix.split(os.sep + "envs" + os.sep)
            conda_root = parts[0]  # always the miniconda3/anaconda3 root
        else:
            conda_root = os.path.expanduser("~/miniconda3")
            if not os.path.isdir(conda_root):
                conda_root = os.path.expanduser("~/anaconda3")

    env_dir = os.path.join(conda_root, "envs", env_name)
    if not os.path.isdir(env_dir):
        print(f"⚠️  Conda env '{env_name}' not found at {env_dir}, falling back to sys.executable")
        return sys.executable

    if sys.platform == "darwin":
        fw = os.path.join(env_dir, "python.app", "Contents", "MacOS", "python")
        if os.path.exists(fw):
            return fw

    for name in ("python", "python3"):
        candidate = os.path.join(env_dir, "bin", name)
        if os.path.exists(candidate):
            return candidate

    print(f"⚠️  Could not find python in conda env '{env_name}', falling back")
    return sys.executable



SERVICE_DEFS: Dict[str, Dict[str, Any]] = {
    "prompt_service": {
        "label":        "Prompt Service",
        "description":  "Speech gate — controls when Nami speaks",
        "cmd":          [sys.executable, os.path.join(PARENT_DIR, "prompt_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "prompt_service"),
        "port":         8001,
        "health_check": "http",
        "health_url":   "http://localhost:8001/health",
        "managed":      True,
    },
    "desktop_monitor": {
        "label":        "Desktop Monitor",
        "description":  "Gemini screen watcher — vision + audio transcription",
        "cmd":          [_conda_python("gemini-screen-watcher"), os.path.join(PARENT_DIR, "desktop_mon_gemini", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "desktop_mon_gemini"),
        "port":         8003,          # WebSocket port the desktop monitor opens
        "health_check": "tcp",         # No HTTP endpoint — probe the WS port instead
        "managed":      True,
    },
    "director": {
        "label":        "Director Engine",
        "description":  "Brain — drives directives, scoring, and state",
        "port":         8002,
        "health_check": "http",
        "health_url":   "http://localhost:8002/health",
        "managed":      False,
    },
    "nami": {
        "label":        "Nami",
        "description":  "LLM + TTS — the voice",
        "port":         8000,
        "health_check": "tcp",
        "managed":      False,
    },
}

# ─────────────────────────────────────────────
# Runtime state
# ─────────────────────────────────────────────

_procs:    Dict[str, Optional[subprocess.Popen]] = {k: None for k in SERVICE_DEFS}
_logs:     Dict[str, deque]                       = {k: deque(maxlen=500) for k in SERVICE_DEFS}
_starting: set                                     = set()
_stopping: set                                     = set()

http_client: Optional[httpx.AsyncClient] = None


# ─────────────────────────────────────────────
# Health check helpers
# ─────────────────────────────────────────────

async def _http_health(url: str, timeout: float = 2.0) -> bool:
    global http_client
    if not http_client:
        return False
    try:
        r = await http_client.get(url, timeout=timeout)
        return r.status_code < 500
    except Exception:
        return False


async def _tcp_health(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


async def _health_check(name: str) -> bool:
    """Dispatch to the right health check strategy for a service."""
    defn = SERVICE_DEFS[name]
    strategy = defn.get("health_check", "tcp")

    if strategy == "http":
        url = defn.get("health_url", f"http://localhost:{defn['port']}/health")
        return await _http_health(url)
    else:
        return await _tcp_health("127.0.0.1", defn["port"])


async def _wait_for_health(name: str, retries: int = 30, interval: float = 0.5) -> bool:
    """Poll until healthy or retries exhausted."""
    for _ in range(retries):
        if await _health_check(name):
            return True
        await asyncio.sleep(interval)
    return False


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _append_log(name: str, line: str) -> None:
    ts = time.strftime("%H:%M:%S")
    _logs[name].append(f"[{ts}] {line.rstrip()}")


def _stream_output(name: str, pipe) -> None:
    try:
        for raw in iter(pipe.readline, b""):
            _append_log(name, raw.decode("utf-8", errors="replace"))
    except Exception:
        pass


def _proc_alive(name: str) -> bool:
    p = _procs[name]
    return p is not None and p.poll() is None


# ─────────────────────────────────────────────
# Service control
# ─────────────────────────────────────────────

async def start_service(name: str) -> Dict[str, Any]:
    defn = SERVICE_DEFS.get(name)
    if not defn:
        raise HTTPException(404, f"Unknown service: {name}")
    if not defn.get("managed"):
        raise HTTPException(400, f"Service '{name}' is not managed by the launcher")
    if _proc_alive(name):
        return {"ok": False, "reason": "already_running"}
    if name in _starting:
        return {"ok": False, "reason": "already_starting"}

    entry = defn["cmd"][-1]
    if not os.path.exists(entry):
        msg = f"Entry point not found: {entry}"
        _append_log(name, f"❌ {msg}")
        return {"ok": False, "reason": msg}

    _starting.add(name)
    _append_log(name, f"--- Starting {defn['label']} ---")
    _append_log(name, f"    cmd: {' '.join(defn['cmd'])}")
    _append_log(name, f"    cwd: {defn.get('cwd', UI_DIR)}")

    try:
        p = subprocess.Popen(
            defn["cmd"],
            cwd=defn.get("cwd", UI_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
        )
        _procs[name] = p
        threading.Thread(
            target=_stream_output, args=(name, p.stdout), daemon=True
        ).start()

        # GUI apps take longer to start — give desktop monitor more time
        max_retries = 40 if name == "desktop_monitor" else 20
        healthy = await _wait_for_health(name, retries=max_retries)

        if healthy:
            _append_log(name, f"✅ {defn['label']} ready on port {defn['port']}")
            return {"ok": True, "pid": p.pid}
        elif p.poll() is not None:
            _append_log(name, f"❌ Process exited early (code {p.returncode})")
            _procs[name] = None
            return {"ok": False, "reason": "process_died", "code": p.returncode}
        else:
            # Still running but health check timed out — treat as running
            _append_log(name, f"⚠️ Running (PID {p.pid}) but health check timed out — may still be loading")
            return {"ok": True, "pid": p.pid, "warning": "health_timeout"}

    except Exception as e:
        _append_log(name, f"❌ Failed to start: {e}")
        _procs[name] = None
        return {"ok": False, "reason": str(e)}
    finally:
        _starting.discard(name)


async def stop_service(name: str) -> Dict[str, Any]:
    defn = SERVICE_DEFS.get(name)
    if not defn:
        raise HTTPException(404, f"Unknown service: {name}")
    if not defn.get("managed"):
        raise HTTPException(400, f"Service '{name}' is not managed by the launcher")

    p = _procs.get(name)
    if not p or p.poll() is not None:
        _procs[name] = None
        return {"ok": False, "reason": "not_running"}
    if name in _stopping:
        return {"ok": False, "reason": "already_stopping"}

    _stopping.add(name)
    _append_log(name, f"--- Stopping {defn['label']} ---")

    try:
        p.terminate()
        for _ in range(50):
            await asyncio.sleep(0.1)
            if p.poll() is not None:
                break
        else:
            _append_log(name, "Process didn't exit cleanly — killing")
            p.kill()
            await asyncio.sleep(0.3)

        code = p.returncode
        _procs[name] = None
        _append_log(name, f"✅ Stopped (exit code {code})")
        return {"ok": True, "code": code}

    except Exception as e:
        _append_log(name, f"❌ Error stopping: {e}")
        return {"ok": False, "reason": str(e)}
    finally:
        _stopping.discard(name)


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient()
    print(f"🚀 Launcher ready on :{LAUNCHER_PORT}")
    print(f"   Desktop Monitor Python: {_conda_python('gemini-screen-watcher')}")
    for name, defn in SERVICE_DEFS.items():
        if defn.get("managed"):
            entry = defn["cmd"][-1]
            exists = os.path.exists(entry)
            print(f"   {'✅' if exists else '❌'} {defn['label']:20s} → {entry}")
    yield
    for name, p in _procs.items():
        if p and p.poll() is None:
            print(f"  Stopping {name}...")
            p.terminate()
    await http_client.aclose()


app = FastAPI(title="Nami Launcher", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/launcher/services")
async def list_services():
    result = []
    for name, defn in SERVICE_DEFS.items():
        alive   = _proc_alive(name)
        healthy = await _health_check(name)

        if name in _starting:      status = "starting"
        elif name in _stopping:    status = "stopping"
        elif healthy:              status = "online"
        elif alive:                status = "unhealthy"
        else:                      status = "offline"

        result.append({
            "id":          name,
            "label":       defn["label"],
            "description": defn.get("description", ""),
            "port":        defn["port"],
            "managed":     defn.get("managed", False),
            "health_check": defn.get("health_check", "tcp"),
            "status":      status,
            "pid":         _procs[name].pid if alive else None,
        })
    return result


@app.post("/launcher/services/{name}/start")
async def start(name: str):
    return await start_service(name)


@app.post("/launcher/services/{name}/stop")
async def stop(name: str):
    return await stop_service(name)


@app.post("/launcher/services/{name}/restart")
async def restart(name: str):
    await stop_service(name)
    await asyncio.sleep(0.5)
    return await start_service(name)


@app.get("/launcher/services/{name}/logs")
async def get_logs(name: str, last: int = 150):
    if name not in SERVICE_DEFS:
        raise HTTPException(404, f"Unknown service: {name}")
    return {"lines": list(_logs[name])[-last:]}


@app.get("/launcher/health")
async def health():
    return {"status": "ok", "service": "launcher", "port": LAUNCHER_PORT}


# ─────────────────────────────────────────────
# Entry
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("🚀 LAUNCHER — Starting...")
    uvicorn.run(app, host="0.0.0.0", port=LAUNCHER_PORT, log_level="warning")