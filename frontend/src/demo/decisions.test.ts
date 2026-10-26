import { expect, it } from 'vitest';
import { decisionScenario } from '../test/decisionScenario';

it('возвращает клиентскую проекцию без банковских входов и трассы', async () => {
  const { record } = await decisionScenario();
  expect(record.decision?.offers[0]).toMatchObject({ amount: '2000000.00', term_months: 24 });
  expect(record.decision?.factors[0].text).toBeTruthy();
  expect(JSON.stringify(record.decision)).not.toMatch(/rule_id|max_points|inflows|score|source/);
});
it('принимает только свой актуальный оффер один раз', async () => {
  const { gateway, token, record } = await decisionScenario(); const offer = record.decision!.offers[0];
  await expect(gateway.accept(token, record.id, record.version, 'wrong')).rejects.toMatchObject({ status: 409 });
  const other = await gateway.login('p2', 'demo');
  await expect(gateway.accept(other.token, record.id, record.version, offer.id)).rejects.toMatchObject({ status: 404 });
  const accepted = await gateway.accept(token, record.id, record.version, offer.id);
  expect(accepted.status).toBe('SIGNING'); expect(accepted.selectedOffer).toEqual(offer);
  expect(accepted.history.at(-1)).toMatchObject({ from: 'APPROVED', to: 'SIGNING', actor: 'CLIENT' });
  await expect(gateway.accept(token, record.id, record.version, offer.id)).rejects.toMatchObject({ status: 409 });
});
it('истечение создаёт доменное событие и запрещает accept', async () => {
  const { gateway, token, record, clock } = await decisionScenario();
  clock.now += 30 * 60_000;
  const expired = await gateway.application(token, record.id);
  expect(expired.status).toBe('EXPIRED'); expect(expired.history.at(-1)?.to).toBe('EXPIRED');
  await expect(gateway.accept(token, record.id, record.version, record.decision!.offers[0].id)).rejects.toMatchObject({ status: 409 });
});

it('подписывает один раз, восстанавливает challenge и выдаёт только после SIGNED', async () => {
  const { gateway, token, record, clock } = await decisionScenario();
  const accepted = await gateway.accept(token, record.id, record.version, record.decision!.offers[0].id);
  const challenge = await gateway.challenge(token, record.id);
  expect(await gateway.challenge(token, record.id)).toEqual(challenge);
  const signed = await gateway.sign(token, record.id, accepted.version, challenge.id, challenge.code);
  expect(signed.status).toBe('SIGNED');
  await expect(gateway.sign(token, record.id, accepted.version, challenge.id, challenge.code)).rejects.toMatchObject({ status: 409 });
  clock.now += 1500;
  expect((await gateway.application(token, record.id)).history.map((e) => e.to)).toEqual(['DRAFT', 'SUBMITTED', 'SCORING', 'APPROVED', 'SIGNING', 'SIGNED', 'DISBURSED']);
});
it('блокирует три неверных кода и истёкшее подтверждение', async () => {
  const { gateway, token, record, clock } = await decisionScenario();
  const accepted = await gateway.accept(token, record.id, record.version, record.decision!.offers[0].id);
  const c = await gateway.challenge(token, record.id);
  for (let i = 0; i < 3; i++) await expect(gateway.sign(token, record.id, accepted.version, c.id, '000000')).rejects.toMatchObject({ status: 422 });
  expect((await gateway.challenge(token, record.id)).attemptsLeft).toBe(0);
  await expect(gateway.sign(token, record.id, accepted.version, c.id, c.code)).rejects.toMatchObject({ code: 'CHALLENGE_BLOCKED' });
  clock.now += 5 * 60_000;
  expect((await gateway.application(token, record.id)).status).toBe('EXPIRED');
  await expect(gateway.challenge(token, record.id)).rejects.toMatchObject({ status: 409 });
});

