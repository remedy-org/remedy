import type { ApiError } from "@/app/console/_lib/api";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

/** JSON request to a console route; every failure comes back as an ApiError the forms can show. */
export async function api<T>(url: string, init: { method?: string; json?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.json === undefined ? "GET" : "POST"),
      headers: init.json === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data !== null) return { ok: true, data: data as T };
    return { ok: false, status: res.status, error: (data as ApiError | null) ?? { error: `Remedy answered ${res.status}. Try again.` } };
  } catch {
    return { ok: false, status: 0, error: { error: "Remedy didn't answer. Check your connection and try again." } };
  }
}
