import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { MockGateway, type Application, type ApplicationInput } from '../demo/gateway';
import { renderWorkspace } from '../test/renderWorkspace';
import { createQueryClient } from '../api/query-client';
import { AppProviders } from '../App';
import { routes } from '../router';
import { ApiError } from '../api/errors';

const input: ApplicationInput = { productCode: 'WC_FLEX', amount: '2000000.00', termMonths: 24, purpose: 'WORKING_CAPITAL', consents: ['BKI_REQUEST', 'PD_PROCESSING'] };
afterEach(() => vi.useRealTimers());
async function record() {
  const clock = { now: 0 }; const gateway = new MockGateway(() => clock.now); gateway.delayMs = 0;
  const { token } = await gateway.login('p1', 'demo'); const draft = await gateway.save(token, input);
  return { gateway, token, draft, clock };
}
async function pollingView() {
  const data = await record(); await data.gateway.submit(data.token, data.draft.id, data.draft.version);
  const user = await data.gateway.me(data.token); const products = await data.gateway.products(data.token);
  const client = createQueryClient(); client.setQueryData(['me', 'mock', 0, data.token], user);
  client.setQueryData(['workspace', 'mock', 0, user.id, 'products'], products);
  const router = createMemoryRouter(routes, { initialEntries: [`/client/applications/${data.draft.id}`] });
  const read = vi.spyOn(data.gateway, 'application');
  vi.useFakeTimers();
  const view = render(<AppProviders queryClient={client} initialToken={data.token} mockGateway={data.gateway} onSessionExpired={() => { void router.navigate('/login', { replace: true }); }}><RouterProvider router={router} /></AppProviders>);
  await act(async () => { await vi.advanceTimersByTimeAsync(30); });
  return { ...data, ...view, router, read };
}
it('открывает черновик, условия и ссылку продолжения', async () => {
  const { gateway, draft } = await record();
  await renderWorkspace(`/client/applications/${draft.id}`, { login: 'p1', gateway });
  expect(await screen.findByRole('link', { name: 'Продолжить оформление' })).toHaveAttribute('href', `/client/applications/new?draft=${draft.id}`);
  expect(screen.getByRole('list', { name: 'История заявки' })).toBeInTheDocument();
  expect(screen.getByText('2 000 000,00 ₽')).toBeInTheDocument();
});
it('обновляет SUBMITTED → SCORING → APPROVED и прекращает опрос', async () => {
  const { clock, read } = await pollingView();
  expect(screen.getAllByText('Заявка отправлена').length).toBeGreaterThan(0);
  clock.now = 1500; await act(async () => { await vi.advanceTimersByTimeAsync(1550); });
  expect(screen.getAllByText('Проверка данных').length).toBeGreaterThan(0);
  clock.now = 5000; await act(async () => { await vi.advanceTimersByTimeAsync(1550); });
  expect(screen.getAllByText('Одобрено').length).toBeGreaterThan(0);
  const calls = read.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(read).toHaveBeenCalledTimes(calls);
  expect(screen.queryByRole('button', { name: /Подписать|Принять/ })).not.toBeInTheDocument();
});
it('после ухода со страницы больше не опрашивает заявку', async () => {
  const { router, read } = await pollingView();
  await act(async () => { await router.navigate('/client'); await vi.advanceTimersByTimeAsync(30); });
  const calls = read.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(read).toHaveBeenCalledTimes(calls);
});
it('401 при опросе завершает сессию и прекращает чтения', async () => {
  const { gateway, read } = await pollingView(); gateway.failNext('read', 401);
  await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
  expect(screen.getByRole('heading', { name: 'Вход в кабинет', level: 1 })).toBeInTheDocument();
  const calls = read.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(read).toHaveBeenCalledTimes(calls);
});
it('ошибка останавливает поллинг до явного повтора', async () => {
  const { gateway, read } = await pollingView(); gateway.failNext('read', 503);
  await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось выполнить действие');
  const calls = read.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(read).toHaveBeenCalledTimes(calls);
});
it('404 чужой заявки не раскрывает данные', async () => {
  const { gateway, draft } = await record();
  await renderWorkspace(`/client/applications/${draft.id}`, { login: 'p2', gateway });
  expect(await screen.findByRole('alert')).toHaveTextContent('Заявка не найдена или недоступна');
  expect(screen.queryByText('Запрошенные условия')).not.toBeInTheDocument();
});
it('неизвестный runtime-статус не открывает действия', async () => {
  const { gateway, draft } = await record();
  vi.spyOn(gateway, 'application').mockResolvedValue({ ...draft, status: 'FUTURE_STATUS' } as unknown as Application);
  await renderWorkspace(`/client/applications/${draft.id}`, { login: 'p1', gateway });
  expect(await screen.findByText('Неизвестный статус')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Продолжить оформление' })).not.toBeInTheDocument();
});
it('сетевую ошибку можно повторить вручную', async () => {
  const { gateway, draft } = await record(); const original = gateway.application.bind(gateway);
  vi.spyOn(gateway, 'application').mockRejectedValueOnce(new ApiError(503, 'NETWORK', 'Временная ошибка')).mockImplementation(original);
  await renderWorkspace(`/client/applications/${draft.id}`, { login: 'p1', gateway });
  await screen.findByRole('alert'); await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByRole('link', { name: 'Продолжить оформление' })).toBeInTheDocument();
});
