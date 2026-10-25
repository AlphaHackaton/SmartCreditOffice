import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderWorkspace } from '../test/renderWorkspace';
import { MockGateway, type ApplicationInput } from '../demo/gateway';
import { ApiError } from '../api/errors';

async function form(options: { gateway?: MockGateway; path?: string } = {}) {
  const view = await renderWorkspace(options.path ?? '/client/applications/new', { login: 'p1', gateway: options.gateway });
  await screen.findByRole('form', { name: 'Оформление заявки' }); return { ...view, user: userEvent.setup() };
}
async function consents(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Согласие на запрос в БКИ'));
  await user.click(screen.getByLabelText('Согласие на обработку персональных данных'));
}
it('не создаёт заявку без обязательных согласий', async () => {
  const { gateway, user } = await form(); const save = vi.spyOn(gateway, 'save');
  await user.click(screen.getByRole('button', { name: 'Подать заявку' }));
  expect(screen.getByText('Примите оба обязательных согласия')).toBeInTheDocument(); expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Согласие на запрос в БКИ')).toHaveFocus();
});
it('проверяет сумму без округления и не теряет ввод', async () => {
  const { user, gateway } = await form(); const save = vi.spyOn(gateway, 'save');
  const amount = screen.getByLabelText('Сумма, ₽'); await user.clear(amount); await user.type(amount, '300000.001');
  await user.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  expect(screen.getByText('Введите сумму цифрами, до двух знаков после точки')).toBeInTheDocument();
  expect(amount).toHaveValue('300000.001'); expect(amount).toHaveFocus(); expect(save).not.toHaveBeenCalled();
});
it('сохраняет и обновляет один черновик без обязательных согласий', async () => {
  const { gateway, token, user } = await form();
  await user.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await screen.findByText('Черновик сохранён. Он доступен в списке заявок.');
  const amount = screen.getByLabelText('Сумма, ₽'); await user.clear(amount); await user.type(amount, '300000');
  await user.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  await screen.findByText('Черновик сохранён. Он доступен в списке заявок.');
  const apps = await gateway.applications(token!); expect(apps).toHaveLength(1); expect(apps[0].amount).toBe('300000'); expect(apps[0].status).toBe('DRAFT');
});
it('подаёт один раз при двойном клике и открывает возвращённый id', async () => {
  const { gateway, user, router, token } = await form(); await consents(user);
  gateway.delayMs = 30; const save = vi.spyOn(gateway, 'save'); const submit = vi.spyOn(gateway, 'submit');
  await user.dblClick(screen.getByRole('button', { name: 'Подать заявку' }));
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/client\/applications\/[a-f0-9-]+$/));
  expect(save).toHaveBeenCalledTimes(1); expect(submit).toHaveBeenCalledTimes(1);
  const apps = await gateway.applications(token!); expect(apps).toHaveLength(1); expect(apps[0].status).toBe('SUBMITTED');
});
it('повтор после ошибки submit переиспользует созданный draft', async () => {
  const gateway = new MockGateway(); const submit = gateway.submit.bind(gateway);
  vi.spyOn(gateway, 'submit').mockRejectedValueOnce(new ApiError(503, 'NETWORK', 'Не удалось отправить заявку')).mockImplementation(submit);
  const { user, token, router } = await form({ gateway }); await consents(user);
  await user.click(screen.getByRole('button', { name: 'Подать заявку' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось отправить заявку');
  expect((await gateway.applications(token!))).toHaveLength(1);
  expect(screen.getByLabelText('Сумма, ₽')).toHaveValue('2000000.00');
  await user.click(screen.getByRole('button', { name: 'Подать заявку' }));
  await waitFor(() => expect(router.state.location.pathname).not.toContain('/new'));
  expect((await gateway.applications(token!))).toHaveLength(1);
});
it('показывает 422 у поля и сохраняет форму', async () => {
  const { gateway, user } = await form();
  vi.spyOn(gateway, 'save').mockRejectedValueOnce(new ApiError(422, 'VALIDATION', 'Проверьте поля', { amount: 'Сумма отклонена адаптером' }));
  await user.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
  expect(await screen.findByText('Сумма отклонена адаптером')).toBeInTheDocument(); expect(screen.getByLabelText('Сумма, ₽')).toHaveValue('2000000.00');
});
it('возобновляет сохранённый черновик по прямому адресу', async () => {
  const gateway = new MockGateway(); gateway.delayMs = 0; const { token } = await gateway.login('p1', 'demo');
  const input: ApplicationInput = { productCode: 'CAPEX', amount: '1000000', termMonths: 36, purpose: 'EQUIPMENT', consents: ['BKI_REQUEST'] };
  const draft = await gateway.save(token, input);
  await form({ gateway, path: `/client/applications/new?draft=${draft.id}` });
  expect(screen.getByLabelText('Сумма, ₽')).toHaveValue('1000000'); expect(screen.getByLabelText('Продукт')).toHaveValue('CAPEX');
  expect(screen.getByLabelText('Согласие на запрос в БКИ')).toBeChecked();
});
