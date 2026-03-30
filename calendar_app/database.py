from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Sequence
from zoneinfo import ZoneInfo

from sqlalchemy import Boolean, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)

TYPE_REPEATING = "repeating"
TYPE_DATED = "dated"
ActionType = Literal["on", "off", "reset"]
ACTIONS: set[ActionType] = {"on", "off", "reset"}


def utcnow_timestamp() -> int:
    return int(datetime.now(timezone.utc).timestamp())


class Base(DeclarativeBase):
    pass


class TimestampedEventBase(Base):
    __abstract__ = True

    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False)


class RepeatingEvent(TimestampedEventBase):
    __tablename__ = "events_repeating"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    socket_id: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    action: Mapped[ActionType] = mapped_column(String, nullable=False)
    minutes_from_midnight: Mapped[int] = mapped_column(Integer, nullable=False)

    days: Mapped[int] = mapped_column(Integer, nullable=False)
    "Bitmask of days of the week, starting with Monday as bit 0."

    timezone: Mapped[str] = mapped_column(String, nullable=False)

    last_triggered: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def days_list(self) -> list[bool]:
        return [(self.days >> i) & 1 != 0 for i in range(7)]

    @property
    def tzinfo(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    def last_occurrence(self, now_utc: datetime) -> datetime | None:
        assert now_utc.tzinfo is not None
        local_now = now_utc.astimezone(self.tzinfo)

        # Check today up to 7 days back, to include the case that the event has not yet
        # occurred today but would have occurred a week ago.
        for days_ago in range(8):
            past_now = local_now - timedelta(days=days_ago)
            if self.days_list[past_now.weekday()]:
                occurrence = past_now.replace(
                    hour=0, minute=0, second=0, microsecond=0
                ) + timedelta(minutes=self.minutes_from_midnight)
                if occurrence <= local_now:
                    return occurrence.astimezone(timezone.utc)

        # No day is enabled
        return None

    def serialise(self) -> dict[str, Any]:
        return {
            "type": TYPE_REPEATING,
            "id": self.id,
            "name": self.name,
            "enabled": self.enabled,
            "socket_id": self.socket_id,
            "priority": self.priority,
            "action": self.action,
            "minutes_from_midnight": self.minutes_from_midnight,
            "days": self.days,
            "timezone": self.timezone,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_triggered": self.last_triggered,
        }


class DatedEvent(TimestampedEventBase):
    __tablename__ = "events_dated"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    socket_id: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    action: Mapped[ActionType] = mapped_column(String, nullable=False)

    trigger_at: Mapped[int] = mapped_column(Integer, nullable=False)
    "UNIX timestamp of when the event should trigger."

    timezone: Mapped[str] = mapped_column(String, nullable=False)

    consumed_at: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def tzinfo(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def trigger_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.trigger_at, tz=self.tzinfo)

    def serialise(self) -> dict[str, Any]:
        return {
            "type": TYPE_DATED,
            "id": self.id,
            "name": self.name,
            "enabled": self.enabled,
            "socket_id": self.socket_id,
            "priority": self.priority,
            "action": self.action,
            "trigger_at": self.trigger_at,
            "timezone": self.timezone,
            "consumed_at": self.consumed_at,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class StateUpdates(Base):
    __tablename__ = "state_updates"

    socket_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    state: Mapped[bool] = mapped_column(Boolean, nullable=False)

    timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    """UNIX timestamp of when this state was set. Defines which events to
    exclude when resolving the current state."""

    @property
    def time_utc(self) -> datetime:
        return datetime.fromtimestamp(self.timestamp, tz=timezone.utc)

    @time_utc.setter
    def time_utc(self, value: datetime) -> None:
        assert value.tzinfo is not None
        self.timestamp = int(value.astimezone(timezone.utc).timestamp())

    priorities: Mapped[list[PriorityState]] = relationship(
        "PriorityState",
        lazy="joined",
        back_populates="update",
        cascade="all, delete-orphan",
    )


class PriorityState(Base):
    __tablename__ = "states_priorities"

    socket_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("state_updates.socket_id"), primary_key=True
    )
    priority: Mapped[int] = mapped_column(Integer, primary_key=True)
    state: Mapped[bool] = mapped_column(Boolean, nullable=False)

    repeating_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("events_repeating.id"), nullable=True
    )
    repeating_event: Mapped[RepeatingEvent | None] = relationship(
        "RepeatingEvent", lazy="joined"
    )
    dated_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("events_dated.id"), nullable=True
    )
    dated_event: Mapped[DatedEvent | None] = relationship("DatedEvent", lazy="joined")

    update: Mapped[StateUpdates] = relationship(
        "StateUpdates",
        lazy="joined",
        back_populates="priorities",
        cascade="all, delete",
    )


