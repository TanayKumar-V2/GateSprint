/** Request-guard placeholders. Full Zod validation + size limits land per-route from Phase 4. */

export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_QUERY_CHARS = 2048;

export function assertContentType(request: Request, expected = "application/json"): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes(expected)) {
    throw new Error(`Unsupported content type: expected ${expected}`);
  }
}
