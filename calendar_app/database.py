from __future__ import annotations

from collections import defaultdict
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from typing import (
    Any,
    ContextManager,
    Literal,
    NewType,
    NotRequired,
    Sequence,
    TypedDict,
)
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Boolean, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    declared_attr,
    mapped_column,
    relationship,
    sessionmaker,
)

RepeatingType = Literal["repeating"]
TYPE_REPEATING: RepeatingType = "repeating"
DatedType = Literal["dated"]
TYPE_DATED: DatedType = "dated"
ActionType = Literal["on", "off", "reset"]
ACTIONS: set[ActionType] = {"on", "off", "reset"}
TimezoneName = NewType("TimezoneName", str)


def _validate_action(action: str) -> ActionType:
    action = action.lower()
    if action not in ACTIONS:
        raise ValueError("action must be one of: on, off, reset")
    return action


def _validate_timezone(name: str) -> TimezoneName:
    try:
        ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Unknown timezone: {name}") from exc
    else:
        return TimezoneName(name)


def utcnow_timestamp() -> int:
    return int(datetime.now(timezone.utc).timestamp())


class Base(DeclarativeBase):
    pass


class EmptyDict(TypedDict):
    pass


class SerialisableBase(Base):
    __abstract__ = True

    def serialise(self) -> EmptyDict:
        return {}


class TimestampedDict(EmptyDict):
    created_at: int
    updated_at: int


class TimestampedBase(SerialisableBase):
    __abstract__ = True

    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False)

    def serialise(self) -> TimestampedDict:
        return {
            **super().serialise(),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class EventOwnerDict(EmptyDict):
    id: int
    name: str


class EventOwner(SerialisableBase):
    __tablename__ = "event_owners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    def serialise(self) -> EventOwnerDict:
        return {
            **super().serialise(),
            "id": self.id,
            "name": self.name,
        }


class EventBaseDict(TimestampedDict):
    name: str | None
    enabled: bool
    socket_id: int
    priority: int
    action: ActionType
    owner: EventOwnerDict


class EventBaseCreateDict(TypedDict):
    name: str | None
    enabled: NotRequired[bool]
    socket_id: int
    priority: NotRequired[int]
    action: ActionType


EVENT_BASE_CREATE_REQUIRED = {"name", "socket_id", "action"}


def validate_event_base_create_payload(payload: dict[str, Any]) -> EventBaseCreateDict:
    missing = EVENT_BASE_CREATE_REQUIRED - payload.keys()
    if missing:
        raise ValueError(f"Missing fields: {', '.join(sorted(missing))}")
    return {
        "name": str(payload["name"] or "").strip() or None,
        "enabled": bool(payload.get("enabled", True)),
        "socket_id": int(payload["socket_id"]),
        "priority": int(payload.get("priority", 0)),
        "action": _validate_action(payload["action"]),
    }


class EventBaseUpdateDict(TypedDict, total=False):
    name: str | None
    enabled: bool
    socket_id: int
    priority: int
    action: ActionType


def validate_event_base_update_payload(payload: dict[str, Any]) -> EventBaseUpdateDict:
    ud: EventBaseUpdateDict = {}
    if "name" in payload:
        ud["name"] = str(payload["name"] or "").strip() or None
    if "enabled" in payload:
        ud["enabled"] = bool(payload["enabled"])
    if "socket_id" in payload:
        ud["socket_id"] = int(payload["socket_id"])
    if "priority" in payload:
        ud["priority"] = int(payload["priority"])
    if "action" in payload:
        ud["action"] = _validate_action(payload["action"])
    return ud


class EventBase(TimestampedBase):
    __abstract__ = True

    name: Mapped[str | None] = mapped_column(String, nullable=True)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("event_owners.id"), nullable=False
    )

    @declared_attr
    @classmethod
    def owner(cls) -> Mapped[EventOwner]:
        return relationship("EventOwner", lazy="joined")

    socket_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[ActionType] = mapped_column(String, nullable=False)

    def serialise(self) -> EventBaseDict:
        return {
            **super().serialise(),
            "name": self.name,
            "enabled": self.enabled,
            "socket_id": self.socket_id,
            "priority": self.priority,
            "action": self.action,
            "owner": self.owner.serialise(),
        }


