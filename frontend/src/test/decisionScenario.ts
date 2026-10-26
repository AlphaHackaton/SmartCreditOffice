import { MockGateway } from '../demo/gateway';
import { demoData } from '../demo/generated';

export async function decisionScenario(login = 'p1') {
  const clock = { now: Date.now() }; const gateway = new MockGateway(() => clock.now); gateway.delayMs = 0;
  const { token } = await gateway.login(login, 'demo');
  const persona = demoData.personas.find((p) => p.login === login)!;
  const draft = await gateway.save(token, { productCode: persona.request.product_code, amount: persona.request.amount, termMonths: persona.request.term_months, purpose: 'WORKING_CAPITAL', consents: ['BKI_REQUEST', 'PD_PROCESSING'] });
  await gateway.submit(token, draft.id, draft.version); clock.now += 4500;
  return { clock, gateway, token, record: await gateway.application(token, draft.id) };
}
