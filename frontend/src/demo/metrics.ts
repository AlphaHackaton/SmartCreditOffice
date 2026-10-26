import { ApiError } from '../api/errors';
import { demoData, type ApplicationStatus, DOMAIN_STATUSES } from './generated';
import type { Application, Product } from './gateway';

export type MetricSourceFilter = 'all' | 'example' | 'session';

export interface MetricsFilter {
  fromDate?: string; // YYYY-MM-DD in Europe/Moscow
  toDate?: string;   // YYYY-MM-DD in Europe/Moscow
  productCode?: string;
  source: MetricSourceFilter;
}

export interface PipelineMetrics {
  asOf: string;
  filter: MetricsFilter;
  total: number;
  submitted: number;
  decided: number;
  awaitingDecision: number;
  automaticDecisions: number;
  stpPct: string | null; // e.g. "100.0", "83.3", or null if decided === 0
  timeToDecision: {
    meanMs: number | null;
    p95Ms: number | null;
    sampleCount: number;
    invalidCount: number;
  };
  currentStatuses: { status: ApplicationStatus | string; count: number }[];
  outcomes: { outcome: 'APPROVED' | 'COUNTER_OFFER' | 'REJECTED'; count: number }[];
  dataIssuesCount: number;
}

export const ALL_KNOWN_STATUSES: readonly ApplicationStatus[] = DOMAIN_STATUSES;

export function parseMoscowDateBounds(fromDate?: string, toDate?: string): { startMs: number; endMs: number } | null {
  const hasFrom = Boolean(fromDate && fromDate.trim());
  const hasTo = Boolean(toDate && toDate.trim());

  if (!hasFrom && !hasTo) {
    return null;
  }

  if (!hasFrom || !hasTo) {
    throw new ApiError(422, 'INVALID_FILTER', 'Укажите обе даты периода или оставьте обе пустыми.');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fromDate!) || !dateRegex.test(toDate!)) {
    throw new ApiError(422, 'INVALID_FILTER', 'Формат дат должен быть ГГГГ-ММ-ДД.');
  }

  const [fy, fm, fd] = fromDate!.split('-').map(Number);
  const fromObj = new Date(Date.UTC(fy, fm - 1, fd));
  if (fromObj.getUTCFullYear() !== fy || fromObj.getUTCMonth() !== fm - 1 || fromObj.getUTCDate() !== fd) {
    throw new ApiError(422, 'INVALID_FILTER', 'Некорректная календарная дата начала периода.');
  }

  const [ty, tm, td] = toDate!.split('-').map(Number);
  const toObj = new Date(Date.UTC(ty, tm - 1, td));
  if (toObj.getUTCFullYear() !== ty || toObj.getUTCMonth() !== tm - 1 || toObj.getUTCDate() !== td) {
    throw new ApiError(422, 'INVALID_FILTER', 'Некорректная календарная дата окончания периода.');
  }

  if (fromDate! > toDate!) {
    throw new ApiError(422, 'INVALID_FILTER', 'Дата начала не может быть позже даты окончания.');
  }

  // Moscow is UTC+3 (no DST).
  const startMs = Date.parse(`${fromDate}T00:00:00+03:00`);
  const toStartMs = Date.parse(`${toDate}T00:00:00+03:00`);
  // End bound is start of the next calendar day in Moscow time
  const endMs = toStartMs + 24 * 60 * 60 * 1000;

  return { startMs, endMs };
}

export function validateMetricsFilter(
  filter?: Partial<MetricsFilter>,
  knownProducts: readonly Product[] = demoData.products,
): MetricsFilter {
  const source: MetricSourceFilter = filter?.source ?? 'all';
  if (!['all', 'example', 'session'].includes(source)) {
    throw new ApiError(422, 'INVALID_FILTER', 'Недопустимый источник данных.');
  }

  const productCode = filter?.productCode?.trim() || undefined;
  if (productCode && !knownProducts.some((p) => p.code === productCode)) {
    throw new ApiError(422, 'INVALID_FILTER', `Неизвестный продукт: ${productCode}`);
  }

  const fromDate = filter?.fromDate?.trim() || undefined;
  const toDate = filter?.toDate?.trim() || undefined;

  parseMoscowDateBounds(fromDate, toDate);

  return {
    source,
    productCode,
    fromDate,
    toDate,
  };
}

