import { useState } from 'react';
import type { Application } from '../../demo/gateway';
import { FactorList } from '../../shared/components/FactorList';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { formatMoney, formatPct } from '../../shared/format';
import { MoneyText } from '../../shared/components/MoneyText';
import { Constraints } from './Simulator';
import { OffersList } from './OffersList';
import { useApplicationCommand } from './useApplicationCommand';

export function DecisionPanel({ record }: { record: Application }) {
  const [selected, setSelected] = useState<string>(); const command = useApplicationCommand(record.id);
  const offer = record.decision?.offers.find((o) => o.id === selected);
  if (!record.decision) return <section className="workspace-card"><h2>Решение</h2><p>Условия ещё не получены. Обновите заявку.</p></section>;
  return <section className="workspace-card" aria-labelledby="decision-title"><h2 id="decision-title">{record.status === 'COUNTER_OFFER' ? 'Встречное предложение' : 'Финансирование одобрено'}</h2>
    <FactorList factors={record.decision.factors} audience="client" />
    {record.status === 'COUNTER_OFFER' && <><p>Запрошено <MoneyText value={record.amount} /> на {record.termMonths} мес. Ниже — доступные альтернативы.</p><Constraints constraints={record.decision.constraints} /></>}<h3>Доступные условия</h3><OffersList offers={record.decision.offers} pending={command.pending} onAccept={setSelected} />
    {!record.decision.offers.length && <p>Доступных предложений пока нет.</p>}
    <ErrorBanner message={command.error} />
    <p className="form-hint">Политика {record.decision.policyVersion}. Условия рассчитаны Python-движком на синтетических данных.</p>
    <ConfirmDialog open={Boolean(offer)} title="Подтвердите выбор условий" description={offer ? `${formatMoney(offer.amount)}, ${offer.term_months} мес., ${formatPct(offer.rate_pct)}. Платёж ${formatMoney(offer.monthly_payment)}. После принятия откроется демо-подписание.` : ''} confirmLabel="Принять условия" pending={command.pending} onCancel={() => setSelected(undefined)} onConfirm={async () => { if (offer) { await command.execute(() => command.gateway.accept(command.token, record.id, record.version, offer.id)); if (command.isCurrent()) setSelected(undefined); } }} />
  </section>;
}
