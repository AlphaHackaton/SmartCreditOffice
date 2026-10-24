import { formatMoney, UNAVAILABLE_VALUE } from '../format';
import './value-text.css';

export function MoneyText({ value }: { value?: string | null }) {
  const text = formatMoney(value);
  return (
    <span className="money-text">
      {text === UNAVAILABLE_VALUE ? <>
        <span aria-hidden="true">{text}</span>
        <span className="value-unavailable-description">Сумма недоступна</span>
      </> : text}
    </span>
  );
}
