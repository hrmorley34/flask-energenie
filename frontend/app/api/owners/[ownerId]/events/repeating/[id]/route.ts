import { ensureWritableOwner, parseOwnerId, proxyToBackend } from "../../../../../_backend";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{
    ownerId: string;
    id: string;
  }>;
};

export async function PUT(request: Request, { params }: Params): Promise<Response> {
  const { ownerId: rawOwnerId, id } = await params;
  const ownerId = parseOwnerId(rawOwnerId);
  if (ownerId === null) {
    return NextResponse.json({ error: "Invalid owner_id" }, { status: 400 });
  }

  const ownerCheck = ensureWritableOwner(ownerId);
  if (ownerCheck) {
    return ownerCheck;
  }

  return proxyToBackend(request, `/api/owners/${ownerId}/events/repeating/${id}`);
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const { ownerId: rawOwnerId, id } = await params;
  const ownerId = parseOwnerId(rawOwnerId);
  if (ownerId === null) {
    return NextResponse.json({ error: "Invalid owner_id" }, { status: 400 });
  }

  const ownerCheck = ensureWritableOwner(ownerId);
  if (ownerCheck) {
    return ownerCheck;
  }

  return proxyToBackend(request, `/api/owners/${ownerId}/events/repeating/${id}`);
}
