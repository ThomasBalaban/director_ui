"""
Service definitions and conda environment resolution for the Nami Launcher.
"""

import os
import sys
from typing import Dict, Any

UI_DIR     = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(UI_DIR)


def conda_python(env_name: str) -> str:
    """
    Resolve the Python executable for a named conda environment.
    On macOS uses python.app (framework build) so tkinter works.
    Falls back to sys.executable if the env can't be found.
    """
    conda_exe = os.environ.get("CONDA_EXE", "")
    if conda_exe:
        conda_root = os.path.dirname(os.path.dirname(conda_exe))
    else:
        conda_prefix = os.environ.get("CONDA_PREFIX", "")
        if conda_prefix:
            parts = conda_prefix.split(os.sep + "envs" + os.sep)
            conda_root = parts[0]
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
        "cmd":          [conda_python("gemini-screen-watcher"), os.path.join(PARENT_DIR, "desktop_mon_gemini", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "desktop_mon_gemini"),
        "port":         8003,
        "health_check": "tcp",
        "managed":      True,
    },
    "director": {
        "label":        "Director Engine",
        "description":  "Brain — drives directives, scoring, and state",
        "cmd":          [conda_python("director-engine"), os.path.join(PARENT_DIR, "director_engine", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "director_engine"),
        "port":         8002,
        "health_check": "http",
        "health_url":   "http://localhost:8002/health",
        "managed":      True,
    },
    "tts_service": {
        "label":        "TTS Service",
        "description":  "Azure TTS + ngrok — audio generation and playback",
        "cmd":          [conda_python("nami"), os.path.join(PARENT_DIR, "tts_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "tts_service"),
        "port":         8004,
        "health_check": "http",
        "health_url":   "http://localhost:8004/health",
        "managed":      True,
    },
    "twitch_service": {
        "label":        "Twitch Service",
        "description":  "Twitch chat, polls, predictions, redeems",
        "cmd":          [conda_python("nami"), os.path.join(PARENT_DIR, "twitch_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "twitch_service"),
        "port":         8005,
        "health_check": "http",
        "health_url":   "http://localhost:8005/health",
        "managed":      True,
    },
    "nami": {
        "label":        "Nami",
        "description":  "LLM + Twitch bot — the voice",
        "cmd":          [conda_python("nami"), "-m", "nami.main"],
        "cwd":          PARENT_DIR,
        "port":         8000,
        "health_check": "tcp",
        "managed":      True,
    },
}

# Boot-time health check retry counts per service
BOOT_RETRIES: Dict[str, int] = {
    "nami":            60,
    "tts_service":     20,
    "desktop_monitor": 40,
    "director":        60,
    "twitch_service":  30,
}