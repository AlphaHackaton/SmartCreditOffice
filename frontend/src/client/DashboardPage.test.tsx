import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderWorkspace } from '../test/renderWorkspace';
import { MockGateway } from '../demo/gateway';

it('показывает профиль/продукты и пустые заявки независимо', async () => {
  await renderWorkspace('/client', { login: 'p1' });
  expect(await screen.findByText('770123456703')).toBeInTheDocument();
  expect(await screen.findByText('Оборотный (гибкий)')).toBeInTheDocument();
  expect(await screen.findByText('У вас пока нет заявок')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Создать заявку' })).toHaveAttribute('href', '/client/applications/new');
});
it('ошибка профиля не скрывает продукты; повтор восстанавливает секцию', async () => {
  const gateway = new MockGateway(); const original = gateway.company.bind(gateway);
  vi.spyOn(gateway, 'company').mockRejectedValueOnce(new Error('Профиль временно недоступен')).mockImplementation(original);
  await renderWorkspace('/client', { login: 'p1', gateway });
  expect(await screen.findByRole('alert')).toHaveTextContent('Профиль временно недоступен');
  expect(await screen.findByText('Оборотный (гибкий)')).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByText('770123456703')).toBeInTheDocument();
});
it('выбор продукта передаёт его в форму, заявки другой компании не появляются', async () => {
  const gateway = new MockGateway(); gateway.delayMs = 0;
  const { token } = await gateway.login('p2', 'demo');
  await gateway.save(token, { productCode: 'WC_FLEX', amount: '2000000', termMonths: 24, purpose: 'OTHER', consents: [] });
  const { router } = await renderWorkspace('/client', { login: 'p1', gateway });
  await screen.findByText('У вас пока нет заявок');
  const section = screen.getByRole('heading', { name: 'Финансирование для бизнеса' }).closest('section')!;
  await userEvent.setup().click(within(section).getAllByRole('link', { name: 'Выбрать продукт →' })[1]);
  expect(router.state.location.search).toBe('?product=CAPEX');
});
it('сбой обновления пустого кеша не выдаётся за отсутствие заявок', async () => {
  const { gateway, client } = await renderWorkspace('/client', { login: 'p1' });
  await screen.findByText('У вас пока нет заявок');
  gateway.failNext('read', 503);
  await act(async () => { await client.invalidateQueries({ predicate: (query) => query.queryKey.at(-1) === 'applications' }); });
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось выполнить действие');
  expect(screen.queryByText('У вас пока нет заявок')).not.toBeInTheDocument();
});
