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
