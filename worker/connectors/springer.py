"""Tier D — Springer Link via institutional cookies. Mirrors the Elsevier
connector with different selectors."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .base import PlaywrightConnectorBase, RawItem
from .elsevier import _load_cookies_from_browser  # reuse the loader  # noqa: PLC2701

log = logging.getLogger(__name__)

_COOKIE_DOMAINS = [".springer.com", ".link.springer.com"]


class SpringerConnector(PlaywrightConnectorBase):
    source_type = "springer"

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        source_id: str = config["source_id"]
        search_url: str = config["search_url"]
        max_articles: int = int(config.get("max_articles", 10))

        from playwright.async_api import async_playwright

        # Reuse the generic loader but filter to Springer domains.
        all_cookies = _load_cookies_from_browser()
        cookies = [
            c for c in all_cookies
            if any(c["domain"].endswith(d) or c["domain"] == d.lstrip(".") for d in _COOKIE_DOMAINS)
        ]
        if not cookies:
            log.warning("No Springer cookies found in any local browser — skipping.")
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
                        await page.wait_for_selector("li.app-card-open", timeout=20_000)

                    await self._with_retry(_go)

                    hrefs = await page.eval_on_selector_all(
                        "li.app-card-open a[data-test='title-link']",
                        "nodes => nodes.map(n => n.href)",
                    )

                    for url in hrefs[:max_articles]:
                        try:
                            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                            title = (await page.locator("h1").first.inner_text()).strip()
                            abstract = ""
                            abstract_loc = page.locator("section[data-title='Abstract'] p")
                            if await abstract_loc.count():
                                abstract = (await abstract_loc.first.inner_text()).strip()
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
                            log.exception("Springer article fetch failed for %s", url)
                        await self._jitter()
                finally:
                    await browser.close()

        log.info("Springer fetched %d articles.", len(items))
        return items

    async def health_check(self) -> bool:
        return bool(_load_cookies_from_browser())
