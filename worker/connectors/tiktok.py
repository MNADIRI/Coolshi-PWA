"""TikTok connector — Playwright + storage_state. Scrapes 'For You' feed."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .base import PlaywrightConnectorBase, RawItem

log = logging.getLogger(__name__)


class TikTokConnector(PlaywrightConnectorBase):
    source_type = "tiktok"

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        source_id: str = config["source_id"]
        url: str = config.get("feed_url", "https://www.tiktok.com/foryou")
        max_posts: int = int(config.get("max_posts", 20))

        from playwright.async_api import async_playwright

        items: list[RawItem] = []

        async with self._semaphore:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    context = await self._get_authenticated_context(browser)
                    page = await context.new_page()

                    async def _go():
                        await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                        await page.wait_for_selector("[data-e2e='recommend-list-item-container']", timeout=20_000)

                    await self._with_retry(_go)

                    for _ in range(max_posts):
                        await page.keyboard.press("ArrowDown")
                        await page.wait_for_timeout(800)

                    tiles = await page.query_selector_all(
                        "[data-e2e='recommend-list-item-container']",
                    )
                    log.info("TikTok: %d tiles on page", len(tiles))

                    for tile in tiles[:max_posts]:
                        caption_el = await tile.query_selector("[data-e2e='video-desc']")
                        caption = (await caption_el.inner_text()).strip() if caption_el else ""

                        link_el = await tile.query_selector("a[href*='/video/']")
                        href = await link_el.get_attribute("href") if link_el else None

                        if not href or not caption:
                            continue

                        items.append(
                            RawItem(
                                source_id=source_id,
                                source_tier="C",
                                url=href.split("?")[0],
                                title=caption[:140],
                                content=caption,
                                author=None,
                                published_at=datetime.now(timezone.utc),
                                raw_metadata={},
                            )
                        )
                finally:
                    await browser.close()

            await self._jitter()

        log.info("TikTok fetched %d clips.", len(items))
        return items
