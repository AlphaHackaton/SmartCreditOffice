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
