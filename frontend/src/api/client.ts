import { ApiError, responseError } from './errors';

interface ClientOptions {
  getToken: () => string | null;
  onUnauthorized: (requestToken: string | null) => void;
  fetcher?: typeof fetch;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  // Explicit token lets /auth/me verify a new login before committing the session.
  authToken?: string | null;
}

function apiPath(path: string): string {
  // Validate before URL normalization; encoded traversal must not escape /api/v1.
  const pathname = path.split('?')[0];
  if (!path || /[\\#\s]/.test(path) || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new ApiError(null, 'INVALID_PATH', 'Допустим только относительный путь API.');
  }
  try {
    for (const segment of pathname.split('/')) {
      const decoded = decodeURIComponent(segment);
      if (decoded === '.' || decoded === '..' || /[%/\\]/.test(decoded) || [...decoded].some((char) => char.charCodeAt(0) < 32)) throw new Error('Unsafe segment');
    }
  } catch {
    throw new ApiError(null, 'INVALID_PATH', 'Допустим только относительный путь API.');
  }
  return `/api/v1/${path.replace(/^\//, '')}`;
}

export function createApiClient({ getToken, onUnauthorized, fetcher = (...args) => fetch(...args) }: ClientOptions) {
  return async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const url = apiPath(path);
    const { authToken, ...requestOptions } = options;
    const token = authToken === undefined ? getToken() : authToken;
    const headers = new Headers({ Accept: 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    let response: Response;
    try {
      response = await fetcher(url, { ...requestOptions, headers, body, redirect: 'error' });
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new ApiError(null, 'NETWORK_ERROR', 'Не удалось связаться с сервером. Проверьте соединение.');
    }
    if (response.status === 401) onUnauthorized(token);
    if (response.status === 204 && response.ok) return undefined;
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      if (response.ok) throw new ApiError(response.status, 'INVALID_RESPONSE', 'Сервер вернул некорректный ответ.');
      throw responseError(response.status, undefined);
    }
    if (!response.ok) throw responseError(response.status, data);
    return data;
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
