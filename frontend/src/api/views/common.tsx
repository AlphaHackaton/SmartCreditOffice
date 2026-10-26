import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useWorkspaceScope } from '../queries';
import { useHttpApi, type ApiApplication } from '../http';
import { useSession } from '../../auth/session';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { MoneyText } from '../../shared/components/MoneyText';
import { DateTimeText } from '../../shared/components/DateTimeText';
import { StatusBadge } from '../../shared/components/StatusBadge';

export function ApiNotice() {
  const api = useHttpApi();
  const health = useQuery({ queryKey: ['http-health'], queryFn: ({ signal }) => api.health(signal), staleTime: 30000 });
  return <section className="workspace-card api-notice" aria-label="Состояние API"><h2>Подключение к API</h2>{health.isPending && <p role="status">Проверяем сервер…</p>}
    <ErrorBanner message={health.error?.message} onRetry={() => health.refetch().then(() => {})} />
    {health.data && <p>Сервер: {health.data.status}. Режим backend: <strong>{health.data.mode}</strong>.</p>}
    <p>API v0.1.0: вход, список/создание/подача заявок и базовые банковские операции. Профиль, каталог продуктов, редактирование, симуляция и подписание пока не опубликованы. Моки в этом режиме не используются.</p>
  </section>;
}
export function useApiScope() { const scope = useWorkspaceScope(); const api = useHttpApi(); return { ...scope, api, httpKey: [...scope.key, 'http'] as const }; }
export function useApiCommand<T>() {
  const scope = useApiScope(); const session = useSession(); const cache = useQueryClient(); const alive = useRef(true); const busy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const mutation = useMutation({ mutationFn: (work: () => Promise<T>) => work(), retry: false });
  async function execute(work: () => Promise<T>): Promise<{ value: T } | undefined> {
    if (busy.current) return;
    const epoch = scope.generation(); const token = scope.token;
    const current = () => alive.current && session.getToken() === token && scope.generation() === epoch;
    busy.current = true;
    try {
      const value = await mutation.mutateAsync(work);
      if (!current()) return;
      await cache.invalidateQueries({ queryKey: scope.httpKey });
      if (current()) return { value };
    } catch {
      if (current()) await cache.invalidateQueries({ queryKey: scope.httpKey });
    } finally { busy.current = false; }
  }
  return { ...scope, execute, pending: mutation.isPending, error: mutation.error, isCurrent: () => alive.current && session.getToken() === scope.token && scope.generation() === scope.epoch };
}
export function ApiApplicationFacts({ record }: { record: ApiApplication }) {
  return <><div className="application-meta"><span>№ {record.id}</span><StatusBadge status={record.status} /></div><dl className="facts"><div><dt>Компания</dt><dd>{record.company_id}</dd></div><div><dt>Код продукта</dt><dd>{record.product_code}</dd></div><div><dt>Сумма</dt><dd><MoneyText value={record.amount} /></dd></div><div><dt>Срок</dt><dd>{record.term_months} мес.</dd></div><div><dt>Версия</dt><dd>{record.version}</dd></div></dl></>;
}
export function ApiHistory({ record }: { record: ApiApplication }) {
  return <section className="workspace-card"><h2>История от API</h2>{record.history?.length ? <ol>{record.history.map((event, index) => <li key={index}><StatusBadge status={event.to_status} /> · <DateTimeText value={event.at} /> · {event.actor}{event.reason && <p>{event.reason}</p>}</li>)}</ol> : <p>Сервер не передал историю.</p>}</section>;
}
export function ApiUnavailable({ title }: { title: string }) { return <section className="workspace-card"><h1>{title}</h1><p>Эта возможность ещё не опубликована в API. Для демонстрационной версии переключитесь в Mock.</p></section>; }