class CalendarStore:
    def __init__(self, url: str, *, enginekwargs: dict[str, Any] = {}) -> None:
        self.engine = create_engine(url, **enginekwargs)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def init_db(self) -> None:
        Base.metadata.create_all(self.engine)

    def list_events(self) -> tuple[Sequence[RepeatingEvent], Sequence[DatedEvent]]:
        with self.session_factory() as session:
            repeating = session.scalars(select(RepeatingEvent))
            dated = session.scalars(select(DatedEvent))
            return (repeating.all(), dated.all())

    def list_events_for_socket(
        self, socket_id: int
    ) -> tuple[Sequence[RepeatingEvent], Sequence[DatedEvent]]:
        with self.session_factory() as session:
            repeating = session.scalars(
                select(RepeatingEvent).filter(RepeatingEvent.socket_id == socket_id)
            )
            dated = session.scalars(
                select(DatedEvent).filter(DatedEvent.socket_id == socket_id)
            )
            return (repeating.all(), dated.all())

    def list_repeating_events(self) -> Sequence[RepeatingEvent]:
        with self.session_factory() as session:
            return session.scalars(select(RepeatingEvent)).all()

    def list_dated_events(self) -> Sequence[DatedEvent]:
        with self.session_factory() as session:
            return session.scalars(select(DatedEvent)).all()

    def get_repeating_event(self, event_id: int) -> RepeatingEvent | None:
        with self.session_factory() as session:
            return session.get(RepeatingEvent, event_id)

    def get_dated_event(self, event_id: int) -> DatedEvent | None:
        with self.session_factory() as session:
            return session.get(DatedEvent, event_id)

    def create_repeating_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = utcnow_timestamp()
        with self.session_factory() as session:
            event = RepeatingEvent(
                name=payload["name"],
                enabled=payload.get("enabled", True),
                socket_id=payload["socket_id"],
                priority=payload.get("priority", 0),
                action=payload["action"],
                minutes_from_midnight=payload["minutes_from_midnight"],
                days=payload["days"],
                timezone=payload["timezone"],
                created_at=now,
                updated_at=now,
                last_triggered=None,
            )
            session.add(event)
            session.commit()
            return event.serialise()

    def create_dated_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = utcnow_timestamp()
        with self.session_factory() as session:
            event = DatedEvent(
                name=payload["name"],
                enabled=payload.get("enabled", True),
                socket_id=payload["socket_id"],
                priority=payload.get("priority", 0),
                action=payload["action"],
                trigger_at=payload["trigger_at"],
                timezone=payload["timezone"],
                consumed_at=None,
                created_at=now,
                updated_at=now,
            )
            session.add(event)
            session.commit()
            return event.serialise()

    def update_repeating_event(
        self, event_id: int, payload: dict[str, Any]
    ) -> dict[str, Any] | None:
        with self.session_factory() as session:
            event = session.get(RepeatingEvent, event_id)
            if event is None:
                return None

            for key, value in payload.items():
                if hasattr(event, key):
                    setattr(event, key, value)
            event.updated_at = utcnow_timestamp()

            session.commit()
            return event.serialise()

    def update_dated_event(
        self, event_id: int, payload: dict[str, Any]
    ) -> dict[str, Any] | None:
        with self.session_factory() as session:
            event = session.get(DatedEvent, event_id)
            if event is None:
                return None

            for key, value in payload.items():
                if hasattr(event, key):
                    setattr(event, key, value)
            event.updated_at = utcnow_timestamp()

            session.commit()
            return event.serialise()

    def delete_repeating_event(self, event_id: int) -> bool:
        with self.session_factory() as session:
            event = session.get(RepeatingEvent, event_id)
            if event is None:
                return False
            session.delete(event)
            session.commit()
            return True

    def delete_dated_event(self, event_id: int) -> bool:
        with self.session_factory() as session:
            event = session.get(DatedEvent, event_id)
            if event is None:
                return False
            session.delete(event)
            session.commit()
            return True

    def list_enabled_repeating_events(self) -> Sequence[RepeatingEvent]:
        with self.session_factory() as session:
            return session.scalars(
                select(RepeatingEvent).filter(RepeatingEvent.enabled.is_(True))
            ).all()

    def list_pending_dated_events(self) -> Sequence[DatedEvent]:
        with self.session_factory() as session:
            return session.scalars(
                select(DatedEvent).filter(
                    DatedEvent.enabled.is_(True), DatedEvent.consumed_at.is_(None)
                )
            ).all()

    def consume_events(self, now_utc: datetime) -> dict[int, bool]:
        with self.session_factory() as session:
            last_updates: dict[int, datetime] = {}
            "Mapping of socket id to timestamp of last consume."

            priorities: dict[
                int, dict[int, tuple[bool, RepeatingEvent | DatedEvent | None]]
            ] = defaultdict(dict)
            "Mapping of socket id to priority to (state, event)"

            for update in session.scalars(select(StateUpdates)).unique():
                last_updates[update.socket_id] = update.time_utc
                priorities[update.socket_id] = {
                    known.priority: (
                        known.state,
                        known.repeating_event or known.dated_event,
                    )
                    for known in update.priorities
                }

            rows: list[tuple[datetime, RepeatingEvent | DatedEvent]] = []

            for event in session.scalars(
                select(RepeatingEvent).filter(RepeatingEvent.enabled.is_(True))
            ):
                last_occurrence = event.last_occurrence(now_utc)
                if last_occurrence is None:
                    continue
                last_update = last_updates.get(event.socket_id)
                if last_update is not None and last_occurrence <= last_update:
                    continue
                rows.append((last_occurrence, event))

            for event in session.scalars(
                select(DatedEvent).filter(
                    DatedEvent.enabled.is_(True), DatedEvent.consumed_at.is_(None)
                )
            ):
                if event.trigger_datetime > now_utc:
                    continue
                last_update = last_updates.get(event.socket_id)
                if last_update is not None and event.trigger_datetime <= last_update:
                    continue
                rows.append((event.trigger_datetime, event))

            rows.sort(key=lambda item: item[0])
            for _, event in rows:
                if event.action == "reset":
                    del priorities[event.socket_id][event.priority]
                else:
                    priorities[event.socket_id][event.priority] = (
                        event.action == "on",
                        event,
                    )
                if isinstance(event, RepeatingEvent):
                    event.last_triggered = int(now_utc.timestamp())
                else:
                    event.consumed_at = int(now_utc.timestamp())
                event.updated_at = int(now_utc.timestamp())

            for socket_id, pr in priorities.items():
                if not pr:
                    session.delete(session.get(StateUpdates, socket_id))
                    continue

                highest_priority = max(pr.keys())
                state, event = pr[highest_priority]
                update = session.get(StateUpdates, socket_id)
                if update is None:
                    update = StateUpdates(socket_id=socket_id)
                    session.add(update)
                update.state = state
                update.time_utc = now_utc

                new_priorities: list[PriorityState] = []
                for priority, (st, ev) in pr.items():
                    pr = PriorityState(socket_id=socket_id, priority=priority, state=st)
                    if isinstance(ev, RepeatingEvent):
                        pr.repeating_id = ev.id
                    elif isinstance(ev, DatedEvent):
                        pr.dated_id = ev.id
                    new_priorities.append(pr)
                update.priorities = new_priorities

            session.commit()

            return {
                update.socket_id: update.state
                for update in session.scalars(select(StateUpdates)).unique()
            }


