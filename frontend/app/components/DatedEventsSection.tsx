import { Dispatch, SetStateAction } from "react";

import { DatedDraft } from "../page-types";
import { dateTimeLocalToUnix, unixToDateTimeLocal } from "../page-utils";
import { DatedEvent, EventAction } from "../schedule-api";

type DatedEventsSectionProps = {
  devices: readonly number[];
  loading: boolean;
  now: number;
  datedSorted: DatedEvent[];
  editingDatedId: number | "new" | null;
  datedDraft: DatedDraft | null;
  setEditingDatedId: Dispatch<SetStateAction<number | "new" | null>>;
  setDatedDraft: Dispatch<SetStateAction<DatedDraft | null>>;
  onStartNew: () => void;
  onStartEdit: (event: DatedEvent) => void;
  onSubmit: () => Promise<void>;
  onRemove: (eventId: number) => Promise<void>;
  writableOwnerId: number | null;
  writableOwnerConfigured: boolean;
  isSubmitting: boolean;
  deletingEventId: number | null;
};

export function DatedEventsSection({
  devices,
  loading,
  now,
  datedSorted,
  editingDatedId,
  datedDraft,
  setEditingDatedId,
  setDatedDraft,
  onStartNew,
  onStartEdit,
  onSubmit,
  onRemove,
  writableOwnerId,
  writableOwnerConfigured,
  isSubmitting,
  deletingEventId,
}: DatedEventsSectionProps) {
  const canCreate = writableOwnerConfigured;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dated Events
        </h2>
        <button
          type="button"
          onClick={onStartNew}
          aria-label="Add dated event"
          disabled={!canCreate || isSubmitting || deletingEventId !== null}
          title={!canCreate ? "Writable owner is not configured" : undefined}
          className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
        >
          +
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2 text-center">Enabled</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Device</th>
              <th className="px-2 py-2">Action</th>
              <th className="px-2 py-2">Priority</th>
              <th className="px-2 py-2">Date / Time</th>
              <th className="px-2 py-2">Owner</th>
              <th className="px-2 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {editingDatedId === "new" && datedDraft && (
              <tr className="border-b border-emerald-200 bg-emerald-50/60">
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={datedDraft.enabled}
                    onChange={(e) =>
                      setDatedDraft((prev) =>
                        prev ? { ...prev, enabled: e.target.checked } : prev,
                      )
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1"
                    value={datedDraft.name}
                    onChange={(e) =>
                      setDatedDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                    value={datedDraft.socket_id}
                    onChange={(e) =>
                      setDatedDraft((prev) =>
                        prev ? { ...prev, socket_id: Number(e.target.value) } : prev,
                      )
                    }
                  >
                    {devices.map((device) => (
                      <option key={device} value={device}>
                        Device {device}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                    value={datedDraft.action}
                    onChange={(e) =>
                      setDatedDraft((prev) =>
                        prev ? { ...prev, action: e.target.value as EventAction } : prev,
                      )
                    }
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                    <option value="reset">Reset</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1"
                    value={datedDraft.priority}
                    onChange={(e) =>
                      setDatedDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              priority: Number(e.target.value),
                            }
                          : prev,
                      )
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="datetime-local"
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                    value={unixToDateTimeLocal(datedDraft.trigger_at)}
                    onChange={(e) =>
                      setDatedDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              trigger_at: dateTimeLocalToUnix(e.target.value),
                            }
                          : prev,
                      )
                    }
                  />
                </td>
                <td className="px-2 py-2 text-slate-500">Owner {writableOwnerId ?? "?"}</td>
                <td className="px-2 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void onSubmit()}
                      disabled={isSubmitting}
                      className="rounded border border-emerald-400 bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
                    >
                      {isSubmitting ? "Saving..." : "Submit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDatedId(null);
                        setDatedDraft(null);
                      }}
                      className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {datedSorted.map((event) => {
              const isEditing = editingDatedId === event.id && datedDraft !== null;
              const isDeleting = deletingEventId === event.id;
              const canMutate = writableOwnerId !== null && event.owner.id === writableOwnerId;
              const occurred = event.trigger_at * 1000 < now || event.consumed_at !== null;
              const rowClass = !event.enabled
                ? "bg-slate-100 text-slate-500"
                : occurred
                  ? "bg-amber-50"
                  : "bg-white";

              return (
                <tr key={event.id} className={`border-b border-slate-100 ${rowClass}`}>
                  <td className="px-2 py-2 text-center">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={datedDraft.enabled}
                        onChange={(e) =>
                          setDatedDraft((prev) =>
                            prev ? { ...prev, enabled: e.target.checked } : prev,
                          )
                        }
                      />
                    ) : (
                      <input type="checkbox" checked={event.enabled} disabled />
                    )}
                  </td>
                  <td className={`px-2 py-2 ${!event.name ? "text-slate-400" : ""}`}>
                    {isEditing ? (
                      <input
                        type="text"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1"
                        value={datedDraft.name}
                        onChange={(e) =>
                          setDatedDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                        }
                      />
                    ) : (
                      (event.name ?? "(unnamed)")
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <select
                        className="rounded border border-slate-300 bg-white px-2 py-1"
                        value={datedDraft.socket_id}
                        onChange={(e) =>
                          setDatedDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  socket_id: Number(e.target.value),
                                }
                              : prev,
                          )
                        }
                      >
                        {devices.map((device) => (
                          <option key={device} value={device}>
                            Device {device}
                          </option>
                        ))}
                      </select>
                    ) : (
                      `Device ${event.socket_id}`
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <select
                        className="rounded border border-slate-300 bg-white px-2 py-1"
                        value={datedDraft.action}
                        onChange={(e) =>
                          setDatedDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  action: e.target.value as EventAction,
                                }
                              : prev,
                          )
                        }
                      >
                        <option value="on">On</option>
                        <option value="off">Off</option>
                        <option value="reset">Reset</option>
                      </select>
                    ) : (
                      event.action.charAt(0).toUpperCase() + event.action.slice(1)
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-16 rounded border border-slate-300 bg-white px-2 py-1"
                        value={datedDraft.priority}
                        onChange={(e) =>
                          setDatedDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  priority: Number(e.target.value),
                                }
                              : prev,
                          )
                        }
                      />
                    ) : event.priority !== undefined ? (
                      event.priority
                    ) : (
                      0
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        className="rounded border border-slate-300 bg-white px-2 py-1"
                        value={unixToDateTimeLocal(Number(datedDraft.trigger_at))}
                        onChange={(e) =>
                          setDatedDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  trigger_at: dateTimeLocalToUnix(e.target.value),
                                }
                              : prev,
                          )
                        }
                      />
                    ) : (
                      new Date(Number(event.trigger_at) * 1000).toLocaleString()
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {event.owner.name} ({event.owner.id})
                  </td>
                  <td className="px-2 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void onSubmit()}
                          disabled={isSubmitting}
                          className="rounded border border-emerald-400 bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
                        >
                          {isSubmitting ? "Saving..." : "Submit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDatedId(null);
                            setDatedDraft(null);
                          }}
                          className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onStartEdit(event)}
                          disabled={!canMutate || isSubmitting || deletingEventId !== null}
                          title={!canMutate ? "Read-only event for configured owner" : undefined}
                          className={
                            "rounded border px-2 py-1 text-xs font-semibold " +
                            (!canMutate
                              ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                              : "border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200")
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRemove(event.id)}
                          disabled={!canMutate || isSubmitting || deletingEventId !== null}
                          title={!canMutate ? "Read-only event for configured owner" : undefined}
                          className={
                            "rounded border px-2 py-1 text-xs font-semibold " +
                            (!canMutate
                              ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                              : "border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200")
                          }
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && datedSorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-sm text-slate-500">
                  No dated events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
