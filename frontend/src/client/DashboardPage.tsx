import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { Link } from 'react-router-dom';
import { useApplications, useCompany, useProducts } from '../api/queries';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import { MoneyText } from '../shared/components/MoneyText';
import { DateTimeText } from '../shared/components/DateTimeText';
import { StatusBadge } from '../shared/components/StatusBadge';
import { ButtonLink } from '../shared/components/ButtonLink';
import './workspace.css';

export function DashboardPage() {
  const company = useCompany(); const products = useProducts(); const applications = useApplications();
  return <>
    <div className="workspace-heading"><div><p className="eyebrow">МОЙ БИЗНЕС</p><TitleDesktop tag="h1" view="large" font="system" defaultMargins={false}>Кабинет предпринимателя</TitleDesktop><p className="page-description">Финансирование, которое помогает двигаться дальше.</p></div><ButtonLink to="/client/applications/new">Создать заявку</ButtonLink></div>
    <section className="workspace-card" aria-labelledby="company-title"><h2 id="company-title">Ваша компания</h2>
      {company.isPending && <p role="status">Загружаем профиль…</p>}
      <ErrorBanner message={company.error?.message} onRetry={() => company.refetch().then(() => {})} />
      {company.data && <><h3>{company.data.name}</h3><dl className="facts"><div><dt>ИНН</dt><dd>{company.data.inn}</dd></div><div><dt>Форма</dt><dd>{company.data.legal_form === 'IP' ? 'Индивидуальный предприниматель' : 'ООО'}</dd></div><div><dt>Регистрация</dt><dd><DateTimeText value={company.data.registered_at} kind="date" /></dd></div><div><dt>ОКВЭД</dt><dd>{company.data.okved}</dd></div></dl></>}
    </section>
    <section className="workspace-section" aria-labelledby="products-title"><h2 id="products-title">Финансирование для бизнеса</h2>
      {products.isPending && <p role="status">Загружаем продукты…</p>}
      <ErrorBanner message={products.error?.message} onRetry={() => products.refetch().then(() => {})} />
      {products.data?.length === 0 && <p>Доступных продуктов пока нет.</p>}
      <div className="product-grid">{products.data?.map((product) => <article className="workspace-card product-card" key={product.code}><span className="product-tag">{product.code === 'WC_FLEX' ? 'ОБОРОТНЫЕ СРЕДСТВА' : 'РАЗВИТИЕ БИЗНЕСА'}</span><h3>{product.name}</h3><p><MoneyText value={product.min_amount} /> — <MoneyText value={product.max_amount} /></p><p className="muted">От {product.min_term} до {product.max_term} месяцев</p><Link className="text-link" to={`/client/applications/new?product=${encodeURIComponent(product.code)}`}>Выбрать продукт →</Link></article>)}</div>
    </section>
    <section className="workspace-card" aria-labelledby="applications-title"><h2 id="applications-title">Ваши заявки</h2>
      {applications.isPending && <p role="status">Загружаем заявки…</p>}
      <ErrorBanner message={applications.error?.message} onRetry={() => applications.refetch().then(() => {})} />
      {applications.data?.length === 0 && <div className="workspace-empty"><h3>У вас пока нет заявок</h3><p>Выберите продукт и расскажите, какое финансирование нужно вашему бизнесу.</p><Link className="text-link" to="/client/applications/new">Подать первую заявку →</Link></div>}
      {Boolean(applications.data?.length) && <table className="application-table"><caption className="value-unavailable-description">Список заявок компании</caption><thead><tr><th>Заявка</th><th>Сумма</th><th>Срок</th><th>Статус</th><th>Создана</th></tr></thead><tbody>{applications.data?.map((a) => <tr key={a.id}><td><Link className="text-link" to={`/client/applications/${a.id}`}>№ {a.id.slice(0, 8)}</Link></td><td><MoneyText value={a.amount} /></td><td>{a.termMonths} мес.</td><td><StatusBadge status={a.status} /></td><td><DateTimeText value={a.createdAt} kind="timestamp" /></td></tr>)}</tbody></table>}
    </section>
  </>;
}
