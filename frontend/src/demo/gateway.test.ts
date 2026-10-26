import { describe, expect, it, vi } from 'vitest';
import { MockGateway, unavailableGateway, validateInput, type ApplicationInput } from './gateway';
import { demoData } from './generated';

const input: ApplicationInput = { productCode: 'WC_FLEX', amount: '2000000.00', termMonths: 24, purpose: 'WORKING_CAPITAL', consents: ['BKI_REQUEST', 'PD_PROCESSING'] };
async function setup(now?: () => number) { const gateway = new MockGateway(now); gateway.delayMs = 0; const { token } = await gateway.login('p1', 'demo'); return { gateway, token }; }

describe('демо gateway', () => {
  it('берёт персоны/продукты из домена и определяет роли по учётке', async () => {
    const { gateway, token } = await setup();
    expect((await gateway.personas()).length).toBe(demoData.personas.length + 1);
    expect((await gateway.me(token)).role).toBe('client');
    expect(await gateway.products(token)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'WC_FLEX' })]));
    await expect(gateway.login('p1', 'wrong')).rejects.toMatchObject({ status: 401 });
    const bank = await gateway.login('underwriter', 'demo');
    await expect(gateway.company(bank.token)).rejects.toMatchObject({ status: 403 });
  });
  it('изолирует заявки компаний и делает копии возвращаемых данных', async () => {
    const { gateway, token } = await setup(); const draft = await gateway.save(token, input);
    draft.amount = '0'; expect((await gateway.application(token, draft.id)).amount).toBe(input.amount);
    const other = await gateway.login('p2', 'demo');
    expect(await gateway.applications(other.token)).toEqual([]);
    await expect(gateway.application(other.token, draft.id)).rejects.toMatchObject({ status: 404 });
  });
  it('воспроизводит проверенные backend стадии и защищает version/повтор submit', async () => {
    let now = Date.parse('2026-10-25T10:00:00Z');
    const { gateway, token } = await setup(() => now);
    const draft = await gateway.save(token, input); expect(draft.status).toBe('DRAFT');
    expect((await gateway.submit(token, draft.id, draft.version)).status).toBe('SUBMITTED');
    await expect(gateway.submit(token, draft.id, draft.version)).rejects.toMatchObject({ status: 409 });
    now += 1500; expect((await gateway.application(token, draft.id)).status).toBe('SCORING');
    now += 3000; const result = await gateway.application(token, draft.id);
    expect(result.status).toBe('APPROVED'); expect(result.history.map((e) => e.to)).toEqual(['DRAFT', 'SUBMITTED', 'SCORING', 'APPROVED']);
    expect(result.history[0].at <= result.history[1].at).toBe(true);
  });
  it('не вычисляет решение для произвольных условий', async () => {
    let now = 0; const { gateway, token } = await setup(() => now);
    const draft = await gateway.save(token, { ...input, amount: '1000000.00' });
    await gateway.submit(token, draft.id, draft.version); now = 5000;
    expect((await gateway.application(token, draft.id)).status).toBe('UNDERWRITING');
  });
  it('одноразовая ошибка не меняет данные; reset отклоняет старую команду и токен', async () => {
    const { gateway, token } = await setup(); gateway.failNext('command', 503);
    await expect(gateway.save(token, input)).rejects.toMatchObject({ status: 503 });
    expect(await gateway.applications(token)).toEqual([]);
    const pending = gateway.save(token, input); gateway.reset();
    await expect(pending).rejects.toMatchObject({ code: 'DEMO_RESET' });
    await expect(gateway.me(token)).rejects.toMatchObject({ status: 401 });
  });
  it('отменяет чтение и передаёт 401 владельцу сессии', async () => {
    const expired = vi.fn(); const gateway = new MockGateway(Date.now, expired); gateway.delayMs = 0;
    const { token } = await gateway.login('p1', 'demo');
    const controller = new AbortController(); const request = gateway.company(token, controller.signal); controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    gateway.failNext('read', 401); await expect(gateway.company(token)).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledWith(token);
  });
  it('API-режим не делает несуществующих HTTP-вызовов и не падает в mock', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(unavailableGateway().login('p1', 'demo')).rejects.toMatchObject({ code: 'API_NOT_CONFIGURED' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('проверяет точность, границы, шаг и согласия без расчёта условий', () => {
    const product = demoData.products[0];
    for (const amount of ['1e6', '0', '10000001', '300000.001', '300001', 'Infinity', '300000\n']) expect(validateInput({ ...input, amount }, product, true).amount).toBeTruthy();
    expect(validateInput({ ...input, amount: '300000' }, product, true)).toEqual({});
    expect(validateInput({ ...input, consents: [] }, product, false)).toEqual({});
    expect(validateInput({ ...input, consents: [] }, product, true).consents).toBeTruthy();
  });
  it('изолирует досье для bank, запрещает seed клиенту и синхронизирует статус с очередью', async () => {
    const { gateway, token } = await setup();
    await expect(gateway.dossier(token, 'seed-p1_ideal')).rejects.toMatchObject({ status: 403 });
    await expect(gateway.application(token, 'seed-p1_ideal')).rejects.toMatchObject({ status: 404 });
    expect(await gateway.applications(token)).toEqual([]);

    const bank = await gateway.login('underwriter', 'demo');
    const dossierP1 = await gateway.dossier(bank.token, 'seed-p1_ideal');
    expect(dossierP1.source).toBe('example');
    expect(dossierP1.application.status).toBe('APPROVED');
    expect(dossierP1.runs[0].result.grade).toBe('A');

    const queueBefore = await gateway.queue(bank.token);
    expect(queueBefore.find((q) => q.id === 'seed-p6_mismatch')?.status).toBe('UNDERWRITING');

    const dossierP6 = await gateway.dossier(bank.token, 'seed-p6_mismatch');
    expect(dossierP6.application.status).toBe('UNDERWRITING');
    expect(dossierP6.allowedOutcomes).toContain('APPROVED');
    expect(dossierP6.allowedOutcomes).toContain('REJECTED');

    // Проверка ограничений decide
    await expect(gateway.decide(token, 'seed-p6_mismatch', { outcome: 'APPROVED', comment: 'тест', version: dossierP6.application.version })).rejects.toMatchObject({ status: 403 });
    await expect(gateway.decide(bank.token, 'seed-p1_ideal', { outcome: 'REJECTED', comment: 'тест', version: dossierP1.application.version })).rejects.toMatchObject({ status: 409 });
    await expect(gateway.decide(bank.token, 'seed-p6_mismatch', { outcome: 'APPROVED', comment: '   ', version: dossierP6.application.version })).rejects.toMatchObject({ status: 422 });
    await expect(gateway.decide(bank.token, 'seed-p6_mismatch', { outcome: 'APPROVED', comment: 'тест', version: 999 })).rejects.toMatchObject({ status: 409 });
    await expect(gateway.decide(bank.token, 'seed-p6_mismatch', { outcome: 'COUNTER_OFFER', comment: 'тест', version: dossierP6.application.version })).rejects.toMatchObject({ status: 422 });
    await expect(gateway.decide(bank.token, 'seed-p6_mismatch', { outcome: 'APPROVED', comment: 'тест', version: dossierP6.application.version })).rejects.toMatchObject({ status: 422 });
    await expect(gateway.decide(bank.token, 'seed-p6_mismatch', { outcome: 'REJECTED', offerId: dossierP6.eligibleOffers[0].id, comment: 'тест', version: dossierP6.application.version })).rejects.toMatchObject({ status: 422 });

    // Успешный decide
    const decided = await gateway.decide(bank.token, 'seed-p6_mismatch', {
      outcome: 'APPROVED',
      offerId: dossierP6.eligibleOffers[0].id,
      comment: 'Документы проверены, обороты подтверждены контрактами',
      version: dossierP6.application.version,
    });
    expect(decided.application.status).toBe('APPROVED');
    expect(decided.application.version).toBe(dossierP6.application.version + 1);
    expect(decided.audit).toHaveLength(1);
    expect(decided.audit[0]).toMatchObject({
      action: 'DECISION',
      actorId: 'underwriter',
      selectedOutcome: 'APPROVED',
      override: false,
      comment: 'Документы проверены, обороты подтверждены контрактами',
    });

    const queueAfter = await gateway.queue(bank.token);
    expect(queueAfter.find((q) => q.id === 'seed-p6_mismatch')?.status).toBe('APPROVED');

    // Сверка replayDossier
    await expect(gateway.replayDossier(token, 'seed-p6_mismatch', decided.runs[0].id)).rejects.toMatchObject({ status: 403 });
    const replay = await gateway.replayDossier(bank.token, 'seed-p6_mismatch', decided.runs[0].id);
    expect(replay.match).toBe(true);

    // Reset возвращает исходные примеры
    gateway.reset();
    const bank2 = await gateway.login('underwriter', 'demo');
    const p6Reset = await gateway.dossier(bank2.token, 'seed-p6_mismatch');
    expect(p6Reset.application.status).toBe('UNDERWRITING');
    expect(p6Reset.audit).toEqual([]);
  });
  it('unavailableGateway отклоняет банковские методы с кодом API_NOT_CONFIGURED', async () => {
    const api = unavailableGateway();
    await expect(api.dossier('token', 'id')).rejects.toMatchObject({ code: 'API_NOT_CONFIGURED' });
    await expect(api.decide('token', 'id', { outcome: 'REJECTED', comment: 'c', version: 1 })).rejects.toMatchObject({ code: 'API_NOT_CONFIGURED' });
    await expect(api.replayDossier('token', 'id', 'runId')).rejects.toMatchObject({ code: 'API_NOT_CONFIGURED' });
  });
});
