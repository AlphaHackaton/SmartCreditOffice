export class ApiError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function responseError(status: number, body: unknown): ApiError {
  const fallback = status === 401 ? 'Сессия истекла. Войдите снова.' : 'Не удалось выполнить запрос. Попробуйте позже.';
  if (!record(body)) return new ApiError(status, `HTTP_${status}`, fallback);
  const message = typeof body.message === 'string' && body.message.trim() && !/[<>]/.test(body.message)
    ? body.message.slice(0, 500) : fallback;
  const code = typeof body.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(body.code) ? body.code : `HTTP_${status}`;
  return new ApiError(status, code, message, body.details);
}
