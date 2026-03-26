import { proxyToBackend } from "../_backend";

export async function GET(request: Request): Promise<Response> {
  return proxyToBackend(request, "/api/status");
}
