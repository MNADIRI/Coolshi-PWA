"""Tier D — ScienceDirect via institutional cookies.

Reads the logged-in Chrome/Firefox/Safari session from the user's Mac via
`browser_cookie3`, then drives Playwright with that cookie jar. No password is
ever stored.

Config:
    {
      "source_id": "...",
      "search_url": "https://www.sciencedirect.com/search?qs=radiomics",
      "max_articles": 10
    }
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .base import PlaywrightConnectorBase, RawItem

log = logging.getLogger(__name__)

_COOKIE_DOMAINS = [".sciencedirect.com", ".elsevier.com"]


def _load_cookies_from_browser() -> list[dict]:
    """Pull cookies from the user's default browser for Elsevier domains."""
    import browser_cookie3

    jars = []
    # Try every installed browser; first match wins.
    for loader in (browser_cookie3.chrome, browser_cookie3.firefox, browser_cookie3.safari):
        try:
            jars.append(loader())
        except Exception as exc:  # noqa: BLE001
            log.debug("browser_cookie3 loader %s failed: %s", loader.__name__, exc)

    merged: list[dict] = []
    for jar in jars:
        for cookie in jar:
            if any(cookie.domain.endswith(d) or cookie.domain == d.lstrip(".") for d in _COOKIE_DOMAINS):
                merged.append(
                    {
                        "name": cookie.name,
                        "value": cookie.value,
                        "domain": cookie.domain,
                        "path": cookie.path or "/",
                        "secure": bool(cookie.secure),
                        "httpOnly": bool(getattr(cookie, "_rest", {}).get("HttpOnly", False)),
                        "expires": int(cookie.expires) if cookie.expires else -1,
                    }
                )
    return merged


class ElsevierConnector(PlaywrightConnectorBase):
    source_type = "elsevier"

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        source_id: str = config["source_id"]
        search_url: str = config["search_url"]
        max_articles: int = int(config.get("max_articles", 10))

        from playwright.async_api import async_playwright

        cookies = _load_cookies_from_browser()
        if not cookies:
            log.warning("No Elsevier cookies found in any local browser — skipping.")
            return []

        items: list[RawItem] = []

        async with self._semaphore:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    context = await browser.new_context()
                    await context.add_cookies(cookies)
                    page = await context.new_page()

                    async def _go():
                        await page.goto(search_url, wait_until="domcontentloaded", timeout=30_000)
                        await page.wait_for_selector("li.ResultItem", timeout=20_000)

                    await self._with_retry(_go)

                    hrefs = await page.eval_on_selector_all(
                        "li.ResultItem h2 a",
                        "nodes => nodes.map(n => n.href)",
                    )

                    for url in hrefs[:max_articles]:
                        try:
                            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                            title = (await page.locator("h1.Head").first.inner_text()).strip()
                            abstract_el = page.locator("div.abstract.author")
                            abstract = (
                                (await abstract_el.first.inner_text()).strip()
                                if await abstract_el.count()
                                else ""
                            )
                            items.append(
                                RawItem(
                                    source_id=source_id,
                                    source_tier="D",
                                    url=url,
                                    title=title[:200],
                                    content=abstract[:10_000],
                                    author=None,
                                    published_at=datetime.now(timezone.utc),
                                    raw_metadata={"search_url": search_url},
                                )
                            )
                        except Exception:
                            log.exception("Elsevier article fetch failed for %s", url)
                        await self._jitter()
                finally:
                    await browser.close()

        log.info("Elsevier fetched %d articles.", len(items))
        return items

    async def health_check(self) -> bool:
        try:
            return len(_load_cookies_from_browser()) > 0
        except Exception:
            log.exception("Elsevier health check failed.")
            return False
