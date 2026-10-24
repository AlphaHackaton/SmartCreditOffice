import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../App';
import { useApiClient } from '../api/provider';
import { createQueryClient } from '../api/query-client';
import { ApiError } from '../api/errors';
import { useSession } from './session';

function Probe() {
  const { token, setToken } = useSession();
  const request = useApiClient();
  const [error, setError] = useState('');
  const run = async () => {
    try { await request('/auth/me'); }
    catch (error) { setError(error instanceof ApiError ? String(error.status) : 'ошибка'); }
  };
  return <>
    <p>Токен: {token ?? 'нет'}</p><p role="status">{error}</p>
    <button onClick={() => void run()}>Запрос</button>
    <button onClick={() => setToken('new-session')}>Новая сессия</button>
  </>;
}

function setup() {
  const router = createMemoryRouter([
    { path: '/client', element: <h1>Кабинет</h1> },
    { path: '/login', element: <h1>Вход</h1> },
  ], { initialEntries: ['/client'] });
  const client = createQueryClient();
  client.setQueryData(['company'], { name: 'synthetic company' });
  render(<AppProviders queryClient={client} initialToken="old-session" onSessionExpired={() => { void router.navigate('/login', { replace: true }); }}>
    <Probe /><RouterProvider router={router} />
  </AppProviders>);
  return { client, router };
}

describe('жизненный цикл сессии', () => {
  it('при 401 удаляет токен, очищает кеш, отменяет запросы и открывает вход', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    const { client, router } = setup();
    let querySignal: AbortSignal | undefined;
    const pending = client.fetchQuery({ queryKey: ['pending'], queryFn: ({ signal }) => {
      querySignal = signal;
      return new Promise(() => {});
    } }).catch(() => undefined);
    await user.click(screen.getByRole('button', { name: 'Запрос' }));
    await screen.findByRole('heading', { name: 'Вход' });
    expect(screen.getByText('Токен: нет')).toBeInTheDocument();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(querySignal?.aborted).toBe(true);
    expect(router.state.location.pathname).toBe('/login');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
    await pending;
  });

  it.each([403, 409, 422])('при %s сохраняет сессию, данные и текущий маршрут', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 'DENIED', message: 'Ошибка запроса' }, { status }));
    vi.stubGlobal('fetch', fetcher);
    const { client, router } = setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Запрос' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(String(status)));
    expect(screen.getByText('Токен: old-session')).toBeInTheDocument();
    expect(client.getQueryData(['company'])).toEqual({ name: 'synthetic company' });
    expect(router.state.location.pathname).toBe('/client');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('не сбрасывает новую сессию из-за позднего ответа 401 старой', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise((resolve) => { finish = resolve; })));
    const user = userEvent.setup();
    const { client, router } = setup();
    await user.click(screen.getByRole('button', { name: 'Запрос' }));
    await user.click(screen.getByRole('button', { name: 'Новая сессия' }));
    expect(client.getQueryData(['company'])).toBeUndefined();
    client.setQueryData(['new-company'], { name: 'new synthetic company' });
    await act(async () => { finish(new Response('', { status: 401 })); });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('401'));
    expect(screen.getByText('Токен: new-session')).toBeInTheDocument();
    expect(client.getQueryData(['new-company'])).toEqual({ name: 'new synthetic company' });
    expect(router.state.location.pathname).toBe('/client');
  });

  it('не повторяет ошибочный запрос автоматически', async () => {
    const client = createQueryClient();
    const queryFn = vi.fn().mockRejectedValue(new ApiError(409, 'VERSION_CONFLICT', 'Версия изменилась'));
    await expect(client.fetchQuery({ queryKey: ['conflict'], queryFn })).rejects.toMatchObject({ status: 409 });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
