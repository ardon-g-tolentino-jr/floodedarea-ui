// Thin fetch wrapper. Set VITE_API_URL to point at the backend; falls back to
// '/api', which Vite proxies to baha-api (or the json-server mock) in dev.

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export const JWT_STORAGE_KEY = 'baha_jwt_v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly url: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = sessionStorage.getItem(JWT_STORAGE_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network error. Please check your connection and try again.');
  }

  if (!res.ok) {
    // Preserve the server message for intentional, user-facing statuses.
    let serverMessage: string | undefined;
    if (res.status === 401 || res.status === 403 || res.status === 409 || res.status === 429) {
      try {
        const parsed = (await res.json()) as { message?: string };
        if (typeof parsed.message === 'string') serverMessage = parsed.message;
      } catch {
        /* not JSON */
      }
    }
    const message =
      serverMessage ??
      (res.status === 401
        ? 'Please sign in to continue.'
        : res.status === 403
          ? 'You do not have permission to do that.'
          : res.status >= 400 && res.status < 500
            ? 'The request could not be completed. Please check your input.'
            : 'A server error occurred. Please try again later.');
    throw new ApiError(res.status, message, url);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Build a query string from an object, skipping undefined values. */
export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
