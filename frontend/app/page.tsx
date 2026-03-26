"use client";

import { useEffect, useMemo, useState } from "react";

import { DatedEventsSection } from "./components/DatedEventsSection";
import { CurrentStatusSection } from "./components/CurrentStatusSection";
import { HeaderSection } from "./components/HeaderSection";
import { RepeatingEventsSection } from "./components/RepeatingEventsSection";
import { TimelineSection } from "./components/TimelineSection";
import { DatedDraft, DEVICES, RepeatingDraft } from "./page-types";
import { datedToDraft, dayRange, repeatingToDraft } from "./page-utils";
import {
  createDatedEvent,
  createRepeatingEvent,
  DatedEvent,
  fetchEvents,
  fetchHealth,
  fetchStatus,
  RepeatingEvent,
  updateDatedEvent,
  updateRepeatingEvent,
  deleteRepeatingEvent,
  deleteDatedEvent,
} from "./schedule-api";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [statusTargets, setStatusTargets] = useState<Record<string, boolean>>(
    {},
  );
  const [repeating, setRepeating] = useState<RepeatingEvent[]>([]);
  const [dated, setDated] = useState<DatedEvent[]>([]);
  const [editingRepeatingId, setEditingRepeatingId] = useState<
    number | "new" | null
  >(null);
  const [repeatingDraft, setRepeatingDraft] = useState<RepeatingDraft | null>(
    null,
  );
  const [editingDatedId, setEditingDatedId] = useState<number | "new" | null>(
    null,
  );
  const [datedDraft, setDatedDraft] = useState<DatedDraft | null>(null);

  const days = useMemo(() => dayRange(), []);

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
      setRepeating(events.repeating);
      setDated(events.dated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatusOnly(): Promise<void> {
    try {
      const status = await fetchStatus();
      setStatusTargets(status.targets ?? {});
    } catch {
      // Keep the last known status if polling fails transiently.
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshStatusOnly();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const defaultTimezone = useMemo(
    () => repeating[0]?.timezone ?? dated[0]?.timezone ?? "UTC",
    [repeating, dated],
  );

  function startNewRepeating() {
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
    setEditingRepeatingId(event.id);
    setRepeatingDraft(repeatingToDraft(event));
  }

  async function submitRepeating() {
    if (!repeatingDraft) {
      return;
    }
    if (editingRepeatingId === "new") {
      const created = await createRepeatingEvent(repeatingDraft);
      setRepeating((prev) => [...prev, created]);
    } else if (typeof editingRepeatingId === "number") {
      const updated = await updateRepeatingEvent(
        editingRepeatingId,
        repeatingDraft,
      );
      setRepeating((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    }
    setEditingRepeatingId(null);
    setRepeatingDraft(null);
  }

  async function removeRepeating(eventId: number) {
    await deleteRepeatingEvent(eventId);
    setRepeating((prev) => prev.filter((e) => e.id !== eventId));
    if (editingRepeatingId === eventId) {
      setEditingRepeatingId(null);
      setRepeatingDraft(null);
    }
  }

  function startNewDated() {
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
    setEditingDatedId(event.id);
    setDatedDraft(datedToDraft(event));
  }

  async function submitDated() {
    if (!datedDraft) {
      return;
    }
    if (editingDatedId === "new") {
      const created = await createDatedEvent(datedDraft);
      setDated((prev) => [...prev, created]);
    } else if (typeof editingDatedId === "number") {
      const updated = await updateDatedEvent(editingDatedId, datedDraft);
      setDated((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    }
    setEditingDatedId(null);
    setDatedDraft(null);
  }

  async function removeDated(eventId: number) {
    await deleteDatedEvent(eventId);
    setDated((prev) => prev.filter((e) => e.id !== eventId));
    if (editingDatedId === eventId) {
      setEditingDatedId(null);
      setDatedDraft(null);
    }
  }

  const repeatingSorted = useMemo(
    () =>
      [...repeating].sort(
        (a, b) => a.minutes_from_midnight - b.minutes_from_midnight,
      ),
    [repeating],
  );
  const datedSorted = useMemo(
    () => [...dated].sort((a, b) => a.trigger_at - b.trigger_at),
    [dated],
  );

  const now = Date.now();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffedd5_0%,_#fff7ed_22%,_#f8fafc_100%)] text-slate-900">
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
        <HeaderSection
          schedulerEnabled={schedulerEnabled}
          error={error}
          onRefresh={() => void refresh()}
        />

        <CurrentStatusSection devices={DEVICES} statusTargets={statusTargets} />

        <TimelineSection
          days={days}
          devices={DEVICES}
          repeating={repeating}
          dated={dated}
        />

        <RepeatingEventsSection
          devices={DEVICES}
          loading={loading}
          repeating={repeating}
          dated={dated}
          repeatingSorted={repeatingSorted}
          editingRepeatingId={editingRepeatingId}
          repeatingDraft={repeatingDraft}
          setEditingRepeatingId={setEditingRepeatingId}
          setRepeatingDraft={setRepeatingDraft}
          onStartNew={startNewRepeating}
          onStartEdit={startEditRepeating}
          onSubmit={submitRepeating}
          onRemove={removeRepeating}
        />

        <DatedEventsSection
          devices={DEVICES}
          loading={loading}
          now={now}
          datedSorted={datedSorted}
          editingDatedId={editingDatedId}
          datedDraft={datedDraft}
          setEditingDatedId={setEditingDatedId}
          setDatedDraft={setDatedDraft}
          onStartNew={startNewDated}
          onStartEdit={startEditDated}
          onSubmit={submitDated}
          onRemove={removeDated}
        />
      </main>
    </div>
  );
}
