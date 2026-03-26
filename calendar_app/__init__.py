from __future__ import annotations

# pyright: reportUnusedFunction=false
import atexit
import logging
from typing import Any, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Flask, jsonify, request

from .calendar_config import load_calendar_config
from .database import (
    CalendarStore,
    validate_dated_payload,
    validate_repeating_payload,
)
from .scheduler import CalendarScheduler

logging.basicConfig(level=logging.DEBUG)


def _json_error(message: str, status: int):
    return jsonify({"error": message}), status


def _validate_timezone(name: str) -> None:
    try:
        ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Unknown timezone: {name}") from exc


def create_app() -> Flask:
    app = Flask(__name__)

    calendar_config = load_calendar_config()
    store = CalendarStore(calendar_config["db_engine"], enginekwargs=dict(echo=False))
    store.init_db()
    logging.debug("Database initialised")

    scheduler = CalendarScheduler(
        store=store,
        rebroadcast_interval_seconds=calendar_config["rebroadcast_interval_seconds"],
        refreshdb_interval_seconds=calendar_config["refreshdb_interval_seconds"],
    )
    logging.debug("Scheduler initialised")

    if calendar_config["scheduler_enabled"]:
        scheduler.start()
        atexit.register(scheduler.shutdown)
        logging.debug("Scheduler started")

    def rebuild_scheduler_if_enabled() -> None:
        if calendar_config["scheduler_enabled"]:
            scheduler.rebuild_jobs()

    @app.get("/api/events")
    def list_events():
        repeating, dated = store.list_events()
        return jsonify(
            {
                "repeating": [e.serialise() for e in repeating],
                "dated": [e.serialise() for e in dated],
            }
        )

    @app.get("/api/events/repeating")
    def list_repeating_events():
        return jsonify([e.serialise() for e in store.list_repeating_events()])

    @app.post("/api/events/repeating")
    def create_repeating_event():
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_repeating_payload(payload, partial=False)
            _validate_timezone(validated["timezone"])
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.create_repeating_event(validated)
        rebuild_scheduler_if_enabled()
        return jsonify(event), 201

    @app.put("/api/events/repeating/<int:event_id>")
    def update_repeating_event(event_id: int):
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_repeating_payload(payload, partial=True)
            if "timezone" in validated:
                _validate_timezone(validated["timezone"])
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.update_repeating_event(event_id, validated)
        if event is None:
            return _json_error("Repeating event not found", 404)

        rebuild_scheduler_if_enabled()
        return jsonify(event)

    @app.delete("/api/events/repeating/<int:event_id>")
    def delete_repeating_event(event_id: int):
        deleted = store.delete_repeating_event(event_id)
        if not deleted:
            return _json_error("Repeating event not found", 404)

        rebuild_scheduler_if_enabled()
        return "", 204

    @app.get("/api/events/dated")
    def list_dated_events():
        return jsonify([e.serialise() for e in store.list_dated_events()])

    @app.post("/api/events/dated")
    def create_dated_event():
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_dated_payload(payload, partial=False)
            _validate_timezone(validated["timezone"])
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.create_dated_event(validated)
        rebuild_scheduler_if_enabled()
        return jsonify(event), 201

    @app.put("/api/events/dated/<int:event_id>")
    def update_dated_event(event_id: int):
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_dated_payload(payload, partial=True)
            if "timezone" in validated:
                _validate_timezone(validated["timezone"])
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.update_dated_event(event_id, validated)
        if event is None:
            return _json_error("Dated event not found", 404)

        rebuild_scheduler_if_enabled()
        return jsonify(event)

    @app.delete("/api/events/dated/<int:event_id>")
    def delete_dated_event(event_id: int):
        deleted = store.delete_dated_event(event_id)
        if not deleted:
            return _json_error("Dated event not found", 404)

        rebuild_scheduler_if_enabled()
        return "", 204

    @app.get("/api/status")
    def status():
        scheduler_targets = scheduler.socket_targets
        return jsonify({"targets": scheduler_targets})

    @app.get("/api/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "scheduler_enabled": calendar_config["scheduler_enabled"],
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001)
