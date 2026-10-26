import { expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { createHttpApi, createHttpGateway } from './http';
import { responseError } from './errors';

const user = { id: 'user-api', login: 'p1', role: 'CLIENT', company_id: 'company-api' };
const record = { id: 'application-api', company_id: 'company-api', product_code: 'WC_FLEX', amount: '4321000.00', term_months: 24, status: 'DRAFT', version: 1, history: [], decision: null };
it('охватывает все 21 опубликованную операций и передаёт DTO без выдуманных полей', async () => {
  const fetcher = vi.fn().mockImplementation(async (path: string, init: RequestInit) => {
    const body = path.endsWith('/auth/login') ? { access_token: 'fresh-token', user } : path.endsWith('/auth/me') ? user : path.endsWith('/health') ? { status: 'ok', mode: 'stub' } : path.endsWith('/personas') ? [] : path.endsWith('/metrics') ? { total_applications: 1 } : path.endsWith('/applications') && init.method !== 'POST' ? { items: [record] } : record;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const client = createApiClient({ getToken: () => 'old-token', onUnauthorized: vi.fn(), fetcher }); const api = createHttpApi(client);
  await api.health(); await api.personas(); await api.login('p1', 'demo'); await api.me('fresh-token');
  await api.applications('fresh-token'); await api.create('fresh-token', { product_code: 'WC_FLEX', amount: '4321000.00', term_months: 24, purpose: 'WORKING_CAPITAL' }); await api.submit('fresh-token', record.id);
  await api.queue('fresh-token'); await api.dossier('fresh-token', record.id); await api.decide('fresh-token', record.id, { outcome: 'REJECTED', comment: 'Причина' }); await api.rescore('fresh-token', record.id); await api.metrics('fresh-token');
  await api.products(); await api.company('fresh-token');
  await api.update('fresh-token', record.id, 7, { product_code: 'WC_FLEX', amount: '2000000.00', term_months: 24, purpose: 'WORKING_CAPITAL' });
  await api.simulate('fresh-token', record.id, { amount: '1234567.89', term_months: 24 });
  await api.accept('fresh-token', record.id, 8, 'offer-id'); await api.sign('fresh-token', record.id, 9, '654321'); await api.cancel('fresh-token', record.id, 10); await api.scoringRuns('fresh-token', record.id); await api.reset();
  expect(fetcher).toHaveBeenCalledTimes(21);
  expect(fetcher.mock.calls[14][0]).toBe('/api/v1/applications/application-api?version=7'); expect(fetcher.mock.calls[14][1].method).toBe('PATCH');
  expect(fetcher.mock.calls[16][0]).toContain('accept?version=8&offer_id=offer-id');
  expect(JSON.parse(fetcher.mock.calls[17][1].body)).toEqual({ code: '654321' });
  expect(new Headers(fetcher.mock.calls[20][1].headers).has('Authorization')).toBe(false);
  expect(new Headers(fetcher.mock.calls[2][1].headers).has('Authorization')).toBe(false);
  expect(new Headers(fetcher.mock.calls[3][1].headers).get('Authorization')).toBe('Bearer fresh-token');
  expect(JSON.parse(fetcher.mock.calls[9][1].body)).toEqual({ outcome: 'REJECTED', comment: 'Причина' });
  expect(fetcher.mock.calls[6][1].body).toBeUndefined();
});
it('читает отдельную заявку через собственный список, а отсутствующие методы не делают fetch', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [record] })));
  const gateway = createHttpGateway(createHttpApi(createApiClient({ getToken: () => null, onUnauthorized: vi.fn(), fetcher })));
  expect((await gateway.application('token', record.id)).amount).toBe('4321000.00');
  expect(fetcher.mock.calls[0][0]).toBe('/api/v1/applications');
  await expect(gateway.sandboxCatalog('token')).rejects.toMatchObject({ code: 'API_UNSUPPORTED' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('нормализует роли сервера и безопасно отклоняет неизвестную роль', async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ...user, role: 'BANK' })));
  const gateway = createHttpGateway(createHttpApi(createApiClient({ getToken: () => null, onUnauthorized: vi.fn(), fetcher })));
  expect((await gateway.me('token')).role).toBe('bank');
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ...user, role: 'ADMIN' })));
  await expect(gateway.me('token')).rejects.toMatchObject({ code: 'INVALID_USER' });
});
it('преобразует FastAPI detail/validation и сохраняет поддержку ErrorDTO', () => {
  expect(responseError(401, { detail: 'INVALID_CREDENTIALS' })).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Проверьте логин и пароль.' });
  expect(responseError(422, { detail: [{ loc: ['body', 'term_months'], msg: 'Must be less than 60' }] })).toMatchObject({ code: 'VALIDATION_ERROR', details: { term_months: 'Must be less than 60' } });
  expect(responseError(409, { code: 'VERSION_CONFLICT', message: 'Обновите заявку', details: { version: 2 } })).toMatchObject({ code: 'VERSION_CONFLICT', details: { version: 2 } });
  expect(responseError(400, { detail: '<script>bad</script>' }).message).not.toContain('<script>');
});
it('401 нового login/me сообщает правильный токен, не старый session token', async () => {
  const expire = vi.fn(); const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'AUTH_REQUIRED' }), { status: 401 }));
  const api = createHttpApi(createApiClient({ getToken: () => 'old', onUnauthorized: expire, fetcher }));
  await expect(api.me('new')).rejects.toMatchObject({ status: 401 }); expect(expire).toHaveBeenCalledWith('new');
});
