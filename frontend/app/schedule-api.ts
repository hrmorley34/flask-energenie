export type EventAction = "on" | "off" | "reset";

export type RepeatingEvent = {
  type: "repeating";
  id: number;
  name: string | null;
  enabled: boolean;
  socket_id: number;
  priority: number;
  action: EventAction;
  minutes_from_midnight: number;
  days: number;
  timezone: string;
  created_at: string;
  updated_at: string;
  last_triggered: string | null;
};

export type DatedEvent = {
  type: "dated";
  id: number;
  name: string | null;
  enabled: boolean;
  socket_id: number;
  priority: number;
  action: EventAction;
  trigger_at: number;
  timezone: string;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EventsResponse = {
  repeating: RepeatingEvent[];
  dated: DatedEvent[];
};

export type StatusResponse = {
  targets: Record<string, boolean>;
};

export type RepeatingEventWrite = Partial<
  Pick<
    RepeatingEvent,
    | "enabled"
    | "socket_id"
    | "days"
    | "minutes_from_midnight"
    | "action"
    | "priority"
    | "name"
    | "timezone"
  >
>;

export type DatedEventWrite = Partial<
  Pick<
    DatedEvent,
    | "enabled"
    | "socket_id"
    | "trigger_at"
    | "action"
    | "priority"
    | "name"
    | "timezone"
  >
>;

const API_URL = "";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchEvents(): Promise<EventsResponse> {
  return call<EventsResponse>("/api/events");
}

export function fetchStatus(): Promise<StatusResponse> {
  return call<StatusResponse>("/api/status");
}

export function updateRepeatingEvent(
  id: number,
  payload: RepeatingEventWrite,
): Promise<RepeatingEvent> {
  return call<RepeatingEvent>(`/api/events/repeating/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createRepeatingEvent(
  payload: Pick<
    RepeatingEvent,
    | "name"
    | "enabled"
    | "socket_id"
    | "action"
    | "minutes_from_midnight"
    | "days"
    | "timezone"
  > &
    Partial<Pick<RepeatingEvent, "priority">>,
): Promise<RepeatingEvent> {
  return call<RepeatingEvent>("/api/events/repeating", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteRepeatingEvent(id: number): Promise<void> {
  return call<void>(`/api/events/repeating/${id}`, {
    method: "DELETE",
  });
}

export function updateDatedEvent(
  id: number,
  payload: DatedEventWrite,
): Promise<DatedEvent> {
  return call<DatedEvent>(`/api/events/dated/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createDatedEvent(
  payload: Pick<
    DatedEvent,
    "name" | "enabled" | "socket_id" | "action" | "timezone"
  > & {
    trigger_at: number | string;
    priority?: number;
  },
): Promise<DatedEvent> {
  return call<DatedEvent>("/api/events/dated", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteDatedEvent(id: number): Promise<void> {
  return call<void>(`/api/events/dated/${id}`, {
    method: "DELETE",
  });
}

export function fetchHealth(): Promise<{
  status: string;
  scheduler_enabled: boolean;
}> {
  return call<{ status: string; scheduler_enabled: boolean }>("/api/health");
}