def validate_repeating_payload(
    payload: dict[str, Any], partial: bool = False
) -> dict[str, Any]:
    required = {
        "name",
        "socket_id",
        "action",
        "minutes_from_midnight",
        "days",
        "timezone",
    }
    if not partial:
        missing = sorted(required - payload.keys())
        if missing:
            raise ValueError(f"Missing fields: {', '.join(missing)}")

    validated: dict[str, Any] = {}

    if "name" in payload:
        name = str(payload["name"] or "").strip()
        validated["name"] = name or None

    if "enabled" in payload:
        validated["enabled"] = bool(payload["enabled"])

    if "socket_id" in payload:
        socket_id = int(payload["socket_id"])
        if socket_id not in {1, 2, 3, 4}:
            raise ValueError("socket_id must be between 1 and 4")
        validated["socket_id"] = socket_id

    if "priority" in payload:
        validated["priority"] = int(payload["priority"])

    if "action" in payload:
        action = str(payload["action"]).lower()
        if action not in ACTIONS:
            raise ValueError("action must be one of: on, off, reset")
        validated["action"] = action

    if "minutes_from_midnight" in payload:
        minutes = int(payload["minutes_from_midnight"])
        if minutes < 0 or minutes > 1439:
            raise ValueError("minutes_from_midnight must be between 0 and 1439")
        validated["minutes_from_midnight"] = minutes

    if "days" in payload:
        days = int(payload["days"])
        if days < 0 or days > 127:
            raise ValueError("days must be a bitmask between 0x00 and 0x7f")
        validated["days"] = days

    if "timezone" in payload:
        tz = str(payload["timezone"]).strip()
        if not tz:
            raise ValueError("timezone must not be empty")
        validated["timezone"] = tz

    if not partial:
        validated.setdefault("enabled", True)
        validated.setdefault("priority", 0)
        validated.setdefault("days", 0b111_1111)

    return validated


