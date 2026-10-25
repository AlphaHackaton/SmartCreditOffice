import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useWorkspaceScope } from '../../api/queries';
import type { Application, Decision } from '../../demo/gateway';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { MoneyText } from '../../shared/components/MoneyText';
import { formatMoney } from '../../shared/format';
import { statusLabel } from '../../shared/status';
import { OfferTerms } from './OffersList';

const constraintLabels: Record<string, string> = { DSCR: 'Платёжная способность', REVENUE: 'Оборот компании', PRODUCT: 'Условия продукта', GRADE: 'Лимит по риск-профилю' };
export function Constraints({ constraints }: { constraints: Decision['constraints'] }) {
  return <ul className="constraints" aria-label="Ограничения суммы">{constraints.map((c) => <li className={c.binding ? 'constraint-binding' : ''} key={c.name}><span>{constraintLabels[c.name] ?? c.name}{c.binding ? ' — ограничивает сумму' : ''}</span><strong><MoneyText value={c.limit} /></strong></li>)}</ul>;
}
export function Simulator({ record }: { record: Application }) {
  const scope = useWorkspaceScope(); const [amount, setAmount] = useState(record.amount); const [term, setTerm] = useState(record.termMonths);
  const [debounced, setDebounced] = useState({ amount, term });
  useEffect(() => { const timer = setTimeout(() => setDebounced({ amount, term }), 300); return () => clearTimeout(timer); }, [amount, term]);
  const options = useQuery({ queryKey: [...scope.key, 'simulation-options', record.id], queryFn: ({ signal }) => scope.gateway.simulationOptions(scope.token, record.id, signal), enabled: scope.enabled });
  const waiting = amount !== debounced.amount || term !== debounced.term;
  const result = useQuery({ queryKey: [...scope.key, 'simulation', record.id, debounced.amount, debounced.term], queryFn: ({ signal }) => scope.gateway.simulate(scope.token, record.id, debounced.amount, debounced.term, signal), enabled: scope.enabled && !waiting && Boolean(options.data) && /^\d+(?:\.\d{1,2})?$/.test(amount) });
  return <section className="workspace-card" aria-labelledby="simulator-title"><h2 id="simulator-title">Что, если изменить условия?</h2>
    <p>Демо: расчёты подготовлены Python для ограниченной сетки. Симуляция не меняет заявку и не заменяет её предложения.</p>
    <div className="simulator-controls"><InputDesktop label="Сумма для симуляции" value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
      {options.data && <label>Срок для симуляции: {term} мес.<input aria-label="Срок для симуляции" type="range" min={options.data.terms[0]} max={options.data.terms.at(-1)} step={6} value={term} onChange={(e) => setTerm(Number(e.target.value))} /></label>}</div>
    {options.data && <label className="prepared-amounts">Подготовленные суммы<select aria-label="Подготовленные суммы" value={options.data.amounts.find((a) => a.replace(/\.0+$/, '') === amount.replace(/\.0+$/, '')) ?? ''} onChange={(e) => { if (e.target.value) setAmount(e.target.value); }}><option value="">Выберите сумму</option>{options.data.amounts.map((a) => <option key={a} value={a}>{formatMoney(a)}</option>)}</select></label>}
    {!/^\d+(?:\.\d{1,2})?$/.test(amount) && <p role="alert">Введите сумму цифрами, до двух знаков после точки.</p>}
    {(waiting || result.isFetching || options.isPending) && <p role="status">Обновляем расчёт…</p>}
    <ErrorBanner message={options.error?.message} onRetry={() => options.refetch().then(() => {})} />
    {!waiting && <ErrorBanner message={result.error?.message} onRetry={() => result.refetch().then(() => {})} />}
    {!waiting && !result.isFetching && !result.error && result.data && <div aria-live="polite"><h3>Прогноз: {result.data.requiresReview ? 'Требуется ручная проверка' : statusLabel(result.data.outcome)}</h3><p>Максимальная сумма для срока: <MoneyText value={result.data.maxAmount} /></p><Constraints constraints={result.data.constraints} />
      <div className="offers-grid">{result.data.offers.map((o, i) => <article className="offer-card" key={i}><h3>Расчётный вариант {i + 1}</h3><OfferTerms offer={{ ...o, id: `preview-${i}`, expiresAt: '' }} /></article>)}</div></div>}
  </section>;
}
