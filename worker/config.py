"""Env loading + paths. Importable on any OS (Keychain is lazy)."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

WORKER_HOME = Path(os.environ.get("COOLSHI_WORKER_HOME", Path(__file__).parent)).resolve()
SESSIONS_DIR = WORKER_HOME / "storage" / "sessions"
LOGS_DIR = WORKER_HOME / "logs"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL, logging.INFO),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        stream=sys.stdout,
    )


def require_supabase() -> tuple[str, str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing. "
            "Copy .env.example to .env and fill them in.",
        )
    return SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
