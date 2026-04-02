import { Dispatch, SetStateAction } from "react";

import { DAY_LABELS, RepeatingDraft } from "../page-types";
import { bitOn, parseTimeToMinutes, toTime } from "../page-utils";
import { EventAction, RepeatingEvent } from "../schedule-api";

type RepeatingEventsSectionProps = {
  devices: readonly number[];
  loading: boolean;
  repeatingSorted: RepeatingEvent[];
  editingRepeatingId: number | "new" | null;
  repeatingDraft: RepeatingDraft | null;
  setEditingRepeatingId: Dispatch<SetStateAction<number | "new" | null>>;
  setRepeatingDraft: Dispatch<SetStateAction<RepeatingDraft | null>>;
  onStartNew: () => void;
  onStartEdit: (event: RepeatingEvent) => void;
  onSubmit: () => Promise<void>;
  onRemove: (eventId: number) => Promise<void>;
  writableOwnerId: number | null;
  writableOwnerLabel: string;
  writableOwnerConfigured: boolean;
  isSubmitting: boolean;
  deletingEventId: number | null;
};

export function RepeatingEventsSection({
  devices,
  loading,
  repeatingSorted,
  editingRepeatingId,
  repeatingDraft,
  setEditingRepeatingId,
  setRepeatingDraft,
  onStartNew,
  onStartEdit,
  onSubmit,
  onRemove,
  writableOwnerId,
  writableOwnerLabel,
  writableOwnerConfigured,
  isSubmitting,
  deletingEventId,
}: RepeatingEventsSectionProps) {
  const canCreate = writableOwnerConfigured;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="repeating-events-heading"
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
        >
          Repeating Events
        </h2>
        <button
          type="button"
          onClick={onStartNew}
          aria-label="Add repeating event"
          disabled={!canCreate || isSubmitting || deletingEventId !== null}
          title={!canCreate ? "Writable owner is not configured" : undefined}
          className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
        >
          +
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2 text-center">Enabled</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Device</th>
              <th className="px-2 py-2">Action</th>
              <th className="px-2 py-2">Priority</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Owner</th>
              {DAY_LABELS.map((label) => (
                <th key={label} className="px-2 py-2 text-center">
                  {label}
                </th>
              ))}
              <th className="px-2 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {editingRepeatingId === "new" && repeatingDraft && (
              <tr className="border-b border-emerald-200 bg-emerald-50/60">
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={repeatingDraft.enabled}
                    onChange={(e) =>
                      setRepeatingDraft((prev) =>
                        prev ? { ...prev, enabled: e.target.checked } : prev,
                      )
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1"
                    value={repeatingDraft.name}
                    onChange={(e) =>
                      setRepeatingDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                    value={repeatingDraft.socket_id}
                    onChange={(e) =>
                      setRepeatingDraft((prev) =>
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
                    value={repeatingDraft.action}
                    onChange={(e) =>
                      setRepeatingDraft((prev) =>
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
                    value={repeatingDraft.priority}
                    onChange={(e) =>
                      setRepeatingDraft((prev) =>
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
                    type="time"
                    className="rounded border border-slate-300 bg-white px-2 py-1"
                    value={toTime(repeatingDraft.minutes_from_midnight)}
                    onChange={(e) =>
                      setRepeatingDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              minutes_from_midnight: parseTimeToMinutes(e.target.value),
                            }
                          : prev,
                      )
                    }
                  />
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">{writableOwnerLabel}</td>
                {DAY_LABELS.map((_, idx) => (
                  <td key={`new-repeat-${idx}`} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={bitOn(repeatingDraft.days, idx)}
                      onChange={(e) =>
                        setRepeatingDraft((prev) => {
                          if (!prev) {
                            return prev;
                          }
                          const nextDays = e.target.checked
                            ? prev.days | (1 << idx)
                            : prev.days & ~(1 << idx);
                          return { ...prev, days: nextDays };
                        })
                      }
                    />
                  </td>
                ))}
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
                        setEditingRepeatingId(null);
                        setRepeatingDraft(null);
                      }}
                      className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {repeatingSorted.map((event) => {
              const isEditing = editingRepeatingId === event.id && repeatingDraft !== null;
              const isDeleting = deletingEventId === event.id;
              const canMutate = writableOwnerId !== null && event.owner.id === writableOwnerId;

              const rowClass = !event.enabled
                ? "bg-slate-100 text-slate-500"
                : event.is_active
                  ? "bg-amber-50"
                  : "bg-white";

              return (
                <tr
                  id={`repeating-event-${event.id}`}
                  key={event.id}
                  className={`border-b border-slate-100 ${rowClass}`}
                >
                  <td className="px-2 py-2 text-center">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={repeatingDraft.enabled}
                        onChange={(e) =>
                          setRepeatingDraft((prev) =>
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
                        value={repeatingDraft.name}
                        onChange={(e) =>
                          setRepeatingDraft((prev) =>
                            prev ? { ...prev, name: e.target.value } : prev,
                          )
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
                        value={repeatingDraft.socket_id}
                        onChange={(e) =>
                          setRepeatingDraft((prev) =>
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
                        value={repeatingDraft.action}
                        onChange={(e) =>
                          setRepeatingDraft((prev) =>
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
                        value={repeatingDraft.priority}
                        onChange={(e) =>
                          setRepeatingDraft((prev) =>
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
                        type="time"
                        className="rounded border border-slate-300 bg-white px-2 py-1"
                        value={toTime(repeatingDraft.minutes_from_midnight)}
                        onChange={(e) =>
                          setRepeatingDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  minutes_from_midnight: parseTimeToMinutes(e.target.value),
                                }
                              : prev,
                          )
                        }
                      />
                    ) : (
                      toTime(event.minutes_from_midnight)
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {event.owner.name} ({event.owner.id})
                  </td>
                  {DAY_LABELS.map((_, idx) => (
                    <td key={`${event.id}-${idx}`} className="px-2 py-2 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={bitOn(repeatingDraft.days, idx)}
                          onChange={(e) =>
                            setRepeatingDraft((prev) => {
                              if (!prev) {
                                return prev;
                              }
                              const nextDays = e.target.checked
                                ? prev.days | (1 << idx)
                                : prev.days & ~(1 << idx);
                              return { ...prev, days: nextDays };
                            })
                          }
                        />
                      ) : (
                        <input type="checkbox" checked={bitOn(event.days, idx)} disabled />
                      )}
                    </td>
                  ))}
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
                            setEditingRepeatingId(null);
                            setRepeatingDraft(null);
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
            {!loading && repeatingSorted.length === 0 && (
              <tr>
                <td colSpan={15} className="px-2 py-4 text-center text-sm text-slate-500">
                  No repeating events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
