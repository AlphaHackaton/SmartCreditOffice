import { DOMAIN_STATUSES, type ApplicationStatus } from '../demo/generated';

export const STATUS_VIEW = {
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  SUBMITTED: { label: 'Заявка отправлена', tone: 'pending' },
  SCORING: { label: 'Проверка данных', tone: 'pending' },
  UNDERWRITING: { label: 'Ручное рассмотрение', tone: 'pending' },
  APPROVED: { label: 'Одобрено', tone: 'positive' },
  COUNTER_OFFER: { label: 'Встречное предложение', tone: 'attention' },
  REJECTED: { label: 'Отказ', tone: 'negative' },
  SIGNING: { label: 'Подписание', tone: 'pending' },
  SIGNED: { label: 'Подписано', tone: 'pending' },
  DISBURSED: { label: 'Кредит выдан', tone: 'positive' },
  CANCELLED: { label: 'Отменена', tone: 'neutral' },
  EXPIRED: { label: 'Срок истёк', tone: 'neutral' },
} satisfies Record<ApplicationStatus, { label: string; tone: string }>;
export function isApplicationStatus(value: string): value is ApplicationStatus { return (DOMAIN_STATUSES as readonly string[]).includes(value); }
export function statusLabel(value: string) { return isApplicationStatus(value) ? STATUS_VIEW[value].label : 'Неизвестный статус'; }
