import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ApiApplication, ApiApplicationInput } from '../http';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { DateTimeText } from '../../shared/components/DateTimeText';
import { ApiSimulator } from './simulator';
import type { components } from '../schema';
import { ApiError } from '../errors';
import { ApiApplicationFacts, ApiHistory, useApiCommand, useApiScope } from './common';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { MoneyText } from '../../shared/components/MoneyText';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { formatPct } from '../../shared/format';
import '../../client/workspace.css';

export function ApiDashboard() {
  const scope = useApiScope(); const list = useQuery({ queryKey: [...scope.httpKey, 'applications'], queryFn: ({ signal }) => scope.api.applications(scope.token, signal), enabled: scope.enabled });
  const company = useQuery({ queryKey: [...scope.httpKey, 'company'], queryFn: ({ signal }) => scope.api.company(scope.token, signal), enabled: scope.enabled });
  const products = useQuery({ queryKey: [...scope.httpKey, 'products'], queryFn: ({ signal }) => scope.api.products(signal), enabled: scope.enabled });
  return <><TitleDesktop tag="h1" view="large" font="system">Кабинет предпринимателя</TitleDesktop><p>Условия и решения рассчитываются сервером на синтетических данных.</p>
    <section className="workspace-card"><h2>Ваша компания</h2>{company.isPending && <p role="status">Загружаем профиль…</p>}<ErrorBanner message={company.error?.message} onRetry={() => company.refetch().then(() => {})} />{!company.error && company.data && <><h3>{company.data.name}</h3><p>ИНН {company.data.inn} · {company.data.legal_form} · регистрация {company.data.registered_at}</p>{company.data.pre_approved_limit != null && <p>Предварительный лимит: <MoneyText value={company.data.pre_approved_limit} />. Итог зависит от проверки заявки.</p>}</>}</section>
    <section className="workspace-card"><h2>Кредитные продукты</h2><ErrorBanner message={products.error?.message} onRetry={() => products.refetch().then(() => {})} />{!products.error && products.data?.items.map((p) => <article key={p.code}><h3>{p.name}</h3><p><MoneyText value={p.min_amount} /> — <MoneyText value={p.max_amount} /> · {p.min_term_months}–{p.max_term_months} мес.</p><Link to={`/client/applications/new?product=${encodeURIComponent(p.code)}`}>Выбрать {p.name}</Link></article>)}</section><Link to="/client/applications/new" className="text-link">Создать заявку через API</Link>
    <section className="workspace-card"><h2>Ваши заявки</h2>{list.isPending && <p role="status">Загружаем заявки…</p>}<ErrorBanner message={list.error?.message} onRetry={() => list.refetch().then(() => {})} />
      {!list.error && list.data && (list.data.items.length ? <table className="workspace-table api-table"><caption>Заявки из API</caption><thead><tr><th>Заявка</th><th>Продукт</th><th>Сумма</th><th>Срок</th><th>Статус</th></tr></thead><tbody>{list.data.items.map((a) => <tr key={a.id}><td><Link to={`/client/applications/${a.id}`}>{a.id}</Link></td><td>{a.product_code}</td><td><MoneyText value={a.amount} /></td><td>{a.term_months} мес.</td><td><StatusBadge status={a.status} /></td></tr>)}</tbody></table> : <p>У вас пока нет заявок.</p>)}</section></>;
}
export function ApiCreateApplication() {
  const command = useApiCommand<ApiApplication>(); const navigate = useNavigate(); const saved = useRef<ApiApplication>();
  const [values, setValues] = useState<ApiApplicationInput>({ product_code: '', amount: '', term_months: 12, purpose: 'WORKING_CAPITAL' });
  const [bki, setBki] = useState(false); const [pd, setPd] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({});
  const [params] = useSearchParams(); const draftId = params.get('draft');
  const products = useQuery({ queryKey: [...command.httpKey, 'products'], queryFn: ({ signal }) => command.api.products(signal), enabled: command.enabled });
  const draft = useQuery({ queryKey: [...command.httpKey, 'application', draftId], queryFn: ({ signal }) => command.api.application(command.token, draftId!, signal), enabled: command.enabled && Boolean(draftId) });
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    if (draftId) { if (!draft.data || draft.data.status !== 'DRAFT') return; setValues({ product_code: draft.data.product_code, amount: draft.data.amount, term_months: draft.data.term_months, purpose: 'WORKING_CAPITAL' }); initialized.current = true; }
    else if (products.data?.items.length) { setValues((old) => ({ ...old, product_code: products.data.items.find((p) => p.code === params.get('product'))?.code ?? products.data.items[0].code })); initialized.current = true; }
  }, [draftId, draft.data, products.data, params]);
  const inFlight = useRef(false);
  async function run(submit: boolean) {
    if (inFlight.current || !products.data || (draftId && (!draft.data || draft.data.status !== 'DRAFT'))) return;
    const fields: Record<string, string> = {};
    if (!values.product_code.trim()) fields.product_code = 'Укажите код продукта.';
    if (!/^\d+(?:\.\d{1,2})?$/.test(values.amount) || !/[1-9]/.test(values.amount)) fields.amount = 'Введите положительную сумму, до двух знаков после точки.';
    if (!Number.isInteger(values.term_months) || values.term_months < 1 || values.term_months > 60) fields.term_months = 'Укажите целый срок от 1 до 60 месяцев.';
    if (submit && (!bki || !pd)) fields.consents = 'Примите оба согласия перед подачей.';
    setErrors(fields); if (Object.keys(fields).length) return;
    inFlight.current = true;
    try {
      const result = await command.execute(async () => {
        if (!saved.current) {
          const body = { ...values, product_code: values.product_code.trim() };
          saved.current = draftId ? await command.api.update(command.token, draftId, draft.data!.version, body) : await command.api.create(command.token, body);
        }
        if (!command.isCurrent()) return saved.current;
        return submit ? command.api.submit(command.token, saved.current.id, saved.current.version) : saved.current;
      });
      if (result && command.isCurrent()) navigate(`/client/applications/${result.value.id}`);
    } finally { inFlight.current = false; }
  }
  return <><Link to="/client">← В кабинет</Link><TitleDesktop tag="h1" view="large" font="system">Новая заявка через API</TitleDesktop>
    <p>Выберите продукт и параметры. Скоринг, ставки и платежи рассчитывает сервер.</p>
    <ErrorBanner message={products.error?.message ?? draft.error?.message} onRetry={() => Promise.all([products.refetch(), draftId ? draft.refetch() : Promise.resolve()]).then(() => {})} />
    {draft.data && draft.data.status !== 'DRAFT' && <p role="alert">Эту заявку уже нельзя редактировать. Вернитесь в её карточку.</p>}
    <form className="workspace-card application-form" aria-label="Заявка API" onSubmit={(e) => { e.preventDefault(); void run(true); }} noValidate>
      <fieldset disabled={command.pending || Boolean(saved.current) || !products.data || Boolean(draftId && (!draft.data || draft.data.status !== 'DRAFT'))}><legend>Параметры заявки</legend>
        <label className="form-field">Продукт<select aria-label="Код продукта" value={values.product_code} onChange={(e) => setValues({ ...values, product_code: e.target.value })}><option value="">Выберите продукт</option>{products.data?.items.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>{errors.product_code && <p role="alert">{errors.product_code}</p>}
        <InputDesktop label="Сумма, ₽" value={values.amount} inputMode="decimal" onChange={(e) => setValues({ ...values, amount: e.target.value })} error={errors.amount} />
        <label className="form-field">Срок, месяцев<input aria-label="Срок, месяцев" type="number" min={1} max={60} value={Number.isNaN(values.term_months) ? '' : values.term_months} onChange={(e) => setValues({ ...values, term_months: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        {errors.term_months && <p role="alert">{errors.term_months}</p>}
        <label className="form-field">Цель<select aria-label="Цель" value={values.purpose ?? 'WORKING_CAPITAL'} onChange={(e) => setValues({ ...values, purpose: e.target.value })}><option value="WORKING_CAPITAL">Оборотные средства</option><option value="EQUIPMENT">Оборудование</option><option value="OTHER">Другая цель</option></select></label>
      </fieldset>
      <fieldset disabled={command.pending}><legend>Согласия перед подачей</legend><label className="consent-field"><input type="checkbox" checked={bki} onChange={(e) => setBki(e.target.checked)} />Согласие на запрос в БКИ</label><label className="consent-field"><input type="checkbox" checked={pd} onChange={(e) => setPd(e.target.checked)} />Согласие на обработку персональных данных</label></fieldset>
      <p className="form-hint">Согласия проверяются только интерфейсом: текущий API не принимает и не сохраняет их. Черновик можно редактировать до подачи; конфликт версии потребует обновления данных.</p>
      {errors.consents && <p role="alert">{errors.consents}</p>}<ErrorBanner message={command.error?.message} />
      {command.error instanceof ApiError && command.error.details != null && <p role="alert">{JSON.stringify(command.error.details)}</p>}
      {saved.current && <p>Черновик {saved.current.id} уже создан. Повтор использует его же; параметры заблокированы.</p>}
      <div className="form-actions"><ButtonDesktop type="button" view="secondary" disabled={command.pending} onClick={() => { void run(false); }}>Сохранить черновик</ButtonDesktop><ButtonDesktop type="submit" view="primary" disabled={command.pending}>{command.pending ? 'Отправляем…' : 'Подать заявку'}</ButtonDesktop></div>
    </form></>;
}
export function ApiApplicationPage() { const { id = '' } = useParams(); return <ApiApplicationRecord key={id} id={id} />; }
function ApiApplicationRecord({ id }: { id: string }) {
  const command = useApiCommand<ApiApplication>(); const query = useQuery({ queryKey: [...command.httpKey, 'application', id], queryFn: ({ signal }) => command.api.application(command.token, id, signal), enabled: command.enabled && Boolean(id), refetchInterval: (q) => !q.state.error && q.state.data && ['SUBMITTED', 'SCORING', 'SIGNED', 'UNDERWRITING'].includes(q.state.data.status) ? 1500 : false });
  const [consent, setConsent] = useState(false); const record = query.data;
  const [action, setAction] = useState<{ kind: 'accept'; offerId: string } | { kind: 'cancel' }>();
  const [challenge, setChallenge] = useState<components['schemas']['SigningChallenge']>();
  const [selectedOfferId, setSelectedOfferId] = useState<string>();
  const [code, setCode] = useState(''); const [signError, setSignError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!challenge) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [challenge]);
  const expired = challenge ? Date.parse(challenge.expires_at) <= now : false;
  async function confirmAction() {
    if (!record || !action) return;
    if (action.kind === 'cancel') await command.execute(() => command.api.cancel(command.token, id, record.version));
    else {
      const accept = action;
      await command.execute(async () => {
        const next = await command.api.accept(command.token, id, record.version, accept.offerId);
        if (command.isCurrent()) { setChallenge(next); setSelectedOfferId(accept.offerId); setNow(Date.now()); }
        return command.api.application(command.token, id);
      });
    }
    if (command.isCurrent()) setAction(undefined);
  }
  async function sign() {
    if (!record || !/^\d{6}$/.test(code) || expired) { setSignError('Введите шесть цифр до окончания срока кода.'); return; }
    setSignError(''); await command.execute(() => command.api.sign(command.token, id, record.version, code));
  }
  return <><Link to="/client">← В кабинет</Link><TitleDesktop tag="h1" view="large" font="system">Заявка из API</TitleDesktop>
    <p>Текущий этап и история обновляются по данным сервера.</p>{query.isPending && <p role="status">Загружаем заявку…</p>}<ErrorBanner message={query.error?.message} onRetry={() => query.refetch().then(() => {})} />
    {!query.error && record && <><section className="workspace-card"><ApiApplicationFacts record={record} />
      {record.status === 'DRAFT' && <><p>Перед подачей подтвердите согласия; сервер их пока не сохраняет.</p><label className="consent-field"><input type="checkbox" checked={consent} disabled={command.pending} onChange={(e) => setConsent(e.target.checked)} />Подтверждаю согласие на запрос в БКИ и обработку персональных данных</label><ButtonDesktop view="primary" disabled={command.pending || !consent} onClick={() => { void command.execute(() => command.api.submit(command.token, id, record.version)); }}>Подать черновик</ButtonDesktop></>}
      {record.status === 'DRAFT' && <p><Link to={`/client/applications/new?draft=${encodeURIComponent(id)}`}>Редактировать черновик</Link></p>}
      {['DRAFT', 'APPROVED', 'COUNTER_OFFER', 'SIGNING'].includes(record.status) && <ButtonDesktop view="secondary" disabled={command.pending} onClick={() => setAction({ kind: 'cancel' })}>Отменить заявку</ButtonDesktop>}
      {record.status === 'UNDERWRITING' && <p>Заявка рассматривается сотрудником. Обновления появятся автоматически.</p>}
      {record.status === 'REJECTED' && <p>По текущим данным принято решение об отказе. Изменение отдельных факторов не гарантирует одобрение следующей заявки.</p>}
      {record.status === 'SIGNING' && <section aria-label="Подписание"><h2>Подписание внутри кабинета</h2>{challenge ? <><p>Код подтверждения: <strong>{challenge.code}</strong></p><p>Действует до <DateTimeText value={challenge.expires_at} /></p>{expired && <p role="alert">Срок кода истёк. API не предоставляет повторную выдачу кода; можно отменить заявку и создать новую.</p>}<form onSubmit={(e) => { e.preventDefault(); void sign(); }}><label>Код из шести цифр<input aria-label="Код подписи" inputMode="numeric" maxLength={6} autoComplete="off" value={code} disabled={command.pending || expired || query.isFetching} onChange={(e) => setCode(e.target.value)} /></label><ButtonDesktop type="submit" view="primary" disabled={command.pending || expired || query.isFetching}>Подписать</ButtonDesktop></form>{signError && <p role="alert">{signError}</p>}</> : <p>Код хранится только до перезагрузки страницы. API не предоставляет восстановление кода: отмените заявку и создайте новую либо вернитесь на страницу, где вы приняли оффер.</p>}</section>}
      {record.status === 'DISBURSED' && <h2>Кредит выдан — статус подтверждён API</h2>}
      <ErrorBanner message={command.error?.message} />
    </section><section className="workspace-card"><h2>Решение от API</h2>{record.decision ? <><ul>{record.decision.factors?.map((f, i) => <li key={i}>{f.client_text || 'Клиентское объяснение отсутствует'}{f.hint && <p>{f.hint}</p>}</li>)}</ul>
      {record.decision.offers?.length && ['APPROVED', 'COUNTER_OFFER', 'SIGNING', 'SIGNED', 'DISBURSED'].includes(record.status) ? record.decision.offers.filter((o) => record.status !== 'SIGNING' || !selectedOfferId || o.id === selectedOfferId).map((o) => <article key={o.id}><p><MoneyText value={o.amount} /> / {o.term_months} мес. / {formatPct(o.rate_pct)}</p><p>Платёж: <MoneyText value={o.monthly_payment} />. Переплата: <MoneyText value={o.overpayment} /></p>{o.expires_at && <p>Действует до <DateTimeText value={o.expires_at} /></p>}{['APPROVED', 'COUNTER_OFFER'].includes(record.status) && <ButtonDesktop view="primary" disabled={command.pending || Boolean(o.expires_at && Date.parse(o.expires_at) <= now)} onClick={() => setAction({ kind: 'accept', offerId: o.id })}>Принять предложение</ButtonDesktop>}</article>) : <p>Офферы и подробные условия сервер не передал.</p>}</> : <p>Решение ещё не получено.</p>}</section>{['APPROVED', 'COUNTER_OFFER'].includes(record.status) && <ApiSimulator record={record} />}<ApiHistory record={record} /></>}
    <ConfirmDialog open={Boolean(action) && !query.error} title={action?.kind === 'accept' ? 'Принять предложение?' : 'Отменить заявку?'} description={action?.kind === 'accept' ? 'Подтвердите выбор условий сервера. Далее потребуется код подписи внутри кабинета.' : 'Заявка будет отменена. Для повторной подачи потребуется новая заявка.'} confirmLabel="Подтвердить" pending={command.pending} onCancel={() => setAction(undefined)} onConfirm={confirmAction} />
  </>;
}
