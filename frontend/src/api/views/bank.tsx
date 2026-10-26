import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ApiApplication, ApiDecisionInput, ApiQueueItem } from '../http';
import { ApiApplicationFacts, ApiHistory, useApiScope, useApiCommand } from './common';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { MoneyText } from '../../shared/components/MoneyText';
import { statusLabel, STATUS_VIEW } from '../../shared/status';
import '../../client/workspace.css';
import { RecordDetails, recordValue } from '../../shared/components/RecordDetails';

const field = recordValue;

export function ApiBankQueue() {
  const scope = useApiScope(); const queue = useQuery({ queryKey: [...scope.httpKey, 'queue'], queryFn: ({ signal }) => scope.api.queue(scope.token, signal), enabled: scope.bankEnabled });
  const [status, setStatus] = useState(''); const [search, setSearch] = useState('');
  const products = useQuery({ queryKey: [...scope.httpKey, 'products'], queryFn: ({ signal }) => scope.api.products(signal), enabled: scope.bankEnabled });
  const rows = queue.data?.items.filter((a) => (!status || status === a.status) && `${a.id} ${a.company_id} ${a.product_code} ${products.data?.items.find((product) => product.code === a.product_code)?.name ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <><TitleDesktop tag="h1" view="large" font="system">Очередь заявок</TitleDesktop><p>Рассматривайте заявки и отслеживайте решения по финансированию.</p>
    <section className="workspace-card"><div className="api-filter-row"><label>Поиск по номеру заявки, компании или продукту<input aria-label="Поиск заявок" value={search} onChange={(e) => setSearch(e.target.value)} /></label><label>Статус<select aria-label="Статус заявки" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Все статусы</option>{Object.entries(STATUS_VIEW).map(([key, view]) => <option key={key} value={key}>{view.label}</option>)}</select></label><ButtonDesktop view="secondary" disabled={queue.isFetching} onClick={() => { void queue.refetch(); }}>Обновить очередь</ButtonDesktop></div></section>
    {queue.isPending && <p role="status">Загружаем очередь…</p>}<ErrorBanner message={queue.error?.message} onRetry={() => queue.refetch().then(() => {})} />
    {!queue.error && rows && <section className="workspace-card"><p>Найдено заявок: {rows.length}</p>{rows.length ? <table className="workspace-table api-table"><caption>Заявки на финансирование</caption><thead><tr><th>Заявка / компания</th><th>Продукт</th><th>Сумма / срок</th><th>Статус</th></tr></thead><tbody>{rows.map((a: ApiQueueItem) => <tr key={a.id}><td><Link className="text-link" title={a.id} to={`/bank/applications/${a.id}`}>№ {a.id.slice(0, 8)}</Link><small title={a.company_id}>Компания № {a.company_id.slice(0, 8)}</small></td><td>{products.data?.items.find((product) => product.code === a.product_code)?.name ?? a.product_code}</td><td><MoneyText value={a.amount} /><small>{a.term_months} мес.</small></td><td><StatusBadge status={a.status} /></td></tr>)}</tbody></table> : <p>Заявок по выбранным фильтрам нет.</p>}</section>}
  </>;
}
export function ApiBankDossier() { const { id = '' } = useParams(); return <ApiBankRecord key={id} id={id} />; }
function ApiBankRecord({ id }: { id: string }) {
  const command = useApiCommand<ApiApplication>();
  const dossier = useQuery({ queryKey: [...command.httpKey, 'dossier', id], queryFn: ({ signal }) => command.api.dossier(command.token, id, signal), enabled: command.bankEnabled && Boolean(id) });
  const runs = useQuery({ queryKey: [...command.httpKey, 'scoring-runs', id], queryFn: ({ signal }) => command.api.scoringRuns(command.token, id, signal), enabled: command.bankEnabled && Boolean(id) });
  const [action, setAction] = useState<'decision' | 'rescore'>(); const [outcome, setOutcome] = useState<ApiDecisionInput['outcome']>('REJECTED'); const [comment, setComment] = useState(''); const [validation, setValidation] = useState('');
  const data = dossier.data;
  async function execute() {
    const result = await command.execute(() => action === 'decision' ? command.api.decide(command.token, id, { outcome, comment: comment.trim() }) : command.api.rescore(command.token, id));
    if (command.isCurrent()) { setAction(undefined); if (result) setComment(''); }
  }
  return <><Link to="/bank/applications">← В очередь</Link><TitleDesktop tag="h1" view="large" font="system">Досье заявки</TitleDesktop>
    {dossier.isPending && <p role="status">Загружаем досье…</p>}<ErrorBanner message={dossier.error?.message} onRetry={() => dossier.refetch().then(() => {})} />
    {!dossier.error && data && <><section className="workspace-card"><ApiApplicationFacts record={data.application} showCompany /><ButtonDesktop view="secondary" disabled={command.pending || !['UNDERWRITING', 'REJECTED', 'COUNTER_OFFER'].includes(data.application.status)} onClick={() => setAction('rescore')}>Пересчитать решение</ButtonDesktop><p className="form-hint">Повторная проверка может изменить решение. Действие доступно для заявок на рассмотрении, отказов и встречных предложений.</p></section>
      {data.application.status === 'UNDERWRITING' && <section className="workspace-card"><h2>Решение сотрудника</h2><p>Выберите решение и укажите результаты проверки.</p>
        <form className="application-form" aria-label="Решение сотрудника" onSubmit={(e) => { e.preventDefault(); if (!comment.trim() || comment.trim().length > 2000) setValidation('Введите комментарий от 1 до 2000 символов.'); else { setValidation(''); setAction('decision'); } }}>
          <fieldset disabled={command.pending}><label>Итоговое решение<select aria-label="Итоговое решение" value={outcome} onChange={(e) => setOutcome(e.target.value as ApiDecisionInput['outcome'])}><option value="APPROVED">Одобрить</option><option value="COUNTER_OFFER">Встречное предложение</option><option value="REJECTED">Отказать</option></select></label><label>Комментарий<textarea aria-label="Комментарий сотрудника" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} /></label><ButtonDesktop type="submit" view="primary">Подтвердить решение</ButtonDesktop></fieldset>{validation && <p role="alert">{validation}</p>}
        </form></section>}
      <ErrorBanner message={command.error?.message} />
      <section className="workspace-card"><h2>Результаты проверки</h2><ErrorBanner message={runs.error?.message} onRetry={() => runs.refetch().then(() => {})} />{!runs.error && (runs.data?.length ? runs.data.map((r) => <article key={r.id}><h3>Проверка {r.id}</h3><p>Политика: {r.policy_version} · {r.created_at}</p><dl className="facts"><div><dt>Рекомендация</dt><dd>{field(r.result.recommendation)}</dd></div><div><dt>Маршрут</dt><dd>{field(r.result.route)}</dd></div><div><dt>Баллы / грейд</dt><dd>{field(r.result.score)} / {field(r.result.grade)}</dd></div></dl><h4>Факторы и правила</h4><div className="api-trace"><table className="workspace-table"><thead><tr><th>Фактор</th><th>Источник</th><th>Значение</th><th>Баллы / максимум</th><th>Правило</th><th>Объяснение</th></tr></thead><tbody>{r.factors.map((f, index) => <tr key={index}><td>{field(f.code)}</td><td>{field(f.source)}</td><td>{field(f.value)}</td><td>{field(f.points)} / {field(f.max_points)}</td><td>{field(f.rule_id)}</td><td>{field(f.client_text)}{f.hint != null && <p>{field(f.hint)}</p>}</td></tr>)}</tbody></table></div><details><summary>Полный результат и ограничения</summary><RecordDetails value={r.result} /></details></article>) : <p>Результаты проверки пока отсутствуют.</p>)}</section>
      <section className="workspace-card"><h2>Данные проверки</h2>{Object.keys(data.inputs_snapshot ?? {}).length ? <RecordDetails value={data.inputs_snapshot} /> : <p>Данные проверки пока отсутствуют.</p>}</section>
      <section className="workspace-card"><h2>История действий</h2>{data.audit?.length ? <RecordDetails value={data.audit} /> : <p>Записей аудита нет.</p>}</section><ApiHistory record={data.application} showReasons />
    </>}
    <ConfirmDialog open={Boolean(action) && !dossier.error} title={action === 'decision' ? 'Подтвердить решение?' : 'Запустить повторную проверку?'} description={action === 'decision' ? `Решение: ${statusLabel(outcome)}. Комментарий: ${comment.trim()}.` : 'Заявка будет повторно проверена. Доступное решение может измениться.'} confirmLabel="Отправить" pending={command.pending} onCancel={() => setAction(undefined)} onConfirm={execute} />
  </>;
}
export function ApiBankMetrics() {
  const scope = useApiScope(); const metrics = useQuery({ queryKey: [...scope.httpKey, 'metrics'], queryFn: ({ signal }) => scope.api.metrics(scope.token, signal), enabled: scope.bankEnabled });
  const labels: Record<string, string> = { total_applications: 'Всего заявок', automated_decisions: 'Автоматические решения', underwriting_decisions: 'На рассмотрении', approved: 'Одобрено', counter_offer: 'Встречное предложение', rejected: 'Отказ' };
  return <><TitleDesktop tag="h1" view="large" font="system">Метрики конвейера</TitleDesktop><p>Количество заявок, автоматических решений и текущих обращений на рассмотрении.</p><ButtonDesktop view="secondary" disabled={metrics.isFetching} onClick={() => { void metrics.refetch(); }}>Обновить метрики</ButtonDesktop>
    {metrics.isPending && <p role="status">Загружаем метрики…</p>}<ErrorBanner message={metrics.error?.message} onRetry={() => metrics.refetch().then(() => {})} />
    {!metrics.error && metrics.data && <dl className="api-metrics-grid">{Object.entries(labels).map(([key, label]) => <div className="workspace-card" key={key}><dt>{label}</dt><dd>{metrics.data[key as keyof typeof metrics.data]}</dd></div>)}</dl>}
  </>;
}
