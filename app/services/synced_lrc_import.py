from __future__ import annotations

import syncedlyrics


def fetch_synced_lrc(query: str, providers: list[str] | None = None) -> str:
    search_options: dict[str, object] = {"synced_only": True}
    if providers:
        search_options["providers"] = providers

    lrc = syncedlyrics.search(query.strip(), **search_options)
    if not lrc:
        raise RuntimeError("no synced lrc found")
    return lrc
