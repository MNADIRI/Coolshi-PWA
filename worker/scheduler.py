"""APScheduler glue. Loads active Tier C/D sources, schedules fetches every 2h
with jitter. Does an immediate pass on startup."""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from connectors import get_connector
from storage import supabase_client

log = logging.getLogger(__name__)

DEFAULT_INTERVAL_HOURS = 2


async def run_source(source_row: dict[str, Any]) -> None:
    source_id = source_row["id"]
    source_type = source_row["source_type"]
    name = source_row.get("name", source_type)

    try:
        connector = get_connector(source_type)
    except KeyError:
        log.error("No connector registered for source_type=%s (source %s).", source_type, name)
        supabase_client.mark_source_error(source_id, f"no connector for {source_type}")
        return

    config = dict(source_row.get("config") or {})
    config["source_id"] = source_id

    last_fetched = source_row.get("last_fetched_at")
    if last_fetched:
        try:
            since = datetime.fromisoformat(last_fetched.replace("Z", "+00:00"))
        except ValueError:
            since = datetime.now(timezone.utc) - timedelta(days=1)
    else:
        since = datetime.now(timezone.utc) - timedelta(days=1)

    log.info("Running %s (%s) since %s", name, source_type, since.isoformat())

    try:
        items = await connector.fetch(config, since)
        supabase_client.push_raw_items(items)
        supabase_client.mark_source_success(source_id)
    except Exception as exc:  # noqa: BLE001
        log.exception("Connector run failed for %s", name)
        supabase_client.mark_source_error(source_id, str(exc))


async def run_all_active() -> None:
    sources = supabase_client.list_active_sources()
    log.info("Active sources: %d", len(sources))
    for source in sources:
        await run_source(source)
        # Stagger between connectors to avoid bursty browser CPU.
        await asyncio.sleep(random.uniform(5, 15))


def build_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        run_all_active,
        IntervalTrigger(hours=DEFAULT_INTERVAL_HOURS, jitter=300),
        id="coolshi-all-sources",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    return scheduler
