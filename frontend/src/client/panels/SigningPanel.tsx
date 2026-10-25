import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { InputDesktop } from '@alfalab/core-components-input/esm/desktop';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Application } from '../../demo/gateway';
import { DateTimeText } from '../../shared/components/DateTimeText';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { OfferTerms } from './OffersList';
import { useApplicationCommand } from './useApplicationCommand';

export function SigningPanel({ record }: { record: Application }) {
  const cache = useQueryClient();
  const command = useApplicationCommand(record.id); const [code, setCode] = useState(''); const [now, setNow] = useState(Date.now);
  const challenge = useQuery({ queryKey: [...command.key, 'challenge', record.id], queryFn: ({ signal }) => command.gateway.challenge(command.token, record.id, signal), enabled: command.enabled });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const data = challenge.data; const expired = Boolean(data && now >= Date.parse(data.expiresAt));
  async function sign() {
    if (!data || expired || data.attemptsLeft === 0) return;
    const success = await command.execute(() => command.gateway.sign(command.token, record.id, record.version, data.id, code));
    if (!success && command.isCurrent()) await challenge.refetch();
  }
  return <section className="workspace-card" aria-labelledby="signing-title"><h2 id="signing-title">Подписание договора</h2>
    <p>Демо-подпись внутри кабинета. В промышленной версии — ПЭП в ДБО / Госключ. Реальная электронная подпись не выполняется.</p>
    {record.selectedOffer && <OfferTerms offer={record.selectedOffer} />}
    {challenge.isPending && <p role="status">Получаем подтверждение…</p>}
    <ErrorBanner message={challenge.error?.message} onRetry={async () => { await cache.invalidateQueries({ queryKey: [...command.key, 'application', record.id] }); if (command.isCurrent()) await challenge.refetch(); }} />
    {data && !challenge.error && <><p>Демо-код: <strong className="demo-code">{data.code}</strong></p><p>Действует до <DateTimeText value={data.expiresAt} />. Осталось попыток: {data.attemptsLeft}.</p>
      {expired && <><p role="alert">Срок подтверждения истёк. Обновите заявку.</p><ButtonDesktop view="secondary" size={40} onClick={() => { void cache.invalidateQueries({ queryKey: [...command.key, 'application', record.id] }); }}>Обновить заявку</ButtonDesktop></>}
      {data.attemptsLeft === 0 && <p role="alert">Попытки исчерпаны. Подписание заблокировано; начните новый сценарий через сброс демо.</p>}
      <form onSubmit={(e) => { e.preventDefault(); void sign(); }} className="signing-form">
        <InputDesktop label="Код подтверждения" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" autoComplete="off" disabled={command.pending || expired || !data.attemptsLeft} />
        <ButtonDesktop type="submit" view="primary" size={48} disabled={command.pending || expired || !data.attemptsLeft || !/^\d{6}$/.test(code)}>{command.pending ? 'Подписываем…' : 'Подписать договор'}</ButtonDesktop>
      </form></>}
    <ErrorBanner message={command.error} />
  </section>;
}
