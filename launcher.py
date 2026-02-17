"""
Nami Launcher — Process Manager

Lives in director_ui/ and manages services in sibling folders.
Started automatically by `npm start` — you never need to run this manually.

Port: 8003
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

UI_DIR      = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR  = os.path.dirname(UI_DIR)

PROMPT_SERVICE_DIR  = os.path.join(PARENT_DIR, "prompt_service")
PROMPT_SERVICE_MAIN = os.path.join(PROMPT_SERVICE_DIR, "main.py")

LAUNCHER_PORT = 8003

SERVICE_DEFS: Dict[str, Dict[str, Any]] = {
    "prompt_service": {
        "label":       "Prompt Service",
        "description": "Speech gate — controls when Nami speaks",
        "cmd":         [sys.executable, PROMPT_SERVICE_MAIN],
        "cwd":         PROMPT_SERVICE_DIR,
        "port":        8001,
        "health_url":  "http://localhost:8001/health",
        "managed":     True,
    },
    "director": {
        "label":       "Director Engine",
        "description": "Brain — drives directives, scoring, and state",
        "port":        8002,
        "health_url":  "http://localhost:8002/health",
        "managed":     False,
    },
    "nami": {
        "label":       "Nami",
        "description": "LLM + TTS — the voice",
        "port":        8000,
        "health_url":  "http://localhost:8000/health",
        "managed":     False,
    },
}

_procs:    Dict[str, Optional[subprocess.Popen]] = {k: None for k in SERVICE_DEFS}
_logs:     Dict[str, deque]                       = {k: deque(maxlen=400) for k in SERVICE_DEFS}
_starting: set                                     = set()
_stopping: set                                     = set()
http_client: Optional[httpx.AsyncClient] = None


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

async def _health_check(url: str, timeout: float = 2.0) -> bool:
    global http_client
    if not http_client:
        return False
    try:
        r = await http_client.get(url, timeout=timeout)
        return r.status_code < 500
    except Exception:
        return False

async def _wait_for_health(name: str, retries: int = 20, interval: float = 0.5) -> bool:
    url = SERVICE_DEFS[name]["health_url"]
    for _ in range(retries):
        if await _health_check(url):
            return True
        await asyncio.sleep(interval)
    return False


async def start_service(name: str) -> Dict[str, Any]:
    defn = SERVICE_DEFS.get(name)
    if not defn:
        raise HTTPException(404, f"Unknown service: {name}")
    if not defn.get("managed"):
        raise HTTPException(400, f"Service '{name}' is not managed")
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

    try:
        p = subprocess.Popen(
            defn["cmd"],
            cwd=defn.get("cwd", UI_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
        )
        _procs[name] = p
        threading.Thread(target=_stream_output, args=(name, p.stdout), daemon=True).start()

        healthy = await _wait_for_health(name)
        if healthy:
            _append_log(name, f"✅ {defn['label']} healthy on port {defn['port']}")
            return {"ok": True, "pid": p.pid}
        elif p.poll() is not None:
            _append_log(name, f"❌ Process exited with code {p.returncode}")
            _procs[name] = None
            return {"ok": False, "reason": "process_died", "code": p.returncode}
        else:
            _append_log(name, "⚠️ Running but health check timed out")
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
        raise HTTPException(400, f"Service '{name}' is not managed")

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
            p.kill()
            await asyncio.sleep(0.2)
        code = p.returncode
        _procs[name] = None
        _append_log(name, f"✅ Stopped (exit code {code})")
        return {"ok": True, "code": code}
    except Exception as e:
        _append_log(name, f"❌ Error stopping: {e}")
        return {"ok": False, "reason": str(e)}
    finally:
        _stopping.discard(name)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient()
    print(f"🚀 Launcher ready on :{LAUNCHER_PORT}")
    print(f"   prompt_service → {PROMPT_SERVICE_MAIN}")
    print(f"   exists: {os.path.exists(PROMPT_SERVICE_MAIN)}")
    yield
    for name, p in _procs.items():
        if p and p.poll() is None:
            p.terminate()
    await http_client.aclose()


app = FastAPI(title="Nami Launcher", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/launcher/services")
async def list_services():
    result = []
    for name, defn in SERVICE_DEFS.items():
        alive   = _proc_alive(name)
        healthy = await _health_check(defn["health_url"])
        if name in _starting:   status = "starting"
        elif name in _stopping: status = "stopping"
        elif healthy:           status = "online"
        elif alive:             status = "unhealthy"
        else:                   status = "offline"
        result.append({
            "id": name, "label": defn["label"],
            "description": defn.get("description", ""),
            "port": defn["port"], "managed": defn.get("managed", False),
            "status": status, "pid": _procs[name].pid if alive else None,
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
async def get_logs(name: str, last: int = 100):
    if name not in SERVICE_DEFS:
        raise HTTPException(404, f"Unknown service: {name}")
    return {"lines": list(_logs[name])[-last:]}

@app.get("/launcher/health")
async def health():
    return {"status": "ok", "service": "launcher"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=LAUNCHER_PORT, log_level="warning")