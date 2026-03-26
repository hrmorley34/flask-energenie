import { DatedEvent, RepeatingEvent } from "./schedule-api";
import {
  DatedDraft,
  DaySummary,
  EventOccurrence,
  Period,
  RepeatingDraft,
  DAY_LABELS,
} from "./page-types";

export function dayRange(): DaySummary[] {
  const now = new Date();
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() - 1);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    const label = `${DAY_LABELS[(date.getDay() + 6) % 7]} ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    const start = date.getTime();
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      date,
      label,
      start,
      end: endDate.getTime(),
    };
  });
}

export function toTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutesFromMidnight % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function parseTimeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map((part) => Number(part));
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return 0;
  }
  return Math.max(0, Math.min(1439, hh * 60 + mm));
}

export function unixToDateTimeLocal(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

export function dateTimeLocalToUnix(value: string): number {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(ts / 1000);
}

export function repeatingToDraft(event: RepeatingEvent): RepeatingDraft {
  return {
    enabled: event.enabled,
    name: event.name ?? "",
    socket_id: event.socket_id,
    action: event.action,
    minutes_from_midnight: event.minutes_from_midnight,
    days: event.days,
    timezone: event.timezone,
    priority: event.priority,
  };
}

export function datedToDraft(event: DatedEvent): DatedDraft {
  return {
    enabled: event.enabled,
    name: event.name ?? "",
    socket_id: event.socket_id,
    action: event.action,
    trigger_at: Number(event.trigger_at),
    timezone: event.timezone,
    priority: event.priority,
  };
}

export function formatTs(tsMs: number): string {
  return new Date(tsMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function minutesSinceDayStart(tsMs: number, dayStartMs: number): number {
  return Math.max(0, Math.min(1440, Math.floor((tsMs - dayStartMs) / 60000)));
}

export function bitOn(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

export function classForPeriod(period: Period): string {
  if (period.sourceType === "dated" && period.action === "on") {
    return "bg-emerald-100 border-emerald-300 text-emerald-900";
  }
  if (period.sourceType === "dated" && period.action === "off") {
    return "bg-rose-100 border-rose-300 text-rose-900";
  }
  if (period.sourceType === "repeating" && period.action === "on") {
    return "bg-blue-100 border-blue-300 text-blue-900";
  }
  return "bg-amber-100 border-amber-300 text-amber-900";
}

export function buildOccurrences(
  day: DaySummary,
  deviceId: number,
  repeating: RepeatingEvent[],
  dated: DatedEvent[],
): EventOccurrence[] {
  const result: EventOccurrence[] = [];
  const dayIndexMondayFirst = (day.date.getDay() + 6) % 7;

  for (const event of repeating) {
    if (!event.enabled || event.socket_id !== deviceId) {
      continue;
    }
    if (!bitOn(event.days, dayIndexMondayFirst)) {
      continue;
    }

    const at = new Date(day.date);
    at.setHours(0, event.minutes_from_midnight, 0, 0);
    result.push({
      sourceType: "repeating",
      action: event.action,
      at: at.getTime(),
      name: event.name ?? "Unnamed",
      priority: event.priority,
    });
  }

  for (const event of dated) {
    if (!event.enabled || event.socket_id !== deviceId) {
      continue;
    }
    const atMs = event.trigger_at * 1000;
    if (atMs >= day.start && atMs < day.end) {
      result.push({
        sourceType: "dated",
        action: event.action,
        at: atMs,
        name: event.name ?? "Unnamed",
        priority: event.priority,
      });
    }
  }

  return result.sort((a, b) => a.at - b.at);
}

export function buildCarryOverOccurrence(
  day: DaySummary,
  deviceId: number,
  repeating: RepeatingEvent[],
  dated: DatedEvent[],
): EventOccurrence | null {
  const historicalOccurrences: EventOccurrence[] = [];

  for (const event of repeating) {
    if (!event.enabled || event.socket_id !== deviceId) {
      continue;
    }

    for (let daysBack = 0; daysBack <= 7; daysBack += 1) {
      const occurrenceDay = new Date(day.start);
      occurrenceDay.setHours(0, 0, 0, 0);
      occurrenceDay.setDate(occurrenceDay.getDate() - daysBack);

      const dayIndexMondayFirst = (occurrenceDay.getDay() + 6) % 7;
      if (!bitOn(event.days, dayIndexMondayFirst)) {
        continue;
      }

      const at = new Date(occurrenceDay);
      at.setHours(0, event.minutes_from_midnight, 0, 0);
      const atMs = at.getTime();

      if (atMs < day.start) {
        historicalOccurrences.push({
          sourceType: "repeating",
          action: event.action,
          at: atMs,
          name: event.name ?? "Unnamed",
          priority: event.priority,
        });
        break;
      }
    }
  }

  for (const event of dated) {
    if (!event.enabled || event.socket_id !== deviceId) {
      continue;
    }

    const atMs = Number(event.trigger_at) * 1000;
    if (atMs < day.start) {
      historicalOccurrences.push({
        sourceType: "dated",
        action: event.action,
        at: atMs,
        name: event.name ?? "Unnamed",
        priority: event.priority,
      });
    }
  }

  if (historicalOccurrences.length === 0) {
    return null;
  }

  historicalOccurrences.sort((a, b) => {
    if (a.at !== b.at) {
      return a.at - b.at;
    }
    if (a.sourceType === b.sourceType) {
      return 0;
    }
    return a.sourceType === "repeating" ? -1 : 1;
  });

  const activeByPriority: Map<number, EventOccurrence> = new Map();
  for (const occ of historicalOccurrences) {
    if (occ.action === "reset") {
      activeByPriority.delete(occ.priority);
    } else {
      activeByPriority.set(occ.priority, occ);
    }
  }

  let highestPriority = -1;
  let highestPriorityEvent: EventOccurrence | null = null;
  for (const [priority, event] of activeByPriority) {
    if (priority > highestPriority) {
      highestPriority = priority;
      highestPriorityEvent = event;
    }
  }

  if (!highestPriorityEvent) {
    return null;
  }

  return {
    ...highestPriorityEvent,
    at: day.start,
    name: `${highestPriorityEvent.name} (carry)`,
  };
}

export function isEventActiveToday(
  event: RepeatingEvent,
  allRepeating: RepeatingEvent[],
  allDated: DatedEvent[],
  today: Date,
): boolean {
  const todayIndex = (today.getDay() + 6) % 7;

  if (!bitOn(event.days, todayIndex)) {
    return false;
  }

  if (event.last_triggered) {
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    if (new Date(event.last_triggered).getTime() < todayStart.getTime()) {
      return false;
    }
  }

  for (const other of allRepeating) {
    if (other.id === event.id || !other.enabled) {
      continue;
    }
    if (!bitOn(other.days, todayIndex)) {
      continue;
    }
    if (
      other.priority >= event.priority &&
      other.minutes_from_midnight > event.minutes_from_midnight
    ) {
      return false;
    }
  }

  for (const datedEvent of allDated) {
    const eventDate = new Date(datedEvent.trigger_at * 1000);
    const isSameDay = eventDate.toDateString() === today.toDateString();
    if (!isSameDay || !datedEvent.enabled) {
      continue;
    }
    const eventMinutes = eventDate.getHours() * 60 + eventDate.getMinutes();
    if (
      datedEvent.priority >= event.priority &&
      eventMinutes > event.minutes_from_midnight
    ) {
      return false;
    }
  }

  return true;
}

export function buildPeriods(
  occurrences: EventOccurrence[],
  dayEnd: number,
): Period[] {
  if (occurrences.length === 0) {
    return [];
  }

  const orderedOccurrences = [...occurrences].sort((a, b) => {
    if (a.at !== b.at) {
      return a.at - b.at;
    }
    if (a.sourceType === b.sourceType) {
      return 0;
    }
    return a.sourceType === "repeating" ? -1 : 1;
  });

  const timePoints = new Set<number>();
  for (const occ of orderedOccurrences) {
    timePoints.add(occ.at);
  }
  timePoints.add(dayEnd);

  const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

  type ActiveOccurrence = EventOccurrence & { action: "on" | "off" };
  const isActiveOccurrence = (
    occurrence: EventOccurrence,
  ): occurrence is ActiveOccurrence =>
    occurrence.action === "on" || occurrence.action === "off";
  const segmentStates: Map<number, ActiveOccurrence | null> = new Map();

  for (const segmentStart of sortedTimes.slice(0, -1)) {
    const activeByPriority: Map<number, ActiveOccurrence> = new Map();

    for (const occ of orderedOccurrences) {
      if (occ.at <= segmentStart) {
        if (occ.action === "reset") {
          activeByPriority.delete(occ.priority);
        } else if (isActiveOccurrence(occ)) {
          activeByPriority.set(occ.priority, occ);
        } else {
          // No-op for unknown actions to preserve forward compatibility.
        }
      }
    }

    let highestPriority = -1;
    let activeEvent: ActiveOccurrence | null = null;

    for (const [priority, event] of activeByPriority) {
      if (priority > highestPriority) {
        highestPriority = priority;
        activeEvent = event;
      }
    }

    segmentStates.set(segmentStart, activeEvent);
  }

  const periods: Period[] = [];
  let currentEvent: ActiveOccurrence | null = null;
  let currentStart = 0;

  for (let i = 0; i < sortedTimes.length - 1; i += 1) {
    const segmentStart = sortedTimes[i];
    const segmentEvent = segmentStates.get(segmentStart) ?? null;

    const isSameLogicalEvent =
      segmentEvent !== null &&
      currentEvent !== null &&
      segmentEvent.name.split(" (carry)")[0] ===
        currentEvent.name.split(" (carry)")[0] &&
      segmentEvent.priority === currentEvent.priority &&
      segmentEvent.action === currentEvent.action;

    if (!isSameLogicalEvent) {
      if (currentEvent && currentStart < segmentStart) {
        periods.push({
          sourceType: currentEvent.sourceType,
          action: currentEvent.action,
          start: currentStart,
          end: segmentStart,
          label: currentEvent.name.split(" (carry)")[0],
        });
      }
      currentEvent = segmentEvent;
      currentStart = segmentStart;
    }
  }

  if (currentEvent && currentStart < dayEnd) {
    periods.push({
      sourceType: currentEvent.sourceType,
      action: currentEvent.action,
      start: currentStart,
      end: dayEnd,
      label: currentEvent.name.split(" (carry)")[0],
    });
  }

  return periods.filter((p) => p.end > p.start);
}
