import { proxyToBackend } from "../../../_backend";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(
  request: Request,
  { params }: Params,
): Promise<Response> {
  const { id } = await params;
  return proxyToBackend(request, `/api/events/dated/${id}`);
}

export async function DELETE(
  request: Request,
  { params }: Params,
): Promise<Response> {
  const { id } = await params;
  return proxyToBackend(request, `/api/events/dated/${id}`);
}
