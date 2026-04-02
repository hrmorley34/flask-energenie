"use client";

import { DatedEventsSection } from "./components/DatedEventsSection";
import { CurrentStatusSection } from "./components/CurrentStatusSection";
import { HeaderSection } from "./components/HeaderSection";
import { PastEventsSection } from "./components/PastEventsSection";
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
    ownerIds,
    writableOwnerId,
    writableOwnerLabel,
    days,
    pastSorted,
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
  } = useSchedulePageState();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffedd5_0%,_#fff7ed_22%,_#f8fafc_100%)] text-slate-900">
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
        <HeaderSection
          schedulerEnabled={schedulerEnabled}
          error={error}
          ownerIds={ownerIds}
          writableOwnerId={writableOwnerId}
          writableOwnerConfigured={writableOwnerConfigured}
          isRefreshing={loading}
          onRefresh={() => void refresh()}
        />

        <CurrentStatusSection devices={DEVICES} statusTargets={statusTargets} />

        <TimelineSection
          days={days}
          devices={DEVICES}
          repeating={repeating}
          dated={dated}
          past={pastSorted}
          now={now}
        />

        <PastEventsSection loading={loading} pastSorted={pastSorted} />

        <RepeatingEventsSection
          devices={DEVICES}
          loading={loading}
          repeatingSorted={repeatingSorted}
          editingRepeatingId={editingRepeatingId}
          repeatingDraft={repeatingDraft}
          setEditingRepeatingId={setEditingRepeatingId}
          setRepeatingDraft={setRepeatingDraft}
          onStartNew={startNewRepeating}
          onStartEdit={startEditRepeating}
          onSubmit={submitRepeating}
          onRemove={removeRepeating}
          writableOwnerId={writableOwnerId}
          writableOwnerLabel={writableOwnerLabel}
          writableOwnerConfigured={writableOwnerConfigured}
          isSubmitting={submittingRepeating}
          deletingEventId={deletingRepeatingId}
        />

        <DatedEventsSection
          devices={DEVICES}
          loading={loading}
          datedSorted={datedSorted}
          editingDatedId={editingDatedId}
          datedDraft={datedDraft}
          setEditingDatedId={setEditingDatedId}
          setDatedDraft={setDatedDraft}
          onStartNew={startNewDated}
          onStartEdit={startEditDated}
          onSubmit={submitDated}
          onRemove={removeDated}
          writableOwnerId={writableOwnerId}
          writableOwnerLabel={writableOwnerLabel}
          writableOwnerConfigured={writableOwnerConfigured}
          isSubmitting={submittingDated}
          deletingEventId={deletingDatedId}
        />
      </main>
    </div>
  );
}
