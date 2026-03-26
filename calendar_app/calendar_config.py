from __future__ import annotations

import json
from typing import TypedDict


class CalendarConfig(TypedDict):
    db_engine: str
    "URL of the database engine to use, in SQLAlchemy format."
    rebroadcast_interval_seconds: int
    "Time in seconds between rebroadcasting the current state to all sockets. Must be at least 1."
    refreshdb_interval_seconds: int
    "Time in seconds between refreshing the database, or <=0 to disable."
    scheduler_enabled: bool


DEFAULT_REBROADCAST_INTERVAL_SECONDS = 60
DEFAULT_SCHEDULER_ENABLED = True


def load_calendar_config() -> CalendarConfig:
    with open("calendar_config.json", "r", encoding="utf-8") as f:
        loaded = json.load(f)

    return {
        "db_engine": str(loaded["db_engine"]),
        "rebroadcast_interval_seconds": max(
            1,
            int(
                loaded.get(
                    "rebroadcast_interval_seconds",
                    DEFAULT_REBROADCAST_INTERVAL_SECONDS,
                )
            ),
        ),
        "refreshdb_interval_seconds": max(
            0,
            int(
                loaded.get(
                    "refreshdb_interval_seconds",
                    0,
                )
            ),
        ),
        "scheduler_enabled": bool(
            loaded.get("scheduler_enabled", DEFAULT_SCHEDULER_ENABLED)
        ),
    }
