import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import type { ApplicationStatus } from './generated';
import { MockGateway, unavailableGateway, type Application } from './gateway';
import {
  calculatePipelineMetrics,
  parseMoscowDateBounds,
  validateMetricsFilter,
  type MetricSourceFilter,
} from './metrics';

describe('Metrics: Moscow date bounds and filters', () => {
  it('возвращает null для пустых дат', () => {
    expect(parseMoscowDateBounds()).toBeNull();
    expect(parseMoscowDateBounds('', '')).toBeNull();
    expect(parseMoscowDateBounds('  ', '  ')).toBeNull();
  });

  it('вычисляет корректные границы по Москве с включением обеих дат', () => {
    const bounds = parseMoscowDateBounds('2026-10-25', '2026-10-25');
    expect(bounds).not.toBeNull();
    // 2026-10-25 00:00 MSK (UTC+3) = 2026-10-24 21:00 UTC
    expect(bounds!.startMs).toBe(Date.parse('2026-10-25T00:00:00+03:00'));
    // Конец полуинтервала: 2026-10-26 00:00 MSK = 2026-10-25 21:00 UTC
    expect(bounds!.endMs).toBe(Date.parse('2026-10-26T00:00:00+03:00'));

    // Заявка в 00:00:00 первой даты включена
    const t0 = Date.parse('2026-10-25T00:00:00+03:00');
    expect(t0 >= bounds!.startMs && t0 < bounds!.endMs).toBe(true);

    // Заявка в 23:59:59 последней даты включена
    const tEnd = Date.parse('2026-10-25T23:59:59+03:00');
    expect(tEnd >= bounds!.startMs && tEnd < bounds!.endMs).toBe(true);

    // Заявка в 00:00:00 следующего дня исключена
    const tNext = Date.parse('2026-10-26T00:00:00+03:00');
    expect(tNext >= bounds!.startMs && tNext < bounds!.endMs).toBe(false);
  });

  it('отклоняет некорректные диапазоны дат с ошибкой 422', () => {
    expect(() => parseMoscowDateBounds('2026-10-25', '')).toThrow(ApiError);
    expect(() => parseMoscowDateBounds('', '2026-10-25')).toThrow(ApiError);
    expect(() => parseMoscowDateBounds('2026-10-26', '2026-10-25')).toThrow(ApiError);
    expect(() => parseMoscowDateBounds('2026-02-31', '2026-03-01')).toThrow(ApiError);
    expect(() => parseMoscowDateBounds('invalid', '2026-10-25')).toThrow(ApiError);
  });

  it('валидирует источник и продукт', () => {
    expect(validateMetricsFilter({ source: 'example' })).toMatchObject({ source: 'example' });
    expect(validateMetricsFilter({ source: 'all', productCode: 'WC_FLEX' })).toMatchObject({
      source: 'all',
      productCode: 'WC_FLEX',
    });
    expect(() => validateMetricsFilter({ source: 'unknown' as unknown as MetricSourceFilter })).toThrow(ApiError);
    expect(() => validateMetricsFilter({ productCode: 'NON_EXISTENT' })).toThrow(ApiError);
  });
});

