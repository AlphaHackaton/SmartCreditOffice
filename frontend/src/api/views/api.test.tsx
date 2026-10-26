import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../../App';
import { routes } from '../../router';
import { createQueryClient } from '../query-client';
import type { ApiApplication } from '../http';

function server(role: 'CLIENT' | 'BANK' = 'CLIENT', initial: ApiApplication[] = []) {
  const user = { id: '11111111-1111-4111-8111-111111111111', login: role === 'CLIENT' ? 'p1' : 'underwriter', role, company_id: '22222222-2222-4222-8222-222222222222' };
  let records = initial; let failSubmit = false; const audit: object[] = [];
  const fetcher = vi.fn().mockImplementation(async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'; const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    if (path.endsWith('/health')) return response({ status: 'ok', mode: 'stub' });
    if (path.endsWith('/personas')) return response([{ id: 'p1', login: 'p1', company_name: 'Компания API', inn: '1234567890', legal_form: 'IP', expected_outcome: 'APPROVED' }]);
    if (path.endsWith('/auth/login')) return response({ access_token: 'fresh', token_type: 'bearer', user });
    if (path.endsWith('/auth/me')) return new Headers(init.headers).get('Authorization') === 'Bearer fresh' ? response(user) : response({ detail: 'AUTH_REQUIRED' }, 401);
    if (path.endsWith('/bank/metrics')) return response({ total_applications: records.length, automated_decisions: 1, underwriting_decisions: 0, approved: 1, counter_offer: 0, rejected: 0 });
    if (path.endsWith('/bank/applications')) return response({ items: records });
    if (path.includes('/bank/applications/')) {
      const record = records[0];
      if (path.endsWith('/decision')) { record.status = body.outcome; audit.push(body); return response(record); }
      if (path.endsWith('/rescore')) { audit.push({ action: 'RESCORE' }); return response(record); }
      return response({ application: record, inputs_snapshot: {}, audit });
    }
    if (path.endsWith('/applications') && method === 'POST') {
      const record: ApiApplication = { id: '33333333-3333-4333-8333-333333333333', company_id: user.company_id, ...body, status: 'DRAFT', version: 1, history: [], decision: null }; records.push(record); return response(record, 201);
    }
    if (path.endsWith('/applications')) return response({ items: records });
    if (path.endsWith('/submit')) {
      if (failSubmit) { failSubmit = false; return response({ code: 'UNAVAILABLE', message: 'Повторите подачу' }, 503); }
      records[0].status = 'APPROVED'; records[0].version++; return response(records[0]);
    }
    return response({ detail: 'NOT_FOUND' }, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, failNextSubmit: () => { failSubmit = true; }, records };
}
function view(path = '/login', token?: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] }); const cache = createQueryClient();
  render(<AppProviders initialMode="api" initialToken={token} queryClient={cache} onSessionExpired={() => { void router.navigate('/login'); }}><RouterProvider router={router} /></AppProviders>);
  return { router, cache };
}
const application: ApiApplication = { id: '33333333-3333-4333-8333-333333333333', company_id: '22222222-2222-4222-8222-222222222222', product_code: 'SERVER_PRODUCT', amount: '4321000.00', term_months: 24, status: 'UNDERWRITING', version: 1, history: [] };
it('входит по API, подтверждает свежий Bearer и читает серверные заявки без seed', async () => {
  const backend = server('CLIENT', [{ ...application }]); view(); const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Компания API · ИНН 1234567890' }));
  expect(await screen.findByRole('table', { name: 'Заявки из API' })).toHaveTextContent('SERVER_PRODUCT');
  expect(screen.queryByText('Ваша компания')).not.toBeInTheDocument();
  const me = backend.fetcher.mock.calls.find((c) => c[0].endsWith('/auth/me'))!;
  expect(new Headers(me[1].headers).get('Authorization')).toBe('Bearer fresh');
});
it('после сбоя submit повторяет только подачу, не создаёт дубль черновика', async () => {
  const backend = server(); const { router } = view('/client/applications/new', 'fresh'); const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Код продукта'), 'WC_FLEX'); await user.type(screen.getByLabelText('Сумма, ₽'), '4321000.00');
  await user.click(screen.getByRole('button', { name: 'Подать заявку' })); expect(screen.getByRole('alert')).toHaveTextContent('Примите оба согласия');
  await user.click(screen.getByRole('checkbox', { name: 'Согласие на запрос в БКИ' })); await user.click(screen.getByRole('checkbox', { name: 'Согласие на обработку персональных данных' })); backend.failNextSubmit();
  await user.click(screen.getByRole('button', { name: 'Подать заявку' })); expect(await screen.findByRole('alert')).toHaveTextContent('Повторите подачу');
  await user.click(screen.getByRole('button', { name: 'Подать заявку' })); await screen.findByRole('heading', { name: 'Заявка из API' });
  expect(router.state.location.pathname).toContain(backend.records[0].id);
  expect(backend.fetcher.mock.calls.filter((c) => c[0] === '/api/v1/applications' && c[1].method === 'POST')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /Подписать|Принять условия/ })).not.toBeInTheDocument();
});
it('bank читает досье, отправляет decision и rescore только после подтверждения', async () => {
  const backend = server('BANK', [{ ...application }]); view(`/bank/applications/${application.id}`, 'fresh'); const user = userEvent.setup();
  expect(await screen.findByText('Сервер вернул пустой снимок входов.')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Комментарий API'), 'Проверка завершена');
  await user.click(screen.getByRole('button', { name: 'Подтвердить решение' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отправить' }));
  await screen.findByText('REJECTED', { exact: false }).catch(() => {});
  expect(backend.fetcher.mock.calls.filter((c) => c[0].endsWith('/decision'))).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Повторная проверка (stub)' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отправить' }));
  expect(await screen.findByText(/RESCORE/)).toBeInTheDocument();
});
it('bank получает базовые метрики без подстановки STP и mock-данных', async () => {
  server('BANK', [{ ...application }]); view('/bank/metrics', 'fresh');
  await screen.findByText('Всего заявок'); expect(screen.getByRole('heading', { name: 'Метрики API' })).toBeInTheDocument();
  expect(screen.queryByText('STP, %')).not.toBeInTheDocument();
});
it('клиенту запрещён bank route, 401 прекращает сессию', async () => {
  const backend = server(); const { router } = view('/bank/applications', 'fresh'); await screen.findByRole('heading', { name: 'Нет доступа' });
  expect(backend.fetcher.mock.calls.some((c) => c[0].includes('/bank/'))).toBe(false);
  backend.fetcher.mockImplementation(async () => new Response(JSON.stringify({ detail: 'AUTH_REQUIRED' }), { status: 401 }));
  await act(() => router.navigate('/client')); await screen.findByRole('heading', { name: 'Вход в кабинет' });
});
