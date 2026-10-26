import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBankDossier, useWorkspaceScope } from '../api/queries';
import { DateTimeText } from '../shared/components/DateTimeText';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import { MoneyText } from '../shared/components/MoneyText';
import { StatusBadge } from '../shared/components/StatusBadge';
import { AuditLog } from './panels/AuditLog';
import { DecisionForm } from './panels/DecisionForm';
import { InputsSnapshot } from './panels/InputsSnapshot';
import { ScoringTrace } from './panels/ScoringTrace';
import '../client/workspace.css';

export function DossierPage() {
  const { id } = useParams<{ id: string }>();
  const scope = useWorkspaceScope();
  const dossierQuery = useBankDossier(id ?? '');
  const [replayResult, setReplayResult] = useState<{ match: boolean; message: string } | null>(null);
  const [replayPending, setReplayPending] = useState(false);

  if (!id) {
    return (
      <div className="workspace-empty">
        <TitleDesktop tag="h1" view="large" font="system">Идентификатор заявки не указан</TitleDesktop>
        <p><Link to="/bank/applications" className="text-link">Вернуться в очередь заявок</Link></p>
      </div>
    );
  }

  if (dossierQuery.isPending) {
    return <p role="status">Загружаем кредитное досье заявки…</p>;
  }

  if (dossierQuery.error) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Link to="/bank/applications" className="text-link">← Вернуться в очередь заявок</Link>
        </div>
        <TitleDesktop tag="h1" view="large" font="system">Кредитное досье</TitleDesktop>
        <ErrorBanner message={dossierQuery.error.message} onRetry={() => dossierQuery.refetch().then(() => {})} />
      </div>
    );
  }

  const dossier = dossierQuery.data;
  if (!dossier) {
    return (
      <div className="workspace-empty">
        <TitleDesktop tag="h1" view="large" font="system">Досье не найдено</TitleDesktop>
        <p>Заявка с номером {id} не найдена или недоступна.</p>
        <Link to="/bank/applications" className="text-link">Вернуться в очередь заявок</Link>
      </div>
    );
  }

  const { application, source, runs, currentRunId } = dossier;
  const currentRun = runs.find((r) => r.id === currentRunId) ?? runs[0];

  async function handleReplay() {
    if (!currentRun || replayPending) return;
    setReplayPending(true);
    setReplayResult(null);
    try {
      const res = await scope.gateway.replayDossier(scope.token, application.id, currentRun.id);
      setReplayResult({ match: res.match, message: res.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка сверки снимка';
      setReplayResult({ match: false, message: msg });
    } finally {
      setReplayPending(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link to="/bank/applications" className="text-link">← Вернуться в очередь заявок</Link>
      </div>

      <div className="workspace-heading">
        <div>
          <p className="eyebrow">
            КРЕДИТНОЕ ДОСЬЕ ЗАЯВКИ № {application.id} {source === 'example' ? '· СИНТЕТИЧЕСКИЙ ПРИМЕР' : '· ТЕКУЩИЙ СЕАНС'}
          </p>
          <TitleDesktop tag="h1" view="large" font="system" defaultMargins={false}>
            Досье заявки
          </TitleDesktop>
          <p className="page-description">
            {application.companyName ?? 'Заемщик'} · Материалы скоринговой проверки, выписки ФНС/БКИ и аудит решений андеррайтера.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <StatusBadge status={application.status} />
          <ButtonDesktop
            view="secondary"
            size={40}
            disabled={replayPending || !currentRun}
            onClick={handleReplay}
          >
            Сверить с ядром скоринга (Replay)
          </ButtonDesktop>
        </div>
      </div>


      {replayResult && (
        <div
          role="status"
          style={{
            padding: 16,
            borderRadius: 8,
            backgroundColor: replayResult.match ? '#eaf5ea' : '#fbebeb',
            border: `1px solid ${replayResult.match ? '#24633e' : '#a5211a'}`,
            color: replayResult.match ? '#24633e' : '#a5211a',
            marginBottom: 20,
          }}
        >
          <strong>{replayResult.match ? 'Сверка успешна:' : 'Ошибка согласованности:'}</strong> {replayResult.message}
        </div>
      )}

      <section className="workspace-card" aria-label="Параметры заявки">
        <h2>Запрошенные условия и реквизиты</h2>
        <dl className="facts">
          <div>
            <dt>Запрошенная сумма</dt>
            <dd><strong><MoneyText value={application.amount} /></strong></dd>
          </div>
          <div>
            <dt>Запрошенный срок</dt>
            <dd><strong>{application.termMonths} мес.</strong></dd>
          </div>
          <div>
            <dt>Продукт</dt>
            <dd>{application.productCode}</dd>
          </div>
          <div>
            <dt>Версия досье</dt>
            <dd>Версия {application.version}</dd>
          </div>
          <div>
            <dt>Дата и время создания</dt>
            <dd><DateTimeText value={application.createdAt} /></dd>
          </div>
          <div>
            <dt>Хеш снимка входов</dt>
            <dd><code>{currentRun?.inputHash.slice(0, 16)}...</code></dd>
          </div>
        </dl>
      </section>

      <DecisionForm dossier={dossier} />

      <ScoringTrace dossier={dossier} />

      <InputsSnapshot dossier={dossier} />

      <AuditLog dossier={dossier} />
    </>
  );
}
