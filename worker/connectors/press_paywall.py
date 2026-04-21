"""Generic paywalled press connector.

Config (per source, in sources.config JSONB):
    {
      "source_id": "...",            # Supabase row id, injected by scheduler
      "homepage": "https://www.lemonde.fr/",
      "article_link_selector": "a[href*='/article/']",
      "title_selector": "h1",
      "content_selector": "article [data-testid='article-body']",
      "author_selector": "[rel='author']",   # optional
      "max_articles": 15
    }
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

from .base import PlaywrightConnectorBase, RawItem

log = logging.getLogger(__name__)


class PressPaywallConnector(PlaywrightConnectorBase):
    source_type = "press_paywall"

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        source_id: str = config["source_id"]
        homepage: str = config["homepage"]
        link_sel: str = config["article_link_selector"]
        title_sel: str = config.get("title_selector", "h1")
        content_sel: str = config.get("content_selector", "article")
        author_sel: str | None = config.get("author_selector")
        max_articles: int = int(config.get("max_articles", 15))

        from playwright.async_api import async_playwright

        items: list[RawItem] = []

        async with self._semaphore:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                try:
                    context = await self._get_authenticated_context(browser)
                    page = await context.new_page()

                    async def _go():
                        await page.goto(homepage, wait_until="domcontentloaded", timeout=30_000)
                        await page.wait_for_selector(link_sel, timeout=15_000)

                    await self._with_retry(_go)

                    hrefs_raw = await page.eval_on_selector_all(
                        link_sel,
                        "nodes => nodes.slice(0, 60).map(n => n.getAttribute('href'))",
                    )
                    seen: set[str] = set()
                    urls: list[str] = []
                    for href in hrefs_raw:
                        if not href:
                            continue
                        full = urljoin(homepage, href).split("#")[0]
                        if full in seen:
                            continue
                        seen.add(full)
                        urls.append(full)
                        if len(urls) >= max_articles:
                            break

                    for url in urls:
                        try:
                            await page.goto(url, wait_until="domcontentloaded", timeout=25_000)
                            title = (await page.locator(title_sel).first.inner_text()).strip()
                            content = (await page.locator(content_sel).first.inner_text()).strip()
                            author = None
                            if author_sel:
                                try:
                                    author = (
                                        await page.locator(author_sel).first.inner_text()
                                    ).strip()
                                except Exception:
                                    author = None
                            if not title or not content:
                                continue
                            items.append(
                                RawItem(
                                    source_id=source_id,
                                    source_tier="C",
                                    url=url,
                                    title=title[:200],
                                    content=content[:20_000],
                                    author=author,
                                    published_at=datetime.now(timezone.utc),
                                    raw_metadata={"homepage": homepage},
                                )
                            )
                        except Exception:
                            log.exception("Article fetch failed for %s", url)
                        await self._jitter()
                finally:
                    await browser.close()

        log.info("PressPaywall %s fetched %d articles.", homepage, len(items))
        return items
