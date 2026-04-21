"""Connector ABC + Playwright base (session decryption, stealth, retry, throttling)."""

from __future__ import annotations

import asyncio
import logging
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from config import SESSIONS_DIR
from credentials.keychain_adapter import read_encrypted_state

log = logging.getLogger(__name__)


@dataclass
class RawItem:
    source_id: str
    source_tier: str  # 'A' | 'B' | 'C' | 'D'
    url: str
    title: str
    content: str
    author: str | None
    published_at: datetime
    raw_metadata: dict[str, Any] = field(default_factory=dict)


class SourceConnector(ABC):
    source_type: str = ""

    @abstractmethod
    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]: ...

    @abstractmethod
    async def health_check(self) -> bool: ...


class PlaywrightConnectorBase(SourceConnector):
    """Base for Playwright-driven connectors. Concurrency limited, stealth applied."""

    _semaphore = asyncio.Semaphore(2)
    MIN_JITTER_S = 2.0
    MAX_JITTER_S = 6.0
    RETRIES = 3

    def _session_path(self) -> Path:
        return SESSIONS_DIR / f"{self.source_type}.enc.json"

    def _load_storage_state(self) -> dict[str, Any]:
        return read_encrypted_state(self._session_path(), self.source_type)

    async def _jitter(self) -> None:
        await asyncio.sleep(random.uniform(self.MIN_JITTER_S, self.MAX_JITTER_S))

    async def _with_retry(self, coro_factory):
        last_exc: Exception | None = None
        for attempt in range(1, self.RETRIES + 1):
            try:
                return await coro_factory()
            except Exception as exc:  # noqa: BLE001 — surface in last_exc
                last_exc = exc
                wait = 2 ** attempt + random.random()
                log.warning(
                    "[%s] attempt %d failed (%s); retrying in %.1fs",
                    self.source_type,
                    attempt,
                    exc,
                    wait,
                )
                await asyncio.sleep(wait)
        assert last_exc is not None
        raise last_exc

    async def _get_authenticated_context(self, browser):
        """Open a stealth-patched context loaded with the decrypted storage_state."""
        from playwright_stealth import stealth_async

        state = self._load_storage_state()
        context = await browser.new_context(
            storage_state=state,
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()
        await stealth_async(page)
        await page.close()
        return context

    async def health_check(self) -> bool:
        try:
            self._load_storage_state()
            return True
        except Exception:
            log.exception("Health check failed for %s.", self.source_type)
            return False