class RepeatingEventDict(EventBaseDict):
    type: RepeatingType
    id: int
    minutes_from_midnight: int
    days: int
    timezone: TimezoneName
    last_triggered: int | None


class RepeatingEventCreateDict(EventBaseCreateDict):
    minutes_from_midnight: int
    days: NotRequired[int]
    timezone: TimezoneName


REPEATING_EVENT_CREATE_REQUIRED = EVENT_BASE_CREATE_REQUIRED | {
    "minutes_from_midnight",
    "days",
    "timezone",
}


def validate_repeating_event_create_payload(
    payload: dict[str, Any],
) -> RepeatingEventCreateDict:
    missing = REPEATING_EVENT_CREATE_REQUIRED - payload.keys()
    if missing:
        raise ValueError(f"Missing fields: {', '.join(sorted(missing))}")
    return {
        **validate_event_base_create_payload(payload),
        "minutes_from_midnight": int(payload["minutes_from_midnight"]),
        "days": int(payload.get("days", 0b111_1111)),
        "timezone": _validate_timezone(payload["timezone"]),
    }


class RepeatingEventUpdateDict(EventBaseUpdateDict, total=False):
    minutes_from_midnight: int
    days: int
    timezone: TimezoneName


def validate_repeating_event_update_payload(
    payload: dict[str, Any],
) -> RepeatingEventUpdateDict:
    ud: RepeatingEventUpdateDict = {**validate_event_base_update_payload(payload)}
    if "minutes_from_midnight" in payload:
        ud["minutes_from_midnight"] = int(payload["minutes_from_midnight"])
    if "days" in payload:
        ud["days"] = int(payload["days"])
    if "timezone" in payload:
        ud["timezone"] = _validate_timezone(payload["timezone"])
    return ud


class RepeatingEvent(EventBase):
    __tablename__ = "events_repeating"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    minutes_from_midnight: Mapped[int] = mapped_column(Integer, nullable=False)

    days: Mapped[int] = mapped_column(Integer, nullable=False)
    "Bitmask of days of the week, starting with Monday as bit 0."

    timezone: Mapped[TimezoneName] = mapped_column(String, nullable=False)

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

    def serialise(self) -> RepeatingEventDict:
        return {
            **super().serialise(),
            "type": TYPE_REPEATING,
            "id": self.id,
            "minutes_from_midnight": self.minutes_from_midnight,
            "days": self.days,
            "timezone": self.timezone,
            "last_triggered": self.last_triggered,
        }


class DatedEventDict(EventBaseDict):
    type: DatedType
    id: int
    trigger_at: int
    timezone: TimezoneName
    consumed_at: int | None


class DatedEventCreateDict(EventBaseCreateDict):
    trigger_at: int
    timezone: TimezoneName


DATED_EVENT_CREATE_REQUIRED = EVENT_BASE_CREATE_REQUIRED | {"trigger_at", "timezone"}


def validate_dated_event_create_payload(
    payload: dict[str, Any],
) -> DatedEventCreateDict:
    missing = DATED_EVENT_CREATE_REQUIRED - payload.keys()
    if missing:
        raise ValueError(f"Missing fields: {', '.join(sorted(missing))}")
    return {
        **validate_event_base_create_payload(payload),
        "trigger_at": int(payload["trigger_at"]),
        "timezone": _validate_timezone(payload["timezone"]),
    }


class DatedEventUpdateDict(EventBaseUpdateDict, total=False):
    trigger_at: int
    timezone: TimezoneName


def validate_dated_event_update_payload(
    payload: dict[str, Any],
) -> DatedEventUpdateDict:
    ud: DatedEventUpdateDict = {**validate_event_base_update_payload(payload)}
    if "trigger_at" in payload:
        ud["trigger_at"] = int(payload["trigger_at"])
    if "timezone" in payload:
        ud["timezone"] = _validate_timezone(payload["timezone"])
    return ud


