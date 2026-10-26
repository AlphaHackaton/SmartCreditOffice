import { formatDate, formatDateTime, UNAVAILABLE_VALUE } from '../format';
import './value-text.css';

export function DateTimeText({ value, kind = 'timestamp' }: {
  value?: string | null;
  kind?: 'date' | 'timestamp';
}) {
  const text = kind === 'date' ? formatDate(value) : formatDateTime(value);
  if (text !== UNAVAILABLE_VALUE) return <time dateTime={value ?? undefined}>{text}</time>;
  return <span>
    <span aria-hidden="true">{text}</span>
    <span className="value-unavailable-description">Дата недоступна</span>
  </span>;
}
