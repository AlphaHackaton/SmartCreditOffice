import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueue } from '../api/queries';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import { MoneyText } from '../shared/components/MoneyText';
import { DateTimeText } from '../shared/components/DateTimeText';
import { StatusBadge } from '../shared/components/StatusBadge';
import { STATUS_VIEW } from '../shared/status';
import '../client/workspace.css';

// Exact comparison only; no loan/rate/payment calculations.
function cents(value: string) { const [whole, part = ''] = value.split('.'); return BigInt(whole + part.padEnd(2, '0')); }
export function QueuePage() {
  const queue = useQueue(); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [product, setProduct] = useState(''); const [sort, setSort] = useState('newest');
  const needle = search.trim().toLocaleLowerCase('ru-RU');
  const rows = (queue.data ?? []).filter((a) => (!status || a.status === status) && (!product || a.productCode === product) && (!needle || `${a.companyName} ${a.inn} ${a.id}`.toLocaleLowerCase('ru-RU').includes(needle))).sort((a, b) => {
    if (sort === 'amountAsc' || sort === 'amountDesc') { const left = cents(a.amount); const right = cents(b.amount); const comparison = left === right ? 0 : left < right ? -1 : 1; return (sort === 'amountDesc' ? -comparison : comparison) || a.id.localeCompare(b.id); }
    const comparison = a.createdAt.localeCompare(b.createdAt); return (sort === 'oldest' ? comparison : -comparison) || a.id.localeCompare(b.id);
  });
  const products = [...new Map(queue.data?.map((a) => [a.productCode, a.productName])).entries()];
  function resetFilters() { setSearch(''); setStatus(''); setProduct(''); setSort('newest'); }
  return <>
    <div className="workspace-heading"><div><p className="eyebrow">РАБОЧЕЕ МЕСТО КРЕДИТНОГО СПЕЦИАЛИСТА</p><TitleDesktop tag="h1" view="large" font="system" defaultMargins={false}>Очередь заявок</TitleDesktop><p className="page-description">Синтетические примеры и заявки текущего демо-сеанса.</p></div><ButtonDesktop view="secondary" size={48} disabled={queue.isFetching} onClick={() => { void queue.refetch(); }}>Обновить очередь</ButtonDesktop></div>
    <section className="workspace-card" aria-label="Фильтры очереди"><div className="queue-filters"><InputDesktop label="Компания, ИНН или номер" value={search} onChange={(e) => setSearch(e.target.value)} />
      <label>Статус<select aria-label="Статус заявки" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Все статусы</option>{Object.entries(STATUS_VIEW).map(([value, view]) => <option key={value} value={value}>{view.label}</option>)}</select></label>
      <label>Продукт<select aria-label="Продукт очереди" value={product} onChange={(e) => setProduct(e.target.value)}><option value="">Все продукты</option>{products.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <label>Сортировка<select aria-label="Сортировка очереди" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="amountAsc">Сумма по возрастанию</option><option value="amountDesc">Сумма по убыванию</option></select></label>
    </div><ButtonDesktop view="secondary" size={40} onClick={resetFilters}>Сбросить фильтры</ButtonDesktop></section>
    {queue.isFetching && <p role="status">Загружаем очередь…</p>}
    <ErrorBanner message={queue.error?.message} onRetry={() => queue.refetch().then(() => {})} />
    {!queue.error && !queue.isPending && <section className="workspace-card" aria-label="Заявки в очереди"><p role="status">Найдено заявок: {rows.length}</p>{rows.length ? <table className="workspace-table queue-table"><caption className="visually-hidden">Заявки компаний</caption><thead><tr><th scope="col">Компания / заявка</th><th scope="col">Продукт</th><th scope="col">Сумма / срок</th><th scope="col">Статус</th><th scope="col">Создана</th></tr></thead><tbody>{rows.map((a) => <tr key={a.id}><td><Link to={`/bank/applications/${encodeURIComponent(a.id)}`} className="text-link">{a.companyName}</Link><small>ИНН {a.inn}</small><small>№ {a.id}{a.synthetic ? ' · пример' : ' · текущий сеанс'}</small></td><td>{a.productName}</td><td><MoneyText value={a.amount} /><small>{a.termMonths} мес.</small></td><td><StatusBadge status={a.status} /></td><td><DateTimeText value={a.createdAt} /></td></tr>)}</tbody></table> : <div><h2>Заявок не найдено</h2><p>Измените фильтры или сбросьте их. Если очередь пуста, обновите данные.</p></div>}</section>}
    <p className="form-hint">Досье и решение сотрудника — следующий этап. Сброс демо удалит заявки сеанса и сохранит шесть исходных примеров.</p>
  </>;
}
