import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBanner } from './ErrorBanner';

describe('ErrorBanner', () => {
  it.each([undefined, null, '', '   '])('не создаёт пустой alert для %s', (message) => {
    const { container } = render(<ErrorBanner message={message} onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('объявляет безопасный текст, не исполняет HTML и не добавляет повтор без обработчика', () => {
    const message = '<img src=x onerror="alert(1)">';
    const { container } = render(<ErrorBanner message={message} />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('запускает повтор только по явному нажатию без сети', async () => {
    const retry = vi.fn();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<ErrorBanner message="Не удалось получить данные" onRetry={retry} />);
    expect(retry).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalledExactlyOnceWith();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('блокирует повторный клик на время Promise', async () => {
    let finish!: () => void;
    const retry = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<ErrorBanner message="Данные недоступны" onRetry={retry} />);
    await userEvent.setup().dblClick(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Повторяем…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Выполняется повторная попытка');
    await act(async () => finish());
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeEnabled();
  });

  it('учитывает pending владельца', async () => {
    const retry = vi.fn();
    const { rerender } = render(<ErrorBanner message="Данные недоступны" onRetry={retry} pending />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторяем…' }));
    expect(retry).not.toHaveBeenCalled();
    rerender(<ErrorBanner message="Данные недоступны" onRetry={retry} />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeEnabled();
  });

  it('после отклонения сохраняет безопасный текст и разрешает следующую попытку', async () => {
    const retry = vi.fn().mockRejectedValue(new Error('private-detail'));
    render(<ErrorBanner message="Не удалось загрузить данные" onRetry={retry} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить данные');
    expect(screen.queryByText('private-detail')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalledTimes(2);
  });
});
