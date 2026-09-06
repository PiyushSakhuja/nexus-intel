// Single place that knows the backend's base URL. Previously every screen
// hardcoded "http://localhost:4000" directly in its own fetch() calls —
// this doesn't change behavior, but it means the URL only needs to change
// in one place (e.g. for deployment), and every screen's real API calls
// are visibly funneled through the same helper rather than sprinkled ad hoc.
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Thin fetch wrapper: resolves to parsed JSON on 2xx, throws ApiError
 * otherwise. Every screen still handles its own loading/error state (so
 * empty/error UI stays screen-specific) — this just removes the repeated
 * "check res.ok, throw, parse json" boilerplate and centralizes the base URL.
 */
export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error ?? `API ${res.status}`);
  }
  return res.json();
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody?.error ?? `API ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export async function apiPatch<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody?.error ?? `API ${res.status}`);
  }
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(apiUrl(path), { method: "DELETE" });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody?.error ?? `API ${res.status}`);
  }
}
