import type { BankDossier } from '../../demo/gateway';
import { MoneyText } from '../../shared/components/MoneyText';

interface Props {
  dossier: BankDossier;
}

export function InputsSnapshot({ dossier }: Props) {
  const run = dossier.runs[0];
  const metrics = run?.metrics ?? {};
  const inputs = dossier.inputsSnapshot as {
    company?: { inn?: string; legal_form?: string; registered_at?: string; okved?: string };
    fns?: { status?: string; accounts_blocked?: boolean; declared_revenue_12m?: string | null; tax_debt?: string };
    bki?: Array<{ subject?: string; current_overdue_days?: number; max_overdue_days_12m?: number; max_overdue_days_24m?: number; inquiries_30d?: number; monthly_payments?: string; active_loans?: number }>;
    account?: { inflows?: string[]; outflows?: string[] };
  } | undefined;

  return (
    <section className="workspace-card" aria-label="Снимки входных данных">
      <h2>Снимки входных данных и расчетные метрики</h2>

      <details open className="dossier-details">
        <summary className="dossier-summary">ФНС и регистрационные данные</summary>
        <div className="dossier-section-content">
          <dl className="facts">
            <div>
              <dt>Статус юрлица</dt>
              <dd>{inputs?.fns?.status ?? '—'}</dd>
            </div>
            <div>
              <dt>Блокировка счетов</dt>
              <dd>{inputs?.fns?.accounts_blocked ? 'Да (счета заблокированы)' : 'Нет'}</dd>
            </div>
            <div>
              <dt>Декларированная годовая выручка</dt>
              <dd>
                {inputs?.fns?.declared_revenue_12m != null ? (
                  <MoneyText value={inputs.fns.declared_revenue_12m} />
                ) : (
                  '— (отсутствует декларация)'
                )}
              </dd>
            </div>
            <div>
              <dt>Налоговая задолженность</dt>
              <dd>
                {inputs?.fns?.tax_debt != null ? <MoneyText value={inputs.fns.tax_debt} /> : '0.00 ₽'}
              </dd>
            </div>
            <div>
              <dt>Возраст бизнеса (месяцев)</dt>
              <dd>{metrics.business_age_months != null ? `${metrics.business_age_months} мес.` : '—'}</dd>
            </div>
            <div>
              <dt>Расхождение оборотов и ФНС</dt>
              <dd>
                {metrics.fns_mismatch != null
                  ? `${(Number(metrics.fns_mismatch) * 100).toFixed(1)}%`
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </details>

      <details open className="dossier-details">
        <summary className="dossier-summary">Бюро кредитных историй (БКИ)</summary>
        <div className="dossier-section-content">
          <dl className="facts" style={{ marginBottom: 16 }}>
            <div>
              <dt>Текущая просрочка</dt>
              <dd>{metrics.current_overdue != null ? `${metrics.current_overdue} дн.` : '0 дн.'}</dd>
            </div>
            <div>
              <dt>Худшая просрочка за 24 мес.</dt>
              <dd>{metrics.worst_overdue_24m != null ? `${metrics.worst_overdue_24m} дн.` : '0 дн.'}</dd>
            </div>
            <div>
              <dt>Запросов за 30 дней</dt>
              <dd>{metrics.inquiries_30d ?? 0}</dd>
            </div>
            <div>
              <dt>Ежемесячные платежи по кредитам</dt>
              <dd>
                {metrics.existing_payments != null ? (
                  <MoneyText value={String(metrics.existing_payments)} />
                ) : (
                  '0.00 ₽'
                )}
              </dd>
            </div>
          </dl>
          {inputs?.bki?.length ? (
            <table className="workspace-table">
              <caption className="visually-hidden">Отчёты БКИ</caption>
              <thead>
                <tr>
                  <th scope="col">Субъект</th>
                  <th scope="col">Активные кредиты</th>
                  <th scope="col">Платежи</th>
                  <th scope="col">Текущая проср.</th>
                  <th scope="col">Макс. 12м</th>
                  <th scope="col">Макс. 24м</th>
                </tr>
              </thead>
              <tbody>
                {inputs.bki.map((report, idx) => (
                  <tr key={idx}>
                    <td>{report.subject ?? '—'}</td>
                    <td>{report.active_loans ?? 0}</td>
                    <td><MoneyText value={report.monthly_payments ?? '0.00'} /></td>
                    <td>{report.current_overdue_days ?? 0} дн.</td>
                    <td>{report.max_overdue_days_12m ?? 0} дн.</td>
                    <td>{report.max_overdue_days_24m ?? 0} дн.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Нет записей БКИ.</p>
          )}
        </div>
      </details>

      <details open className="dossier-details">
        <summary className="dossier-summary">Банковский счёт и расчётные метрики</summary>
        <div className="dossier-section-content">
          <dl className="facts">
            <div>
              <dt>Сумма поступлений за 12 мес.</dt>
              <dd>
                {metrics.inflows_12m != null ? <MoneyText value={String(metrics.inflows_12m)} /> : '—'}
              </dd>
            </div>
            <div>
              <dt>Среднемесячные поступления</dt>
              <dd>
                {metrics.mean_inflow != null ? <MoneyText value={String(metrics.mean_inflow)} /> : '—'}
              </dd>
            </div>
            <div>
              <dt>Коэффициент вариации оборотов (CV)</dt>
              <dd>{metrics.cv != null ? metrics.cv : '—'}</dd>
            </div>
            <div>
              <dt>Чистый денежный поток (NCF)</dt>
              <dd>
                {metrics.ncf != null ? <MoneyText value={String(metrics.ncf)} /> : '—'}
              </dd>
            </div>
            <div>
              <dt>Долговая нагрузка (платежи / NCF)</dt>
              <dd>{metrics.debt_burden != null ? metrics.debt_burden : '—'}</dd>
            </div>
            <div>
              <dt>История наблюдений</dt>
              <dd>{metrics.history_months != null ? `${metrics.history_months} мес.` : '—'}</dd>
            </div>
          </dl>
        </div>
      </details>
    </section>
  );
}
