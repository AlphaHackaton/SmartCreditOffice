import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { Link, useParams } from 'react-router-dom';
import { useApplication, useProducts } from '../api/queries';
import { ApiError } from '../api/errors';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import { MoneyText } from '../shared/components/MoneyText';
import { DateTimeText } from '../shared/components/DateTimeText';
import { StatusBadge } from '../shared/components/StatusBadge';
import { Timeline } from '../shared/components/Timeline';
import { ButtonLink } from '../shared/components/ButtonLink';
import { isApplicationStatus } from '../shared/status';
import type { ApplicationStatus } from '../demo/generated';
import { RejectedPanel } from './panels/RejectedPanel';
import { UnderwritingPanel } from './panels/UnderwritingPanel';
import { Simulator } from './panels/Simulator';
import { SigningPanel } from './panels/SigningPanel';
import { DisbursedPanel } from './panels/DisbursedPanel';
import { DecisionPanel } from './panels/DecisionPanel';
import './workspace.css';

const descriptions: Record<ApplicationStatus, string> = {
  DRAFT: 'Заявка сохранена в черновиках. Проверьте параметры и согласия перед подачей.',
  SUBMITTED: 'Заявка принята. Готовим данные к проверке. Статус обновится автоматически.',
  SCORING: 'Проверяем данные компании и кредитную историю. Статус обновляется автоматически.',
  UNDERWRITING: 'Для решения нужна дополнительная проверка кредитного специалиста.',
  APPROVED: 'Проверка завершена. Изучите причины и выберите подходящие условия.',
  COUNTER_OFFER: 'На запрошенных условиях финансирование недоступно. Сравните альтернативы и ограничения суммы.',
  REJECTED: 'Рассмотрение завершено отказом. Причины и следующие шаги приведены ниже.',
  SIGNING: 'Условия выбраны. Подтвердите демо-подпись кодом внутри кабинета.',
  SIGNED: 'Договор подписан. Выдача ещё не подтверждена.',
  DISBURSED: 'В демонстрационных данных подтверждён статус «Кредит выдан». Реальные операции не выполняются.',
  CANCELLED: 'Рассмотрение этой заявки отменено.',
  EXPIRED: 'Срок действия заявки истёк.',
};
const purposes: Record<string, string> = { WORKING_CAPITAL: 'Пополнение оборотных средств', EQUIPMENT: 'Приобретение оборудования', OTHER: 'Другая цель' };

export function ApplicationPage() {
  const { id = '' } = useParams(); const application = useApplication(id); const products = useProducts();
  const record = application.data;
  const denied = application.error instanceof ApiError && [403, 404].includes(application.error.status ?? 0);
  if (application.isPending) return <p role="status">Загружаем заявку…</p>;
  return <>
    <Link to="/client" className="text-link">← В кабинет</Link>
    <TitleDesktop tag="h1" view="large" font="system">Заявка на финансирование</TitleDesktop>
    <ErrorBanner message={application.error?.message} onRetry={denied ? undefined : () => application.refetch().then(() => {})} />
    {record && !denied && <>
      <div className="application-meta"><span>№ {record.id}</span><StatusBadge status={record.status} /></div>
      <section className="workspace-card" aria-labelledby="application-state"><h2 id="application-state">Текущий этап</h2>
        {!isApplicationStatus(record.status) ? <p role="alert">Состояние заявки не поддерживается. Действия недоступны; обновите данные или обратитесь к специалисту.</p> : <>
          <div className="application-progress">{['SUBMITTED', 'SCORING', 'SIGNED'].includes(record.status) && <span className="scoring-spinner" aria-hidden="true" />}<p role={['SUBMITTED', 'SCORING', 'SIGNED'].includes(record.status) ? 'status' : undefined}>{descriptions[record.status]}</p></div>
          {record.status === 'DRAFT' && !application.error && <ButtonLink to={`/client/applications/new?draft=${encodeURIComponent(record.id)}`}>Продолжить оформление</ButtonLink>}
        </>}
        <p className="form-hint">Демо-режим: воспроизводится последовательность, проверенная backend FSM. Это не результат реального банковского рассмотрения.</p>
      </section>
      {['APPROVED', 'COUNTER_OFFER'].includes(record.status) && !application.error && <DecisionPanel record={record} />}
      {['APPROVED', 'COUNTER_OFFER'].includes(record.status) && !application.error && <Simulator key={record.id} record={record} />}
      {record.status === 'REJECTED' && !application.error && <RejectedPanel record={record} />}
      {record.status === 'UNDERWRITING' && !application.error && <UnderwritingPanel record={record} />}
      {record.status === 'SIGNING' && !application.error && <SigningPanel record={record} />}
      {record.status === 'DISBURSED' && !application.error && <DisbursedPanel record={record} />}
      <div className="application-columns"><section className="workspace-card" aria-labelledby="terms-title"><h2 id="terms-title">Запрошенные условия</h2><dl className="facts"><div><dt>Продукт</dt><dd>{products.data?.find((p) => p.code === record.productCode)?.name ?? record.productCode}</dd></div><div><dt>Сумма</dt><dd><MoneyText value={record.amount} /></dd></div><div><dt>Срок</dt><dd>{record.termMonths} мес.</dd></div><div><dt>Цель</dt><dd>{purposes[record.purpose] ?? 'Неизвестная цель'}</dd></div><div><dt>Создана</dt><dd><DateTimeText value={record.createdAt} /></dd></div><div><dt>Версия</dt><dd>{record.version}</dd></div></dl></section>
        <section className="workspace-card" aria-labelledby="history-title"><h2 id="history-title">История рассмотрения</h2><Timeline history={record.history} current={record.status} /></section></div>
    </>}
  </>;
}
