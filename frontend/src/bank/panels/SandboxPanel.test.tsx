import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MockGateway } from '../../demo/gateway';
import { renderWorkspace } from '../../test/renderWorkspace';

describe('SandboxPanel component', () => {
  it('загружает и отображает все селекторы каталога песочницы для сотрудника банка', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/sandbox', { login: 'underwriter', gateway });

    expect(await screen.findByRole('heading', { level: 1, name: 'Анализ условий' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Компания')).toBeInTheDocument();
    expect(screen.getByLabelText('Обороты по счёту')).toBeInTheDocument();
    expect(screen.getByLabelText('Кредитная история')).toBeInTheDocument();
    expect(screen.getByLabelText('Возраст бизнеса')).toBeInTheDocument();
    expect(screen.getByLabelText('Кредитная политика')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Исходный снимок' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сравнить политики' })).toBeInTheDocument();
  });

  it('выполняет синтетический расчёт и отображает результаты скоринга', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/sandbox', { login: 'underwriter', gateway });

    await screen.findByRole('heading', { level: 1, name: 'Анализ условий' });
    await screen.findByLabelText('Компания');

    // Нажимаем «Рассчитать»
    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));

    // Появляется секция с результатами скоринга
    expect(await screen.findByRole('region', { name: 'Результат расчёта' })).toBeInTheDocument();
    expect(screen.getByText(/Маршрут:/)).toBeInTheDocument();
    expect(screen.queryByText(/Hash входов:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hash решения:/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Кредитные предложения/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Ограничения суммы кредита/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Факторы оценки/ })).toBeInTheDocument();
    expect(screen.getByText(/Предварительный расчёт/)).toBeInTheDocument();
  });

  it('вычисляет исходный baseline-снимок при нажатии на соответствующую кнопку', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/sandbox', { login: 'underwriter', gateway });

    await screen.findByRole('heading', { level: 1, name: 'Анализ условий' });
    await screen.findByLabelText('Компания');

    await user.click(screen.getByRole('button', { name: 'Исходный снимок' }));

    expect(await screen.findByText('Исходные данные')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Результат расчёта' })).toBeInTheDocument();
  });

  it('сравнивает 3 кредитные политики для выбранного снимка', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/sandbox', { login: 'underwriter', gateway });

    await screen.findByRole('heading', { level: 1, name: 'Анализ условий' });
    await screen.findByLabelText('Компания');

    // Включаем сравнение политик
    await user.click(screen.getByRole('button', { name: 'Сравнить политики' }));

    expect(await screen.findByRole('region', { name: 'Сравнение политик' })).toBeInTheDocument();
    expect(screen.getByText('Сниженная (-2 п.п.)')).toBeInTheDocument();
    expect(screen.getByText('Базовая политика')).toBeInTheDocument();
    expect(screen.getByText('Повышенная (+2 п.п.)')).toBeInTheDocument();
    expect(screen.getByText('14.50%')).toBeInTheDocument();
    expect(screen.getAllByText('16.50%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('18.50%')).toBeInTheDocument();
  });

  it('показывает ошибку при выборе стоп-фактора просрочки и отсутствие предложений', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/sandbox', { login: 'underwriter', gateway });

    await screen.findByRole('heading', { level: 1, name: 'Анализ условий' });
    await screen.findByLabelText('Компания');

    // Выбираем просрочку 45 дней
    const overdueSelect = screen.getByLabelText('Кредитная история');
    fireEvent.change(overdueSelect, { target: { value: '45' } });

    await user.click(screen.getByRole('button', { name: 'Рассчитать' }));

    expect(await screen.findByRole('region', { name: 'Результат расчёта' })).toBeInTheDocument();
    expect(screen.getByText(/Предложения отсутствуют из-за стоп-факторов/)).toBeInTheDocument();
    expect(screen.getAllByText('BKI_CURRENT_OVERDUE').length).toBeGreaterThanOrEqual(1);
  });

  it('блокирует доступ клиенту к песочнице', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/sandbox', { login: 'p1', gateway });

    // Должна появиться заглушка «Нет доступа»
    expect(await screen.findByRole('heading', { name: 'Нет доступа' })).toBeInTheDocument();
  });
});
