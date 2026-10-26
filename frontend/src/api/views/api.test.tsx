import { render, screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../../App';
import { routes } from '../../router';
import { diagnosticRoutes } from '../../test/renderWorkspace';
import { createQueryClient } from '../query-client';
import type { ApiApplication } from '../http';

function server(role: 'CLIENT' | 'BANK' = 'CLIENT', initial: ApiApplication[] = []) {
  const user = { id: '11111111-1111-4111-8111-111111111111', login: role === 'CLIENT' ? 'p1' : 'underwriter', role, company_id: '22222222-2222-4222-8222-222222222222' };
  const records = initial; let failSubmit = false; const audit: object[] = [];
  const fetcher = vi.fn().mockImplementation(async (path: string, init: RequestInit = {}) => {
    const offerId = new URL(path, 'http://localhost').searchParams.get('offer_id');
    path = path.split('?')[0];
    const method = init.method ?? 'GET'; const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    if (path.endsWith('/products')) return response({ items: [{ code: 'WC_FLEX', name: 'Оборотный кредит API', min_amount: '100000', max_amount: '10000000', min_term_months: 6, max_term_months: 36 }] });
    if (path.endsWith('/companies/me')) return response({ id: user.company_id, name: 'Серверная компания', inn: '1234567890', legal_form: 'IP', registered_at: '2020-01-01', pre_approved_limit: '5000000' });
    if (path.endsWith('/scoring-runs')) return response([]);
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
    if (path.endsWith('/accept')) { records[0].selected_offer = records[0].decision?.offers?.find((offer) => offer.id === offerId); records[0].status = 'SIGNING'; records[0].version++; return response({ application_id: records[0].id, code: '654321', expires_at: new Date(Date.now() + 300000).toISOString() }); }
    if (path.endsWith('/sign')) { if (body.code !== '654321') return response({ code: 'INVALID_OTP', message: 'Signing challenge failed' }, 400); records[0].status = 'DISBURSED'; records[0].version++; return response(records[0]); }
    if (path.endsWith('/cancel')) { records[0].status = 'CANCELLED'; records[0].version++; return response(records[0]); }
    if (path.endsWith('/simulate')) return response({ predicted_outcome: 'COUNTER_OFFER', requires_review: false, max_amount_for_term: body.amount, headroom: '0.00', offers: [], constraints: [] });
    if (method === 'PATCH') { Object.assign(records[0], body); records[0].version++; return response(records[0]); }
    if (path.endsWith('/submit')) {
      if (failSubmit) { failSubmit = false; return response({ code: 'UNAVAILABLE', message: 'Повторите подачу' }, 503); }
      records[0].status = 'APPROVED'; records[0].version++; return response(records[0]);
    }
    return response({ detail: 'NOT_FOUND' }, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, failNextSubmit: () => { failSubmit = true; }, records };
}
function view(path = '/login', token?: string, diagnostics = false) {
  const router = createMemoryRouter(diagnostics ? diagnosticRoutes : routes, { initialEntries: [path] }); const cache = createQueryClient();
  const rendered = render(<AppProviders initialMode="api" initialToken={token} queryClient={cache} onSessionExpired={() => { void router.navigate('/login'); }}><RouterProvider router={router} /></AppProviders>);
  return { router, cache, unmount: rendered.unmount };
}
const application: ApiApplication = { id: '33333333-3333-4333-8333-333333333333', company_id: '22222222-2222-4222-8222-222222222222', product_code: 'SERVER_PRODUCT', amount: '4321000.00', term_months: 24, status: 'UNDERWRITING', version: 1, history: [] };
it('входит по API, подтверждает свежий Bearer и читает серверные заявки без seed', async () => {
  const backend = server('CLIENT', [{ ...application }]); view(); const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Логин'), 'p1'); await user.type(screen.getByLabelText('Пароль'), 'demo'); await user.click(screen.getByRole('button', { name: 'Войти' }));
  expect(backend.fetcher.mock.calls.some((c) => /personas|health/.test(c[0]))).toBe(false);
  expect(await screen.findByRole('table', { name: 'Ваши заявки' })).toHaveTextContent('SERVER_PRODUCT');
  expect(await screen.findByText('Серверная компания')).toBeInTheDocument();
  const me = backend.fetcher.mock.calls.find((c) => c[0].endsWith('/auth/me'))!;
  expect(new Headers(me[1].headers).get('Authorization')).toBe('Bearer fresh');
});
it('после сбоя submit повторяет только подачу, не создаёт дубль черновика', async () => {
  const backend = server(); const { router } = view('/client/applications/new', 'fresh'); const user = userEvent.setup();
  await screen.findByRole('option', { name: 'Оборотный кредит API' }); await user.selectOptions(screen.getByLabelText('Код продукта'), 'WC_FLEX'); await user.type(screen.getByLabelText('Сумма, ₽'), '4321000.00');
  await user.click(screen.getByRole('button', { name: 'Подать заявку' })); expect(screen.getByRole('alert')).toHaveTextContent('Примите оба согласия');
  await user.click(screen.getByRole('checkbox', { name: 'Согласие на запрос в БКИ' })); await user.click(screen.getByRole('checkbox', { name: 'Согласие на обработку персональных данных' })); backend.failNextSubmit();
  await user.click(screen.getByRole('button', { name: 'Подать заявку' })); expect(await screen.findByRole('alert')).toHaveTextContent('Повторите подачу');
  await user.click(screen.getByRole('button', { name: 'Подать заявку' })); await screen.findByRole('heading', { name: 'Ваша заявка' });
  expect(router.state.location.pathname).toContain(backend.records[0].id);
  expect(backend.fetcher.mock.calls.filter((c) => c[0] === '/api/v1/applications' && c[1].method === 'POST')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /Подписать|Принять условия/ })).not.toBeInTheDocument();
});
it('bank читает досье, отправляет decision и rescore только после подтверждения', async () => {
  const backend = server('BANK', [{ ...application }]); view(`/bank/applications/${application.id}`, 'fresh'); const user = userEvent.setup();
  expect(await screen.findByText('Данные проверки пока отсутствуют.')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Комментарий сотрудника'), 'Проверка завершена');
  await user.click(screen.getByRole('button', { name: 'Подтвердить решение' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отправить' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(backend.fetcher.mock.calls.filter((c) => c[0].endsWith('/decision'))).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Пересчитать решение' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отправить' }));
  expect(await within(screen.getByRole('heading', { name: 'История действий' }).closest('section')!).findByText('Повторная проверка', { exact: true })).toBeInTheDocument();
});
it('bank получает базовые метрики без подстановки STP и mock-данных', async () => {
  server('BANK', [{ ...application }]); view('/bank/metrics', 'fresh');
  await screen.findByText('Всего заявок'); expect(screen.getByRole('heading', { name: 'Метрики конвейера' })).toBeInTheDocument();
  expect(screen.queryByText('STP, %')).not.toBeInTheDocument();
});
it('клиенту запрещён bank route, 401 прекращает сессию', async () => {
  const backend = server(); const { router } = view('/bank/applications', 'fresh'); await screen.findByRole('heading', { name: 'Нет доступа' });
  expect(backend.fetcher.mock.calls.some((c) => c[0].includes('/bank/'))).toBe(false);
  const previous = backend.fetcher.getMockImplementation()!;
  backend.fetcher.mockImplementation(async (path: string, init: RequestInit) => path.includes('/applications') || path.includes('/companies/me') ? new Response(JSON.stringify({ detail: 'AUTH_REQUIRED' }), { status: 401 }) : previous(path, init));
  await act(() => router.navigate('/client')); await screen.findByRole('heading', { name: 'Вход в кабинет' });
});

const approved: ApiApplication = { ...application, status: 'APPROVED', version: 4, decision: { outcome: 'APPROVED', route: 'AUTO', factors: [{ code: 'M1', source: 'FNS', value: 'secret-value', points: 1, max_points: 1, impact: 'POSITIVE', rule_id: 'private-rule', client_text: 'Устойчивая выручка' }], offers: [{ id: '44444444-4444-4444-8444-444444444444', kind: 'BASE', amount: '2000000.00', term_months: 24, rate_pct: '24.00', monthly_payment: '100000.00', overpayment: '400000.00' }] } };
const counter: ApiApplication = { ...approved, amount: '5000000.00', term_months: 6, status: 'COUNTER_OFFER', selected_offer: null, decision: { ...approved.decision!, outcome: 'COUNTER_OFFER', offers: [
  { id: 'longer', kind: 'LONGER_TERM', amount: '5000000.00', term_months: 18, rate_pct: '21.00', monthly_payment: '326224.62', overpayment: '872043.16' },
  { id: 'reduced', kind: 'REDUCED_AMOUNT', amount: '1950000.00', term_months: 6, rate_pct: '20.50', monthly_payment: '344706.55', overpayment: '118239.30' },
] } };

it('сохраняет выбор второго оффера после подписания и повторного открытия с новым кешем', async () => {
  const backend = server('CLIENT', [structuredClone(counter)]); const first = view(`/client/applications/${counter.id}`, 'fresh'); const user = userEvent.setup();
  const buttons = await screen.findAllByRole('button', { name: 'Принять предложение' });
  expect(buttons).toHaveLength(2); await user.click(buttons[1]);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Подтвердить' }));
  expect(await screen.findByRole('article', { name: 'Выбранное предложение' })).toHaveTextContent(/1\s950\s000,00/);
  expect(screen.queryByRole('article', { name: 'Предложение банка' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Код подписи'), '654321'); await user.click(screen.getByRole('button', { name: 'Подписать' }));
  await screen.findByRole('heading', { name: 'Кредит выдан' });
  first.unmount(); view(`/client/applications/${counter.id}`, 'fresh');
  const chosen = await screen.findByRole('article', { name: 'Выбранное предложение' });
  expect(chosen).toHaveTextContent('Выбрано вами'); expect(chosen).toHaveTextContent(/1\s950\s000,00/); expect(chosen).toHaveTextContent('6 мес.');
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Сумма по договору').parentElement).toHaveTextContent(/1\s950\s000,00/);
  expect(screen.getByText(/Первоначально запрошено/)).toHaveTextContent(/5\s000\s000,00.*6 мес/);
  expect(backend.records[0].selected_offer?.id).toBe('reduced');
  expect(screen.queryByRole('button', { name: 'Принять предложение' })).not.toBeInTheDocument();
});

it.each(['SIGNING', 'SIGNED', 'DISBURSED'] as const)('восстанавливает выбранные условия из API на этапе %s', async (status) => {
  const row = structuredClone(counter); row.status = status; row.selected_offer = row.decision!.offers![1];
  server('CLIENT', [row]); view(`/client/applications/${row.id}`, 'fresh');
  const chosen = await screen.findByRole('article', { name: 'Выбранное предложение' });
  expect(chosen).toHaveTextContent(/1\s950\s000,00/); expect(chosen).toHaveTextContent('Выбрано вами');
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Срок по договору').parentElement).toHaveTextContent('6 мес.');
  expect(screen.queryByRole('button', { name: 'Принять предложение' })).not.toBeInTheDocument();
});

it('при отсутствии сохранённого выбора явно показывает только запрошенные условия', async () => {
  server('CLIENT', [{ ...structuredClone(counter), status: 'DISBURSED' }]); view(`/client/applications/${counter.id}`, 'fresh');
  await screen.findByText('Выбранные условия недоступны. Обновите заявку.');
  expect(screen.getByText('Запрошенная сумма').parentElement).toHaveTextContent(/5\s000\s000,00/);
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('в списке выданных заявок показывает сумму и срок выбранного предложения', async () => {
  const row = structuredClone(counter); row.status = 'DISBURSED'; row.selected_offer = row.decision!.offers![0];
  server('CLIENT', [row]); view('/client', 'fresh');
  const table = await screen.findByRole('table', { name: 'Ваши заявки' });
  expect(table).toHaveTextContent('18 мес.'); expect(table).not.toHaveTextContent('6 мес.');
});

it('подписывает настоящий оффер с version/offer_id, обрабатывает неверный OTP и показывает только подтверждённую выдачу', async () => {
  const backend = server('CLIENT', [structuredClone(approved)]); view(`/client/applications/${approved.id}`, 'fresh'); const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Принять предложение' }));
  expect(backend.fetcher.mock.calls.some((c) => c[0].includes('/accept?'))).toBe(false);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Подтвердить' }));
  await screen.findByText('654321'); const accept = backend.fetcher.mock.calls.find((c) => c[0].includes('/accept?'))!;
  expect(accept[0]).toContain('version=4&offer_id=44444444-4444-4444-8444-444444444444');
  expect(screen.queryByText('secret-value')).not.toBeInTheDocument(); expect(screen.queryByText('private-rule')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Код подписи'), '111111'); await user.click(screen.getByRole('button', { name: 'Подписать' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Неверный код'); expect(screen.queryByText(/Кредит выдан/)).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText('Код подписи')); await user.type(screen.getByLabelText('Код подписи'), '654321'); await user.click(screen.getByRole('button', { name: 'Подписать' }));
  await screen.findByRole('heading', { name: 'Кредит выдан' });
  const sign = backend.fetcher.mock.calls.filter((c) => c[0].includes('/sign?')).at(-1)!; expect(sign[0]).toContain('version=5'); expect(JSON.parse(sign[1].body)).toEqual({ code: '654321' });
});
it('редактирует существующий DRAFT через PATCH с текущей версией без POST create', async () => {
  const backend = server('CLIENT', [{ ...application, status: 'DRAFT', product_code: 'WC_FLEX', version: 7 }]); view(`/client/applications/new?draft=${application.id}`, 'fresh'); const user = userEvent.setup();
  const amount = await screen.findByLabelText('Сумма, ₽'); await waitFor(() => expect(amount).toHaveValue('4321000.00')); await user.clear(amount); await user.type(amount, '2500000.00');
  await user.click(screen.getByRole('button', { name: 'Сохранить черновик' })); await screen.findByRole('heading', { name: 'Ваша заявка' });
  const patch = backend.fetcher.mock.calls.find((c) => c[1].method === 'PATCH')!; expect(patch[0]).toContain('version=7'); expect(JSON.parse(patch[1].body).amount).toBe('2500000.00'); expect(backend.fetcher.mock.calls.some((c) => c[0] === '/api/v1/applications' && c[1].method === 'POST')).toBe(false);
});
it('симулятор скрывает устаревший прогноз и передаёт десятичную строку после debounce', async () => {
  const backend = server('CLIENT', [structuredClone(approved)]); view(`/client/applications/${approved.id}`, 'fresh'); const user = userEvent.setup();
  await screen.findByLabelText('Результат симуляции'); const amount = screen.getByLabelText('Сумма для расчёта, ₽'); await user.clear(amount); await user.type(amount, '1234567.89');
  expect(screen.queryByLabelText('Результат симуляции')).not.toBeInTheDocument(); await screen.findByLabelText('Результат симуляции');
  const call = backend.fetcher.mock.calls.filter((c) => c[0].endsWith('/simulate')).at(-1)!; expect(JSON.parse(call[1].body)).toEqual({ amount: '1234567.89', term_months: 24 });
});
it('при восстановлении SIGNING не выдумывает код, отмена требует подтверждения', async () => {
  const backend = server('CLIENT', [{ ...application, status: 'SIGNING', version: 6 }]); view(`/client/applications/${application.id}`, 'fresh'); const user = userEvent.setup();
  await screen.findByText(/Код подтверждения больше недоступен/); expect(screen.queryByLabelText('Код подписи')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Отменить заявку' })); expect(backend.fetcher.mock.calls.some((c) => c[0].includes('/cancel'))).toBe(false); await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Подтвердить' })); await screen.findByText('Отменена');
  expect(backend.fetcher.mock.calls.find((c) => c[0].includes('/cancel?'))![0]).toContain('version=6');
});

it('не отправляет submit и не возвращает клиента после logout во время create', async () => {
  const backend = server(); const original = backend.fetcher.getMockImplementation()!; let finish!: (response: Response) => void;
  backend.fetcher.mockImplementation((path: string, init: RequestInit) => path === '/api/v1/applications' && init.method === 'POST' ? new Promise<Response>((resolve) => { finish = resolve; }) : original(path, init));
  const { router } = view('/client/applications/new', 'fresh'); const user = userEvent.setup();
  await screen.findByRole('option', { name: 'Оборотный кредит API' }); await user.type(screen.getByLabelText('Сумма, ₽'), '2000000.00');
  await user.click(screen.getByRole('checkbox', { name: 'Согласие на запрос в БКИ' })); await user.click(screen.getByRole('checkbox', { name: 'Согласие на обработку персональных данных' })); await user.click(screen.getByRole('button', { name: 'Подать заявку' }));
  await waitFor(() => expect(finish).toBeDefined()); await user.click(screen.getByRole('button', { name: 'Выйти' })); await screen.findByRole('heading', { name: 'Вход в кабинет' });
  await act(async () => finish(new Response(JSON.stringify({ ...application, status: 'DRAFT' }), { status: 201 })));
  expect(router.state.location.pathname).toBe('/login'); expect(backend.fetcher.mock.calls.some((c) => c[0].includes('/submit'))).toBe(false);
});
it('истёкший серверный код блокирует sign, а банковские комментарии не отображаются клиенту', async () => {
  const row = structuredClone(approved); row.history = [{ from_status: 'UNDERWRITING', to_status: 'APPROVED', actor: 'BANK', at: '2026-10-26T09:00:00Z', reason: 'Внутренний комментарий сотрудника' }];
  const backend = server('CLIENT', [row]); const original = backend.fetcher.getMockImplementation()!;
  backend.fetcher.mockImplementation(async (path: string, init: RequestInit) => { const response = await original(path, init); if (!path.includes('/accept?')) return response; const challenge = await response.json(); return new Response(JSON.stringify({ ...challenge, expires_at: '2000-01-01T00:00:00Z' })); });
  view(`/client/applications/${approved.id}`, 'fresh'); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Принять предложение' })); expect(screen.queryByText('Внутренний комментарий сотрудника')).not.toBeInTheDocument();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Подтвердить' })); await screen.findByText(/Срок кода истёк/); expect(screen.getByRole('button', { name: 'Подписать' })).toBeDisabled(); expect(backend.fetcher.mock.calls.some((c) => c[0].includes('/sign?'))).toBe(false);
});
it('сброс API подтверждается и вызывает сервер, затем очищает сессию', async () => {
  const backend = server(); const original = backend.fetcher.getMockImplementation()!;
  backend.fetcher.mockImplementation((path: string, init: RequestInit) => path.endsWith('/demo/reset') ? Promise.resolve(new Response(JSON.stringify({ reset: true }))) : original(path, init));
  const { router } = view('/client', 'fresh', true); const user = userEvent.setup(); await screen.findByText('Серверная компания'); await user.click(screen.getByRole('button', { name: 'Сбросить данные API' })); expect(backend.fetcher.mock.calls.some((c) => c[0].endsWith('/demo/reset'))).toBe(false);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Сбросить$/ })); await screen.findByRole('heading', { name: 'Вход в кабинет' }); expect(router.state.location.pathname).toBe('/login'); expect(backend.fetcher.mock.calls.filter((c) => c[0].endsWith('/demo/reset'))).toHaveLength(1);
});

it('сохраняет финансовые данные и объяснение решения в читаемом банковском досье', async () => {
  const backend = server('BANK', [{ ...application }]); const original = backend.fetcher.getMockImplementation()!;
  backend.fetcher.mockImplementation((path: string, init: RequestInit) => {
    if (path.endsWith('/scoring-runs')) return Promise.resolve(new Response(JSON.stringify([{ id: 'run-1', policy_version: 'v1', created_at: '2026-10-26T09:00:00Z', factors: [{ code: 'M1', source: 'FNS', value: '1200.00', points: 8, max_points: 10, rule_id: 'TAX_DEBT', client_text: 'Проверена налоговая задолженность' }], result: { recommendation: 'APPROVED', score: 81, constraints: [{ name: 'DSCR', limit: '4500000.00', binding: true }] } }])));
    if (path.endsWith(`/bank/applications/${application.id}`)) return Promise.resolve(new Response(JSON.stringify({ application, inputs_snapshot: { fns: { tax_debt: '1200.00', accounts_blocked: false } }, audit: [{ actor: 'BANK', action: 'DECISION', comment: 'Отчётность проверена' }] })));
    return original(path, init);
  });
  view(`/bank/applications/${application.id}`, 'fresh');
  expect(await screen.findByText('Налоговая задолженность')).toBeInTheDocument();
  expect(screen.getAllByText('1200.00').length).toBeGreaterThan(0);
  expect(await screen.findByText('Проверена налоговая задолженность')).toBeInTheDocument();
  expect(screen.getByText('Отчётность проверена')).toBeInTheDocument();
  expect(screen.getByText('Нет')).toBeInTheDocument();
  expect(screen.queryByLabelText('Состояние API')).not.toBeInTheDocument();
  expect(document.querySelector('pre')).toBeNull();
  expect(screen.getByRole('button', { name: 'Пересчитать решение' })).toBeEnabled();
});
