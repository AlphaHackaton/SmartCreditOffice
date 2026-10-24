import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError } from './errors';

function setup(response: Response | (() => Promise<Response>), token: string | null = null) {
  const fetcher = vi.fn<typeof fetch>();
  if (typeof response === 'function') fetcher.mockImplementation(response);
  else fetcher.mockResolvedValue(response);
  const onUnauthorized = vi.fn();
  const request = createApiClient({ getToken: () => token, onUnauthorized, fetcher });
  return { fetcher, request, onUnauthorized };
}

describe('HTTP-транспорт', () => {
  it('передаёт JSON и денежные строки без потери точности', async () => {
    const { request, fetcher } = setup(Response.json({ ok: true }), 'test-token');
    expect(await request('/applications', { method: 'POST', body: { amount: '2500000.00' } })).toEqual({ ok: true });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/applications');
    expect(options?.body).toBe('{"amount":"2500000.00"}');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json');
    expect(options?.redirect).toBe('error');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('не добавляет токен и Content-Type при GET без сессии', async () => {
    const { request, fetcher } = setup(Response.json([]));
    await request('products?page=1');
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/products?page=1');
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it.each(['https://example.org', '//example.org', '../auth', '/%2e%2e/admin', 'a/%252e%252e/b', '/x%2fy', '/x\\y', '/x#fragment', '/%00', '/%invalid'])('отклоняет небезопасный адрес %s до fetch', async (path) => {
    const { request, fetcher } = setup(Response.json({}), 'secret-test-token');
    await expect(request(path)).rejects.toMatchObject({ code: 'INVALID_PATH' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('обрабатывает 204 без JSON', async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, 'json');
    const { request } = setup(response);
    expect(await request('/applications/x', { method: 'DELETE' })).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('выделяет повреждённый успешный JSON', async () => {
    const { request } = setup(new Response('broken', { status: 200 }));
    await expect(request('/products')).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' });
  });

  it.each([403, 409, 422])('сохраняет ошибку %s и не сбрасывает сессию', async (status) => {
    const { request, onUnauthorized, fetcher } = setup(Response.json({ code: 'VERSION_CONFLICT', message: 'Данные изменились', details: { version: 2 } }, { status }));
    await expect(request('/applications/x', { method: 'POST' })).rejects.toMatchObject({ status, code: 'VERSION_CONFLICT', message: 'Данные изменились', details: { version: 2 } });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('передаёт обработчику 401 токен исходного запроса даже при пустом теле', async () => {
    const { request, onUnauthorized, fetcher } = setup(new Response('', { status: 401 }), 'old-token');
    await expect(request('/auth/me')).rejects.toMatchObject({ status: 401, code: 'HTTP_401' });
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith('old-token');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(['<html>Bad gateway</html>', '{bad json', ''])('не раскрывает некорректное тело ошибки', async (body) => {
    const { request } = setup(new Response(body, { status: 502 }));
    await expect(request('/products')).rejects.toMatchObject({ status: 502, code: 'HTTP_502', message: 'Не удалось выполнить запрос. Попробуйте позже.' });
  });

  it('не показывает HTML внутри JSON-сообщения', async () => {
    const { request } = setup(Response.json({ message: '<h1>Gateway</h1>', code: 'BAD_GATEWAY' }, { status: 502 }));
    await expect(request('/products')).rejects.toMatchObject({ status: 502, message: 'Не удалось выполнить запрос. Попробуйте позже.' });
  });

  it('преобразует сетевую ошибку', async () => {
    const { request } = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(request('/products')).rejects.toBeInstanceOf(ApiError);
    await expect(request('/products')).rejects.toMatchObject({ status: null, code: 'NETWORK_ERROR' });
  });

  it('передаёт сигнал и сохраняет отмену во время ожидания', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const onUnauthorized = vi.fn();
    const request = createApiClient({ getToken: () => null, onUnauthorized, fetcher });
    const result = request('/products', { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
