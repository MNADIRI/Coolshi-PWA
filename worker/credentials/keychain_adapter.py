"""AES-256-GCM session state encryption, with the symmetric key stored in the
macOS Keychain via `keyring`. Falls back to a file-based keyring on other OSes
so the worker remains importable in CI/dev.

The encrypted payload is JSON with a 12-byte nonce prepended:
    [nonce (12 bytes)] [ciphertext + tag]
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

import keyring
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

log = logging.getLogger(__name__)

SERVICE = "coolshi"
_FALLBACK_KEY_DIR = Path.home() / ".coolshi-keys"


def _is_macos() -> bool:
    return sys.platform == "darwin"


def _fallback_read(name: str) -> bytes | None:
    p = _FALLBACK_KEY_DIR / f"{name}.key"
    if not p.exists():
        return None
    return p.read_bytes()


def _fallback_write(name: str, key: bytes) -> None:
    _FALLBACK_KEY_DIR.mkdir(mode=0o700, exist_ok=True)
    p = _FALLBACK_KEY_DIR / f"{name}.key"
    p.write_bytes(key)
    p.chmod(0o600)


def _key_name(source: str) -> str:
    return f"session-key-{source}"


def get_or_create_key(source: str) -> bytes:
    """Return a 32-byte key for the given source, creating & storing it on first call."""
    name = _key_name(source)
    try:
        stored = keyring.get_password(SERVICE, name)
        if stored:
            return bytes.fromhex(stored)
    except keyring.errors.KeyringError as exc:
        log.warning("Keyring backend unavailable (%s); falling back to file storage.", exc)

    if not _is_macos():
        fallback = _fallback_read(name)
        if fallback:
            return fallback

    key = os.urandom(32)

    try:
        keyring.set_password(SERVICE, name, key.hex())
    except keyring.errors.KeyringError as exc:
        log.warning("Keyring set failed (%s); storing key under %s.", exc, _FALLBACK_KEY_DIR)
        _fallback_write(name, key)

    if not _is_macos():
        # Mirror to file on non-macOS so restarts can recover without Keychain.
        _fallback_write(name, key)

    return key


def encrypt_state(state: dict[str, Any], key: bytes) -> bytes:
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    plaintext = json.dumps(state, separators=(",", ":")).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)
    return nonce + ciphertext


def decrypt_state(path: Path, key: bytes) -> dict[str, Any]:
    blob = path.read_bytes()
    nonce, ciphertext = blob[:12], blob[12:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
    return json.loads(plaintext.decode("utf-8"))


def write_encrypted_state(path: Path, state: dict[str, Any], source: str) -> None:
    key = get_or_create_key(source)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encrypt_state(state, key))
    path.chmod(0o600)


def read_encrypted_state(path: Path, source: str) -> dict[str, Any]:
    key = get_or_create_key(source)
    return decrypt_state(path, key)