describe('Metrics: calculator core logic', () => {
  const dummyApp = (overrides: Partial<Application> = {}): Application => ({
    id: 'test-1',
    companyId: 'comp-1',
    productCode: 'WC_FLEX',
    amount: '1000000.00',
    termMonths: 12,
    purpose: 'WORKING_CAPITAL',
    consents: ['BKI_REQUEST', 'PD_PROCESSING'],
    status: 'DRAFT',
    version: 1,
    history: [],
    createdAt: '2026-10-25T09:00:00+03:00',
    ...overrides,
  });

  it('таблица тестов: пустая выборка (0)', () => {
    const res = calculatePipelineMetrics([], { source: 'all' }, '2026-10-25T12:00:00Z');
    expect(res.total).toBe(0);
    expect(res.submitted).toBe(0);
    expect(res.decided).toBe(0);
    expect(res.awaitingDecision).toBe(0);
    expect(res.automaticDecisions).toBe(0);
    expect(res.stpPct).toBeNull();
    expect(res.timeToDecision.meanMs).toBeNull();
    expect(res.timeToDecision.p95Ms).toBeNull();
    expect(res.timeToDecision.sampleCount).toBe(0);
    expect(res.timeToDecision.invalidCount).toBe(0);
    expect(res.currentStatuses).toEqual([]);
    expect(res.outcomes).toEqual([
      { outcome: 'APPROVED', count: 0 },
      { outcome: 'COUNTER_OFFER', count: 0 },
      { outcome: 'REJECTED', count: 0 },
    ]);
    expect(res.dataIssuesCount).toBe(0);
  });

  it('таблица тестов: 1 автоматическая одобренная заявка', () => {
    const app = dummyApp({
      status: 'APPROVED',
      history: [
        { from: null, to: 'DRAFT', actor: 'CLIENT', at: '2026-10-25T09:00:00Z' },
        { from: 'DRAFT', to: 'SUBMITTED', actor: 'CLIENT', at: '2026-10-25T09:00:01Z' },
        { from: 'SUBMITTED', to: 'SCORING', actor: 'SYSTEM', at: '2026-10-25T09:00:02Z' },
        { from: 'SCORING', to: 'APPROVED', actor: 'SYSTEM', at: '2026-10-25T09:00:06Z' },
      ],
    });
    const res = calculatePipelineMetrics([app], { source: 'all' }, '2026-10-25T12:00:00Z');
    expect(res.total).toBe(1);
    expect(res.submitted).toBe(1);
    expect(res.decided).toBe(1);
    expect(res.awaitingDecision).toBe(0);
    expect(res.automaticDecisions).toBe(1);
    expect(res.stpPct).toBe('100.0');
    expect(res.timeToDecision.meanMs).toBe(5000); // 09:00:06 - 09:00:01 = 5s
    expect(res.timeToDecision.p95Ms).toBe(5000);
    expect(res.timeToDecision.sampleCount).toBe(1);
    expect(res.outcomes).toEqual([
      { outcome: 'APPROVED', count: 1 },
      { outcome: 'COUNTER_OFFER', count: 0 },
      { outcome: 'REJECTED', count: 0 },
    ]);
  });

  it('вычисляет p95 nearest-rank на выборке N', () => {
    // 5 заявок с длительностями 100, 200, 300, 400, 500 ms
    const apps = [100, 200, 300, 400, 500].map((dur, i) =>
      dummyApp({
        id: `app-${i}`,
        status: 'APPROVED',
        history: [
          { from: 'DRAFT', to: 'SUBMITTED', actor: 'CLIENT', at: '2026-10-25T09:00:00.000Z' },
          { from: 'SUBMITTED', to: 'APPROVED', actor: 'SYSTEM', at: new Date(Date.parse('2026-10-25T09:00:00.000Z') + dur).toISOString() },
        ],
      }),
    );
    const res = calculatePipelineMetrics(apps, { source: 'all' }, '2026-10-25T12:00:00Z');
    expect(res.total).toBe(5);
    expect(res.timeToDecision.sampleCount).toBe(5);
    expect(res.timeToDecision.meanMs).toBe(300);
    // ceil(0.95 * 5) = 5 -> index 4 -> 500
    expect(res.timeToDecision.p95Ms).toBe(500);

    // 20 заявок: 10, 20, ..., 200 ms
    const apps20 = Array.from({ length: 20 }, (_, i) =>
      dummyApp({
        id: `app20-${i}`,
        status: 'REJECTED',
        history: [
          { from: 'DRAFT', to: 'SUBMITTED', actor: 'CLIENT', at: '2026-10-25T09:00:00.000Z' },
          { from: 'SUBMITTED', to: 'REJECTED', actor: 'SYSTEM', at: new Date(Date.parse('2026-10-25T09:00:00.000Z') + (i + 1) * 10).toISOString() },
        ],
      }),
    );
    const res20 = calculatePipelineMetrics(apps20, { source: 'all' }, '2026-10-25T12:00:00Z');
    // ceil(0.95 * 20) = 19 -> index 18 -> 190
    expect(res20.timeToDecision.p95Ms).toBe(190);
  });

  it('корректно обрабатывает ошибки в истории: решение без подачи, отрицательная длительность', () => {
    const noSub = dummyApp({
      id: 'no-sub',
      status: 'APPROVED',
      history: [{ from: 'SCORING', to: 'APPROVED', actor: 'SYSTEM', at: '2026-10-25T09:00:00Z' }],
    });
    const negDur = dummyApp({
      id: 'neg-dur',
      status: 'REJECTED',
      history: [
        { from: 'DRAFT', to: 'SUBMITTED', actor: 'CLIENT', at: '2026-10-25T09:00:10Z' },
        { from: 'SCORING', to: 'REJECTED', actor: 'SYSTEM', at: '2026-10-25T09:00:05Z' }, // раньше подачи
      ],
    });
    const unknownStatus = dummyApp({
      id: 'unknown-stat',
      status: 'SOME_WEIRD_STATUS' as unknown as ApplicationStatus,
    });

    const res = calculatePipelineMetrics([noSub, negDur, unknownStatus], { source: 'all' }, '2026-10-25T12:00:00Z');
    expect(res.total).toBe(3);
    expect(res.decided).toBe(2);
    expect(res.timeToDecision.sampleCount).toBe(0);
    expect(res.timeToDecision.invalidCount).toBe(2);
    expect(res.timeToDecision.meanMs).toBeNull();
    expect(res.timeToDecision.p95Ms).toBeNull();
    // 1 (no-sub) + 1 (negDur) + 1 (unknown status) = 3 data issues
    expect(res.dataIssuesCount).toBe(3);
    expect(res.currentStatuses).toContainEqual({ status: 'UNKNOWN', count: 1 });
  });

  it('сохраняет бизнес-исход после перехода в SIGNING / DISBURSED / CANCELLED / EXPIRED', () => {
    const disbursed = dummyApp({
      id: 'disbursed',
      status: 'DISBURSED',
      history: [
        { from: 'DRAFT', to: 'SUBMITTED', actor: 'CLIENT', at: '2026-10-25T09:00:00Z' },
        { from: 'SCORING', to: 'APPROVED', actor: 'SYSTEM', at: '2026-10-25T09:00:02Z' },
        { from: 'APPROVED', to: 'SIGNING', actor: 'CLIENT', at: '2026-10-25T09:00:05Z' },
        { from: 'SIGNING', to: 'SIGNED', actor: 'CLIENT', at: '2026-10-25T09:00:10Z' },
        { from: 'SIGNED', to: 'DISBURSED', actor: 'SYSTEM', at: '2026-10-25T09:00:15Z' },
      ],
    });
    const res = calculatePipelineMetrics([disbursed], { source: 'all' }, '2026-10-25T12:00:00Z');
    expect(res.decided).toBe(1);
    expect(res.outcomes).toEqual([
      { outcome: 'APPROVED', count: 1 },
      { outcome: 'COUNTER_OFFER', count: 0 },
      { outcome: 'REJECTED', count: 0 },
    ]);
    expect(res.awaitingDecision).toBe(0);
    expect(res.currentStatuses).toEqual([{ status: 'DISBURSED', count: 1 }]);
  });
});

