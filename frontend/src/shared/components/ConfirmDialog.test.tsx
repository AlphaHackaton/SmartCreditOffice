import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

const prototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close');

// jsdom lacks native dialog modality. Browser QA covers the real focus trap/Escape.
beforeAll(() => {
  Object.defineProperty(prototype, 'showModal', { configurable: true, value() { this.open = true; } });
  Object.defineProperty(prototype, 'close', { configurable: true, value() { this.open = false; } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(prototype, 'showModal', originalShow);
  else Reflect.deleteProperty(prototype, 'showModal');
  if (originalClose) Object.defineProperty(prototype, 'close', originalClose);
  else Reflect.deleteProperty(prototype, 'close');
});

const base: ConfirmDialogProps = {
  open: true,
  title: 'Подтвердите действие',
  description: 'Проверьте данные перед продолжением.',
  confirmLabel: 'Продолжить',
  onConfirm: () => {},
  onCancel: () => {},
};

describe('ConfirmDialog', () => {
  it('скрыт до команды владельца', () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('даёт доступное название/описание и фокусирует отмену даже в StrictMode', () => {
    const confirm = vi.fn();
    render(<StrictMode><ConfirmDialog {...base} onConfirm={confirm} /></StrictMode>);
    expect(screen.getByRole('dialog', { name: base.title })).toHaveAccessibleDescription(base.description);
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('Enter на отмене не выполняет действие и возвращает фокус инициатору', async () => {
    const confirm = vi.fn();
    function Example() {
      const [open, setOpen] = useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Открыть</button>
        <ConfirmDialog {...base} open={open} onConfirm={confirm} onCancel={() => setOpen(false)} />
      </>;
    }
    render(<Example />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Открыть' }));
    await user.keyboard('{Enter}');
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Открыть' })).toHaveFocus();
  });

  it('передаёт нативный Escape владельцу и не подтверждает', () => {
    const cancel = vi.fn();
    const confirm = vi.fn();
    render(<ConfirmDialog {...base} onCancel={cancel} onConfirm={confirm} />);
    expect(fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('замыкает Tab и Shift+Tab между действиями', async () => {
    render(<ConfirmDialog {...base} />);
    const user = userEvent.setup();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Продолжить' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Продолжить' })).toHaveFocus();
  });

  it('ожидает Promise, блокирует двойной клик и Escape, не закрывается сам', async () => {
    let finish!: () => void;
    const confirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const cancel = vi.fn();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<ConfirmDialog {...base} onConfirm={confirm} onCancel={cancel} />);
    await userEvent.setup().dblClick(screen.getByRole('button', { name: 'Продолжить' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(dialog).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Выполняется действие…');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(cancel).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false);
    await act(async () => finish());
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeEnabled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('учитывает внешний pending и закрытие владельцем', async () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const { rerender } = render(<ConfirmDialog {...base} pending onConfirm={confirm} onCancel={cancel} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Продолжить' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    rerender(<ConfirmDialog {...base} open={false} pending />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('после ошибки разрешает повтор без раскрытия деталей; новое открытие очищает ошибку', async () => {
    const confirm = vi.fn().mockRejectedValue(new Error('private-detail'));
    const { rerender } = render(<ConfirmDialog {...base} onConfirm={confirm} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось выполнить действие. Попробуйте ещё раз.');
    expect(screen.queryByText('private-detail')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    rerender(<ConfirmDialog {...base} open={false} />);
    rerender(<ConfirmDialog {...base} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
