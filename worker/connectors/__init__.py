"""Registry of connector classes, keyed by source_type."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .base import SourceConnector


def get_connector(source_type: str) -> "SourceConnector":
    # Lazy import so adding a new connector doesn't drag all playwright deps at module load.
    if source_type == "instagram":
        from .instagram import InstagramConnector

        return InstagramConnector()
    if source_type == "linkedin":
        from .linkedin import LinkedInConnector

        return LinkedInConnector()
    if source_type == "x_twitter":
        from .x_twitter import XTwitterConnector

        return XTwitterConnector()
    if source_type == "tiktok":
        from .tiktok import TikTokConnector

        return TikTokConnector()
    if source_type == "press_paywall":
        from .press_paywall import PressPaywallConnector

        return PressPaywallConnector()
    if source_type == "elsevier":
        from .elsevier import ElsevierConnector

        return ElsevierConnector()
    if source_type == "springer":
        from .springer import SpringerConnector

        return SpringerConnector()
    if source_type == "generic_auth_rss":
        from .generic_auth_rss import GenericAuthRssConnector

        return GenericAuthRssConnector()
    raise KeyError(f"Unknown source_type: {source_type}")
