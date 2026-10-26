import { recordValue } from '../../shared/components/RecordDetails';
import type { BankDossier } from '../../demo/gateway';
import { MoneyText } from '../../shared/components/MoneyText';

interface Props {
  dossier: BankDossier;
}

export function ScoringTrace({ dossier }: Props) {
  const run = dossier.runs[0];
  if (!run) {
    return (
      <section className="workspace-card" aria-label="Скоринговая трасса">
        <h2>Скоринговая трасса</h2>
        <p className="muted">Нет данных скорингового прогона.</p>
      </section>
    );
  }

  const { result, factors, constraints } = run;

  return (
    <section className="workspace-card" aria-label="Скоринговая трасса">
      <h2>Скоринговая трасса и правила</h2>

      <div className="trace-summary" style={{ marginBottom: 20 }}>
        <dl className="facts">
          <div>
            <dt>Рекомендация системы</dt>
            <dd><strong>{recordValue(result.recommendation)}</strong></dd>
          </div>
          <div>
            <dt>Маршрут</dt>
            <dd>{recordValue(result.route)}</dd>
          </div>
          <div>
            <dt>Итоговый скоринговый балл</dt>
            <dd>{result.score != null ? `${result.score} из 100` : '— (стоп-фактор / knockout)'}</dd>
          </div>
          <div>
            <dt>Кредитный грейд</dt>
            <dd>{result.grade ?? '—'}</dd>
          </div>
          <div>
            <dt>Лимитирующее ограничение</dt>
            <dd>{result.bindingConstraint ? recordValue(result.bindingConstraint) : 'Отсутствует'}</dd>
          </div>
          <div>
            <dt>Версия риск-политики</dt>
            <dd><code>{run.policyVersion}</code></dd>
          </div>
        </dl>
      </div>

      <h3>Факторы скоринговой карты и стоп-правила</h3>
      <table className="workspace-table trace-table">
        <caption className="visually-hidden">Факторы скоринга</caption>
        <thead>
          <tr>
            <th scope="col">Правило</th>
            <th scope="col">Источник</th>
            <th scope="col">Значение</th>
            <th scope="col">Диапазон значений</th>
            <th scope="col">Баллы</th>
            <th scope="col">Влияние</th>
            <th scope="col">Описание фактора</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f, idx) => (
            <tr key={idx}>
              <td><code>{f.ruleId}</code></td>
              <td>{f.source}</td>
              <td><strong>{f.value}</strong></td>
              <td>
                {f.bin ? (
                  <span className="bin-badge">
                    {f.bin.lower != null ? `${f.bin.lower} ≤ ` : ''}
                    x
                    {f.bin.upper != null ? ` < ${f.bin.upper}` : ''} ({f.bin.code})
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                {f.maxPoints > 0 ? (
                  <span>{f.points} / {f.maxPoints}</span>
                ) : (
                  <span>{f.points}</span>
                )}
              </td>
              <td>
                <span className={`impact-badge impact-badge--${f.impact.toLowerCase()}`}>
                  {recordValue(f.impact)}
                </span>
              </td>
              <td>
                <p style={{ margin: 0 }}>{f.clientText}</p>
                {f.hint && <small className="muted">{f.hint}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {constraints.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Ограничения суммы кредита</h3>
          <ul className="constraints">
            {constraints.map((c) => (
              <li key={recordValue(c.name)} className={c.binding ? 'constraint-binding' : undefined}>
                <div>
                  <strong>{recordValue(c.name)}</strong>
                  {c.binding && <span className="binding-tag" style={{ marginLeft: 8, color: '#e4791a', fontWeight: 600 }}>[Лимитирующий фактор]</span>}
                </div>
                <div>
                  <MoneyText value={c.limit} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
