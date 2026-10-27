export const API_BASE = "";

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const raw = await response.text();
  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
  if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`);
  return body as T;
}
export function rows<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.players)) return payload.players;
  if (Array.isArray(payload?.tournaments)) return payload.tournaments;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
}
export function item<T>(payload: any): T {
  return (payload?.data ?? payload?.player ?? payload?.tournament ?? payload?.match ?? payload) as T;
}
export function idOf(value: any): string { return String(value?.id ?? ""); }
export function displayName(value: any): string {
  return value?.name || value?.fullName || [value?.firstName, value?.lastName].filter(Boolean).join(" ") || value?.title || "Unnamed";
}