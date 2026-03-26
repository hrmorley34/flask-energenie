from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false
import logging
import time
from datetime import datetime, timezone
from threading import Lock
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

from energenie_control import ENERGENIE_IDS, transmit

from .database import CalendarStore

_LOGGER = logging.getLogger(__name__)


class CalendarScheduler:
    store: CalendarStore
    rebroadcast_interval_seconds: int
    refreshdb_interval_seconds: int | None
    scheduler: BackgroundScheduler
    socket_targets: dict[int, bool]
    _scheduler_lock: Lock
    _transmit_lock: Lock

    def __init__(
        self,
        store: CalendarStore,
        rebroadcast_interval_seconds: int,
        refreshdb_interval_seconds: int,
    ) -> None:
        self.store = store
        self.rebroadcast_interval_seconds = max(1, rebroadcast_interval_seconds)
        self.refreshdb_interval_seconds = (
            refreshdb_interval_seconds if refreshdb_interval_seconds > 0 else None
        )
        self.scheduler = BackgroundScheduler(timezone=timezone.utc)
        self.socket_targets: dict[int, bool] = {}
        self._scheduler_lock = Lock()
        self._transmit_lock = Lock()

    def start(self) -> None:
        with self._scheduler_lock:
            if not self.scheduler.running:
                self.scheduler.start()
        self.rebuild_jobs()

    def shutdown(self) -> None:
        with self._scheduler_lock:
            if self.scheduler.running:
                self.scheduler.shutdown(wait=False)

    def rebuild_jobs(self) -> None:
        with self._scheduler_lock:
            self.scheduler.remove_all_jobs()
            self._schedule_repeating_events()
            self._schedule_dated_events()
            self.scheduler.add_job(
                self._rebroadcast_targets,
                trigger="interval",
                seconds=self.rebroadcast_interval_seconds,
                id="rebroadcast_targets",
                replace_existing=True,
            )
            if self.refreshdb_interval_seconds is not None:
                self.scheduler.add_job(
                    self.consume_events,
                    trigger="interval",
                    seconds=self.refreshdb_interval_seconds,
                    id="refreshdb",
                    replace_existing=True,
                )
            # Run immediately to ensure we're in sync with the database on startup
            self.scheduler.add_job(self.consume_events)

    def _schedule_repeating_events(self) -> None:
        for event in self.store.list_enabled_repeating_events():
            minute_of_day = int(event.minutes_from_midnight)
            hour = minute_of_day // 60
            minute = minute_of_day % 60
            active_day_indexes = [
                str(index)
                for index, is_active in zip(range(7), event.days_list)
                if is_active
            ]
            if not active_day_indexes:
                continue
            trigger = CronTrigger(
                day_of_week=",".join(active_day_indexes),
                hour=hour,
                minute=minute,
                timezone=ZoneInfo(str(event.timezone)),
            )
            self.scheduler.add_job(
                self.consume_events,
                trigger=trigger,
                id=f"repeat:{event.id}",
                replace_existing=True,
            )

    def _schedule_dated_events(self) -> None:
        now_utc = datetime.now(timezone.utc)
        for event in self.store.list_pending_dated_events():
            if event.trigger_datetime <= now_utc:
                continue
            self.scheduler.add_job(
                self.consume_events,
                trigger=DateTrigger(run_date=event.trigger_datetime),
                id=f"dated:{event.id}",
                replace_existing=True,
            )

    def consume_events(self) -> None:
        _LOGGER.debug("Consuming events from database")
        now_utc = datetime.now(timezone.utc)
        self.socket_targets = self.store.consume_events(now_utc)
        _LOGGER.debug(f"Updated socket targets: {self.socket_targets}")
        self._rebroadcast_targets()

    def _rebroadcast_targets(self) -> None:
        with self._transmit_lock:
            _LOGGER.debug("Rebroadcasting targets")
            for _ in range(5):  # Retry a few times in case of transient failures
                for socket_id in ENERGENIE_IDS:
                    target = self.socket_targets.get(socket_id)
                    if target is None:
                        continue
                    transmit(socket_id, target)
                time.sleep(0.5)
