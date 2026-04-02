from __future__ import annotations

# pyright: reportUnusedFunction=false
import atexit
import logging
from datetime import datetime
from typing import Any, cast

from flask import Flask, jsonify, request

from .calendar_config import load_calendar_config
from .database import (
    CalendarStore,
    validate_dated_event_create_payload,
    validate_dated_event_update_payload,
    validate_repeating_event_create_payload,
    validate_repeating_event_update_payload,
)
from .scheduler import CalendarScheduler

logging.basicConfig(level=logging.INFO)


def _json_error(message: str, status: int):
    return jsonify({"error": message}), status


def create_app() -> Flask:
    app = Flask(__name__)

    calendar_config = load_calendar_config()
    store = CalendarStore(calendar_config["db_engine"], enginekwargs=dict(echo=False))
    store.init_db()
    logging.debug("Database initialised")

    scheduler = CalendarScheduler(store=store, config=calendar_config)
    logging.debug("Scheduler initialised")

    if calendar_config["scheduler_enabled"]:
        scheduler.start()
        atexit.register(scheduler.shutdown)
        logging.debug("Scheduler started")

    def rebuild_scheduler_if_enabled() -> None:
        if calendar_config["scheduler_enabled"]:
            scheduler.rebuild_jobs()

    @app.get("/api/owners")
    def list_owners():
        return jsonify([owner.serialise() for owner in store.list_owners()])

    @app.get("/api/owners/by-name/<string:name>")  # ?[create=true]
    def get_owner_by_name(name: str):
        create_if_missing = request.args.get("create", "").lower() == "true"
        if create_if_missing:
            owner = store.ensure_owner_by_name(name)
        else:
            owner = store.get_owner_by_name(name)
            if owner is None:
                return _json_error("Owner not found", 404)

        return jsonify(owner.serialise())

    @app.get("/api/events")
    def list_events():
        after = request.args.get("after")
        if after is not None:
            try:
                after = datetime.fromtimestamp(int(after))
            except ValueError:
                return _json_error("Invalid 'after' parameter", 400)

        with store.session() as session:
            past = store.list_past_events(after, session=session)
            repeating = store.list_future_repeating_events(session=session)
            dated = store.list_future_dated_events(session=session)
            return jsonify(
                {
                    "past": [e.serialise() for e in past],
                    "repeating": [e.serialise() for e in repeating],
                    "dated": [e.serialise() for e in dated],
                }
            )

    @app.post("/api/owners/<int:owner_id>/events/repeating")
    def create_repeating_event(owner_id: int):
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_repeating_event_create_payload(payload)
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.create_repeating_event(owner_id, validated)
        rebuild_scheduler_if_enabled()
        return jsonify(event.serialise()), 201

    @app.put("/api/owners/<int:owner_id>/events/repeating/<int:event_id>")
    def update_repeating_event(owner_id: int, event_id: int):
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_repeating_event_update_payload(payload)
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.update_repeating_event(owner_id, event_id, validated)
        if event is None:
            return _json_error("Repeating event not found", 404)

        rebuild_scheduler_if_enabled()
        return jsonify(event.serialise())

    @app.delete("/api/owners/<int:owner_id>/events/repeating/<int:event_id>")
    def delete_repeating_event(owner_id: int, event_id: int):
        deleted = store.delete_repeating_event(owner_id, event_id)
        if not deleted:
            return _json_error("Repeating event not found", 404)

        rebuild_scheduler_if_enabled()
        return "", 204

    @app.post("/api/owners/<int:owner_id>/events/dated")
    def create_dated_event(owner_id: int):
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_dated_event_create_payload(payload)
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.create_dated_event(owner_id, validated)
        rebuild_scheduler_if_enabled()
        return jsonify(event.serialise()), 201

    @app.put("/api/owners/<int:owner_id>/events/dated/<int:event_id>")
    def update_dated_event(owner_id: int, event_id: int):
        payload = cast(dict[str, Any], request.get_json(silent=True) or {})
        try:
            validated = validate_dated_event_update_payload(payload)
        except ValueError as exc:
            return _json_error(str(exc), 400)

        event = store.update_dated_event(owner_id, event_id, validated)
        if event is None:
            return _json_error("Dated event not found", 404)

        rebuild_scheduler_if_enabled()
        return jsonify(event.serialise())

    @app.delete("/api/owners/<int:owner_id>/events/dated/<int:event_id>")
    def delete_dated_event(owner_id: int, event_id: int):
        deleted = store.delete_dated_event(owner_id, event_id)
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
