import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MockGateway } from './gateway';
import { renderWorkspace } from '../test/renderWorkspace';

describe('DemoControls component', () => {
  it('рендерит основные элементы управления демо в mock-режиме', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/login', { gateway, diagnostics: true });

    expect(screen.getByLabelText('Режим данных')).toBeInTheDocument();
    expect(screen.getByLabelText('Демо-сценарий')).toBeInTheDocument();
    expect(screen.getByLabelText('Задержка демо')).toBeInTheDocument();
    expect(screen.getByLabelText('Тип операции')).toBeInTheDocument();
    expect(screen.getByLabelText('Цель сбоя')).toBeInTheDocument();
    expect(screen.getByLabelText('Статус сбоя')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запланировать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сбросить демо' })).toBeInTheDocument();
  });

  it('показывает описание активного сценария и подсказку входа', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/login', { gateway, diagnostics: true });

    expect(screen.getByLabelText('Описание текущего сценария')).toBeInTheDocument();
    expect(screen.getByText(/Старт: DRAFT/)).toBeInTheDocument();
    expect(screen.getByText(/Вход:/)).toBeInTheDocument();
  });

  it('загружает сценарий напрямую, когда пользователь не авторизован', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/login', { gateway, diagnostics: true });

    const scenarioSelect = screen.getByLabelText('Демо-сценарий');
    fireEvent.change(scenarioSelect, { target: { value: 'p1-approved' } });

    expect(gateway.getActiveScenarioId()).toBe('p1-approved');
    expect(screen.getByText(/Загружен сценарий: P1: Одобрено/)).toBeInTheDocument();
  });

  it('запрашивает подтверждение при смене сценария авторизованным пользователем', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { router } = await renderWorkspace('/client', { login: 'p1', gateway, diagnostics: true });

    // Ждём завершения авторизации и загрузки кабинета
    await screen.findByRole('heading', { name: 'Кабинет предпринимателя' });

    const scenarioSelect = screen.getByLabelText('Демо-сценарий');
    fireEvent.change(scenarioSelect, { target: { value: 'p2-counter' } });

    // Появляется диалог подтверждения
    expect(await screen.findByRole('heading', { name: 'Сменить демо-сценарий?' })).toBeInTheDocument();

    // Нажимаем Отмена — сценарий не изменился
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(gateway.getActiveScenarioId()).toBe('factory');

    // Снова выбираем другой сценарий и подтверждаем
    fireEvent.change(scenarioSelect, { target: { value: 'p2-counter' } });
    await user.click(await screen.findByRole('button', { name: 'Сменить сценарий' }));

    expect(gateway.getActiveScenarioId()).toBe('p2-counter');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('планирует адресный сбой и позволяет отменить его', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/login', { gateway, diagnostics: true });

    // Планируем сбой sign -> 422
    await user.click(screen.getByRole('button', { name: 'Запланировать' }));

    expect(gateway.getPendingFailures().command?.target).toBe('sign');
    expect(gateway.getPendingFailures().command?.variant).toBe(422);
    expect(screen.getByText(/Ожидает: command:sign → 422/)).toBeInTheDocument();

    // Отменяем сбой
    await user.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(gateway.getPendingFailures().command).toBeNull();
    expect(screen.getByText('Ожидающие сбои отменены.')).toBeInTheDocument();
  });

  it('сбрасывает демонстрацию через диалог подтверждения', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { router } = await renderWorkspace('/client', { login: 'p1', gateway, diagnostics: true });

    await screen.findByRole('heading', { name: 'Кабинет предпринимателя' });
    await user.click(screen.getByRole('button', { name: 'Сбросить демо' }));

    expect(await screen.findByRole('heading', { name: 'Сбросить демонстрацию?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(gateway.getActiveScenarioId()).toBe('factory');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('показывает кнопку Песочница скоринга для сотрудника банка', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const { router } = await renderWorkspace('/bank/applications', { login: 'underwriter', gateway, diagnostics: true });

    await screen.findByRole('heading', { level: 1, name: 'Очередь заявок' });

    const sandboxBtn = await screen.findByRole('button', { name: 'Песочница скоринга' });
    expect(sandboxBtn).toBeInTheDocument();

    await user.click(sandboxBtn);
    expect(router.state.location.pathname).toBe('/bank/sandbox');
  });

  it('скрывает элементы mock-управления при переключении в API-режим', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/login', { gateway, mode: 'api', diagnostics: true });

    expect(screen.getByLabelText('Режим данных')).toBeInTheDocument();
    expect(screen.queryByLabelText('Демо-сценарий')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Задержка демо')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сбросить демо' })).not.toBeInTheDocument();
  });
});
