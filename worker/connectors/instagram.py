"""Instagram connector — uses instagrapi's session file, persisted via Keychain."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from config import SESSIONS_DIR
from credentials.keychain_adapter import (
    read_encrypted_state,
    write_encrypted_state,
)

from .base import RawItem, SourceConnector

log = logging.getLogger(__name__)


class InstagramConnector(SourceConnector):
    source_type = "instagram"

    def _session_path(self):
        return SESSIONS_DIR / f"{self.source_type}.enc.json"

    def _load_client(self):
        from instagrapi import Client  # lazy — heavy import

        client = Client()
        state = read_encrypted_state(self._session_path(), self.source_type)
        client.set_settings(state)
        return client

    def _save_client(self, client) -> None:
        write_encrypted_state(self._session_path(), client.get_settings(), self.source_type)

    async def fetch(self, config: dict[str, Any], since: datetime) -> list[RawItem]:
        handles: list[str] = config.get("handles", [])
        max_per_user: int = int(config.get("max_per_user", 10))
        source_id: str = config["source_id"]

        items: list[RawItem] = []

        client = self._load_client()
        try:
            for handle in handles:
                try:
                    user_id = client.user_id_from_username(handle)
                    medias = client.user_medias(user_id, amount=max_per_user)
                except Exception:
                    log.exception("Instagram fetch failed for @%s", handle)
                    continue

                for m in medias:
                    published = m.taken_at
                    if published.tzinfo is None:
                        published = published.replace(tzinfo=timezone.utc)
                    if published < since:
                        continue
                    items.append(
                        RawItem(
                            source_id=source_id,
                            source_tier="C",
                            url=f"https://www.instagram.com/p/{m.code}/",
                            title=(m.caption_text or "")[:200],
                            content=m.caption_text or "",
                            author=handle,
                            published_at=published,
                            raw_metadata={
                                "media_type": m.media_type,
                                "like_count": m.like_count,
                                "comment_count": m.comment_count,
                            },
                        )
                    )
        finally:
            # Re-persist settings (cookies may have rotated).
            try:
                self._save_client(client)
            except Exception:
                log.warning("Could not re-save Instagram session.")

        log.info("Instagram fetched %d items across %d handles.", len(items), len(handles))
        return items

    async def health_check(self) -> bool:
        try:
            self._load_client()
            return True
        except FileNotFoundError:
            return False
        except json.JSONDecodeError:
            return False