export function calculatePipelineMetrics(
  applications: readonly (Application & { synthetic?: boolean })[],
  filter: MetricsFilter,
  asOf: string,
): PipelineMetrics {
  const bounds = parseMoscowDateBounds(filter.fromDate, filter.toDate);

  // Filter cohort
  const cohort = applications.filter((app) => {
    const isSynthetic = app.synthetic ?? app.id.startsWith('seed-');
    if (filter.source === 'example' && !isSynthetic) return false;
    if (filter.source === 'session' && isSynthetic) return false;

    if (filter.productCode && app.productCode !== filter.productCode) return false;

    if (bounds) {
      const createdMs = Date.parse(app.createdAt);
      if (isNaN(createdMs) || createdMs < bounds.startMs || createdMs >= bounds.endMs) {
        return false;
      }
    }

    return true;
  });

  const total = cohort.length;
  let submittedCount = 0;
  let decidedCount = 0;
  let awaitingCount = 0;
  let automaticCount = 0;
  let dataIssuesCount = 0;
  let invalidDurationCount = 0;
  const validDurations: number[] = [];

  const outcomesMap: Record<'APPROVED' | 'COUNTER_OFFER' | 'REJECTED', number> = {
    APPROVED: 0,
    COUNTER_OFFER: 0,
    REJECTED: 0,
  };

  const statusCounts = new Map<string, number>();

  for (const app of cohort) {
    const currentStatus = app.status;
    if (ALL_KNOWN_STATUSES.includes(currentStatus)) {
      statusCounts.set(currentStatus, (statusCounts.get(currentStatus) ?? 0) + 1);
    } else {
      statusCounts.set('UNKNOWN', (statusCounts.get('UNKNOWN') ?? 0) + 1);
      dataIssuesCount++;
    }

    if (['SUBMITTED', 'SCORING', 'UNDERWRITING'].includes(currentStatus)) {
      awaitingCount++;
    }

    const history = app.history ?? [];
    const firstSubmitted = history.find((e) => e.to === 'SUBMITTED');
    if (firstSubmitted) {
      submittedCount++;
    }

    const firstDecisionIndex = history.findIndex((e) =>
      ['APPROVED', 'COUNTER_OFFER', 'REJECTED'].includes(e.to),
    );

    if (firstDecisionIndex !== -1) {
      decidedCount++;
      const firstDecisionEvent = history[firstDecisionIndex];
      const outcome = firstDecisionEvent.to as 'APPROVED' | 'COUNTER_OFFER' | 'REJECTED';
      outcomesMap[outcome]++;

      const hasBankPrior = history
        .slice(0, firstDecisionIndex)
        .some((e) => e.actor === 'BANK');
      if (firstDecisionEvent.actor === 'SYSTEM' && !hasBankPrior) {
        automaticCount++;
      }

      if (!firstSubmitted) {
        invalidDurationCount++;
        dataIssuesCount++;
      } else {
        const subMs = Date.parse(firstSubmitted.at);
        const decMs = Date.parse(firstDecisionEvent.at);
        if (isNaN(subMs) || isNaN(decMs) || decMs < subMs) {
          invalidDurationCount++;
          dataIssuesCount++;
        } else {
          validDurations.push(decMs - subMs);
        }
      }
    }
  }

  const stpPct = decidedCount === 0 ? null : ((automaticCount / decidedCount) * 100).toFixed(1);

  let meanMs: number | null = null;
  let p95Ms: number | null = null;

  if (validDurations.length > 0) {
    const sum = validDurations.reduce((a, b) => a + b, 0);
    meanMs = Math.round(sum / validDurations.length);

    const sorted = [...validDurations].sort((a, b) => a - b);
    const N = sorted.length;
    const rank = Math.ceil(0.95 * N);
    const index = Math.max(0, rank - 1);
    p95Ms = sorted[index];
  }

  const currentStatuses: { status: ApplicationStatus | string; count: number }[] = [];
  for (const s of ALL_KNOWN_STATUSES) {
    const count = statusCounts.get(s) ?? 0;
    if (count > 0) {
      currentStatuses.push({ status: s, count });
    }
  }
  const unknownCount = statusCounts.get('UNKNOWN') ?? 0;
  if (unknownCount > 0) {
    currentStatuses.push({ status: 'UNKNOWN', count: unknownCount });
  }

  return {
    asOf,
    filter,
    total,
    submitted: submittedCount,
    decided: decidedCount,
    awaitingDecision: awaitingCount,
    automaticDecisions: automaticCount,
    stpPct,
    timeToDecision: {
      meanMs,
      p95Ms,
      sampleCount: validDurations.length,
      invalidCount: invalidDurationCount,
    },
    currentStatuses,
    outcomes: [
      { outcome: 'APPROVED', count: outcomesMap.APPROVED },
      { outcome: 'COUNTER_OFFER', count: outcomesMap.COUNTER_OFFER },
      { outcome: 'REJECTED', count: outcomesMap.REJECTED },
    ],
    dataIssuesCount,
  };
}
