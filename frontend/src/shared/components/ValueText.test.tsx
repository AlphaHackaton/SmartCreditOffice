import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoneyText } from './MoneyText';
import { DateTimeText } from './DateTimeText';

describe('MoneyText', () => {
  it('сохраняет точность и включает табличные цифры', () => {
    render(<MoneyText value="9007199254740993.01" />);
    expect(screen.getByText('9 007 199 254 740 993,01 ₽')).toHaveClass('money-text');
    expect(screen.queryByText('Сумма недоступна')).not.toBeInTheDocument();
  });

  it('отличает настоящий ноль от отсутствия суммы', () => {
    render(<MoneyText value="0" />);
    expect(screen.getByText('0,00 ₽')).toBeInTheDocument();
    expect(screen.queryByText('Сумма недоступна')).not.toBeInTheDocument();
  });

  it.each([null, undefined, '12.345', 'invalid'])('объясняет недоступность %s текстом для screen reader', (value) => {
    render(<MoneyText value={value} />);
    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true');
    const description = screen.getByText('Сумма недоступна');
    expect(description).toHaveClass('value-unavailable-description');
    expect(description).not.toHaveAttribute('aria-hidden');
    expect(description).not.toHaveAttribute('hidden');
    expect(screen.queryByText('0,00 ₽')).not.toBeInTheDocument();
  });
});

describe('DateTimeText', () => {
  it('показывает время Москвы и сохраняет исходный timestamp', () => {
    render(<DateTimeText value="2026-10-24T22:30:00Z" />);
    const time = screen.getByText('25.10.2026, 01:30');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-10-24T22:30:00Z');
  });

  it('поддерживает календарную дату без сдвига', () => {
    render(<DateTimeText kind="date" value="2026-10-25" />);
    expect(screen.getByText('25.10.2026')).toHaveAttribute('datetime', '2026-10-25');
  });

  it.each([null, undefined, '2026-02-29T00:00:00Z', '2026-10-25T01:30:00'])('не создаёт машинно-читаемую дату для %s', (value) => {
    const { container } = render(<DateTimeText value={value} />);
    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Дата недоступна')).toHaveClass('value-unavailable-description');
    expect(screen.getByText('Дата недоступна')).not.toHaveAttribute('aria-hidden');
    expect(container.querySelector('time, [datetime]')).toBeNull();
  });

  it('не нормализует невозможную календарную дату', () => {
    const { container } = render(<DateTimeText kind="date" value="2026-02-29" />);
    expect(screen.getByText('Дата недоступна')).toBeInTheDocument();
    expect(container.querySelector('time')).toBeNull();
  });
});
