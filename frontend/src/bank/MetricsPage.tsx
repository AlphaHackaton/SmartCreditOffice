import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBankMetrics } from '../api/queries';
import { demoData } from '../demo/generated';
import {
  parseMoscowDateBounds,
  type MetricsFilter,
  type MetricSourceFilter,
} from '../demo/metrics';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import { StatusBadge } from '../shared/components/StatusBadge';
import { formatDateTime, formatDuration, UNAVAILABLE_VALUE } from '../shared/format';
import { STATUS_VIEW } from '../shared/status';
import '../client/workspace.css';

export function MetricsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSource = (searchParams.get('source') as MetricSourceFilter) || 'all';
  const urlProduct = searchParams.get('product') || undefined;
  const urlFrom = searchParams.get('from') || undefined;
  const urlTo = searchParams.get('to') || undefined;

  // Applied filter drives the TanStack Query hook
  const [appliedFilter, setAppliedFilter] = useState<MetricsFilter>({
    source: ['all', 'example', 'session'].includes(urlSource) ? urlSource : 'all',
    productCode: urlProduct,
    fromDate: urlFrom,
    toDate: urlTo,
  });

  // Draft form filter
  const [draftSource, setDraftSource] = useState<MetricSourceFilter>(appliedFilter.source);
  const [draftProduct, setDraftProduct] = useState<string>(appliedFilter.productCode ?? '');
  const [draftFrom, setDraftFrom] = useState<string>(appliedFilter.fromDate ?? '');
  const [draftTo, setDraftTo] = useState<string>(appliedFilter.toDate ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const metricsQuery = useBankMetrics(appliedFilter);
  const data = metricsQuery.data;

  function handleApply() {
    setFormError(null);
    try {
      parseMoscowDateBounds(draftFrom, draftTo);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
        return;
      }
      setFormError('Некорректный диапазон дат');
      return;
    }

    const nextFilter: MetricsFilter = {
      source: draftSource,
      productCode: draftProduct.trim() || undefined,
      fromDate: draftFrom.trim() || undefined,
      toDate: draftTo.trim() || undefined,
    };

    setAppliedFilter(nextFilter);

    // Sync to URL
    const nextParams = new URLSearchParams();
    if (nextFilter.source !== 'all') nextParams.set('source', nextFilter.source);
    if (nextFilter.productCode) nextParams.set('product', nextFilter.productCode);
    if (nextFilter.fromDate) nextParams.set('from', nextFilter.fromDate);
    if (nextFilter.toDate) nextParams.set('to', nextFilter.toDate);
    setSearchParams(nextParams, { replace: true });
  }

  function handleReset() {
    setFormError(null);
    setDraftSource('all');
    setDraftProduct('');
    setDraftFrom('');
    setDraftTo('');
    const resetFilter: MetricsFilter = { source: 'all' };
    setAppliedFilter(resetFilter);
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  const products = demoData.products;

  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">РАБОЧЕЕ МЕСТО КРЕДИТНОГО СПЕЦИАЛИСТА</p>
          <TitleDesktop tag="h1" view="large" font="system" defaultMargins={false}>
            Метрики конвейера
          </TitleDesktop>
          <p className="page-description">Операционная эффективность и статистика рассмотрения заявок.</p>
        </div>
        <ButtonDesktop
          view="secondary"
          size={48}
          disabled={metricsQuery.isFetching}
          onClick={() => {
            void metricsQuery.refetch();
          }}
        >
          Обновить метрики
        </ButtonDesktop>
      </div>

      <div className="metrics-meta workspace-card">
        <div>
          <p className="metrics-meta-title">Синтетические демо-показатели</p>
          <p className="metrics-meta-note">
            Показатели рассчитаны по аналитическому снимку синтетических примеров и сеанса. Не отражают SLA реального бэкенда.
          </p>
        </div>
        {data && (
          <div className="metrics-meta-asof">
            <span>Срез на:</span>
            <strong>{formatDateTime(data.asOf)}</strong>
            <small>Europe/Moscow</small>
          </div>
        )}
      </div>

      <section className="workspace-card" aria-label="Фильтры метрик">
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="queue-filters">
          <label>
            Источник данных
            <select
              aria-label="Источник данных метрик"
              value={draftSource}
              onChange={(e) => setDraftSource(e.target.value as MetricSourceFilter)}
            >
              <option value="all">Все демо-данные</option>
              <option value="example">Синтетические примеры</option>
              <option value="session">Сеанс пользователя</option>
            </select>
          </label>
          <label>
            Продукт
            <select
              aria-label="Продукт метрик"
              value={draftProduct}
              onChange={(e) => setDraftProduct(e.target.value)}
            >
              <option value="">Все продукты</option>
              {products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Дата создания с
            <input
              type="date"
              aria-label="Дата создания с"
              value={draftFrom}
              className="queue-date-input"
              onChange={(e) => setDraftFrom(e.target.value)}
            />
          </label>
          <label>
            Дата создания по
            <input
              type="date"
              aria-label="Дата создания по"
              value={draftTo}
              className="queue-date-input"
              onChange={(e) => setDraftTo(e.target.value)}
            />
          </label>
        </div>
        <div className="metrics-filter-actions">
          <ButtonDesktop view="primary" size={40} onClick={handleApply}>
            Применить
          </ButtonDesktop>
          <ButtonDesktop view="secondary" size={40} onClick={handleReset}>
            Сбросить фильтры
          </ButtonDesktop>
        </div>
      </section>

      {metricsQuery.isFetching && <p role="status">Загружаем метрики…</p>}
      <ErrorBanner
        message={metricsQuery.error?.message}
        onRetry={() => metricsQuery.refetch().then(() => {})}
      />

      {!metricsQuery.error && !metricsQuery.isPending && data && (
        <>
          {data.total === 0 ? (
            <section className="workspace-card" aria-label="Результаты">
              <h2>Нет заявок в когорте</h2>
              <p>По выбранным фильтрам не найдено ни одной заявки. Сбросьте фильтры или выберите другой период.</p>
              <ButtonDesktop view="secondary" size={40} onClick={handleReset}>
                Сбросить фильтры
              </ButtonDesktop>
            </section>
          ) : (
            <>
              {/* KPI Cards Grid */}
              <section className="workspace-card" aria-label="Ключевые показатели">
                <h2>Ключевые показатели когорты</h2>
                <div className="metrics-cards-grid">
                  <div className="metric-card" aria-label="Всего заявок">
                    <p className="metric-card-label">Всего заявок</p>
                    <p className="metric-card-value">{data.total}</p>
                    <p className="metric-card-desc">Уникальные заявки по фильтрам когорты</p>
                  </div>

                  <div className="metric-card" aria-label="Подано заявок">
                    <p className="metric-card-label">Подано заявок</p>
                    <p className="metric-card-value">{data.submitted}</p>
                    <p className="metric-card-desc">Заявки с этапом SUBMITTED в истории</p>
                  </div>

                  <div className="metric-card" aria-label="Принято решений">
                    <p className="metric-card-label">Принято решений</p>
                    <p className="metric-card-value">{data.decided}</p>
                    <p className="metric-card-desc">Заявки с первым зафиксированным решением</p>
                  </div>

                  <div className="metric-card" aria-label="Ожидают решения">
                    <p className="metric-card-label">Ожидают решения</p>
                    <p className="metric-card-value">{data.awaitingDecision}</p>
                    <p className="metric-card-desc">Текущие SUBMITTED / SCORING / UNDERWRITING</p>
                  </div>

                  <div className="metric-card" aria-label="Уровень автоматизации (STP)">
                    <p className="metric-card-label">Автоматизация (STP)</p>
                    <p className="metric-card-value">{data.stpPct !== null ? `${data.stpPct} %` : UNAVAILABLE_VALUE}</p>
                    <p className="metric-card-desc">
                      {data.decided > 0
                        ? `Авторешений SYSTEM: ${data.automaticDecisions} из ${data.decided}`
                        : 'Нет принятых решений'}
                    </p>
                  </div>

                  <div className="metric-card" aria-label="Среднее время до решения">
                    <p className="metric-card-label">Среднее время (mean)</p>
                    <p className="metric-card-value">{formatDuration(data.timeToDecision.meanMs)}</p>
                    <p className="metric-card-desc">Выборка: {data.timeToDecision.sampleCount} заявок</p>
                  </div>

                  <div className="metric-card" aria-label="95-й процентиль времени">
                    <p className="metric-card-label">Время p95</p>
                    <p className="metric-card-value">{formatDuration(data.timeToDecision.p95Ms)}</p>
                    <p className="metric-card-desc">Nearest-rank 95-й процентиль времени</p>
                  </div>

                  {data.dataIssuesCount > 0 && (
                    <div className="metric-card metric-card--warning" aria-label="Проблемы данных">
                      <p className="metric-card-label">Проблемы данных</p>
                      <p className="metric-card-value">{data.dataIssuesCount}</p>
                      <p className="metric-card-desc">
                        {data.timeToDecision.invalidCount > 0
                          ? `Ошибок времени: ${data.timeToDecision.invalidCount}`
                          : 'Некорректные статусы или метки времени'}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Distribution: Current Statuses */}
              <section className="workspace-card" aria-label="Распределение по текущим статусам">
                <h2>Распределение по текущим статусам</h2>
                <p className="page-description">
                  Текущий статус всех заявок в когорте (сумма бакетов: {data.total}).
                </p>

                {/* Accessible Bar */}
                <div className="distribution-bar" role="img" aria-label="Диаграмма текущих статусов">
                  {data.currentStatuses.map((s) => {
                    const pct = data.total > 0 ? (s.count / data.total) * 100 : 0;
                    const label = (STATUS_VIEW as Record<string, { label: string }>)[s.status]?.label ?? s.status;
                    return (
                      <div
                        key={s.status}
                        className="distribution-segment"
                        style={{ width: `${pct}%` }}
                        title={`${label}: ${s.count} (${pct.toFixed(1)}%)`}
                      >
                        {pct >= 10 && <span className="distribution-segment-text">{pct.toFixed(0)}%</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Table with Drilldown */}
                <table className="workspace-table queue-table">
                  <caption className="visually-hidden">Текущие статусы когорты</caption>
                  <thead>
                    <tr>
                      <th scope="col">Текущий статус</th>
                      <th scope="col">Количество</th>
                      <th scope="col">Доля</th>
                      <th scope="col">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.currentStatuses.map((s) => {
                      const label = (STATUS_VIEW as Record<string, { label: string }>)[s.status]?.label ?? s.status;
                      const pct = data.total > 0 ? ((s.count / data.total) * 100).toFixed(1) : '0.0';
                      // Build drilldown URL
                      const drillParams = new URLSearchParams();
                      drillParams.set('status', s.status);
                      if (appliedFilter.productCode) drillParams.set('product', appliedFilter.productCode);
                      if (appliedFilter.source !== 'all') drillParams.set('source', appliedFilter.source);
                      if (appliedFilter.fromDate) drillParams.set('from', appliedFilter.fromDate);
                      if (appliedFilter.toDate) drillParams.set('to', appliedFilter.toDate);
                      const drillUrl = `/bank/applications?${drillParams.toString()}`;

                      return (
                        <tr key={s.status}>
                          <td>
                            <StatusBadge status={s.status} />
                          </td>
                          <td>
                            <strong>{s.count}</strong>
                          </td>
                          <td>{pct} %</td>
                          <td>
                            <Link
                              to={drillUrl}
                              className="text-link"
                              aria-label={`Показать ${label} в очереди (${s.count})`}
                            >
                              Показать в очереди ({s.count})
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              {/* Distribution: Outcomes */}
              <section className="workspace-card" aria-label="Распределение по принятым решениям">
                <h2>Распределение по принятым решениям</h2>
                <p className="page-description">
                  Первый зафиксированный бизнес-исход (APPROVED / COUNTER_OFFER / REJECTED). Сохраняется после выдачи или отмены.
                </p>

                {/* Accessible Bar */}
                <div className="distribution-bar" role="img" aria-label="Диаграмма принятых решений">
                  {data.outcomes.map((o) => {
                    const pct = data.decided > 0 ? (o.count / data.decided) * 100 : 0;
                    const modClass =
                      o.outcome === 'APPROVED'
                        ? 'distribution-segment--approved'
                        : o.outcome === 'COUNTER_OFFER'
                          ? 'distribution-segment--counter'
                          : 'distribution-segment--rejected';
                    return (
                      <div
                        key={o.outcome}
                        className={`distribution-segment ${modClass}`}
                        style={{ width: `${pct}%` }}
                        title={`${o.outcome}: ${o.count} (${pct.toFixed(1)}%)`}
                      >
                        {pct >= 10 && <span className="distribution-segment-text">{pct.toFixed(0)}%</span>}
                      </div>
                    );
                  })}
                </div>

                <table className="workspace-table queue-table">
                  <caption className="visually-hidden">Принятые решения</caption>
                  <thead>
                    <tr>
                      <th scope="col">Принятое решение</th>
                      <th scope="col">Количество</th>
                      <th scope="col">Доля от решений</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outcomes.map((o) => {
                      const label =
                        o.outcome === 'APPROVED'
                          ? 'Одобрено'
                          : o.outcome === 'COUNTER_OFFER'
                            ? 'Встречное предложение'
                            : 'Отказ';
                      const pct =
                        data.decided > 0 ? `${((o.count / data.decided) * 100).toFixed(1)} %` : UNAVAILABLE_VALUE;
                      return (
                        <tr key={o.outcome}>
                          <td>
                            <StatusBadge status={o.outcome} />
                            <span style={{ marginLeft: 8 }}>{label}</span>
                          </td>
                          <td>
                            <strong>{o.count}</strong>
                          </td>
                          <td>{pct}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