class DatedEvent(EventBase):
    __tablename__ = "events_dated"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    trigger_at: Mapped[int] = mapped_column(Integer, nullable=False)
    "UNIX timestamp of when the event should trigger."

    timezone: Mapped[TimezoneName] = mapped_column(String, nullable=False)

    consumed_at: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def tzinfo(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def trigger_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.trigger_at, tz=self.tzinfo)

    def serialise(self) -> DatedEventDict:
        return {
            **super().serialise(),
            "type": TYPE_DATED,
            "id": self.id,
            "trigger_at": self.trigger_at,
            "timezone": self.timezone,
            "consumed_at": self.consumed_at,
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
    repeating_event: Mapped[RepeatingEvent | None] = relationship(lazy="joined")
    dated_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("events_dated.id"), nullable=True
    )
    dated_event: Mapped[DatedEvent | None] = relationship(lazy="joined")

    update: Mapped[StateUpdates] = relationship(
        "StateUpdates",
        lazy="joined",
        back_populates="priorities",
        cascade="all, delete",
    )

    @property
    def owner_id(self) -> int | None:
        if self.repeating_event is not None:
            return self.repeating_event.owner_id
        elif self.dated_event is not None:
            return self.dated_event.owner_id
        else:
            return None

    @property
    def owner(self) -> EventOwner | None:
        if self.repeating_event is not None:
            return self.repeating_event.owner
        elif self.dated_event is not None:
            return self.dated_event.owner
        else:
            return None


