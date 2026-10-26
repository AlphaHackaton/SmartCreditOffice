import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MockGateway } from '../demo/gateway';
import { ApiError } from '../api/errors';
import { renderWorkspace } from '../test/renderWorkspace';

it('показывает шесть примеров, сочетает фильтры и сбрасывает их', async () => {
  await renderWorkspace('/bank/applications', { login: 'underwriter' });
  expect(await screen.findByText('Найдено заявок: 6')).toBeInTheDocument();
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Статус заявки'), 'REJECTED');
  expect(screen.getByText('Найдено заявок: 2')).toBeInTheDocument();
  const table = screen.getByRole('table', { name: 'Заявки компаний' });
  const inn = within(table).getAllByText(/ИНН/)[0].textContent!.replace('ИНН ', '');
  await user.type(screen.getByLabelText('Компания, ИНН или номер'), inn);
  expect(screen.getByText('Найдено заявок: 1')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Статус заявки'), 'APPROVED');
  expect(screen.getByRole('heading', { name: 'Заявок не найдено' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(screen.getByText('Найдено заявок: 6')).toBeInTheDocument();
});
it('сортирует суммы точно и переходит в адресуемое досье', async () => {
  const gateway = new MockGateway(); gateway.delayMs = 0; const bank = await gateway.login('underwriter', 'demo');
  const rows = (await gateway.queue(bank.token)).slice(0, 2);
  rows[0].amount = '9007199254740992.02'; rows[1].amount = '9007199254740992.01';
  vi.spyOn(gateway, 'queue').mockResolvedValue(rows);
  const { router } = await renderWorkspace('/bank/applications', { login: 'underwriter', gateway });
  await screen.findByText('Найдено заявок: 2');
  fireEvent.change(screen.getByLabelText('Сортировка очереди'), { target: { value: 'amountAsc' } });
  let links = within(screen.getByRole('table')).getAllByRole('link');
  expect(links[0]).toHaveAttribute('href', `/bank/applications/${rows[1].id}`);
  fireEvent.change(screen.getByLabelText('Сортировка очереди'), { target: { value: 'amountDesc' } });
  links = within(screen.getByRole('table')).getAllByRole('link');
  expect(links[0]).toHaveAttribute('href', `/bank/applications/${rows[0].id}`);
  await userEvent.setup().click(links[0]);
  expect(router.state.location.pathname).toBe(`/bank/applications/${rows[0].id}`);
  expect(screen.getByRole('heading', { name: 'Досье заявки' })).toBeInTheDocument();
});
it('ошибка скрывает таблицу, явный повтор восстанавливает очередь', async () => {
  const gateway = new MockGateway(); vi.spyOn(gateway, 'queue').mockRejectedValueOnce(new ApiError(503, 'DOWN', 'Очередь недоступна'));
  await renderWorkspace('/bank/applications', { login: 'underwriter', gateway });
  expect(await screen.findByRole('alert')).toHaveTextContent('Очередь недоступна');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByText('Найдено заявок: 6')).toBeInTheDocument();
});
it('403 скрывает ранее загруженные строки, клиент не читает очередь', async () => {
  const gateway = new MockGateway(); const queue = vi.spyOn(gateway, 'queue');
  const view = await renderWorkspace('/bank/applications', { login: 'underwriter', gateway });
  await screen.findByText('Найдено заявок: 6'); queue.mockRejectedValueOnce(new ApiError(403, 'NO_ACCESS', 'Нет доступа к очереди'));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Обновить очередь' }));
  await screen.findByRole('alert'); expect(screen.queryByRole('table')).not.toBeInTheDocument(); view.unmount(); queue.mockClear();
  await renderWorkspace('/bank/applications', { login: 'p1', gateway });
  await screen.findByRole('heading', { name: 'Нет доступа' }); expect(queue).not.toHaveBeenCalled();
});
it('показывает loading и пустую очередь', async () => {
  const gateway = new MockGateway();
  let finish!: (value: []) => void; vi.spyOn(gateway, 'queue').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await renderWorkspace('/bank/applications', { login: 'underwriter', gateway });
  expect(await screen.findByText('Загружаем очередь…')).toBeInTheDocument();
  await act(async () => { finish([]); });
  expect(await screen.findByRole('heading', { name: 'Заявок не найдено' })).toBeInTheDocument();
});
