"""LinkedIn connector — Playwright + storage_state."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .base import PlaywrightConnectorBase, RawItem

log = logging.getLogger(__name__)


class LinkedInConnector(PlaywrightConnectorBase):
    source_type = "linkedin"

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        source_id: str = config["source_id"]
        feed_url: str = config.get("feed_url", "https://www.linkedin.com/feed/")
        max_posts: int = int(config.get("max_posts", 30))

        from playwright.async_api import async_playwright

        items: list[RawItem] = []

        async with self._semaphore:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    context = await self._get_authenticated_context(browser)
                    page = await context.new_page()

                    async def _go():
                        await page.goto(feed_url, wait_until="domcontentloaded", timeout=30_000)
                        await page.wait_for_selector("div.feed-shared-update-v2", timeout=20_000)

                    await self._with_retry(_go)

                    # Incremental scrolling to trigger lazy loading
                    for _ in range(5):
                        await page.mouse.wheel(0, 3000)
                        await page.wait_for_timeout(1500)

                    posts = await page.query_selector_all("div.feed-shared-update-v2")
                    log.info("LinkedIn: %d posts on page", len(posts))

                    for post in posts[:max_posts]:
                        text_el = await post.query_selector(
                            "div.feed-shared-update-v2__description"
                        )
                        text = (await text_el.inner_text()).strip() if text_el else ""

                        author_el = await post.query_selector("span.update-components-actor__name")
                        author = (
                            (await author_el.inner_text()).strip().split("\n")[0]
                            if author_el
                            else None
                        )

                        link_el = await post.query_selector("a.app-aware-link")
                        url = await link_el.get_attribute("href") if link_el else None
                        if not url or not text:
                            continue

                        items.append(
                            RawItem(
                                source_id=source_id,
                                source_tier="C",
                                url=url.split("?")[0],
                                title=text[:140],
                                content=text,
                                author=author,
                                published_at=datetime.now(timezone.utc),
                                raw_metadata={},
                            )
                        )
                finally:
                    await browser.close()

            await self._jitter()

        log.info("LinkedIn fetched %d posts.", len(items))
        return items
