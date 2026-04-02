export type EventAction = "on" | "off" | "reset";

export type EventOwner = {
  id: number;
  name: string;
};

export type RepeatingEvent = {
  type: "repeating";
  id: number;
  name: string | null;
  enabled: boolean;
  socket_id: number;
  priority: number;
  action: EventAction;
  owner: EventOwner;
  minutes_from_midnight: number;
  days: number;
  timezone: string;
  created_at: number;
  updated_at: number;
  is_active: boolean;
  last_triggered: number | null;
};

export type DatedEvent = {
  type: "dated";
  id: number;
  name: string | null;
  enabled: boolean;
  socket_id: number;
  priority: number;
  action: EventAction;
  owner: EventOwner;
  trigger_at: number;
  timezone: string;
  created_at: number;
  updated_at: number;
};

export type PastEvent = {
  id: number;
  name: string | null;
  priority: number;
  socket_id: number;
  action: EventAction;
  owner: EventOwner | null;
  timestamp: number;
  consumed_at: number;
  repeating_event_id: number | null;
  is_active: boolean;
};

export type EventsResponse = {
  past: PastEvent[];
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
    "enabled" | "socket_id" | "trigger_at" | "action" | "priority" | "name" | "timezone"
  >
>;

const API_URL = "";

function getWritableOwnerApiPrefix(): string {
  const ownerIdRaw = process.env.NEXT_PUBLIC_WRITABLE_OWNER_ID;
  const ownerId = Number(ownerIdRaw);
  if (!ownerIdRaw || !Number.isInteger(ownerId) || ownerId <= 0) {
    throw new Error("NEXT_PUBLIC_WRITABLE_OWNER_ID is not configured");
  }
  return `/api/owners/${ownerId}`;
}

function parseErrorDetail(response: Response, payload: unknown): string {
  if (payload && typeof payload === "object") {
    const message =
      "message" in payload && typeof payload.message === "string" ? payload.message : null;
    const error = "error" in payload && typeof payload.error === "string" ? payload.error : null;
    if (message) {
      return message;
    }
    if (error) {
      return error;
    }
  }
  return response.statusText || "Request failed";
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const rawBody = await response.text();
  let parsedBody: unknown = rawBody;

  if (isJson && rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    const detail = parseErrorDetail(response, parsedBody);
    throw new Error(`API ${response.status}: ${detail}`);
  }

  if (!rawBody) {
    return undefined as T;
  }

  return (isJson ? parsedBody : rawBody) as T;
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
  return call<RepeatingEvent>(`${getWritableOwnerApiPrefix()}/events/repeating/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createRepeatingEvent(
  payload: Pick<
    RepeatingEvent,
    "name" | "enabled" | "socket_id" | "action" | "minutes_from_midnight" | "days" | "timezone"
  > &
    Partial<Pick<RepeatingEvent, "priority">>,
): Promise<RepeatingEvent> {
  return call<RepeatingEvent>(`${getWritableOwnerApiPrefix()}/events/repeating`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteRepeatingEvent(id: number): Promise<void> {
  return call<void>(`${getWritableOwnerApiPrefix()}/events/repeating/${id}`, {
    method: "DELETE",
  });
}

export function updateDatedEvent(id: number, payload: DatedEventWrite): Promise<DatedEvent> {
  return call<DatedEvent>(`${getWritableOwnerApiPrefix()}/events/dated/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createDatedEvent(
  payload: Pick<DatedEvent, "name" | "enabled" | "socket_id" | "action" | "timezone"> & {
    trigger_at: number | string;
    priority?: number;
  },
): Promise<DatedEvent> {
  return call<DatedEvent>(`${getWritableOwnerApiPrefix()}/events/dated`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteDatedEvent(id: number): Promise<void> {
  return call<void>(`${getWritableOwnerApiPrefix()}/events/dated/${id}`, {
    method: "DELETE",
  });
}

export function fetchHealth(): Promise<{
  status: string;
  scheduler_enabled: boolean;
}> {
  return call<{ status: string; scheduler_enabled: boolean }>("/api/health");
}
