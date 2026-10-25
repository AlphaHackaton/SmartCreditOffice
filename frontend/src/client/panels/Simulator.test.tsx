import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { decisionScenario } from '../../test/decisionScenario';
import { renderWorkspace } from '../../test/renderWorkspace';

it('показывает контроффер и ограничение, симуляция не меняет заявку', async () => {
  const { gateway, record } = await decisionScenario('p2');
  await renderWorkspace(`/client/applications/${record.id}`, { login: 'p2', gateway });
  expect(await screen.findByRole('heading', { name: 'Встречное предложение' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Прогноз: Встречное предложение' })).toBeInTheDocument();
  expect(screen.getAllByText(/ограничивает сумму/).length).toBeGreaterThan(0);
  const simulate = vi.spyOn(gateway, 'simulate');
  fireEvent.change(screen.getByLabelText('Сумма для симуляции'), { target: { value: '1234567' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('нет демо-расчёта');
  expect(simulate).toHaveBeenCalledTimes(1);
});
it('debounce 300 мс отправляет только последнее значение и скрывает старый прогноз', async () => {
  const { gateway, record } = await decisionScenario('p2');
  const view = await renderWorkspace(`/client/applications/${record.id}`, { login: 'p2', gateway });
  await screen.findByRole('heading', { name: 'Прогноз: Встречное предложение' });
  const simulate = vi.spyOn(gateway, 'simulate');
  vi.useFakeTimers();
  try {
    fireEvent.change(screen.getByLabelText('Сумма для симуляции'), { target: { value: '1000000' } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    fireEvent.change(screen.getByLabelText('Сумма для симуляции'), { target: { value: '300000' } });
    expect(screen.queryByRole('heading', { name: /Прогноз:/ })).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(299)); expect(simulate).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(50)); expect(simulate).toHaveBeenCalledTimes(1);
    expect(simulate.mock.calls[0][2]).toBe('300000');
  } finally { view.unmount(); vi.useRealTimers(); }
});
it('поздний ответ старых условий не заменяет актуальный результат', async () => {
  const { gateway, record } = await decisionScenario('p2');
  await renderWorkspace(`/client/applications/${record.id}`, { login: 'p2', gateway });
  await screen.findByRole('heading', { name: 'Прогноз: Встречное предложение' });
  const original = gateway.simulate.bind(gateway); let aborted = false;
  vi.spyOn(gateway, 'simulate').mockImplementation(async (...args) => {
    if (args[2] === '1234567') {
      args[4]?.addEventListener('abort', () => { aborted = true; });
      await new Promise((r) => setTimeout(r, 500));
    }
    return original(...args);
  });
  fireEvent.change(screen.getByLabelText('Сумма для симуляции'), { target: { value: '1234567' } });
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.change(screen.getByLabelText('Сумма для симуляции'), { target: { value: record.amount } });
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Прогноз: Встречное предложение' })).toBeInTheDocument());
  await act(async () => { await new Promise((r) => setTimeout(r, 550)); });
  expect(aborted).toBe(true); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
