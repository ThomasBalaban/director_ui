"""
Nami Launcher — Process Manager

Lives in director_ui/ and manages services in sibling folders.
Started automatically by `npm start` — you never need to run this manually.

Port: 8010 (configurable via .env LAUNCHER_PORT)

Service defs support a `steps` list for multi-process services (e.g. YouTube Hub).
Each step is started and health-checked in order before moving to the next.
"""

import asyncio
import subprocess
import threading
import time
import os
import sys
import httpx
import uvicorn
import webbrowser
from collections import deque
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from service_defs import SERVICE_DEFS, BOOT_RETRIES, UI_DIR, conda_python

LAUNCHER_PORT = int(os.environ.get("LAUNCHER_PORT", 8010))

# Each service stores a list of Popen objects (one per step, or just one for simple services)
_procs:    Dict[str, List[subprocess.Popen]] = {k: [] for k in SERVICE_DEFS}
_logs:     Dict[str, deque]                  = {k: deque(maxlen=500) for k in SERVICE_DEFS}
_starting: set                               = set()
_stopping: set                               = set()

http_client: Optional[httpx.AsyncClient] = None

# ── Health checks ─────────────────────────────────────────────────────────────

async def _http_health(url: str, timeout: float = 2.0) -> bool:
    if not http_client:
        return False
    try:
        r = await http_client.get(url, timeout=timeout)
        r.raise_for_status()
        return True
    except Exception:
        return False


async def _tcp_health(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


async def _check(hc: str, url_or_port) -> bool:
    if hc == "http":
        return await _http_health(url_or_port)
    return await _tcp_health("127.0.0.1", url_or_port)


async def _health_check(name: str) -> bool:
    defn = SERVICE_DEFS[name]
    if defn.get("health_check") == "http":
        return await _http_health(defn.get("health_url", f"http://localhost:{defn['port']}/health"))
    return await _tcp_health("127.0.0.1", defn["port"])


async def _wait_for(hc: str, url_or_port, retries: int, interval: float = 0.5) -> bool:
    for _ in range(retries):
        if await _check(hc, url_or_port):
            return True
        await asyncio.sleep(interval)
    return False

# ── Logging ───────────────────────────────────────────────────────────────────

def _append_log(name: str, line: str) -> None:
    _logs[name].append(f"[{time.strftime('%H:%M:%S')}] {line.rstrip()}")


def _stream_output(name: str, pipe) -> None:
    try:
        for raw in iter(pipe.readline, b""):
            _append_log(name, raw.decode("utf-8", errors="replace"))
    except Exception:
        pass


def _procs_alive(name: str) -> bool:
    return any(p.poll() is None for p in _procs[name])

# ── Start a single process step ───────────────────────────────────────────────

def _launch_proc(name: str, cmd: list, cwd: str, env: dict) -> subprocess.Popen:
    proc_env = os.environ.copy()
    proc_env.update(env)
    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=proc_env,
    )
    threading.Thread(target=_stream_output, args=(name, p.stdout), daemon=True).start()
    return p

# ── Service control ───────────────────────────────────────────────────────────