it('симуляция совпадает с Python, отменяется и не меняет заявку', async () => {
  const { gateway, token, record } = await decisionScenario('p2');
  const options = await gateway.simulationOptions(token, record.id);
  const result = await gateway.simulate(token, record.id, record.amount, record.termMonths);
  expect(result.outcome).toBe('COUNTER_OFFER'); expect(result.offers.length).toBeGreaterThan(0);
  expect((await gateway.application(token, record.id)).version).toBe(record.version);
  await expect(gateway.simulate(token, record.id, '1234567', record.termMonths)).rejects.toMatchObject({ code: 'NO_DEMO_SIMULATION' });
  const controller = new AbortController(); const request = gateway.simulate(token, record.id, options.amounts[0], options.terms[0], controller.signal); controller.abort();
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
});

it('очередь доступна bank, включает примеры и живую заявку, reset очищает сеанс', async () => {
  const { gateway, token, record } = await decisionScenario();
  await expect(gateway.queue(token)).rejects.toMatchObject({ status: 403 });
  const bank = await gateway.login('underwriter', 'demo');
  const rows = await gateway.queue(bank.token); expect(rows).toHaveLength(7);
  expect(rows.find((a) => a.id === record.id)?.status).toBe('APPROVED');
  rows[0].amount = '0'; expect((await gateway.queue(bank.token))[0].amount).not.toBe('0');
  gateway.reset(); const next = await gateway.login('underwriter', 'demo');
  expect(await gateway.queue(next.token)).toHaveLength(6);
});

it('лимиты публичной проекции имеют денежную точность для отображения', async () => {
  const { gateway, token, record } = await decisionScenario('p2');
  const sim = await gateway.simulate(token, record.id, record.amount, record.termMonths);
  for (const c of [...record.decision!.constraints, ...sim.constraints]) expect(c.limit).toMatch(/^\d+\.\d{2}$/);
});

it('банковская проекция содержит полные трассы, метрики, хеши и допустимые переходы', async () => {
  const { bankDemoData } = await import('./generated');
  expect(bankDemoData.policy.version).toBeTruthy();
  expect(bankDemoData.bankTransitions.UNDERWRITING_APPROVED).toMatchObject({
    from: 'UNDERWRITING',
    to: 'APPROVED',
    actor: 'BANK',
    reasonRequired: true,
  });
  expect(bankDemoData.bankTransitions.UNDERWRITING_COUNTER_OFFER).toMatchObject({
    from: 'UNDERWRITING',
    to: 'COUNTER_OFFER',
    actor: 'BANK',
    reasonRequired: true,
  });
  expect(bankDemoData.bankTransitions.UNDERWRITING_REJECTED).toMatchObject({
    from: 'UNDERWRITING',
    to: 'REJECTED',
    actor: 'BANK',
    reasonRequired: true,
  });

  const p1Run = bankDemoData.scoringRuns.p1_ideal;
  expect(p1Run.result.score).toBeGreaterThan(0);
  expect(p1Run.result.grade).toBe('A');
  expect(p1Run.factors.find((f) => f.ruleId === 'M1')?.bin).toMatchObject({
    upper: '0.25',
    points: 20,
    rule: 'M1',
  });

  const p4Run = bankDemoData.scoringRuns.p4_overdue;
  expect(p4Run.result.score).toBeNull();
  expect(p4Run.result.grade).toBeNull();
  expect(p4Run.result.recommendation).toBe('REJECTED');

  const p5Run = bankDemoData.scoringRuns.p5_young;
  expect(p5Run.result.score).toBeNull();
  expect(p5Run.result.grade).toBeNull();
  expect(p5Run.metrics.fns_mismatch).toBeNull();

  const p6Dossier = bankDemoData.dossiers.p6_mismatch;
  expect(p6Dossier.status).toBe('UNDERWRITING');
  expect(p6Dossier.engineRecommendation).toBe('APPROVED');
  expect(p6Dossier.allowedOutcomes).toContain('APPROVED');
  expect(p6Dossier.allowedOutcomes).toContain('REJECTED');

  const p6Review = bankDemoData.reviewVariants.p6_capex_6m_24m;
  expect(p6Review.request.amount).toBe('6000000.00');
  expect(p6Review.scoringRun.result.recommendation).toBe('COUNTER_OFFER');
  expect(p6Review.eligibleOffers).toHaveLength(2);
  expect(p6Review.allowedOutcomes).toEqual(['COUNTER_OFFER', 'REJECTED']);
});
