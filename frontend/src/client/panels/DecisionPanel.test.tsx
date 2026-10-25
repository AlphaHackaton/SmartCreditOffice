import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { decisionScenario } from '../../test/decisionScenario';
import { renderWorkspace } from '../../test/renderWorkspace';

it('показывает причины и подтверждает однократный выбор', async () => {
  const { gateway, record } = await decisionScenario(); const accept = vi.spyOn(gateway, 'accept');
  await renderWorkspace(`/client/applications/${record.id}`, { login: 'p1', gateway });
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Выбрать предложение 1' }));
  const dialog = screen.getByRole('dialog', { name: 'Подтвердите выбор условий' });
  expect(dialog).toHaveTextContent('2 000 000');
  await user.dblClick(within(dialog).getByRole('button', { name: 'Принять условия' }));
  expect(await screen.findByText('Ожидается подписание. Интерфейс подписи будет добавлен отдельно.')).toBeInTheDocument();
  expect(accept).toHaveBeenCalledTimes(1);
});
it('ошибка 409 перечитывает заявку и не повторяет команду', async () => {
  const { gateway, record } = await decisionScenario(); const accept = vi.spyOn(gateway, 'accept'); const read = vi.spyOn(gateway, 'application');
  await renderWorkspace(`/client/applications/${record.id}`, { login: 'p1', gateway }); const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Выбрать предложение 1' })); gateway.failNext('command', 409);
  await user.click(screen.getByRole('button', { name: 'Принять условия' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Демонстрационный сбой');
  expect(read.mock.calls.length).toBeGreaterThan(1); expect(accept).toHaveBeenCalledTimes(1);
});
