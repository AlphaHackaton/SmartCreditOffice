import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useProducts, useWorkspaceScope } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/session';
import { ApiError } from '../api/errors';
import { demoData } from '../demo/generated';
import { validateInput, type Application, type ApplicationInput, type Product } from '../demo/gateway';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import { MoneyText } from '../shared/components/MoneyText';
import './workspace.css';

export function NewApplicationPage() {
  const products = useProducts(); const scope = useWorkspaceScope(); const [search] = useSearchParams(); const draftId = search.get('draft');
  const draft = useQuery({ queryKey: [...scope.key, 'application', draftId], queryFn: ({ signal }) => scope.gateway.application(scope.token, draftId!, signal), enabled: scope.enabled && Boolean(draftId) });
  if (products.isPending || (draftId && draft.isPending)) return <p role="status">Загружаем форму заявки…</p>;
  if (products.error || draft.error) return <ErrorBanner message={(products.error ?? draft.error)?.message} onRetry={async () => { await products.refetch(); if (draftId) await draft.refetch(); }} />;
  if (draft.data && draft.data.status !== 'DRAFT') return <Navigate replace to={`/client/applications/${draft.data.id}`} />;
  if (!products.data?.length) return <p>Нет доступных продуктов. <Link to="/client">Вернуться в кабинет</Link></p>;
  return <ApplicationForm key={draftId ?? 'new'} products={products.data} initial={draft.data} preferredProduct={search.get('product')} />;
}

