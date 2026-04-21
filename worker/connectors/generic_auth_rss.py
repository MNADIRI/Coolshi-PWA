"""Authenticated RSS — pulls an RSS feed using cookies from the user's browser.
Useful for private Substack RSS and similar.

Config:
    {
      "source_id": "...",
      "feed_url": "https://example.substack.com/feed",
      "cookie_domain": ".substack.com",
      "max_items": 20
    }
"""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from .base import RawItem, SourceConnector
from .elsevier import _load_cookies_from_browser  # reuse the loader  # noqa: PLC2701

log = logging.getLogger(__name__)


class GenericAuthRssConnector(SourceConnector):
    source_type = "generic_auth_rss"

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        source_id: str = config["source_id"]
        feed_url: str = config["feed_url"]
        cookie_domain: str = config.get("cookie_domain", "")
        max_items: int = int(config.get("max_items", 20))

        all_cookies = _load_cookies_from_browser()
        relevant = {
            c["name"]: c["value"]
            for c in all_cookies
            if not cookie_domain
            or c["domain"].endswith(cookie_domain)
            or c["domain"] == cookie_domain.lstrip(".")
        }

        async with httpx.AsyncClient(cookies=relevant, follow_redirects=True, timeout=30) as client:
            resp = await client.get(feed_url)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)

        items: list[RawItem] = []
        for entry in root.iter("item"):
            title_el = entry.find("title")
            link_el = entry.find("link")
            desc_el = entry.find("description")
            pubdate_el = entry.find("pubDate")

            url = (link_el.text or "").strip() if link_el is not None else ""
            if not url:
                continue

            try:
                published = (
                    parsedate_to_datetime(pubdate_el.text).astimezone(timezone.utc)
                    if pubdate_el is not None and pubdate_el.text
                    else datetime.now(timezone.utc)
                )
            except (TypeError, ValueError):
                published = datetime.now(timezone.utc)

            if published < since:
                continue

            items.append(
                RawItem(
                    source_id=source_id,
                    source_tier="C",
                    url=url,
                    title=(title_el.text or "").strip()[:200] if title_el is not None else "",
                    content=(desc_el.text or "").strip() if desc_el is not None else "",
                    author=None,
                    published_at=published,
                    raw_metadata={"feed_url": feed_url},
                )
            )
            if len(items) >= max_items:
                break

        log.info("Auth RSS %s fetched %d items.", feed_url, len(items))
        return items

    async def health_check(self) -> bool:
        return True
