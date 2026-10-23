/* The access token is stored in memory (not localStorage), so injected scripts can't read it. 
The httpOnly refresh cookie keeps the user signed in.*/
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(value: string | null): void {
  accessToken = value;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onSessionExpired(handler: () => void): void {
  onSessionLost = handler;
}

export interface ApiErrorBody {
  code: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.code);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? {};
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as { error?: ApiErrorBody };
    if (payload.error?.code)
      return new ApiError(response.status, payload.error);
  } catch {} // Not a JSON error; probably an HTML page from a proxy.
  return new ApiError(response.status, { code: 'error.internal' });
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

// How many times to ask again when another tab renewed the shared cookie at the same moment
export const RENEWAL_RACE_RETRIES = 3;

// Exchanges the refresh cookie for a new access token
async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      for (let attempt = 0; attempt <= RENEWAL_RACE_RETRIES; attempt += 1)
      {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
        });
        /* 409: another tab renewed with the same cookie a moment earlier. The fresh cookie arrives with that tab's answer,
        so asking again a little later works; it isn't an expired session */
        if (response.status === 409)
        {
          await wait(250 * (attempt + 1));
          continue;
        }
        if (!response.ok)
          return false;
        const payload = (await response.json()) as { accessToken: string };
        accessToken = payload.accessToken;
        return true;
      }
      return false;
    } catch {
      return false;
    } finally { // Cleared on the next tick so concurrent callers all see this result.
      queueMicrotask(() => {
        refreshing = null;
      });
    }
  })();
  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  // Multipart form. Browser need to set the boundary.
  formData?: FormData;
  signal?: AbortSignal;
  // Internal: prevents a refresh loop
  retry?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) 
    headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (options.formData) 
  {
    body = options.formData;
  }
  else if (options.body !== undefined)
  {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'same-origin',
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    throw new ApiError(0, { code: 'error.network' });
  }
/* Try a silent refresh, then retry once, if it's still a 401 the session is gone.
Skip auth endpoints, refreshing after a failed refresh would just repeat the request*/
  const isAuthEndpoint = path.startsWith('/api/auth/refresh') || path.startsWith('/api/auth/session');
  if (response.status === 401 && !options.retry && !isAuthEndpoint)
  {
    const renewed = await refreshSession();
    if (renewed)
      return request<T>(path, { ...options, retry: true });
    accessToken = null;
    onSessionLost?.();
  }
  if (!response.ok) 
    throw await parseError(response);
  if (response.status === 204) 
    return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { signal } : {}),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, body === undefined ? { method: 'DELETE' } : { method: 'DELETE', body }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', formData }),
  /* Downloads a file with the in memory access token attached (a plain '<a download>'
can't send it), then saves the response as a blob*/
  download: async (path: string, fallbackName: string): Promise<void> => {
    const send = () => {
      const headers: Record<string, string> = {};
      if (accessToken)
        headers.Authorization = `Bearer ${accessToken}`;
      return fetch(path, { headers, credentials: 'same-origin' });
    };
    let response = await send();
    if (response.status === 401 && (await refreshSession()))
      response = await send();
    if (!response.ok)
      throw await parseError(response);
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const named = /filename="([^"]+)"/.exec(disposition);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = named?.[1] ?? fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
