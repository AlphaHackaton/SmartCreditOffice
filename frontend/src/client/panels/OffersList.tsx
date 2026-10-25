import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { useEffect, useState } from 'react';
import type { Offer } from '../../demo/gateway';
import { MoneyText } from '../../shared/components/MoneyText';
import { DateTimeText } from '../../shared/components/DateTimeText';
import { formatPct } from '../../shared/format';

export const offerLabels: Record<string, string> = { REQUESTED: 'Запрошенные условия', REDUCED_AMOUNT: 'Меньшая сумма', LONGER_TERM: 'Увеличенный срок', MAX: 'Максимальная доступная сумма' };
export function OfferTerms({ offer }: { offer: Offer }) {
  return <dl className="facts"><div><dt>Сумма</dt><dd><MoneyText value={offer.amount} /></dd></div><div><dt>Срок</dt><dd>{offer.term_months} мес.</dd></div><div><dt>Ставка</dt><dd>{formatPct(offer.rate_pct)}</dd></div><div><dt>Платёж в месяц</dt><dd><MoneyText value={offer.monthly_payment} /></dd></div><div><dt>Переплата</dt><dd><MoneyText value={offer.overpayment} /></dd></div></dl>;
}
export function OffersList({ offers, onAccept, pending = false }: { offers: Offer[]; onAccept?: (offerId: string) => void; pending?: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <div className="offers-grid">{offers.map((offer, index) => {
    const expired = now >= Date.parse(offer.expiresAt);
    return <article className="offer-card" key={offer.id}><h3>{offerLabels[offer.kind] ?? `Предложение ${index + 1}`}</h3><OfferTerms offer={offer} /><p className="form-hint">Действует до <DateTimeText value={offer.expiresAt} /></p>{expired && <p role="status">Предложение истекло</p>}{onAccept && <ButtonDesktop view="primary" size={48} disabled={pending || expired} onClick={() => onAccept(offer.id)}>Выбрать предложение {index + 1}</ButtonDesktop>}</article>;
  })}</div>;
}
