import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useState } from 'react';
import { ApiError } from '../../api/errors';
import { useSandboxCatalog, useSandboxRun } from '../../api/queries';
import type { SandboxRunInput } from '../../demo/gateway';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { MoneyText } from '../../shared/components/MoneyText';
import { StatusBadge } from '../../shared/components/StatusBadge';

export function SandboxPanel() {
  const catalogQuery = useSandboxCatalog();
  const catalog = catalogQuery.data;

  const [personaId, setPersonaId] = useState('p1_ideal');
  const [turnoverVariant, setTurnoverVariant] = useState<'baseline' | 'reduced'>('baseline');
  const [overdueDays, setOverdueDays] = useState(0);
  const [businessAgeMonths, setBusinessAgeMonths] = useState(48);
  const [policyId, setPolicyId] = useState('policy_v1');
  const [isExactBaseline, setIsExactBaseline] = useState(false);

  const [activeInput, setActiveInput] = useState<SandboxRunInput | null>(null);
  const [comparePolicies, setComparePolicies] = useState(false);

  // Active run query
  const runQuery = useSandboxRun(activeInput);
  const result = runQuery.data;

  // Comparison queries across the other 2 policies
  const compareInputV1: SandboxRunInput | null = comparePolicies && activeInput
    ? { ...activeInput, policyId: 'policy_v1' }
    : null;
  const compareInputMinus2: SandboxRunInput | null = comparePolicies && activeInput
    ? { ...activeInput, policyId: 'policy_minus_2' }
    : null;
  const compareInputPlus2: SandboxRunInput | null = comparePolicies && activeInput
    ? { ...activeInput, policyId: 'policy_plus_2' }
    : null;

  const queryV1 = useSandboxRun(compareInputV1);
  const queryMinus2 = useSandboxRun(compareInputMinus2);
  const queryPlus2 = useSandboxRun(compareInputPlus2);

  function handleCalculate() {
    setIsExactBaseline(false);
    setActiveInput({
      personaId,
      turnoverVariant,
      overdueDays,
      businessAgeMonths,
      policyId,
      isExactBaseline: false,
    });
  }

  function handleBaseline() {
    setIsExactBaseline(true);
    setActiveInput({
      personaId,
      turnoverVariant,
      overdueDays,
      businessAgeMonths,
      policyId,
      isExactBaseline: true,
    });
  }

  const selectedPolicy = catalog?.policies.find((p) => p.id === policyId);

  return (
    <div className="sandbox-panel">
      <div className="workspace-header">
        <TitleDesktop tag="h1" view="large" font="system" defaultMargins={false}>
          Синтетическая песочница скоринга
        </TitleDesktop>
        <p className="workspace-subtitle">
          Исследование расчётного ядра Python на 144 подготовленных комбинациях и baseline-снимках.
          Песочница не создаёт заявку, не добавляет аудит и не меняет KPI очереди.
        </p>
      </div>

      {catalogQuery.isPending && <p role="status">Загрузка параметров песочницы…</p>}
      <ErrorBanner message={catalogQuery.error?.message} />

      {catalog && (
        <section className="workspace-card" role="region" aria-label="Параметры песочницы">
          <TitleDesktop tag="h2" view="small" font="system" defaultMargins={false} style={{ marginBottom: 16 }}>
            Параметры синтетического расчёта
          </TitleDesktop>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCalculate();
            }}
            className="sandbox-controls-grid"
          >
            <label>
              Синтетическая основа
              <select
                aria-label="Синтетическая основа"
                value={personaId}
                onChange={(e) => {
                  setPersonaId(e.target.value);
                  setActiveInput(null);
                }}
              >
                {catalog.personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.companyName} ({p.inn}) · {p.productCode}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Обороты по счёту
              <select
                aria-label="Обороты по счёту"
                value={turnoverVariant}
                onChange={(e) => {
                  setTurnoverVariant(e.target.value as 'baseline' | 'reduced');
                  setActiveInput(null);
                }}
              >
                {catalog.turnoverVariants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Кредитная история (БКИ)
              <select
                aria-label="Кредитная история"
                value={overdueDays}
                onChange={(e) => {
                  setOverdueDays(Number(e.target.value));
                  setActiveInput(null);
                }}
              >
                {catalog.overdueVariants.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Возраст бизнеса
              <select
                aria-label="Возраст бизнеса"
                value={businessAgeMonths}
                onChange={(e) => {
                  setBusinessAgeMonths(Number(e.target.value));
                  setActiveInput(null);
                }}
              >
                {catalog.businessAgeVariants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Кредитная политика
              <select
                aria-label="Кредитная политика"
                value={policyId}
                onChange={(e) => {
                  setPolicyId(e.target.value);
                  setActiveInput(null);
                }}
              >
                {catalog.policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </form>

          {selectedPolicy && (
            <div className="sandbox-policy-info">
              <span>Версия политики: <strong>{selectedPolicy.version}</strong></span>
              <span>Ключевая ставка ЦБ: <strong>{selectedPolicy.keyRatePct}%</strong></span>
              {isExactBaseline && <span className="sandbox-badge">Исходный baseline-снимок</span>}
            </div>
          )}

          <div className="sandbox-actions">
            <ButtonDesktop
              type="button"
              view="primary"
              size={40}
              onClick={handleCalculate}
              disabled={runQuery.isLoading}
            >
              Рассчитать
            </ButtonDesktop>

            <ButtonDesktop
              type="button"
              view="secondary"
              size={40}
              onClick={handleBaseline}
              disabled={runQuery.isLoading}
            >
              Исходный снимок
            </ButtonDesktop>

            <ButtonDesktop
              type="button"
              view={comparePolicies ? 'accent' : 'secondary'}
              size={40}
              onClick={() => {
                if (!activeInput) handleCalculate();
                setComparePolicies((prev) => !prev);
              }}
            >
              {comparePolicies ? 'Скрыть сравнение' : 'Сравнить политики'}
            </ButtonDesktop>
          </div>
        </section>
      )}

      {runQuery.isLoading && (
        <section className="workspace-card">
          <p role="status">Выполняем синтетический расчёт…</p>
        </section>
      )}

      {runQuery.error && (
        <ErrorBanner
          message={
            runQuery.error instanceof ApiError && runQuery.error.status === 422
              ? 'Синтетическая комбинация не найдена в подготовленном реестре.'
              : runQuery.error.message
          }
        />
      )}

      {result && !runQuery.isLoading && !runQuery.error && (
        <>
          {comparePolicies && (
            <section className="workspace-card" role="region" aria-label="Сравнение политик">
              <TitleDesktop tag="h2" view="small" font="system" defaultMargins={false} style={{ marginBottom: 12 }}>
                Сравнение кредитных политик для выбранного снимка
              </TitleDesktop>
              <p className="muted" style={{ marginBottom: 16 }}>
                Снимок входов идентичен (<code className="sandbox-hash">{result.inputHash}</code>).
                Различаются только ключевая ставка и версии расчётной политики.
              </p>

              <div className="sandbox-compare-grid">
                {[
                  { title: 'Сниженная (-2 п.п.)', query: queryMinus2 },
                  { title: 'Базовая демо-политика', query: queryV1 },
                  { title: 'Повышенная (+2 п.п.)', query: queryPlus2 },
                ].map(({ title, query }, idx) => {
                  const res = query.data;
                  return (
                    <div key={idx} className="sandbox-compare-col">
                      <h3>{title}</h3>
                      {query.isPending && <p>Загрузка…</p>}
                      {query.error && <p className="field-error">Ошибка расчёта</p>}
                      {res && (
                        <>
                          <p>Ставка ЦБ: <strong>{res.keyRatePct}%</strong> ({res.policyVersion})</p>
                          <div style={{ margin: '8px 0' }}>
                            <StatusBadge status={res.result.recommendation} />
                          </div>
                          <p>Скоринг: {res.result.score ?? '—'} / Грейд {res.result.grade ?? '—'}</p>
                          {res.offers.length > 0 ? (
                            <div className="sandbox-compare-offers">
                              {res.offers.map((o, oIdx) => (
                                <div key={oIdx} className="sandbox-offer-compact">
                                  <strong><MoneyText value={o.amount} /></strong> на {o.term_months} мес.
                                  <div>Ставка: <strong>{o.rate_pct}%</strong></div>
                                  <div>Платёж: <MoneyText value={o.monthly_payment} />/мес.</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted">Нет кредитных предложений</p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="workspace-card" role="region" aria-label="Результат расчёта">
            <div className="sandbox-result-header">
              <div>
                <TitleDesktop tag="h2" view="medium" font="system" defaultMargins={false} style={{ marginBottom: 8 }}>
                  Результат скоринга: <StatusBadge status={result.result.recommendation} />
                </TitleDesktop>
                <p className="muted">
                  Маршрут: <strong>{result.result.route}</strong> · Грейд: <strong>{result.result.grade ?? '—'}</strong> · Баллы: <strong>{result.result.score ?? '—'}</strong>
                  {result.result.bindingConstraint && (
                    <> · Лимитирующий фактор: <strong>{result.result.bindingConstraint}</strong></>
                  )}
                </p>
              </div>
              <div className="sandbox-hashes">
                <div>Hash входов: <code>{result.inputHash}</code></div>
                <div>Hash решения: <code>{result.resultHash}</code></div>
              </div>
            </div>

            {result.result.topReasons.length > 0 && (
              <div className="sandbox-reasons">
                <strong>Ключевые факторы решения:</strong>
                <ul>
                  {result.result.topReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.result.reviewFlags.length > 0 && (
              <div className="sandbox-reasons sandbox-flags">
                <strong>Флаги ручного рассмотрения:</strong>
                <ul>
                  {result.result.reviewFlags.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <TitleDesktop tag="h3" view="small" font="system" defaultMargins={false} style={{ margin: '20px 0 12px' }}>
              Кредитные предложения ({result.offers.length})
            </TitleDesktop>
            {result.offers.length === 0 ? (
              <p className="muted">Предложения отсутствуют из-за стоп-факторов или параметров заявки.</p>
            ) : (
              <div className="offers-grid">
                {result.offers.map((offer, idx) => (
                  <div key={idx} className="offer-card">
                    <p className="offer-title">
                      {offer.kind === 'REQUESTED' ? 'Запрошенные условия' : offer.kind === 'LONGER_TERM' ? 'Увеличенный срок' : 'Сниженная сумма'}
                    </p>
                    <p className="offer-amount"><MoneyText value={offer.amount} /></p>
                    <p className="offer-meta">Срок: {offer.term_months} мес. · Ставка: {offer.rate_pct}%</p>
                    <p className="offer-payment">Платёж: <MoneyText value={offer.monthly_payment} /> / мес.</p>
                    <p className="offer-overpayment">Переплата: <MoneyText value={offer.overpayment} /></p>
                  </div>
                ))}
              </div>
            )}

            <TitleDesktop tag="h3" view="small" font="system" defaultMargins={false} style={{ margin: '24px 0 12px' }}>
              Ограничения лимита (констрейнты)
            </TitleDesktop>
            <ul className="constraints">
              {result.constraints.map((c, idx) => (
                <li key={idx} className={c.binding ? 'constraint-binding' : ''}>
                  <span>
                    <strong>{c.name}</strong>
                    {c.binding && <span className="sandbox-binding-tag"> (Лимитирующий)</span>}
                  </span>
                  <span><MoneyText value={c.limit} /></span>
                </li>
              ))}
            </ul>

            <TitleDesktop tag="h3" view="small" font="system" defaultMargins={false} style={{ margin: '24px 0 12px' }}>
              Факторы оценки ({result.factors.length})
            </TitleDesktop>
            <ul className="factor-list">
              {result.factors.map((f, idx) => (
                <li key={idx}>
                  <span
                    className={`factor-dot ${
                      f.impact === 'POSITIVE'
                        ? 'factor-dot--positive'
                        : f.impact === 'NEGATIVE' || f.impact === 'STOP_FACTOR'
                        ? 'factor-dot--negative'
                        : ''
                    }`}
                  />
                  <div>
                    <p>
                      <strong>{f.code}</strong>: {f.clientText}
                    </p>
                    {f.hint && <small className="muted">{f.hint}</small>}
                  </div>
                </li>
              ))}
            </ul>

            <p className="sandbox-disclaimer">{result.disclaimer}</p>
          </section>
        </>
      )}
    </div>
  );
}
