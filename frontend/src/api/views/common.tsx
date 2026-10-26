import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useWorkspaceScope } from '../queries';
import { useHttpApi, type ApiApplication } from '../http';
import { useSession } from '../../auth/session';
import { MoneyText } from '../../shared/components/MoneyText';
import { DateTimeText } from '../../shared/components/DateTimeText';
import { recordValue } from '../../shared/components/RecordDetails';
import { StatusBadge } from '../../shared/components/StatusBadge';

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
export function ApiApplicationFacts({ record, showCompany = false }: { record: ApiApplication; showCompany?: boolean }) {
  const scope = useApiScope();
  const products = useQuery({ queryKey: [...scope.httpKey, 'products'], queryFn: ({ signal }) => scope.api.products(signal), enabled: scope.enabled || scope.bankEnabled });
  const selected = record.selected_offer;
  return <><div className="application-meta"><span>№ {record.id}</span><StatusBadge status={record.status} /></div><dl className="facts">{showCompany && <div><dt>Номер компании</dt><dd>{record.company_id}</dd></div>}<div><dt>Продукт</dt><dd>{products.data?.items.find((product) => product.code === record.product_code)?.name ?? record.product_code}</dd></div><div><dt>{selected ? 'Сумма по договору' : 'Запрошенная сумма'}</dt><dd><MoneyText value={selected?.amount ?? record.amount} /></dd></div><div><dt>{selected ? 'Срок по договору' : 'Запрошенный срок'}</dt><dd>{selected?.term_months ?? record.term_months} мес.</dd></div></dl>{selected && <p className="form-hint">Первоначально запрошено: <MoneyText value={record.amount} /> на {record.term_months} мес.</p>}</>;
}
export function ApiHistory({ record, showReasons = false }: { record: ApiApplication; showReasons?: boolean }) {
  return <section className="workspace-card"><h2>История заявки</h2>{record.history?.length ? <ol>{record.history.map((event, index) => <li key={index}><StatusBadge status={event.to_status} /> · <DateTimeText value={event.at} /> · {recordValue(event.actor)}{showReasons && event.reason && <p>{event.reason}</p>}</li>)}</ol> : <p>История заявки пока пуста.</p>}</section>;
}
export function ApiUnavailable({ title }: { title: string }) { return <section className="workspace-card"><h1>{title}</h1><p>Раздел пока недоступен. Продолжить работу можно в очереди заявок.</p></section>; }
