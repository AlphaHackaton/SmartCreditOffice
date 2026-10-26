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
  if (typeof body.detail === 'string') {
    const translations: Record<string, string> = { INVALID_CREDENTIALS: 'Проверьте логин и пароль.', AUTH_REQUIRED: 'Сессия истекла. Войдите снова.', FORBIDDEN: 'Нет доступа к разделу.', APPLICATION_NOT_FOUND: 'Заявка не найдена или недоступна.', INVALID_STATUS: 'Текущий этап не допускает это действие. Обновите данные.' };
    const code = /^[A-Z0-9_]{1,100}$/.test(body.detail) ? body.detail : `HTTP_${status}`;
    return new ApiError(status, code, translations[code] ?? fallback);
  }
  if (Array.isArray(body.detail)) {
    const fields: Record<string, string> = {};
    for (const entry of body.detail) {
      if (!record(entry) || !Array.isArray(entry.loc) || typeof entry.msg !== 'string') continue;
      const field = entry.loc.at(-1);
      if (typeof field === 'string' && /^[a-zA-Z_][a-zA-Z_0-9]*$/.test(field) && !/[<>]/.test(entry.msg)) fields[field] = entry.msg.slice(0, 300);
    }
    return new ApiError(status, 'VALIDATION_ERROR', 'Проверьте поля запроса.', fields);
  }
  const message = typeof body.message === 'string' && body.message.trim() && !/[<>]/.test(body.message)
    ? body.message.slice(0, 500) : fallback;
  const code = typeof body.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(body.code) ? body.code : `HTTP_${status}`;
  return new ApiError(status, code, message, body.details);
}
