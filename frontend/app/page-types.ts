import { DatedEvent, EventAction, PastEvent, RepeatingEvent } from "./schedule-api";

export type DaySummary = {
  key: string;
  date: Date;
  label: string;
  start: number;
  end: number;
};

export type EventOccurrence = {
  sourceType: "repeating" | "dated";
  action: EventAction;
  at: number;
  name: string;
  priority: number;
};

export type TimelineEventHistory = {
  past: PastEvent[];
  repeating: RepeatingEvent[];
  dated: DatedEvent[];
};

export type Period = {
  sourceType: "repeating" | "dated";
  action: "on" | "off";
  start: number;
  end: number;
  label: string;
};

export type RepeatingDraft = {
  enabled: boolean;
  name: string;
  socket_id: number;
  action: EventAction;
  minutes_from_midnight: number;
  days: number;
  timezone: string;
  priority: number;
};

export type DatedDraft = {
  enabled: boolean;
  name: string;
  socket_id: number;
  action: EventAction;
  trigger_at: number;
  timezone: string;
  priority: number;
};

export const DEVICES = [1, 2, 3, 4] as const;
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOUR_HEIGHT_PX = 20;
export const DAY_HEIGHT_PX = 24 * HOUR_HEIGHT_PX;

export type RepeatingEventType = RepeatingEvent;
export type DatedEventType = DatedEvent;
export type PastEventType = PastEvent;
