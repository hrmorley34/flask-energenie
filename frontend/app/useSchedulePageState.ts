import { useEffect, useMemo, useState } from "react";

import { DatedDraft, RepeatingDraft } from "./page-types";
import { getWritableOwnerIdFromPublicEnv } from "./owner-config";
import { datedToDraft, dayRange, repeatingToDraft } from "./page-utils";
import {
  createDatedEvent,
  createRepeatingEvent,
  DatedEvent,
  deleteDatedEvent,
  deleteRepeatingEvent,
  fetchEvents,
  fetchHealth,
  fetchStatus,
  PastEvent,
  RepeatingEvent,
  updateDatedEvent,
  updateRepeatingEvent,
} from "./schedule-api";

export function useSchedulePageState() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingRepeating, setSubmittingRepeating] = useState(false);
  const [submittingDated, setSubmittingDated] = useState(false);
  const [deletingRepeatingId, setDeletingRepeatingId] = useState<number | null>(null);
  const [deletingDatedId, setDeletingDatedId] = useState<number | null>(null);
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [statusTargets, setStatusTargets] = useState<Record<string, boolean>>({});
  const [past, setPast] = useState<PastEvent[]>([]);
  const [repeating, setRepeating] = useState<RepeatingEvent[]>([]);
  const [dated, setDated] = useState<DatedEvent[]>([]);
  const [editingRepeatingId, setEditingRepeatingId] = useState<number | "new" | null>(null);
  const [repeatingDraft, setRepeatingDraft] = useState<RepeatingDraft | null>(null);
  const [editingDatedId, setEditingDatedId] = useState<number | "new" | null>(null);
  const [datedDraft, setDatedDraft] = useState<DatedDraft | null>(null);

  const days = useMemo(() => dayRange(), []);
  const writableOwnerId = getWritableOwnerIdFromPublicEnv();

  const ownerIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...repeating.map((event) => event.owner.id),
          ...dated.map((event) => event.owner.id),
          ...past.flatMap((event) => (event.owner ? [event.owner.id] : [])),
        ]),
      ).sort((a, b) => a - b),
    [past, repeating, dated],
  );

  const writableOwnerLabel = useMemo(() => {
    if (writableOwnerId === null) {
      return "?";
    }

    const matchingOwner =
      repeating.find((event) => event.owner.id === writableOwnerId)?.owner ??
      dated.find((event) => event.owner.id === writableOwnerId)?.owner ??
      past.find((event) => event.owner?.id === writableOwnerId)?.owner;

    if (!matchingOwner) {
      return `Owner ${writableOwnerId}`;
    }

    return `${matchingOwner.name} (${matchingOwner.id})`;
  }, [writableOwnerId, repeating, dated, past]);

  const writableOwnerConfigured = writableOwnerId !== null;

  function canWriteOwner(ownerId: number): boolean {
    return writableOwnerId !== null && ownerId === writableOwnerId;
  }

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [health, status, events] = await Promise.all([
        fetchHealth(),
        fetchStatus(),
        fetchEvents(),
      ]);
      setSchedulerEnabled(health.scheduler_enabled);
      setStatusTargets(status.targets ?? {});
      setPast(events.past);
      setRepeating(events.repeating);
      setDated(events.dated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatusOnly(): Promise<void> {
    const status = await fetchStatus();
    setStatusTargets(status.targets ?? {});
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;
    let failures = 0;
    let disposed = false;

    const scheduleNext = (delayMs: number) => {
      if (disposed) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        void poll();
      }, delayMs);
    };

    const poll = async () => {
      if (disposed) {
        return;
      }

      if (document.visibilityState === "hidden") {
        scheduleNext(5000);
        return;
      }

      try {
        await refreshStatusOnly();
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 4);
      }

      const nextDelayMs = Math.min(5000 * 2 ** failures, 30000);
      scheduleNext(nextDelayMs);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      void poll();
    };

    void poll();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const defaultTimezone = useMemo(
    () => repeating[0]?.timezone ?? dated[0]?.timezone ?? "UTC",
    [repeating, dated],
  );

  function startNewRepeating() {
    if (!writableOwnerConfigured) {
      setError("Writable owner is not configured");
      return;
    }
    setEditingRepeatingId("new");
    setRepeatingDraft({
      enabled: true,
      name: "",
      socket_id: 1,
      action: "on",
      minutes_from_midnight: 8 * 60,
      days: 0b111_1111,
      timezone: defaultTimezone,
      priority: 0,
    });
  }

  function startEditRepeating(event: RepeatingEvent) {
    if (!canWriteOwner(event.owner.id)) {
      setError("This event is read-only for the configured owner");
      return;
    }
    setEditingRepeatingId(event.id);
    setRepeatingDraft(repeatingToDraft(event));
  }

  async function submitRepeating() {
    if (!repeatingDraft || submittingRepeating) {
      return;
    }
    setError(null);
    setSubmittingRepeating(true);
    try {
      if (editingRepeatingId === "new") {
        if (!writableOwnerConfigured) {
          throw new Error("Writable owner is not configured");
        }
        const created = await createRepeatingEvent(repeatingDraft);
        setRepeating((prev) => [...prev, created]);
      } else if (typeof editingRepeatingId === "number") {
        const existing = repeating.find((event) => event.id === editingRepeatingId);
        if (!existing || !canWriteOwner(existing.owner.id)) {
          throw new Error("This event is read-only for the configured owner");
        }
        const updated = await updateRepeatingEvent(editingRepeatingId, repeatingDraft);
        setRepeating((prev) => prev.map((event) => (event.id === updated.id ? updated : event)));
      }
      setEditingRepeatingId(null);
      setRepeatingDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save repeating event");
    } finally {
      setSubmittingRepeating(false);
    }
  }

  async function removeRepeating(eventId: number) {
    if (submittingRepeating || deletingRepeatingId !== null) {
      return;
    }
    if (!window.confirm("Delete this repeating event?")) {
      return;
    }

    setError(null);
    setDeletingRepeatingId(eventId);
    try {
      const existing = repeating.find((event) => event.id === eventId);
      if (!existing || !canWriteOwner(existing.owner.id)) {
        throw new Error("This event is read-only for the configured owner");
      }
      await deleteRepeatingEvent(eventId);
      setRepeating((prev) => prev.filter((event) => event.id !== eventId));
      if (editingRepeatingId === eventId) {
        setEditingRepeatingId(null);
        setRepeatingDraft(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete repeating event");
    } finally {
      setDeletingRepeatingId(null);
    }
  }

  function startNewDated() {
    if (!writableOwnerConfigured) {
      setError("Writable owner is not configured");
      return;
    }
    setEditingDatedId("new");
    setDatedDraft({
      enabled: true,
      name: "",
      socket_id: 1,
      action: "on",
      trigger_at: Math.floor(Date.now() / 1000),
      timezone: defaultTimezone,
      priority: 0,
    });
  }

  function startEditDated(event: DatedEvent) {
    if (!canWriteOwner(event.owner.id)) {
      setError("This event is read-only for the configured owner");
      return;
    }
    setEditingDatedId(event.id);
    setDatedDraft(datedToDraft(event));
  }

  async function submitDated() {
    if (!datedDraft || submittingDated) {
      return;
    }
    setError(null);
    setSubmittingDated(true);
    try {
      if (editingDatedId === "new") {
        if (!writableOwnerConfigured) {
          throw new Error("Writable owner is not configured");
        }
        const created = await createDatedEvent(datedDraft);
        setDated((prev) => [...prev, created]);
      } else if (typeof editingDatedId === "number") {
        const existing = dated.find((event) => event.id === editingDatedId);
        if (!existing || !canWriteOwner(existing.owner.id)) {
          throw new Error("This event is read-only for the configured owner");
        }
        const updated = await updateDatedEvent(editingDatedId, datedDraft);
        setDated((prev) => prev.map((event) => (event.id === updated.id ? updated : event)));
      }
      setEditingDatedId(null);
      setDatedDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save dated event");
    } finally {
      setSubmittingDated(false);
    }
  }

  async function removeDated(eventId: number) {
    if (submittingDated || deletingDatedId !== null) {
      return;
    }
    if (!window.confirm("Delete this dated event?")) {
      return;
    }

    setError(null);
    setDeletingDatedId(eventId);
    try {
      const existing = dated.find((event) => event.id === eventId);
      if (!existing || !canWriteOwner(existing.owner.id)) {
        throw new Error("This event is read-only for the configured owner");
      }
      await deleteDatedEvent(eventId);
      setDated((prev) => prev.filter((event) => event.id !== eventId));
      if (editingDatedId === eventId) {
        setEditingDatedId(null);
        setDatedDraft(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dated event");
    } finally {
      setDeletingDatedId(null);
    }
  }

  const repeatingSorted = useMemo(
    () => [...repeating].sort((a, b) => a.minutes_from_midnight - b.minutes_from_midnight),
    [repeating],
  );

  const datedSorted = useMemo(
    () => [...dated].sort((a, b) => a.trigger_at - b.trigger_at),
    [dated],
  );

  const pastSorted = useMemo(
    () => [...past].sort((a, b) => b.timestamp - a.timestamp || b.consumed_at - a.consumed_at),
    [past],
  );

  return {
    loading,
    error,
    schedulerEnabled,
    statusTargets,
    ownerIds,
    writableOwnerId,
    writableOwnerLabel,
    days,
    past,
    pastSorted,
    repeating,
    dated,
    repeatingSorted,
    datedSorted,
    now: Date.now(),
    editingRepeatingId,
    repeatingDraft,
    editingDatedId,
    datedDraft,
    submittingRepeating,
    submittingDated,
    deletingRepeatingId,
    deletingDatedId,
    writableOwnerConfigured,
    refresh,
    startNewRepeating,
    startEditRepeating,
    submitRepeating,
    removeRepeating,
    setEditingRepeatingId,
    setRepeatingDraft,
    startNewDated,
    startEditDated,
    submitDated,
    removeDated,
    setEditingDatedId,
    setDatedDraft,
  };
}
