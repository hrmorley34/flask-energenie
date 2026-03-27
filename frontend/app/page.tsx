"use client";

import { DatedEventsSection } from "./components/DatedEventsSection";
import { CurrentStatusSection } from "./components/CurrentStatusSection";
import { HeaderSection } from "./components/HeaderSection";
import { RepeatingEventsSection } from "./components/RepeatingEventsSection";
import { TimelineSection } from "./components/TimelineSection";
import { DEVICES } from "./page-types";
import { useSchedulePageState } from "./useSchedulePageState";

export default function Home() {
  const {
    loading,
    error,
    schedulerEnabled,
    statusTargets,
    days,
    repeating,
    dated,
    repeatingSorted,
    datedSorted,
    now,
    editingRepeatingId,
    repeatingDraft,
    editingDatedId,
    datedDraft,
    submittingRepeating,
    submittingDated,
    deletingRepeatingId,
    deletingDatedId,
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
  } = useSchedulePageState();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffedd5_0%,_#fff7ed_22%,_#f8fafc_100%)] text-slate-900">
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
        <HeaderSection
          schedulerEnabled={schedulerEnabled}
          error={error}
          isRefreshing={loading}
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
          isSubmitting={submittingRepeating}
          deletingEventId={deletingRepeatingId}
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
          isSubmitting={submittingDated}
          deletingEventId={deletingDatedId}
        />
      </main>
    </div>
  );
}
