import { proxyToBackend } from "../../_backend";

export async function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/api/events/dated");
}
