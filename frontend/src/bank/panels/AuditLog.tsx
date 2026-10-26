import { recordValue } from '../../shared/components/RecordDetails';
import type { BankDossier } from '../../demo/gateway';
import { DateTimeText } from '../../shared/components/DateTimeText';
import { Timeline } from '../../shared/components/Timeline';

interface Props {
  dossier: BankDossier;
}

export function AuditLog({ dossier }: Props) {
  const { audit, application } = dossier;

  return (
    <section className="workspace-card" aria-label="Журнал аудита решений">
      <h2>История переходов и аудит решений</h2>

      <div style={{ marginBottom: 24 }}>
        <h3>История статусов заявки</h3>
        <Timeline history={application.history} current={application.status} />
      </div>

      <h3>Журнал ручных решений андеррайтера</h3>
      {audit.length === 0 ? (
        <p className="muted">Ручных решений по заявке ещё не принималось.</p>
      ) : (
        <table className="workspace-table audit-table">
          <caption className="visually-hidden">Записи аудита</caption>
          <thead>
            <tr>
              <th scope="col">Дата и время</th>
              <th scope="col">Сотрудник</th>
              <th scope="col">Действие</th>
              <th scope="col">Версия</th>
              <th scope="col">Решение ядра → Фактическое</th>
              <th scope="col">Комментарий андеррайтера</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((entry) => (
              <tr key={entry.id}>
                <td><DateTimeText value={entry.at} /></td>
                <td><code>{entry.actorId}</code></td>
                <td>
                  {entry.override ? (
                    <span className="override-badge" style={{ color: '#c8353b', fontWeight: 600 }}>
                      Изменение рекомендации
                    </span>
                  ) : (
                    <span>{recordValue(entry.action)}</span>
                  )}
                </td>
                <td>v{entry.versionBefore} → v{entry.versionAfter}</td>
                <td>
                  <strong>{recordValue(entry.engineOutcome)}</strong> → <strong>{recordValue(entry.selectedOutcome)}</strong>
                </td>
                <td>
                  <p style={{ margin: 0, fontStyle: 'italic' }}>«{entry.comment ?? '—'}»</p>
                  {entry.offerId && <small className="muted">Оффер: {entry.offerId}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
