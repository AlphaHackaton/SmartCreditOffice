import { statusLabel } from '../status';

const labels: Record<string, string> = {
  company: 'Компания', company_id: 'Компания', id: 'Номер записи', inn: 'ИНН', name: 'Название',
  legal_form: 'Организационная форма', registered_at: 'Дата регистрации', okved: 'ОКВЭД',
  fns: 'Налоговая служба', bki: 'Кредитная история', account: 'Операции по счёту',
  status: 'Статус', accounts_blocked: 'Блокировка счетов', declared_revenue_12m: 'Выручка за год',
  tax_debt: 'Налоговая задолженность', subject: 'Заёмщик', current_overdue_days: 'Текущая просрочка, дней',
  max_overdue_days_12m: 'Максимальная просрочка за год, дней', max_overdue_days_24m: 'Максимальная просрочка за 2 года, дней',
  inquiries_30d: 'Запросы за 30 дней', monthly_payments: 'Платежи в месяц', active_loans: 'Активные кредиты',
  inflows: 'Поступления', outflows: 'Списания', at: 'Дата и время', created_at: 'Дата создания',
  actor: 'Участник', actor_id: 'Сотрудник', action: 'Действие', comment: 'Комментарий',
  recommendation: 'Рекомендация', outcome: 'Решение', engine_outcome: 'Рекомендация системы',
  selected_outcome: 'Решение сотрудника', override: 'Изменение рекомендации', version: 'Редакция',
  version_before: 'Редакция до изменения', version_after: 'Редакция после изменения',
  route: 'Порядок рассмотрения', grade: 'Риск-класс', score: 'Скоринговый балл', policy_version: 'Кредитная политика',
  amount: 'Сумма', term_months: 'Срок, месяцев', product_code: 'Продукт', purpose: 'Цель кредита',
  offers: 'Предложения', offer_id: 'Номер предложения', kind: 'Вариант условий', rate_pct: 'Ставка, %',
  monthly_payment: 'Ежемесячный платёж', overpayment: 'Переплата', expires_at: 'Действует до',
  factors: 'Факторы решения', constraints: 'Ограничения', binding: 'Определяет сумму', limit: 'Лимит',
  binding_constraint: 'Определяющее ограничение', client_text: 'Объяснение', hint: 'Рекомендация',
  code: 'Код фактора', source: 'Источник проверки', value: 'Значение', points: 'Баллы', max_points: 'Максимум баллов',
  rule_id: 'Правило', impact: 'Влияние', metrics: 'Финансовые показатели', inputs: 'Данные проверки',
  review_flags: 'Причины ручного рассмотрения', requires_review: 'Нужна ручная проверка',
  top_reasons: 'Основные причины', max_amount: 'Максимальная сумма', max_amount_for_term: 'Максимум на выбранный срок',
  requested_amount: 'Запрошенная сумма', requested_term_months: 'Запрошенный срок, месяцев',
  headroom: 'Запас платёжеспособности', reason: 'Основание', from_status: 'Предыдущий этап', to_status: 'Новый этап',
  business_age_months: 'Возраст бизнеса, месяцев', inflows_12m: 'Поступления за год', mean_inflow: 'Средние поступления',
  ncf: 'Чистый денежный поток', debt_burden: 'Долговая нагрузка', cv: 'Изменчивость оборотов',
  history_months: 'Срок наблюдений, месяцев', existing_payments: 'Текущие кредитные платежи',
  fns_mismatch: 'Расхождение выручки и декларации', current_overdue: 'Текущая просрочка', worst_overdue_24m: 'Худшая просрочка за 2 года',
};
const values: Record<string, string> = {
  DSCR: 'Платёжная способность', REVENUE: 'Оборот компании', GRADE_CAP: 'Лимит по риск-профилю', PRODUCT_MAX: 'Условия продукта',
  AUTO: 'Автоматическое рассмотрение', UNDERWRITER: 'Сотрудник банка', MANUAL: 'Ручное рассмотрение', SYSTEM: 'Система',
  CLIENT: 'Клиент', BANK: 'Сотрудник банка', FNS: 'ФНС', BKI: 'БКИ', ACCOUNT: 'Банковский счёт',
  POSITIVE: 'Положительное', NEGATIVE: 'Отрицательное', NEUTRAL: 'Нейтральное', STOP_FACTOR: 'Стоп-фактор',
  DECISION: 'Кредитное решение', MANUAL_DECISION: 'Решение сотрудника', RESCORE: 'Повторная проверка',
  APPROVE: 'Одобрение', REJECT: 'Отказ', ACTIVE: 'Действует', IP: 'ИП', LLC: 'ООО',
  WORKING_CAPITAL: 'Оборотные средства', EQUIPMENT: 'Оборудование', OTHER: 'Другая цель',
};
export function recordLabel(key: string) { return labels[key] ?? key.replaceAll('_', ' '); }
export function recordValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  const text = String(value);
  return values[text] ?? (['APPROVED', 'COUNTER_OFFER', 'REJECTED', 'UNDERWRITING', 'DISBURSED'].includes(text) ? statusLabel(text) : text);
}
export function RecordDetails({ value }: { value: unknown }) {
  if (Array.isArray(value)) return value.length ? <ol className="record-list">{value.map((item, index) => <li key={index}><RecordDetails value={item} /></li>)}</ol> : <span>Нет записей</span>;
  if (value && typeof value === 'object') return <dl className="record-fields">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{recordLabel(key)}</dt><dd>{item && typeof item === 'object' ? <details open><summary>Подробнее</summary><RecordDetails value={item} /></details> : recordValue(item)}</dd></div>)}</dl>;
  return <>{recordValue(value)}</>;
}