describe('Metrics: gateway integration', () => {
  it('исходный seed: total 6, decided 5, awaiting 1, automatic 5, STP 100.0%', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { token } = await gateway.login('underwriter', 'demo');
    const m = await gateway.metrics(token);

    expect(m.total).toBe(6);
    expect(m.submitted).toBe(6);
    expect(m.decided).toBe(5);
    expect(m.awaitingDecision).toBe(1);
    expect(m.automaticDecisions).toBe(5);
    expect(m.stpPct).toBe('100.0');
    expect(m.outcomes).toEqual([
      { outcome: 'APPROVED', count: 1 },
      { outcome: 'COUNTER_OFFER', count: 2 },
      { outcome: 'REJECTED', count: 2 },
    ]);
    expect(m.currentStatuses).toEqual(
      expect.arrayContaining([
        { status: 'UNDERWRITING', count: 1 },
        { status: 'APPROVED', count: 1 },
        { status: 'COUNTER_OFFER', count: 2 },
        { status: 'REJECTED', count: 2 },
      ]),
    );
    expect(m.dataIssuesCount).toBe(0);
  });

  it('ручное решение по P6 изменяет decided, awaiting, STP и исход', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { token } = await gateway.login('underwriter', 'demo');

    const dossier = await gateway.dossier(token, 'seed-p6_mismatch');
    expect(dossier.application.status).toBe('UNDERWRITING');

    // Сотрудник банка принимает решение APPROVED
    await gateway.decide(token, 'seed-p6_mismatch', {
      outcome: 'APPROVED',
      offerId: dossier.eligibleOffers[0].id,
      comment: 'Ручное согласование после проверки контрактов',
      version: dossier.application.version,
    });

    const m = await gateway.metrics(token);
    expect(m.total).toBe(6);
    expect(m.decided).toBe(6);
    expect(m.awaitingDecision).toBe(0);
    expect(m.automaticDecisions).toBe(5); // Осталось 5, так как P6 решён сотрудником (BANK)
    expect(m.stpPct).toBe('83.3'); // 5 / 6 * 100 = 83.3%
    expect(m.outcomes).toEqual([
      { outcome: 'APPROVED', count: 2 },
      { outcome: 'COUNTER_OFFER', count: 2 },
      { outcome: 'REJECTED', count: 2 },
    ]);
  });

  it('повторный replayDossier не меняет метрики', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { token } = await gateway.login('underwriter', 'demo');

    const before = await gateway.metrics(token);
    await gateway.replayDossier(token, 'seed-p1_ideal', 'run-seed-p1_ideal');
    await gateway.replayDossier(token, 'seed-p1_ideal', 'run-seed-p1_ideal');
    const after = await gateway.metrics(token);

    expect(after.total).toBe(before.total);
    expect(after.decided).toBe(before.decided);
    expect(after.awaitingDecision).toBe(before.awaitingDecision);
    expect(after.stpPct).toBe(before.stpPct);
  });

  it('клиент получает 403 при запросе метрик', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { token } = await gateway.login('p1', 'demo');
    await expect(gateway.metrics(token)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('unavailableGateway отклоняет metrics с кодом API_NOT_CONFIGURED (503)', async () => {
    const api = unavailableGateway();
    await expect(api.metrics('any-token')).rejects.toMatchObject({
      status: 503,
      code: 'API_NOT_CONFIGURED',
    });
  });
});
