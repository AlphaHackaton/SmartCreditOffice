import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWorkspace } from './test/renderWorkspace';
import { safeReturnTo } from './auth/RequireRole';

const demoClient = () => screen.findByRole('button', { name: /^Демо p1 ·/ });
describe('защищённая навигация и демо-вход', () => {
  it.each(['/client', '/client/applications/new', '/client/applications/test-id', '/bank/applications', '/bank/applications/test-id', '/bank/metrics'])('направляет %s на вход без запросов бизнес-данных', async (path) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { router, gateway } = await renderWorkspace(path); const read = vi.spyOn(gateway, 'applications');
    await screen.findByRole('heading', { name: 'Вход в кабинет', level: 1 });
    expect(router.state.location.pathname).toBe('/login'); expect(read).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('после демо-входа восстанавливает собственный адрес, показывает только свою роль и выходит', async () => {
    const user = userEvent.setup(); const { router } = await renderWorkspace('/client/applications/new');
    await user.click(await demoClient()); await screen.findByRole('heading', { name: 'Новая заявка', level: 1 });
    expect(router.state.location.pathname).toBe('/client/applications/new');
    expect(screen.queryByRole('navigation', { name: 'Выбор контура' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Разделы клиента' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Выйти' }));
    await screen.findByRole('heading', { name: 'Вход в кабинет', level: 1 });
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });
  it('клиенту не даёт банковскую роль даже через служебный адрес', async () => {
    const user = userEvent.setup(); const { router } = await renderWorkspace('/bank/applications');
    await user.click(await demoClient()); await screen.findByRole('heading', { name: 'Кабинет предпринимателя' });
    expect(router.state.location.pathname).toBe('/client');
    await router.navigate('/bank/applications');
    await screen.findByRole('heading', { name: 'Нет доступа' });
    expect(screen.queryByRole('heading', { name: 'Очередь заявок' })).not.toBeInTheDocument();
  });
  it('сотруднику открывает свой контур и рабочую навигацию', async () => {
    const user = userEvent.setup(); await renderWorkspace();
    await user.click(await screen.findByRole('button', { name: 'Сотрудник банка · демо' }));
    await screen.findByRole('heading', { name: 'Очередь заявок' });
    const nav = screen.getByRole('navigation', { name: 'Разделы сотрудника банка' });
    await user.click(within(nav).getByRole('link', { name: 'Метрики конвейера' }));
    expect(screen.getByRole('heading', { name: 'Метрики конвейера' })).toBeInTheDocument();
  });
  it('показывает ошибку учётных данных без входа', async () => {
    const user = userEvent.setup(); await renderWorkspace();
    await user.type(screen.getByLabelText('Логин'), 'p1'); await user.type(screen.getByLabelText('Пароль'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Проверьте логин и пароль')).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
  });
  it('API-режим не предлагает фиктивный вход и явно сообщает отсутствие адаптера', async () => {
    await renderWorkspace('/login', { mode: 'api' });
    expect(screen.getByText(/API Dev 2 ещё не подключён\. Переключитесь/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Демо p1/ })).not.toBeInTheDocument();
  });
  it('после refresh требует новый вход, неизвестный маршрут показывает 404', async () => {
    const first = await renderWorkspace('/client', { login: 'p1' }); await screen.findByRole('heading', { name: 'Кабинет предпринимателя' }); first.unmount();
    const next = await renderWorkspace('/client'); await screen.findByRole('heading', { name: 'Вход в кабинет', level: 1 });
    await next.router.navigate('/missing'); await screen.findByRole('heading', { name: 'Страница не найдена' });
  });
  it.each(['https://evil.test', '//evil.test', '/bank/applications', '/clientish', '/client/../bank', '/client/%2fsecret', '/client\\evil'])('отклоняет опасный returnTo %s', (path) => { expect(safeReturnTo(path, 'client')).toBe('/client'); });
});
