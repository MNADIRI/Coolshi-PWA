"""One-time interactive bootstrap for a Tier-C source.

Opens a visible Chromium window, waits for you to log in manually, captures
`storage_state` when you close the window, encrypts it under a key stored in
the macOS Keychain, and registers the source in Supabase.

Usage:
    python bootstrap.py --source instagram
    python bootstrap.py --source linkedin --name "LinkedIn"
    python bootstrap.py --source press_paywall --name "Le Monde" --config path/to/config.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

from config import SESSIONS_DIR, configure_logging
from credentials.keychain_adapter import write_encrypted_state
from storage import supabase_client

log = logging.getLogger("coolshi.bootstrap")

TIER_BY_SOURCE = {
    "instagram": "C",
    "linkedin": "C",
    "x_twitter": "C",
    "tiktok": "C",
    "press_paywall": "C",
    "generic_auth_rss": "C",
    "elsevier": "D",
    "springer": "D",
}


async def capture_playwright_state(source: str, login_url: str) -> dict[str, Any]:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(login_url)

        log.info("Log in in the browser window, then CLOSE the window to capture the session.")

        close_event = asyncio.Event()
        context.on("close", lambda *_: close_event.set())
        await close_event.wait()

        state = await context.storage_state()
        await browser.close()
        return state


async def capture_instagrapi_state() -> dict[str, Any]:
    from getpass import getpass

    from instagrapi import Client

    username = input("Instagram username: ").strip()
    password = getpass("Instagram password (used once, never stored): ")

    client = Client()
    client.login(username, password)
    return client.get_settings()


DEFAULT_LOGIN_URLS = {
    "linkedin": "https://www.linkedin.com/login",
    "x_twitter": "https://x.com/i/flow/login",
    "tiktok": "https://www.tiktok.com/login",
    "press_paywall": "https://www.lemonde.fr/connexion/",
}


async def bootstrap(source: str, name: str, extra_config: dict[str, Any]) -> None:
    tier = TIER_BY_SOURCE.get(source)
    if tier is None:
        log.error("Unknown source: %s. Known: %s", source, sorted(TIER_BY_SOURCE))
        sys.exit(1)

    session_path = SESSIONS_DIR / f"{source}.enc.json"

    if source == "instagram":
        state = await capture_instagrapi_state()
    elif source in DEFAULT_LOGIN_URLS:
        login_url = extra_config.get("login_url") or DEFAULT_LOGIN_URLS[source]
        state = await capture_playwright_state(source, login_url)
    else:
        log.error(
            "Source %s does not require local session bootstrap (e.g. Tier D uses browser cookies).",
            source,
        )
        sys.exit(1)

    write_encrypted_state(session_path, state, source)
    log.info("Session written to %s (encrypted).", session_path)

    source_id = supabase_client.insert_source(
        source_type=source,
        source_tier=tier,
        name=name,
        config=extra_config,
    )
    log.info("Registered source %s (%s) with id=%s", name, source, source_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, choices=sorted(TIER_BY_SOURCE))
    parser.add_argument("--name", default=None, help="Human-readable name")
    parser.add_argument("--config", type=Path, default=None, help="Path to JSON config file")
    return parser.parse_args()


def main() -> None:
    configure_logging()
    args = parse_args()

    extra_config: dict[str, Any] = {}
    if args.config:
        extra_config = json.loads(args.config.read_text())

    name = args.name or args.source.capitalize()
    asyncio.run(bootstrap(args.source, name, extra_config))


if __name__ == "__main__":
    main()
