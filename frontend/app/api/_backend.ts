import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://127.0.0.1:5001";

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
