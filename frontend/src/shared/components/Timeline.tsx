import type { HistoryEvent } from '../../demo/gateway';
import { statusLabel } from '../status';
import { DateTimeText } from './DateTimeText';
import './status.css';

const actors: Record<string, string> = { CLIENT: 'Клиент', BANK: 'Сотрудник банка', SYSTEM: 'Система' };
export function Timeline({ history, current }: { history: readonly HistoryEvent[]; current: string }) {
  if (!history.length) return <p>История заявки пока недоступна.</p>;
  return <ol className="status-timeline" aria-label="История заявки">{history.map((event, index) => <li key={`${event.at}-${index}`} aria-current={index === history.length - 1 && event.to === current ? 'step' : undefined}>
    <span className="timeline-dot" aria-hidden="true" />
    <div><strong>{statusLabel(event.to)}</strong><p><DateTimeText value={event.at} /> · {actors[event.actor] ?? 'Неизвестный участник'}</p>{event.reason && <p>{event.reason}</p>}</div>
  </li>)}</ol>;
}
