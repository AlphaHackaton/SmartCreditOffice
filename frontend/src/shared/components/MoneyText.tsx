import { formatMoney, UNAVAILABLE_VALUE } from '../format';
import './value-text.css';

export function MoneyText({ value, exactPrecision = false }: { value?: string | null; exactPrecision?: boolean }) {
  const text = formatMoney(value, exactPrecision);
  return (
    <span className="money-text">
      {text === UNAVAILABLE_VALUE ? <>
        <span aria-hidden="true">{text}</span>
        <span className="value-unavailable-description">Сумма недоступна</span>
      </> : text}
    </span>
  );
}
