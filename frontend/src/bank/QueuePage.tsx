import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueue } from '../api/queries';
import { parseMoscowDateBounds, type MetricSourceFilter } from '../demo/metrics';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import { MoneyText } from '../shared/components/MoneyText';
import { DateTimeText } from '../shared/components/DateTimeText';
import { StatusBadge } from '../shared/components/StatusBadge';
import { STATUS_VIEW } from '../shared/status';
import '../client/workspace.css';

// Exact comparison only; no loan/rate/payment calculations.
function cents(value: string) {
  const [whole, part = ''] = value.split('.');
  return BigInt(whole + part.padEnd(2, '0'));
}

export function QueuePage() {
  const queue = useQueue();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') ?? '';
  const product = searchParams.get('product') ?? '';
  const source = (searchParams.get('source') as MetricSourceFilter) ?? 'all';
  const fromDate = searchParams.get('from') ?? '';
  const toDate = searchParams.get('to') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';

  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  function resetFilters() {
    setSearch('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  let dateBounds: { startMs: number; endMs: number } | null = null;
  let dateError: string | null = null;
  if (fromDate || toDate) {
    try {
      dateBounds = parseMoscowDateBounds(fromDate, toDate);
    } catch (e: unknown) {
      dateError = e instanceof Error ? e.message : 'Некорректный диапазон дат';
    }
  }

  const needle = search.trim().toLocaleLowerCase('ru-RU');
  const rows = (queue.data ?? [])
    .filter((a) => {
      if (status && a.status !== status) return false;
      if (product && a.productCode !== product) return false;
      if (source === 'example' && !a.synthetic) return false;
      if (source === 'session' && a.synthetic) return false;
      if (dateBounds) {
        const createdMs = Date.parse(a.createdAt);
        if (isNaN(createdMs) || createdMs < dateBounds.startMs || createdMs >= dateBounds.endMs) {
          return false;
        }
      }
      if (needle && !`${a.companyName} ${a.inn} ${a.id}`.toLocaleLowerCase('ru-RU').includes(needle)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'amountAsc' || sort === 'amountDesc') {
        const left = cents(a.amount);
        const right = cents(b.amount);
        const comparison = left === right ? 0 : left < right ? -1 : 1;
        return (sort === 'amountDesc' ? -comparison : comparison) || a.id.localeCompare(b.id);
      }
      const comparison = a.createdAt.localeCompare(b.createdAt);
      return (sort === 'oldest' ? comparison : -comparison) || a.id.localeCompare(b.id);
    });

  const products = [...new Map(queue.data?.map((a) => [a.productCode, a.productName])).entries()];

  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">РАБОЧЕЕ МЕСТО КРЕДИТНОГО СПЕЦИАЛИСТА</p>
          <TitleDesktop tag="h1" view="large" font="system" defaultMargins={false}>
            Очередь заявок
          </TitleDesktop>
          <p className="page-description">Синтетические примеры и заявки текущего демо-сеанса.</p>
        </div>
        <ButtonDesktop
          view="secondary"
          size={48}
          disabled={queue.isFetching}
          onClick={() => {
            void queue.refetch();
          }}
        >
          Обновить очередь
        </ButtonDesktop>
      </div>

      <section className="workspace-card" aria-label="Фильтры очереди">
        {dateError && <p className="form-error" role="alert">{dateError}</p>}
        <div className="queue-filters">
          <InputDesktop
            label="Компания, ИНН или номер"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateParam('search', e.target.value);
            }}
          />
          <label>
            Статус
            <select
              aria-label="Статус заявки"
              value={status}
              onChange={(e) => updateParam('status', e.target.value)}
            >
              <option value="">Все статусы</option>
              {Object.entries(STATUS_VIEW).map(([value, view]) => (
                <option key={value} value={value}>
                  {view.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Продукт
            <select
              aria-label="Продукт очереди"
              value={product}
              onChange={(e) => updateParam('product', e.target.value)}
            >
              <option value="">Все продукты</option>
              {products.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Источник данных
            <select
              aria-label="Источник данных"
              value={source}
              onChange={(e) => updateParam('source', e.target.value)}
            >
              <option value="all">Все демо-данные</option>
              <option value="example">Синтетические примеры</option>
              <option value="session">Сеанс пользователя</option>
            </select>
          </label>
          <label>
            Дата создания с
            <input
              type="date"
              aria-label="Дата создания с"
              value={fromDate}
              className="queue-date-input"
              onChange={(e) => updateParam('from', e.target.value)}
            />
          </label>
          <label>
            Дата создания по
            <input
              type="date"
              aria-label="Дата создания по"
              value={toDate}
              className="queue-date-input"
              onChange={(e) => updateParam('to', e.target.value)}
            />
          </label>
          <label>
            Сортировка
            <select
              aria-label="Сортировка очереди"
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="amountAsc">Сумма по возрастанию</option>
              <option value="amountDesc">Сумма по убыванию</option>
            </select>
          </label>
        </div>
        <ButtonDesktop view="secondary" size={40} onClick={resetFilters}>
          Сбросить фильтры
        </ButtonDesktop>
      </section>

      {queue.isFetching && <p role="status">Загружаем очередь…</p>}
      <ErrorBanner message={queue.error?.message} onRetry={() => queue.refetch().then(() => {})} />

      {!queue.error && !queue.isPending && (
        <section className="workspace-card" aria-label="Заявки в очереди">
          <p role="status">Найдено заявок: {rows.length}</p>
          {rows.length ? (
            <table className="workspace-table queue-table">
              <caption className="visually-hidden">Заявки компаний</caption>
              <thead>
                <tr>
                  <th scope="col">Компания / заявка</th>
                  <th scope="col">Продукт</th>
                  <th scope="col">Сумма / срок</th>
                  <th scope="col">Статус</th>
                  <th scope="col">Создана</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/bank/applications/${encodeURIComponent(a.id)}`} className="text-link">
                        {a.companyName}
                      </Link>
                      <small>ИНН {a.inn}</small>
                      <small>
                        № {a.id}
                        {a.synthetic ? ' · пример' : ' · текущий сеанс'}
                      </small>
                    </td>
                    <td>{a.productName}</td>
                    <td>
                      <MoneyText value={a.amount} />
                      <small>{a.termMonths} мес.</small>
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <DateTimeText value={a.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <h2>Заявок не найдено</h2>
              <p>Измените фильтры или сбросьте их. Если очередь пуста, обновите данные.</p>
            </div>
          )}
        </section>
      )}

      <p className="form-hint">
        Досье и решение сотрудника — раздел «Досье». Сброс демо удалит заявки сеанса и сохранит шесть исходных примеров.
      </p>
    </>
  );
}
