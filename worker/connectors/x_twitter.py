"""X/Twitter connector — Playwright + storage_state. Scrapes the Following feed."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .base import PlaywrightConnectorBase, RawItem

log = logging.getLogger(__name__)


class XTwitterConnector(PlaywrightConnectorBase):
    source_type = "x_twitter"

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        source_id: str = config["source_id"]
        url: str = config.get("feed_url", "https://x.com/home")
        max_posts: int = int(config.get("max_posts", 40))

        from playwright.async_api import async_playwright

        items: list[RawItem] = []

        async with self._semaphore:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    context = await self._get_authenticated_context(browser)
                    page = await context.new_page()

                    async def _go():
                        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                        await page.wait_for_selector("article[data-testid='tweet']", timeout=20_000)

                    await self._with_retry(_go)

                    for _ in range(6):
                        await page.mouse.wheel(0, 3000)
                        await page.wait_for_timeout(1200)

                    tweets = await page.query_selector_all("article[data-testid='tweet']")
                    log.info("X: %d tweets on page", len(tweets))

                    for tweet in tweets[:max_posts]:
                        text_el = await tweet.query_selector("div[data-testid='tweetText']")
                        text = (await text_el.inner_text()).strip() if text_el else ""

                        time_el = await tweet.query_selector("time")
                        timestamp = (
                            await time_el.get_attribute("datetime") if time_el else None
                        )
                        link_el = await tweet.query_selector("a[href*='/status/']")
                        href = await link_el.get_attribute("href") if link_el else None

                        if not href or not text:
                            continue

                        try:
                            published = (
                                datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                                if timestamp
                                else datetime.now(timezone.utc)
                            )
                        except ValueError:
                            published = datetime.now(timezone.utc)

                        if published < since:
                            continue

                        items.append(
                            RawItem(
                                source_id=source_id,
                                source_tier="C",
                                url=f"https://x.com{href.split('?')[0]}",
                                title=text[:140],
                                content=text,
                                author=href.split("/")[1] if href.startswith("/") else None,
                                published_at=published,
                                raw_metadata={},
                            )
                        )
                finally:
                    await browser.close()

            await self._jitter()

        log.info("X fetched %d tweets.", len(items))
        return items
