import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { decisionScenario } from '../../test/decisionScenario';
import { renderWorkspace } from '../../test/renderWorkspace';

async function signingView() {
  const data = await decisionScenario();
  await data.gateway.accept(data.token, data.record.id, data.record.version, data.record.decision!.offers[0].id);
  const view = await renderWorkspace(`/client/applications/${data.record.id}`, { login: 'p1', gateway: data.gateway });
  await screen.findByLabelText('Код подтверждения');
  return { ...data, ...view, user: userEvent.setup() };
}
it('ошибка сохраняет код, затем SIGNED не выдаётся за DISBURSED', async () => {
  const { user } = await signingView(); const field = screen.getByLabelText('Код подтверждения');
  await user.type(field, '000000'); await user.click(screen.getByRole('button', { name: 'Подписать договор' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Неверный код'); expect(field).toHaveValue('000000');
  await user.clear(field); await user.type(field, '123456'); await user.click(screen.getByRole('button', { name: 'Подписать договор' }));
  expect(await screen.findByText('Договор подписан. Выдача ещё не подтверждена.')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Кредит выдан' })).not.toBeInTheDocument();
});
it('восстанавливает подтверждение при уходе и возврате', async () => {
  const { router, record } = await signingView(); expect(screen.getByText('123456')).toBeInTheDocument();
  await act(() => router.navigate('/client'));
  await act(() => router.navigate(`/client/applications/${record.id}`));
  expect(await screen.findByLabelText('Код подтверждения')).toBeInTheDocument();
  expect(screen.getByText('123456')).toBeInTheDocument();
});
it('поздняя подпись после выхода не восстанавливает заявку', async () => {
  const { user, gateway } = await signingView(); const sign = vi.spyOn(gateway, 'sign'); gateway.delayMs = 80;
  await user.type(screen.getByLabelText('Код подтверждения'), '123456');
  await user.click(screen.getByRole('button', { name: 'Подписать договор' }));
  await user.click(screen.getByRole('button', { name: 'Выйти' }));
  await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
  expect(sign).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', { name: 'Вход в кабинет' })).toBeInTheDocument();
  expect(screen.queryByText('Запрошенные условия')).not.toBeInTheDocument();
});

it('обновляет заявку после истечения подтверждения и скрывает подпись', async () => {
  const { gateway, token, record, clock } = await decisionScenario();
  await gateway.accept(token, record.id, record.version, record.decision!.offers[0].id);
  const challenge = await gateway.challenge(token, record.id);
  // UI clock and gateway clock may differ. An expired UI challenge must offer a reread.
  vi.spyOn(gateway, 'challenge').mockResolvedValue({ ...challenge, expiresAt: new Date(Date.now() - 1).toISOString() });
  await renderWorkspace(`/client/applications/${record.id}`, { login: 'p1', gateway });
  const refresh = await screen.findByRole('button', { name: 'Обновить заявку' });
  clock.now += 5 * 60_000 + 50;
  await userEvent.setup().click(refresh);
  expect(await screen.findByText('Срок действия заявки истёк.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Подписать договор' })).not.toBeInTheDocument();
});