async def start_service(name: str) -> Dict[str, Any]:
    defn = SERVICE_DEFS.get(name)
    if not defn:
        raise HTTPException(404, f"Unknown service: {name}")
    if not defn.get("managed"):
        raise HTTPException(400, f"Service '{name}' is not managed by the launcher")
    if _procs_alive(name):
        return {"ok": False, "reason": "already_running"}
    if name in _starting:
        return {"ok": False, "reason": "already_starting"}

    _starting.add(name)
    _procs[name] = []
    _append_log(name, f"--- Starting {defn['label']} ---")

    steps = defn.get("steps")

    try:
        if steps:
            # ── Multi-step service: start each step and wait for its health ──
            total_retries = BOOT_RETRIES.get(name, 20)
            per_step      = max(total_retries // len(steps), 10)

            for i, step in enumerate(steps, 1):
                cmd  = step["cmd"]
                cwd  = step.get("cwd", defn.get("cwd", UI_DIR))
                env  = step.get("env", {})
                label = step.get("label", f"step {i}")

                _append_log(name, f"[{i}/{len(steps)}] Starting {label}…")
                _append_log(name, f"    cmd: {' '.join(str(c) for c in cmd)}")

                p = _launch_proc(name, cmd, cwd, env)
                _procs[name].append(p)

                # Determine health target for this step
                hc  = step.get("health_check", "tcp")
                hcu = step.get("health_url") if hc == "http" else step.get("port")

                healthy = await _wait_for(hc, hcu, retries=per_step)

                if p.poll() is not None:
                    _append_log(name, f"❌ {label} exited early (code {p.returncode})")
                    _kill_all(name)
                    return {"ok": False, "reason": f"{label} process_died"}

                if not healthy:
                    _append_log(name, f"⚠️  {label} health timed out — continuing anyway")
                else:
                    _append_log(name, f"✅ {label} is ready")

        else:
            # ── Single-process service ────────────────────────────────────────
            if not defn.get("no_entry_check"):
                is_module = "-m" in defn["cmd"]
                entry     = defn["cmd"][-1]
                if not is_module and not os.path.exists(entry):
                    msg = f"Entry point not found: {entry}"
                    _append_log(name, f"❌ {msg}")
                    return {"ok": False, "reason": msg}

            cmd = defn["cmd"]
            cwd = defn.get("cwd", UI_DIR)
            env = defn.get("env", {})
            _append_log(name, f"    cmd: {' '.join(str(c) for c in cmd)}")

            p = _launch_proc(name, cmd, cwd, env)
            _procs[name].append(p)

            retries = BOOT_RETRIES.get(name, 20)
            healthy = await _wait_for(
                defn.get("health_check", "tcp"),
                defn.get("health_url") if defn.get("health_check") == "http" else defn["port"],
                retries=retries,
            )

            if p.poll() is not None:
                _append_log(name, f"❌ Process exited early (code {p.returncode})")
                _procs[name] = []
                return {"ok": False, "reason": "process_died", "code": p.returncode}

            if not healthy:
                _append_log(name, f"⚠️  Running but health check timed out — treating as online")

        # ── All steps up ─────────────────────────────────────────────────────
        pids = [p.pid for p in _procs[name]]
        _append_log(name, f"✅ {defn['label']} ready (PIDs {pids})")

        if defn.get("open_url"):
            webbrowser.open(defn["open_url"])
            _append_log(name, f"🌐 Opened {defn['open_url']}")

        return {"ok": True, "pid": _procs[name][0].pid if _procs[name] else None}

    except Exception as e:
        _append_log(name, f"❌ Failed to start: {e}")
        _kill_all(name)
        return {"ok": False, "reason": str(e)}
    finally:
        _starting.discard(name)


def _kill_all(name: str) -> None:
    for p in reversed(_procs[name]):
        try:
            if p.poll() is None:
                p.terminate()
        except Exception:
            pass
    _procs[name] = []


async def stop_service(name: str) -> Dict[str, Any]:
    defn = SERVICE_DEFS.get(name)
    if not defn:
        raise HTTPException(404, f"Unknown service: {name}")
    if not defn.get("managed"):
        raise HTTPException(400, f"Service '{name}' is not managed by the launcher")

    if not _procs_alive(name):
        _procs[name] = []
        return {"ok": False, "reason": "not_running"}
    if name in _stopping:
        return {"ok": False, "reason": "already_stopping"}

    _stopping.add(name)
    _append_log(name, f"--- Stopping {defn['label']} ---")

    try:
        # Stop in reverse order (UI before backend)
        for p in reversed(_procs[name]):
            try:
                p.terminate()
            except Exception:
                pass

        for _ in range(50):
            await asyncio.sleep(0.1)
            if not _procs_alive(name):
                break
        else:
            for p in _procs[name]:
                try:
                    if p.poll() is None:
                        p.kill()
                except Exception:
                    pass
            await asyncio.sleep(0.3)

        codes = [p.returncode for p in _procs[name]]
        _procs[name] = []
        _append_log(name, f"✅ Stopped (exit codes {codes})")
        return {"ok": True, "codes": codes}

    except Exception as e:
        _append_log(name, f"❌ Error stopping: {e}")
        return {"ok": False, "reason": str(e)}
    finally:
        _stopping.discard(name)

# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient()
    try:
        print(f"🚀 Launcher ready on :{LAUNCHER_PORT}")
        print(f"   Desktop Monitor Python : {conda_python('gemini-screen-watcher')}")
        print(f"   Director Engine Python : {conda_python('director-engine')}")
        print(f"   Nami / TTS Python      : {conda_python('nami')}")
        for name, defn in SERVICE_DEFS.items():
            if not defn.get("managed"):
                continue
            if defn.get("steps"):
                print(f"   ✅ {defn['label']:25s} → {len(defn['steps'])}-step service")
            elif defn.get("no_entry_check"):
                print(f"   ✅ {defn['label']:25s} → {' '.join(str(c) for c in defn['cmd'])}")
            else:
                is_module = "-m" in defn["cmd"]
                if is_module:
                    module = defn["cmd"][defn["cmd"].index("-m") + 1]
                    print(f"   ✅ {defn['label']:25s} → -m {module}")
                else:
                    entry = defn["cmd"][-1]
                    print(f"   {'✅' if os.path.exists(entry) else '❌'} {defn['label']:25s} → {entry}")
        yield
    finally:
        for name in SERVICE_DEFS:
            if _procs_alive(name):
                print(f"  Stopping {name}...")
                _kill_all(name)
        if http_client:
            await http_client.aclose()


app = FastAPI(title="Nami Launcher", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/launcher/services")
async def list_services():
    result = []
    for name, defn in SERVICE_DEFS.items():
        alive   = _procs_alive(name)
        healthy = await _health_check(name)

        if name in _starting:   status = "starting"
        elif name in _stopping: status = "stopping"
        elif healthy:           status = "online"
        elif alive:             status = "unhealthy"
        else:                   status = "offline"

        # Report the PID of the first process (launcher / primary)
        first_pid = _procs[name][0].pid if _procs[name] else None

        result.append({
            "id":           name,
            "label":        defn["label"],
            "description":  defn.get("description", ""),
            "port":         defn["port"],
            "managed":      defn.get("managed", False),
            "health_check": defn.get("health_check", "tcp"),
            "status":       status,
            "pid":          first_pid,
            "cwd":          defn.get("cwd", UI_DIR),
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


@app.delete("/launcher/services/{name}/logs")
async def clear_logs(name: str):
    if name not in SERVICE_DEFS:
        raise HTTPException(404, f"Unknown service: {name}")
    _logs[name].clear()
    return {"ok": True}


@app.get("/launcher/health")
async def health():
    return {"status": "ok", "service": "launcher", "port": LAUNCHER_PORT}


if __name__ == "__main__":
    print("🚀 LAUNCHER — Starting...")
    uvicorn.run(app, host="0.0.0.0", port=LAUNCHER_PORT, log_level="warning")