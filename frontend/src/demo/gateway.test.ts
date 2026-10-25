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
});
