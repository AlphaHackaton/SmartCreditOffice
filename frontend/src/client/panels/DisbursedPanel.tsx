import type { Application } from '../../demo/gateway';
import { DateTimeText } from '../../shared/components/DateTimeText';
import { ButtonLink } from '../../shared/components/ButtonLink';
import { OfferTerms } from './OffersList';

export function DisbursedPanel({ record }: { record: Application }) {
  return <section className="workspace-card disbursed-panel" aria-labelledby="disbursed-title"><h2 id="disbursed-title">Кредит выдан</h2><p>Демонстрационная выдача подтверждена. Реальные средства и банковские счета не используются.</p>{record.selectedOffer && <OfferTerms offer={record.selectedOffer} />}<p>Дата выдачи: <DateTimeText value={record.history.find((e) => e.to === 'DISBURSED')?.at} /></p><ButtonLink to="/client">Вернуться в кабинет</ButtonLink></section>;
}
