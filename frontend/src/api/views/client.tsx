import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ApiApplication, ApiApplicationInput } from '../http';
import { ApiError } from '../errors';
import { ApiApplicationFacts, ApiHistory, useApiCommand, useApiScope } from './common';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { MoneyText } from '../../shared/components/MoneyText';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { formatPct } from '../../shared/format';
import '../../client/workspace.css';

export function ApiDashboard() {
  const scope = useApiScope(); const list = useQuery({ queryKey: [...scope.httpKey, 'applications'], queryFn: ({ signal }) => scope.api.applications(scope.token, signal), enabled: scope.enabled });
  return <><TitleDesktop tag="h1" view="large" font="system">Кабинет предпринимателя</TitleDesktop><p>Заявки загружаются из API. Профиль компании и каталог продуктов сервер пока не предоставляет.</p><Link to="/client/applications/new" className="text-link">Создать заявку через API</Link>
    <section className="workspace-card"><h2>Ваши заявки</h2>{list.isPending && <p role="status">Загружаем заявки…</p>}<ErrorBanner message={list.error?.message} onRetry={() => list.refetch().then(() => {})} />
      {!list.error && list.data && (list.data.items.length ? <table className="workspace-table"><caption>Заявки из API</caption><thead><tr><th>Заявка</th><th>Продукт</th><th>Сумма</th><th>Срок</th><th>Статус</th></tr></thead><tbody>{list.data.items.map((a) => <tr key={a.id}><td><Link to={`/client/applications/${a.id}`}>{a.id}</Link></td><td>{a.product_code}</td><td><MoneyText value={a.amount} /></td><td>{a.term_months} мес.</td><td><StatusBadge status={a.status} /></td></tr>)}</tbody></table> : <p>У вас пока нет заявок.</p>)}</section></>;
}
export function ApiCreateApplication() {
  const command = useApiCommand<ApiApplication>(); const navigate = useNavigate(); const saved = useRef<ApiApplication>();
  const [values, setValues] = useState<ApiApplicationInput>({ product_code: '', amount: '', term_months: 12, purpose: 'WORKING_CAPITAL' });
  const [bki, setBki] = useState(false); const [pd, setPd] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  async function run(submit: boolean) {
    if (inFlight.current) return;
    const fields: Record<string, string> = {};
    if (!values.product_code.trim()) fields.product_code = 'Укажите код продукта.';
    if (!/^\d+(?:\.\d{1,2})?$/.test(values.amount) || !/[1-9]/.test(values.amount)) fields.amount = 'Введите положительную сумму, до двух знаков после точки.';
    if (!Number.isInteger(values.term_months) || values.term_months < 1 || values.term_months > 60) fields.term_months = 'Укажите целый срок от 1 до 60 месяцев.';
    if (submit && (!bki || !pd)) fields.consents = 'Примите оба согласия перед подачей.';
    setErrors(fields); if (Object.keys(fields).length) return;
    inFlight.current = true;
    try {
      const result = await command.execute(async () => {
        if (!saved.current) saved.current = await command.api.create(command.token, { ...values, product_code: values.product_code.trim() });
        if (!command.isCurrent()) return saved.current;
        return submit ? command.api.submit(command.token, saved.current.id) : saved.current;
      });
      if (result && command.isCurrent()) navigate(`/client/applications/${result.value.id}`);
    } finally { inFlight.current = false; }
  }
  return <><Link to="/client">← В кабинет</Link><TitleDesktop tag="h1" view="large" font="system">Новая заявка через API</TitleDesktop>
    <p>Каталога продуктов в API пока нет. Введите код, согласованный с backend (например WC_FLEX или CAPEX). Параметры проверяются по опубликованной схеме; условия кредита здесь не рассчитываются.</p>
    <form className="workspace-card application-form" aria-label="Заявка API" onSubmit={(e) => { e.preventDefault(); void run(true); }} noValidate>
      <fieldset disabled={command.pending || Boolean(saved.current)}><legend>Параметры заявки</legend>
        <InputDesktop label="Код продукта" value={values.product_code} onChange={(e) => setValues({ ...values, product_code: e.target.value })} error={errors.product_code} />
        <InputDesktop label="Сумма, ₽" value={values.amount} inputMode="decimal" onChange={(e) => setValues({ ...values, amount: e.target.value })} error={errors.amount} />
        <label className="form-field">Срок, месяцев<input aria-label="Срок, месяцев" type="number" min={1} max={60} value={Number.isNaN(values.term_months) ? '' : values.term_months} onChange={(e) => setValues({ ...values, term_months: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        {errors.term_months && <p role="alert">{errors.term_months}</p>}
        <label className="form-field">Цель<select aria-label="Цель" value={values.purpose ?? 'WORKING_CAPITAL'} onChange={(e) => setValues({ ...values, purpose: e.target.value })}><option value="WORKING_CAPITAL">Оборотные средства</option><option value="EQUIPMENT">Оборудование</option><option value="OTHER">Другая цель</option></select></label>
      </fieldset>
      <fieldset disabled={command.pending}><legend>Согласия перед подачей</legend><label className="consent-field"><input type="checkbox" checked={bki} onChange={(e) => setBki(e.target.checked)} />Согласие на запрос в БКИ</label><label className="consent-field"><input type="checkbox" checked={pd} onChange={(e) => setPd(e.target.checked)} />Согласие на обработку персональных данных</label></fieldset>
      <p className="form-hint">Согласия проверяются только интерфейсом: текущий API не принимает и не сохраняет их. Редактирование созданного черновика API не поддерживает.</p>
      {errors.consents && <p role="alert">{errors.consents}</p>}<ErrorBanner message={command.error?.message} />
      {command.error instanceof ApiError && command.error.details != null && <p role="alert">{JSON.stringify(command.error.details)}</p>}
      {saved.current && <p>Черновик {saved.current.id} уже создан. Повтор использует его же; параметры заблокированы.</p>}
      <div className="form-actions"><ButtonDesktop type="button" view="secondary" disabled={command.pending} onClick={() => { void run(false); }}>Сохранить черновик</ButtonDesktop><ButtonDesktop type="submit" view="primary" disabled={command.pending}>{command.pending ? 'Отправляем…' : 'Подать заявку'}</ButtonDesktop></div>
    </form></>;
}
export function ApiApplicationPage() { const { id = '' } = useParams(); return <ApiApplicationRecord key={id} id={id} />; }
function ApiApplicationRecord({ id }: { id: string }) {
  const command = useApiCommand<ApiApplication>(); const query = useQuery({ queryKey: [...command.httpKey, 'application', id], queryFn: ({ signal }) => command.api.application(command.token, id, signal), enabled: command.enabled && Boolean(id), refetchInterval: (q) => !q.state.error && q.state.data && ['SUBMITTED', 'SCORING', 'SIGNED'].includes(q.state.data.status) ? 1500 : false });
  const [consent, setConsent] = useState(false); const record = query.data;
  return <><Link to="/client">← В кабинет</Link><TitleDesktop tag="h1" view="large" font="system">Заявка из API</TitleDesktop>
    <p>Чтение выполняется через ваш список заявок: отдельного GET заявки в этом API нет.</p>{query.isPending && <p role="status">Загружаем заявку…</p>}<ErrorBanner message={query.error?.message} onRetry={() => query.refetch().then(() => {})} />
    {!query.error && record && <><section className="workspace-card"><ApiApplicationFacts record={record} />
      {record.status === 'DRAFT' && <><p>Редактирование черновика недоступно в API. Перед подачей подтвердите согласия; сервер их пока не сохраняет.</p><label className="consent-field"><input type="checkbox" checked={consent} disabled={command.pending} onChange={(e) => setConsent(e.target.checked)} />Подтверждаю согласие на запрос в БКИ и обработку персональных данных</label><ButtonDesktop view="primary" disabled={command.pending || !consent} onClick={() => { void command.execute(() => command.api.submit(command.token, id)); }}>Подать черновик</ButtonDesktop></>}
      {record.status === 'APPROVED' && <p>API вернул одобрение. Текущий stub не выполняет полноценный скоринг; отсутствие офферов не означает завершение сделки.</p>}
      {record.status === 'DISBURSED' && <h2>Кредит выдан — статус подтверждён API</h2>}
      <ErrorBanner message={command.error?.message} />
    </section><section className="workspace-card"><h2>Решение от API</h2>{record.decision ? <><p>Исход: {record.decision.outcome}; маршрут: {record.decision.route}.</p><ul>{record.decision.factors?.map((f, i) => <li key={i}>{f.client_text || 'Клиентское объяснение отсутствует'}{f.hint && <p>{f.hint}</p>}</li>)}</ul>
      {record.decision.offers?.length ? record.decision.offers.map((o) => <article key={o.id}><p><MoneyText value={o.amount} /> / {o.term_months} мес. / {formatPct(o.rate_pct)}</p><p>Платёж: <MoneyText value={o.monthly_payment} />. Переплата: <MoneyText value={o.overpayment} /></p></article>) : <p>Офферы и подробные условия сервер не передал.</p>}</> : <p>Решение ещё не получено.</p>}<p>Принятие оффера, симуляция и подписание в этой версии API недоступны.</p></section><ApiHistory record={record} /></>}
  </>;
}
