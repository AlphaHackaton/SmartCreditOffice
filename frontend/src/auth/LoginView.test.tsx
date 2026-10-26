import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginView } from './LoginView';

async function fillForm(login = 'test-user', password = 'test-password') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Логин'), login);
  await user.type(screen.getByLabelText('Пароль'), password);
  return user;
}

describe('форма входа без API', () => {
  it('предоставляет подписанные поля и маскирует пароль без запроса к сети', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<LoginView onSubmit={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Вход в кабинет' })).toBeInTheDocument();
    expect(screen.getByLabelText('Логин')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('form', { name: 'Вход по учётной записи' })).toHaveAttribute('aria-busy', 'false');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('показывает ошибки пустых полей и фокусирует первое', async () => {
    const onSubmit = vi.fn();
    render(<LoginView onSubmit={onSubmit} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Войти' }));
    expect(screen.getByText('Введите логин')).toBeInTheDocument();
    expect(screen.getByText('Введите пароль')).toBeInTheDocument();
    expect(screen.getByLabelText('Логин')).toHaveFocus();
    expect(screen.getByLabelText('Логин')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('не считает пробелы логином и очищает ошибку при исправлении', async () => {
    const onSubmit = vi.fn();
    render(<LoginView onSubmit={onSubmit} />);
    const user = await fillForm('   ');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Логин'), 'user');
    expect(screen.queryByText('Введите логин')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Логин')).toHaveAttribute('aria-invalid', 'false');
  });

  it('отправляет с клавиатуры, обрезает только логин и очищает пароль после попытки', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginView onSubmit={onSubmit} />);
    const user = await fillForm('  test-user  ', ' pass with spaces ');
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ login: 'test-user', password: ' pass with spaces ' });
    await waitFor(() => expect(screen.getByLabelText('Пароль')).toHaveValue(''));
    expect(screen.getByLabelText('Логин')).toHaveValue('  test-user  ');
    expect(screen.queryByText(/Вы вошли|Успешный вход/)).not.toBeInTheDocument();
  });

  it('блокирует форму при pending от владельца и сохраняет ввод', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<LoginView onSubmit={onSubmit} />);
    const user = await fillForm();
    rerender(<LoginView onSubmit={onSubmit} pending />);
    expect(screen.getByLabelText('Логин')).toBeDisabled();
    expect(screen.getByLabelText('Пароль')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Выполняется вход…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Проверяем учётные данные');
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: 'Выполняется вход…' }));
    fireEvent.submit(screen.getByRole('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Логин')).toHaveValue('test-user');
    rerender(<LoginView onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
  });

  it('не отправляет второй запрос до завершения первого', async () => {
    let finish!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<LoginView onSubmit={onSubmit} />);
    const user = await fillForm();
    await user.dblClick(screen.getByRole('button', { name: 'Войти' }));
    fireEvent.submit(screen.getByRole('form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Выполняется вход…' })).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
  });

  it('сохраняет логин при ошибке владельца и позволяет повтор', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<LoginView onSubmit={onSubmit} />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    rerender(<LoginView onSubmit={onSubmit} error="Проверьте логин и пароль" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте логин и пароль');
    expect(screen.getByLabelText('Логин')).toHaveValue('test-user');
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    await user.type(screen.getByLabelText('Пароль'), 'corrected-password');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('обрабатывает отклонение обработчика без утечки деталей и постоянного хранения', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<LoginView onSubmit={vi.fn().mockRejectedValue(new Error('private-transport-detail'))} />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось войти. Попробуйте ещё раз.');
    expect(screen.queryByText('private-transport-detail')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(storage).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('меняет только контекст формы, очищает пароль и не назначает роль', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginView onSubmit={onSubmit} />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Вход для сотрудников' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Вход для сотрудников' })).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Пароль'), 'employee-password');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ login: 'test-user', password: 'employee-password' });
    await user.click(screen.getByRole('button', { name: 'Вход для предпринимателей' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Вход в кабинет' })).toBeInTheDocument();
  });

  it('может сразу открыться в контексте сотрудника', () => {
    render(<LoginView initialAudience="employee" onSubmit={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Вход для сотрудников', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Рабочее место кредитного специалиста:/)).toBeInTheDocument();
  });
});
