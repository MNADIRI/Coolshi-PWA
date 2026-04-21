"""Entrypoint for the Coolshi worker.

Run directly:
    python main.py

Under launchd:
    ~/Library/LaunchAgents/com.coolshi.worker.plist
"""

from __future__ import annotations

import asyncio
import logging
import signal

from config import configure_logging
from scheduler import build_scheduler, run_all_active

log = logging.getLogger("coolshi.worker")


async def amain() -> None:
    configure_logging()
    log.info("Coolshi worker starting.")

    scheduler = build_scheduler()
    scheduler.start()

    # Fire an immediate pass so the first ingestion doesn't wait 2h.
    asyncio.create_task(run_all_active())

    stop_event = asyncio.Event()

    def _stop(*_args) -> None:
        log.info("Signal received, shutting down.")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _stop)

    await stop_event.wait()
    scheduler.shutdown(wait=False)
    log.info("Coolshi worker stopped.")


if __name__ == "__main__":
    asyncio.run(amain())
