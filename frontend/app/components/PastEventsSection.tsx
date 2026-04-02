import { PastEvent } from "../schedule-api";
import { formatDateTime } from "../page-utils";

type PastEventsSectionProps = {
  loading: boolean;
  pastSorted: PastEvent[];
};

export function PastEventsSection({ loading, pastSorted }: PastEventsSectionProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="past-events-heading"
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Past Events
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Action</th>
              <th className="px-2 py-2">Priority</th>
              <th className="px-2 py-2">Device</th>
              <th className="px-2 py-2">Effective At</th>
              <th className="px-2 py-2">Set At</th>
              <th className="px-2 py-2">Owner</th>
            </tr>
          </thead>
          <tbody>
            {pastSorted.map((event) => {
              const sourceHref =
                event.repeating_event_id !== null
                  ? `#repeating-event-${event.repeating_event_id}`
                  : "#dated-events-heading";
              const sourceLabel =
                event.repeating_event_id !== null
                  ? `Repeating #${event.repeating_event_id}`
                  : "Dated event";
              const rowClass = event.is_active ? "bg-amber-50" : "bg-white";

              return (
                <tr key={event.id} className={`border-b border-slate-100 ${rowClass}`}>
                  <td className="px-2 py-2">
                    <a
                      className="font-medium text-blue-700 hover:underline"
                      href={sourceHref}
                      title={sourceLabel}
                    >
                      {sourceLabel}
                    </a>
                  </td>
                  <td className={`px-2 py-2 ${!event.name ? "text-slate-400" : ""}`}>
                    {event.name ?? "(unnamed)"}
                  </td>
                  <td className="px-2 py-2">
                    {event.action.charAt(0).toUpperCase() + event.action.slice(1)}
                  </td>
                  <td className="px-2 py-2">{event.priority}</td>
                  <td className="px-2 py-2">Device {event.socket_id}</td>
                  <td className="px-2 py-2">{formatDateTime(event.timestamp * 1000)}</td>
                  <td className="px-2 py-2">{formatDateTime(event.consumed_at * 1000)}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {event.owner ? `${event.owner.name} (${event.owner.id})` : "(deleted owner)"}
                  </td>
                </tr>
              );
            })}
            {!loading && pastSorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-sm text-slate-500">
                  No past events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
