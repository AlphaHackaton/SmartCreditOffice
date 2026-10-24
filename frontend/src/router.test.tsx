import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from './App';
import { routes } from './router';

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<AppProviders onSessionExpired={() => { void router.navigate('/login'); }}><RouterProvider router={router} /></AppProviders>);
  return router;
}

describe('навигация кабинета', () => {
  it.each([
    ['/client', 'Кабинет предпринимателя'], ['/login', 'Вход в кабинет'],
    ['/client/applications/new', 'Новая заявка'], ['/client/applications/test-id', 'Заявка на финансирование'],
    ['/bank/applications', 'Очередь заявок'], ['/bank/applications/test-id', 'Досье заявки'],
    ['/bank/metrics', 'Метрики конвейера'],
  ])('открывает %s без запросов к API', (path, heading) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderRoute(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByText('Предварительный просмотр')).toBeInTheDocument();
    expect(screen.getByText('Функциональность пока недоступна')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Выбор контура' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    if (path.endsWith('test-id')) expect(screen.getByText('test-id')).toBeInTheDocument();
  });

  it('перенаправляет корень в кабинет', async () => {
    const router = renderRoute('/');
    await screen.findByRole('heading', { name: 'Кабинет предпринимателя' });
    expect(router.state.location.pathname).toBe('/client');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('переключает контуры и отмечает активную ссылку', async () => {
    const user = userEvent.setup();
    const router = renderRoute('/client');
    await user.click(screen.getByRole('link', { name: 'Банк' }));
    expect(router.state.location.pathname).toBe('/bank/applications');
    const menu = screen.getByRole('navigation', { name: 'Разделы банка' });
    expect(within(menu).getByRole('link', { name: 'Очередь заявок' })).toHaveAttribute('aria-current', 'page');
    await user.click(within(menu).getByRole('link', { name: 'Метрики конвейера' }));
    expect(screen.getByRole('heading', { name: 'Метрики конвейера' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Очередь заявок' })).not.toHaveAttribute('aria-current');
  });

  it('открывает новую заявку с клавиатуры', async () => {
    const user = userEvent.setup();
    renderRoute('/client');
    const menu = screen.getByRole('navigation', { name: 'Разделы клиента' });
    const link = within(menu).getByRole('link', { name: 'Новая заявка' });
    within(menu).getByRole('link', { name: 'Обзор кабинета' }).focus();
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Новая заявка' })).toBeInTheDocument();
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('показывает 404 и возвращает в кабинет', async () => {
    const user = userEvent.setup();
    renderRoute('/does-not-exist');
    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'В клиентский кабинет' }));
    expect(screen.getByRole('heading', { name: 'Кабинет предпринимателя' })).toBeInTheDocument();
  });
});
