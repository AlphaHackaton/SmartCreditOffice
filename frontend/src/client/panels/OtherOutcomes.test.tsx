import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { decisionScenario } from '../../test/decisionScenario';
import { renderWorkspace } from '../../test/renderWorkspace';

it.each(['p4', 'p5'])('объясняет отказ %s и не даёт подписать', async (login) => {
  const { gateway, record } = await decisionScenario(login);
  await renderWorkspace(`/client/applications/${record.id}`, { login, gateway });
  await screen.findByRole('heading', { name: 'Почему заявка отклонена' });
  expect(screen.getByRole('list', { name: 'Объяснение решения' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Выбрать предложение|Подписать/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Сумма для симуляции')).not.toBeInTheDocument();
  if (login === 'p4') expect(screen.getByText('Есть текущая просрочка по действующим обязательствам.')).toBeInTheDocument();
  else expect(screen.getByText(/Подайте заявку после/)).toBeInTheDocument();
});
it('P6 объясняет ручное рассмотрение без команд и банковской трассы', async () => {
  const { gateway, record } = await decisionScenario('p6');
  await renderWorkspace(`/client/applications/${record.id}`, { login: 'p6', gateway });
  await screen.findByRole('heading', { name: 'Заявка на ручном рассмотрении' });
  expect(screen.getByText('Отчётность существенно расходится с оборотами по счёту.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Подписать|Одобрить/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/rule_id|FNS_MISMATCH|Баллы/)).not.toBeInTheDocument();
});
it('нестандартные условия явно оставляет без выдуманного решения', async () => {
  const { gateway, token, clock } = await decisionScenario('p4');
  const draft = await gateway.save(token, { productCode: 'WC_FLEX', amount: '500000.00', termMonths: 12, purpose: 'OTHER', consents: ['BKI_REQUEST', 'PD_PROCESSING'] });
  await gateway.submit(token, draft.id, draft.version); clock.now += 4500;
  await renderWorkspace(`/client/applications/${draft.id}`, { login: 'p4', gateway });
  expect(await screen.findByText(/Специалист проверяет данные/)).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Объяснение решения' })).not.toBeInTheDocument();
});
