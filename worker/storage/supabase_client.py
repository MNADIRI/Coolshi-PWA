"""Thin supabase-py wrapper. Upserts raw_items on URL, records source status."""

from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from supabase import create_client

from config import require_supabase

if TYPE_CHECKING:
    from connectors.base import RawItem
    from supabase import Client

log = logging.getLogger(__name__)


def _client() -> "Client":
    url, key = require_supabase()
    return create_client(url, key)


def _item_to_row(item: "RawItem") -> dict:
    d = asdict(item)
    # published_at may be a datetime — serialize explicitly.
    if isinstance(d.get("published_at"), datetime):
        d["published_at"] = d["published_at"].isoformat()
    return d


def push_raw_items(items: list["RawItem"]) -> int:
    """Upsert raw_items on URL. Returns number of rows written (inserts + updates)."""
    if not items:
        return 0
    client = _client()
    rows = [_item_to_row(i) for i in items]
    try:
        resp = client.table("raw_items").upsert(rows, on_conflict="url").execute()
        count = len(resp.data or [])
        log.info("Pushed %d raw_items (source_id=%s).", count, items[0].source_id)
        return count
    except Exception:
        log.exception("Failed to push raw_items.")
        raise


def mark_source_success(source_id: str) -> None:
    client = _client()
    client.table("sources").update(
        {
            "last_fetched_at": datetime.now(timezone.utc).isoformat(),
            "last_error": None,
        }
    ).eq("id", source_id).execute()


def mark_source_error(source_id: str, err: str) -> None:
    client = _client()
    client.table("sources").update(
        {
            "last_fetched_at": datetime.now(timezone.utc).isoformat(),
            "last_error": err[:2000],
        }
    ).eq("id", source_id).execute()


def list_active_sources() -> list[dict]:
    client = _client()
    resp = (
        client.table("sources")
        .select("*")
        .eq("is_active", True)
        .in_("source_tier", ["C", "D"])
        .execute()
    )
    return resp.data or []


def insert_source(source_type: str, source_tier: str, name: str, config: dict) -> str:
    client = _client()
    resp = (
        client.table("sources")
        .insert(
            {
                "source_type": source_type,
                "source_tier": source_tier,
                "name": name,
                "config": config,
                "is_active": True,
            }
        )
        .execute()
    )
    return resp.data[0]["id"]
