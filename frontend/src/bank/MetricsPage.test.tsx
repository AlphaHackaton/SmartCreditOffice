import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { MockGateway } from '../demo/gateway';
import { renderWorkspace } from '../test/renderWorkspace';

describe('MetricsPage UI', () => {
  it('рендерит начальные KPI карточки и распределения для сотрудника банка', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/metrics', { login: 'underwriter', gateway });

    expect(await screen.findByRole('heading', { level: 1, name: 'Метрики конвейера' })).toBeInTheDocument();
    expect(screen.getByText(/Синтетические демо-показатели/)).toBeInTheDocument();

    // Ждём загрузки данных метрик
    const totalCard = await screen.findByLabelText('Всего заявок');
    expect(within(totalCard).getByText('6')).toBeInTheDocument();
    expect(screen.getByText(/Europe\/Moscow/)).toBeInTheDocument();

    const submittedCard = screen.getByLabelText('Подано заявок');
    expect(within(submittedCard).getByText('6')).toBeInTheDocument();

    const decidedCard = screen.getByLabelText('Принято решений');
    expect(within(decidedCard).getByText('5')).toBeInTheDocument();

    const awaitingCard = screen.getByLabelText('Ожидают решения');
    expect(within(awaitingCard).getByText('1')).toBeInTheDocument();

    const stpCard = screen.getByLabelText('Уровень автоматизации (STP)');
    expect(within(stpCard).getByText('100.0 %')).toBeInTheDocument();

    // Distributions
    expect(screen.getByRole('heading', { name: 'Распределение по текущим статусам' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Распределение по принятым решениям' })).toBeInTheDocument();
  });

  it('валидирует диапазон дат в фильтрах и показывает ошибку', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/metrics', { login: 'underwriter', gateway });

    await screen.findByRole('heading', { level: 1, name: 'Метрики конвейера' });
    const user = userEvent.setup();

    // Вводим дату начала позже даты окончания
    const fromInput = screen.getByLabelText('Дата создания с');
    const toInput = screen.getByLabelText('Дата создания по');
    fireEvent.change(fromInput, { target: { value: '2026-10-26' } });
    fireEvent.change(toInput, { target: { value: '2026-10-25' } });

    await user.click(screen.getByRole('button', { name: 'Применить' }));

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent(/Дата начала не может быть позже/);
  });

  it('применяет фильтры и обновляет URL, сброс возвращает к исходному состоянию', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { router } = await renderWorkspace('/bank/metrics', { login: 'underwriter', gateway });

    await screen.findByRole('heading', { level: 1, name: 'Метрики конвейера' });
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Продукт метрик'), 'WC_FLEX');
    await user.click(screen.getByRole('button', { name: 'Применить' }));

    expect(router.state.location.search).toContain('product=WC_FLEX');

    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getByLabelText('Продукт метрик')).toHaveValue('');
  });

  it('drilldown из распределения переходит в очередь с сохранением фильтра и совпадением количества', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { router } = await renderWorkspace('/bank/metrics', { login: 'underwriter', gateway });

    await screen.findByLabelText('Всего заявок');
    const user = userEvent.setup();

    // Находим ссылку перехода для статуса UNDERWRITING
    const drillLink = screen.getByRole('link', { name: /Показать Ручное рассмотрение в очереди/ });
    await user.click(drillLink);

    expect(router.state.location.pathname).toBe('/bank/applications');
    expect(router.state.location.search).toBe('?status=UNDERWRITING');
    expect(await screen.findByText('Найдено заявок: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Статус заявки')).toHaveValue('UNDERWRITING');
  });

  it('обрабатывает пустое состояние выборки без NaN/Infinity', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    // Фильтруем по датам в прошлом, где нет заявок
    await renderWorkspace('/bank/metrics?from=2025-01-01&to=2025-01-02', { login: 'underwriter', gateway });

    expect(await screen.findByRole('heading', { name: 'Нет заявок в когорте' })).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });

  it('ошибка загрузки показывает ErrorBanner и кнопку повтора', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    vi.spyOn(gateway, 'metrics').mockRejectedValueOnce(new ApiError(503, 'SERVICE_UNAVAILABLE', 'Сервис метрик временно недоступен'));

    await renderWorkspace('/bank/metrics', { login: 'underwriter', gateway });

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервис метрик временно недоступен');
    expect(screen.queryByLabelText('Всего заявок')).not.toBeInTheDocument();

    // Повторить запрос
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByLabelText('Всего заявок')).toBeInTheDocument();
  });

  it('клиент не имеет доступа к метрикам конвейера', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/metrics', { login: 'p1', gateway });

    expect(await screen.findByRole('heading', { name: 'Нет доступа' })).toBeInTheDocument();
    expect(screen.queryByText('Метрики конвейера')).not.toBeInTheDocument();
  });

  it('ручное решение по P6 и сброс согласованы с метриками', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { token } = await gateway.login('underwriter', 'demo');

    // Принимаем решение по P6
    const dossier = await gateway.dossier(token, 'seed-p6_mismatch');
    await gateway.decide(token, 'seed-p6_mismatch', {
      outcome: 'APPROVED',
      offerId: dossier.eligibleOffers[0].id,
      comment: 'Одобрено андеррайтером',
      version: dossier.application.version,
    });

    await renderWorkspace('/bank/metrics', { login: 'underwriter', gateway });

    const decidedCard = await screen.findByLabelText('Принято решений');
    expect(within(decidedCard).getByText('6')).toBeInTheDocument();

    const awaitingCard = screen.getByLabelText('Ожидают решения');
    expect(within(awaitingCard).getByText('0')).toBeInTheDocument();

    const stpCard = screen.getByLabelText('Уровень автоматизации (STP)');
    expect(within(stpCard).getByText('83.3 %')).toBeInTheDocument();
  });
});