def validate_dated_payload(
    payload: dict[str, Any], partial: bool = False
) -> dict[str, Any]:
    required = {"name", "socket_id", "action", "trigger_at", "timezone"}
    if not partial:
        missing = sorted(required - payload.keys())
        if missing:
            raise ValueError(f"Missing fields: {', '.join(missing)}")

    validated: dict[str, Any] = {}

    if "name" in payload:
        name = str(payload["name"] or "").strip()
        validated["name"] = name or None

    if "enabled" in payload:
        validated["enabled"] = bool(payload["enabled"])

    if "socket_id" in payload:
        socket_id = int(payload["socket_id"])
        if socket_id not in {1, 2, 3, 4}:
            raise ValueError("socket_id must be between 1 and 4")
        validated["socket_id"] = socket_id

    if "priority" in payload:
        validated["priority"] = int(payload["priority"])

    if "action" in payload:
        action = str(payload["action"]).lower()
        if action not in ACTIONS:
            raise ValueError("action must be one of: on, off, reset")
        validated["action"] = action

    if "trigger_at" in payload:
        trigger_at = str(payload["trigger_at"] or "").strip()
        if not trigger_at:
            raise ValueError("trigger_at must not be empty")
        validated["trigger_at"] = trigger_at

    if "timezone" in payload:
        tz = str(payload["timezone"] or "").strip()
        if not tz:
            raise ValueError("timezone must not be empty")
        validated["timezone"] = tz

    if not partial:
        validated.setdefault("enabled", True)
        validated.setdefault("priority", 0)

    return validated
