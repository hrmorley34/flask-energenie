import { NextResponse } from "next/server";
import { getWritableOwnerIdFromAnyEnv } from "../owner-config";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://127.0.0.1:5001";

export function getWritableOwnerId(): number | null {
  return getWritableOwnerIdFromAnyEnv();
}

export function parseOwnerId(rawOwnerId: string): number | null {
  const ownerId = Number(rawOwnerId);
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    return null;
  }
  return ownerId;
}

export function ensureWritableOwner(ownerId: number): NextResponse | null {
  const writableOwnerId = getWritableOwnerId();
  if (writableOwnerId === null) {
    return NextResponse.json({ error: "WRITABLE_OWNER_ID is not configured" }, { status: 500 });
  }
  if (ownerId != writableOwnerId) {
    return NextResponse.json({ error: "owner_id is not writable" }, { status: 403 });
  }
  return null;
}

export async function proxyToBackend(request: Request, backendPath: string): Promise<NextResponse> {
  try {
    const method = request.method;
    const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

    const upstream = await fetch(`${BACKEND_API_URL}${backendPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const payload = await upstream.text();

    return new NextResponse(payload, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach backend API" }, { status: 502 });
  }
}
