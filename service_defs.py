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
    "microphone_audio_service": {
        "label":        "Microphone Audio Service",
        "description":  "Parakeet MLX mic transcription → Hub + WS (port 8013)",
        "cmd":          [conda_python("gemini-screen-watcher"),
                         os.path.join(PARENT_DIR, "microphone_audio_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "microphone_audio_service"),
        "port":         8013,
        "health_check": "http",
        "health_url":   "http://localhost:8014/health",
        "managed":      True,
    },

    "vision_service": {
        "label":        "Vision Service",
        "description":  "Gemini 2.5 Flash screen analysis → Hub + WS (port 8015)",
        "cmd":          [conda_python("gemini-screen-watcher"),
                         os.path.join(PARENT_DIR, "vision_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "vision_service"),
        "port":         8015,
        "health_check": "http",
        "health_url":   "http://localhost:8016/health",
        "managed":      True,
    },

    "stream_audio_service": {
        "label":        "Stream Audio Service",
        "description":  "OpenAI Realtime desktop-audio transcription + GPT-4o enrichment → Hub + WS (port 8017)",
        "cmd":          [conda_python("gemini-screen-watcher"),
                         os.path.join(PARENT_DIR, "stream_audio_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "stream_audio_service"),
        "port":         8017,
        "health_check": "http",
        "health_url":   "http://localhost:8018/health",
        "managed":      True,
    },
    "memory_service": {
        "label":        "Memory Service",
        "description":  "Semantic memory store — retrieval, compression, and decay",
        "cmd":          [conda_python("memory-service"), "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8009"],
        "cwd":          os.path.join(PARENT_DIR, "memory_service"),
        "port":         8009,
        "health_check": "http",
        "health_url":   "http://localhost:8009/health",
        "managed":      True,
    },
    "director": {
        "label":        "Director Engine",
        "description":  "Brain — drives directives, scoring, and state",
        "cmd":          [conda_python("director-engine"), os.path.join(PARENT_DIR, "director_engine", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "director_engine"),
        "port":         8006,
        "health_check": "http",
        "health_url":   "http://localhost:8006/health", 
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
        "description":  "LLM + Twitch bot",
        "cmd":          [conda_python("nami"), "-m", "nami.main"],
        "cwd":          PARENT_DIR,
        "port":         8000,
        "health_check": "tcp",
        "managed":      True,
    },
    "hub": {
        "label":        "Central Hub",
        "description":  "Socket.IO relay hub — all services connect through here",
        "cmd":          [sys.executable, os.path.join(PARENT_DIR, "hub_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "hub_service"),
        "port":         8002,
        "health_check": "tcp",
        "managed":      True,
    },
    "user_profile_service": {
        "label":        "User Profile Service",
        "description":  "Standalone database for user profiles and relationships",
        "cmd":          [sys.executable, os.path.join(PARENT_DIR, "user_profile_service", "main.py")],
        "cwd":          os.path.join(PARENT_DIR, "user_profile_service"),
        "port":         8008, 
        "health_check": "http",
        "health_url":   "http://localhost:8008/health",
        "managed":      True,
    },
}

# Boot-time health check retry counts per service
BOOT_RETRIES: Dict[str, int] = {
    "hub":             15,
    "nami":            60,
    "tts_service":     20,
    "microphone_audio_service": 30,
    "vision_service":           40,
    "stream_audio_service":     30,
    "director":        60,
    "twitch_service":  30,
    "user_profile_service": 30,
    "memory_service": 40,
}