function ApplicationForm({ products, initial, preferredProduct }: { products: Product[]; initial?: Application; preferredProduct: string | null }) {
  const scope = useWorkspaceScope(); const { user } = useAuth(); const session = useSession(); const cache = useQueryClient(); const navigate = useNavigate();
  const fixture = demoData.personas.find((p) => p.id === user?.companyId)?.request;
  const [values, setValues] = useState<ApplicationInput>(() => initial ?? { productCode: preferredProduct ?? fixture?.product_code ?? products[0].code, amount: fixture?.amount ?? '', termMonths: fixture?.term_months ?? products[0].min_term, purpose: 'WORKING_CAPITAL', consents: [] });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [notice, setNotice] = useState('');
  const saved = useRef<Application | undefined>(initial); const inFlight = useRef(false); const mounted = useRef(true); const form = useRef<HTMLFormElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const product = products.find((p) => p.code === values.productCode);
  const mutation = useMutation({ mutationFn: async (submit: boolean) => {
    const record = await scope.gateway.save(scope.token, values, saved.current?.id, saved.current?.version);
    saved.current = record;
    return submit ? scope.gateway.submit(scope.token, record.id, record.version) : record;
  } });
  function change<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: '' })); setNotice(''); }
  async function run(submit: boolean) {
    if (inFlight.current) return;
    const validation = validateInput(values, product, submit); setErrors(validation); setNotice('');
    if (Object.keys(validation).length) { form.current?.querySelector<HTMLElement>(`[name="${Object.keys(validation)[0]}"]`)?.focus(); return; }
    inFlight.current = true;
    try {
      const record = await mutation.mutateAsync(submit);
      if (!mounted.current || session.getToken() !== scope.token) return;
      saved.current = record;
      void cache.invalidateQueries({ queryKey: [...scope.key, 'applications'] });
      cache.setQueryData([...scope.key, 'application', record.id], record);
      if (submit) await navigate(`/client/applications/${record.id}`);
      else setNotice('Черновик сохранён. Он доступен в списке заявок.');
    } catch (e) {
      if (!mounted.current || session.getToken() !== scope.token) return;
      if (e instanceof ApiError && e.status === 422 && e.details && typeof e.details === 'object') {
        const fields = Object.fromEntries(Object.entries(e.details).filter(([key, value]) => ['amount', 'termMonths', 'productCode', 'purpose', 'consents'].includes(key) && typeof value === 'string'));
        setErrors(fields);
      }
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT' && saved.current) {
        try { saved.current = await scope.gateway.application(scope.token, saved.current.id); setNotice('Данные заявки обновлены. Введённые поля сохранены; проверьте их перед повтором.'); } catch { /* The original command error remains visible. */ }
      }
    } finally { inFlight.current = false; }
  }
  function consent(value: string, checked: boolean) { change('consents', checked ? [...values.consents, value] : values.consents.filter((item) => item !== value)); }
  return <>
    <Link className="text-link" to="/client">← В кабинет</Link>
    <TitleDesktop tag="h1" view="large" font="system">Новая заявка</TitleDesktop>
    <p className="page-description">Укажите параметры финансирования. Профиль компании уже заполнен.</p>
    <form ref={form} className="workspace-card application-form" noValidate aria-label="Оформление заявки" aria-busy={mutation.isPending} onSubmit={(event: FormEvent) => { event.preventDefault(); void run(true); }}>
      <fieldset disabled={mutation.isPending}><legend>Параметры финансирования</legend>
        <label className="form-field">Продукт<select name="productCode" value={values.productCode} aria-invalid={Boolean(errors.productCode)} onChange={(e) => change('productCode', e.target.value)}>{!product && <option value={values.productCode}>Выберите продукт</option>}{products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
        {errors.productCode && <p className="field-error">{errors.productCode}</p>}
        {product && <p className="form-hint">Сумма от <MoneyText value={product.min_amount} /> до <MoneyText value={product.max_amount} />. Шаг <MoneyText value={demoData.amountStep} />. Срок {product.min_term}–{product.max_term} мес., шаг {demoData.termStep} мес.</p>}
        <InputDesktop label="Сумма, ₽" labelView="outer" name="amount" value={values.amount} inputMode="decimal" block required error={errors.amount} aria-invalid={Boolean(errors.amount)} onChange={(_event, { value }) => change('amount', value)} />
        <label className="form-field">Срок, месяцев<input name="termMonths" type="number" min={product?.min_term} max={product?.max_term} step={demoData.termStep} value={Number.isNaN(values.termMonths) ? '' : values.termMonths} aria-invalid={Boolean(errors.termMonths)} aria-describedby={errors.termMonths ? 'term-error' : undefined} onChange={(e) => change('termMonths', e.target.value === '' ? NaN : Number(e.target.value))} /></label>
        {errors.termMonths && <p className="field-error" id="term-error">{errors.termMonths}</p>}
        <label className="form-field">Цель финансирования<select name="purpose" value={values.purpose} aria-invalid={Boolean(errors.purpose)} onChange={(e) => change('purpose', e.target.value)}><option value="WORKING_CAPITAL">Пополнение оборотных средств</option><option value="EQUIPMENT">Приобретение оборудования</option><option value="OTHER">Другая цель</option></select></label>
        {errors.purpose && <p className="field-error">{errors.purpose}</p>}
      </fieldset>
      <fieldset disabled={mutation.isPending}><legend>Согласия для рассмотрения заявки</legend>
        <label className="consent-field"><input name="consents" type="checkbox" checked={values.consents.includes('BKI_REQUEST')} aria-invalid={Boolean(errors.consents)} aria-describedby={errors.consents ? 'consent-error' : undefined} onChange={(e) => consent('BKI_REQUEST', e.target.checked)} />Согласие на запрос в БКИ</label>
        <label className="consent-field"><input type="checkbox" checked={values.consents.includes('PD_PROCESSING')} aria-invalid={Boolean(errors.consents)} aria-describedby={errors.consents ? 'consent-error' : undefined} onChange={(e) => consent('PD_PROCESSING', e.target.checked)} />Согласие на обработку персональных данных</label>
        {errors.consents && <p className="field-error" id="consent-error">{errors.consents}</p>}
      </fieldset>
      <ErrorBanner message={mutation.error?.message} />
      {notice && <p role="status" className="save-notice">{notice}</p>}
      <p className="form-hint">Выберите сумму и срок. После проверки заявки вы получите решение и доступные условия финансирования.</p>
      <div className="form-actions"><ButtonDesktop type="button" view="secondary" size={48} disabled={mutation.isPending} onClick={() => { void run(false); }}>Сохранить черновик</ButtonDesktop><ButtonDesktop type="submit" view="primary" size={48} disabled={mutation.isPending}>{mutation.isPending ? 'Сохраняем…' : 'Подать заявку'}</ButtonDesktop></div>
    </form>
  </>;
}
