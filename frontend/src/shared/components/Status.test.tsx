import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DOMAIN_STATUSES } from '../../demo/generated';
import { STATUS_VIEW } from '../status';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';

describe('статусы и история', () => {
  it('имеет подпись для каждого состояния backend', () => { expect(Object.keys(STATUS_VIEW).sort()).toEqual([...DOMAIN_STATUSES].sort()); });
  it('безопасно отображает неизвестный статус без команд', () => { const { container } = render(<StatusBadge status="NEW_SERVER_STATE" />); expect(screen.getByText('Неизвестный статус')).toBeInTheDocument(); expect(container.querySelector('button')).toBeNull(); });
  it('показывает только фактическую историю с московским временем', () => {
    render(<Timeline current="SCORING" history={[{ from: null, to: 'DRAFT', actor: 'CLIENT', at: '2026-10-24T22:30:00Z' }, { from: 'SUBMITTED', to: 'SCORING', actor: 'SYSTEM', at: '2026-10-24T22:31:00Z' }]} />);
    expect(screen.getByText('25.10.2026, 01:30')).toHaveAttribute('datetime', '2026-10-24T22:30:00Z');
    expect(screen.getByText('Проверка данных').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByText('Кредит выдан')).not.toBeInTheDocument();
  });
  it('объясняет отсутствие истории', () => { render(<Timeline current="DRAFT" history={[]} />); expect(screen.getByText('История заявки пока недоступна.')).toBeInTheDocument(); });
});