class CalendarStore:
    def __init__(self, url: str, *, enginekwargs: dict[str, Any] = {}) -> None:
        self.engine = create_engine(url, **enginekwargs)
        self._session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def init_db(self) -> None:
        Base.metadata.create_all(self.engine)
        with self._session_factory() as session:
            if session.scalars(select(EventOwner)).first() is None:
                # Create a default owner for manually added events
                session.add(EventOwner(name="manual"))
                session.commit()

    def _ensure_session(self, session: Session | None) -> ContextManager[Session]:
        if session is not None:
            return nullcontext(session)
        else:
            return self._session_factory()

    def session(self) -> Session:
        return self._session_factory()

    def list_owners(self, *, session: Session | None = None) -> Sequence[EventOwner]:
        with self._ensure_session(session) as session:
            return session.scalars(select(EventOwner)).all()

    def get_owner_by_name(
        self, name: str, *, session: Session | None = None
    ) -> EventOwner | None:
        with self._ensure_session(session) as session:
            return session.scalar(select(EventOwner).filter(EventOwner.name == name))

    def ensure_owner_by_name(
        self, name: str, *, session: Session | None = None
    ) -> EventOwner:
        with self._ensure_session(session) as session:
            owner = session.scalar(select(EventOwner).filter(EventOwner.name == name))
            if owner is None:
                owner = EventOwner(name=name)
                session.add(owner)
                session.commit()
            return owner

    def list_repeating_events(
        self, socket_id: int | None = None, *, session: Session | None = None
    ) -> Sequence[RepeatingEvent]:
        with self._ensure_session(session) as session:
            query = select(RepeatingEvent)
            if socket_id is not None:
                query = query.filter(RepeatingEvent.socket_id == socket_id)
            return session.scalars(query).all()

    def list_dated_events(
        self, socket_id: int | None = None, *, session: Session | None = None
    ) -> Sequence[DatedEvent]:
        with self._ensure_session(session) as session:
            query = select(DatedEvent)
            if socket_id is not None:
                query = query.filter(DatedEvent.socket_id == socket_id)
            return session.scalars(query).all()

    def get_repeating_event(
        self, event_id: int, *, session: Session | None = None
    ) -> RepeatingEvent | None:
        with self._ensure_session(session) as session:
            return session.get(RepeatingEvent, event_id)

    def get_dated_event(
        self, event_id: int, *, session: Session | None = None
    ) -> DatedEvent | None:
        with self._ensure_session(session) as session:
            return session.get(DatedEvent, event_id)

    def create_repeating_event(
        self,
        owner_id: int,
        payload: RepeatingEventCreateDict,
        *,
        session: Session | None = None,
    ) -> RepeatingEvent:
        with self._ensure_session(session) as session:
            now = utcnow_timestamp()
            event = RepeatingEvent(
                created_at=now,
                updated_at=now,
                name=payload["name"],
                enabled=payload.get("enabled", True),
                socket_id=payload["socket_id"],
                priority=payload.get("priority", 0),
                action=payload["action"],
                owner_id=owner_id,
                minutes_from_midnight=payload["minutes_from_midnight"],
                days=payload.get("days", 0b111_1111),
                timezone=payload["timezone"],
                last_triggered=None,
            )
            session.add(event)
            session.commit()
            session.refresh(event)  # force population of relationships
            return event

    def create_dated_event(
        self,
        owner_id: int,
        payload: DatedEventCreateDict,
        *,
        session: Session | None = None,
    ) -> DatedEvent:
        with self._ensure_session(session) as session:
            now = utcnow_timestamp()
            event = DatedEvent(
                created_at=now,
                updated_at=now,
                name=payload["name"],
                enabled=payload.get("enabled", True),
                socket_id=payload["socket_id"],
                priority=payload.get("priority", 0),
                action=payload["action"],
                owner_id=owner_id,
                trigger_at=payload["trigger_at"],
                timezone=payload["timezone"],
                consumed_at=None,
            )
            session.add(event)
            session.commit()
            session.refresh(event)  # force population of relationships
            return event

    def update_repeating_event(
        self,
        owner_id: int,
        event_id: int,
        payload: RepeatingEventUpdateDict,
        *,
        session: Session | None = None,
    ) -> RepeatingEvent | None:
        with self._ensure_session(session) as session:
            event = session.get(RepeatingEvent, event_id)
            if event is None:
                return None
            if event.owner_id != owner_id:
                raise ValueError("Incorrect owner_id for event")

            for key, value in payload.items():
                if hasattr(event, key):
                    setattr(event, key, value)
            event.updated_at = utcnow_timestamp()

            session.commit()
            return event

    def update_dated_event(
        self,
        owner_id: int,
        event_id: int,
        payload: DatedEventUpdateDict,
        *,
        session: Session | None = None,
    ) -> DatedEvent | None:
        with self._ensure_session(session) as session:
            event = session.get(DatedEvent, event_id)
            if event is None:
                return None
            if event.owner_id != owner_id:
                raise ValueError("Incorrect owner_id for event")

            for key, value in payload.items():
                if hasattr(event, key):
                    setattr(event, key, value)
            event.updated_at = utcnow_timestamp()

            session.commit()
            return event

    def delete_repeating_event(
        self, owner_id: int, event_id: int, *, session: Session | None = None
    ) -> bool:
        with self._ensure_session(session) as session:
            event = session.get(RepeatingEvent, event_id)
            if event is None:
                return False
            if event.owner_id != owner_id:
                raise ValueError("Incorrect owner_id for event")
            session.delete(event)
            session.commit()
            return True

    def delete_dated_event(
        self, owner_id: int, event_id: int, *, session: Session | None = None
    ) -> bool:
        with self._ensure_session(session) as session:
            event = session.get(DatedEvent, event_id)
            if event is None:
                return False
            if event.owner_id != owner_id:
                raise ValueError("Incorrect owner_id for event")
            session.delete(event)
            session.commit()
            return True

    def list_enabled_repeating_events(
        self, *, session: Session | None = None
    ) -> Sequence[RepeatingEvent]:
        with self._ensure_session(session) as session:
            return session.scalars(
                select(RepeatingEvent).filter(RepeatingEvent.enabled.is_(True))
            ).all()

    def list_pending_dated_events(
        self, *, session: Session | None = None
    ) -> Sequence[DatedEvent]:
        with self._ensure_session(session) as session:
            return session.scalars(
                select(DatedEvent).filter(
                    DatedEvent.enabled.is_(True), DatedEvent.consumed_at.is_(None)
                )
            ).all()

    def consume_events(
        self, now_utc: datetime, *, session: Session | None = None
    ) -> dict[int, bool]:
        with self._ensure_session(session) as session:
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
