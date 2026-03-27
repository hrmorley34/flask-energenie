type HeaderSectionProps = {
  schedulerEnabled: boolean;
  error: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function HeaderSection({
  schedulerEnabled,
  error,
  isRefreshing,
  onRefresh,
}: HeaderSectionProps) {
  return (
    <header className="mb-6 rounded-2xl border border-orange-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Energenie Calendar Viewer
          </h1>
          <p className="text-sm text-slate-600">
            Single-page status, timeline, and event editor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium">
            Scheduler: {schedulerEnabled ? "enabled" : "disabled"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh status and events"
            disabled={isRefreshing}
            className="rounded-md border border-orange-300 bg-orange-100 px-3 py-1 text-xs font-medium text-orange-900 hover:bg-orange-200"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </header>
  );
}
