import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiScope } from './common';
import type { ApiApplication } from '../http';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { MoneyText } from '../../shared/components/MoneyText';
import { recordValue } from '../../shared/components/RecordDetails';
import { formatPct } from '../../shared/format';

export function ApiSimulator({ record }: { record: ApiApplication }) {
  const scope = useApiScope();
  const [amount, setAmount] = useState(record.amount); const [term, setTerm] = useState(record.term_months);
  const [settled, setSettled] = useState({ amount, term });
  const valid = /^\d+(?:\.\d{1,2})?$/.test(amount) && /[1-9]/.test(amount) && Number.isInteger(term) && term >= 1 && term <= 60;
  useEffect(() => { if (!valid) return; const timer = setTimeout(() => setSettled({ amount, term }), 300); return () => clearTimeout(timer); }, [amount, term, valid]);
  const current = valid && amount === settled.amount && term === settled.term;
  const query = useQuery({ queryKey: [...scope.httpKey, 'simulation', record.id, settled], queryFn: ({ signal }) => scope.api.simulate(scope.token, record.id, { amount: settled.amount, term_months: settled.term }, signal), enabled: scope.enabled && current, staleTime: 0 });
  return <section className="workspace-card"><h2>Подобрать условия</h2><p>Сравните сумму, срок и платёж. Расчёт не меняет вашу заявку. Для оформления других условий создайте новую заявку.</p>
    <div className="api-filter-row"><label>Сумма для расчёта, ₽<input aria-label="Сумма для расчёта, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label>Срок для расчёта<input aria-label="Срок для расчёта" type="number" min={1} max={60} value={Number.isNaN(term) ? '' : term} onChange={(e) => setTerm(e.target.value === '' ? NaN : Number(e.target.value))} /></label></div>
    {!valid && <p role="alert">Введите положительную сумму и целый срок от 1 до 60 месяцев.</p>}
    {valid && (!current || query.isFetching) && <p role="status">Пересчитываем условия…</p>}
    {current && <ErrorBanner message={query.error?.message} onRetry={() => query.refetch().then(() => {})} />}
    {current && !query.isFetching && !query.error && query.data && <div aria-label="Результат симуляции"><p>Прогноз: {recordValue(query.data.predicted_outcome)}{query.data.requires_review && ' · требуется рассмотрение сотрудником'}</p><p>Максимум для срока: <MoneyText value={query.data.max_amount_for_term} />. Запас: <MoneyText value={query.data.headroom} /></p>
      <ul>{query.data.constraints?.map((c) => <li key={c.name}>{recordValue(c.name)}: <MoneyText value={c.limit} exactPrecision />{c.binding && ' · ограничивает сумму'}</li>)}</ul>
      {query.data.offers?.map((o) => <p key={o.id}><MoneyText value={o.amount} /> · {o.term_months} мес. · {formatPct(o.rate_pct)} · платёж <MoneyText value={o.monthly_payment} /></p>)}</div>}
  </section>;
}
