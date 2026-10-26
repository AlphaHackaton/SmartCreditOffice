import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWorkspace } from '../test/renderWorkspace';
import { MockGateway } from '../demo/gateway';

describe('Кредитное досье андеррайтера (DossierPage)', () => {
  it('открывает досье seed-p1_ideal с трассой, баллами, снимками и сверкой replay', async () => {
    const user = userEvent.setup();
    await renderWorkspace('/bank/applications/seed-p1_ideal', { login: 'underwriter' });

    await screen.findByRole('heading', { name: 'Досье заявки', level: 1 });
    expect(screen.getByText(/ИП · 770123456703/i)).toBeInTheDocument();
    expect(screen.getByText(/КРЕДИТНОЕ ДОСЬЕ ЗАЯВКИ № seed-p1_ideal/i)).toBeInTheDocument();
    expect(screen.getAllByText('Одобрено').length).toBeGreaterThan(0);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText(/Снимки входных данных и расчетные метрики/i)).toBeInTheDocument();
    expect(screen.getByText(/Скоринговая трасса и правила/i)).toBeInTheDocument();
    expect(screen.getByText(/M1/)).toBeInTheDocument();

    // Replay сверка
    const replayBtn = screen.getByRole('button', { name: /Проверить расчёт/i });
    await user.click(replayBtn);
    await screen.findByText(/Сверка успешна:/i);
  });

  it('открывает досье seed-p4_overdue со стоп-фактором и без выдуманных баллов', async () => {
    await renderWorkspace('/bank/applications/seed-p4_overdue', { login: 'underwriter' });

    await screen.findByRole('heading', { name: 'Досье заявки', level: 1 });
    expect(screen.getByText(/ИП · 770234567818/i)).toBeInTheDocument();
    expect(screen.getAllByText('Отказ').length).toBeGreaterThan(0);
    expect(screen.getByText(/— \(стоп-фактор \/ knockout\)/i)).toBeInTheDocument();
    expect(screen.getByText(/KO_BKI_CURRENT_OVERDUE/i)).toBeInTheDocument();
    expect(screen.getByText(/Решение по заявке уже принято/i)).toBeInTheDocument();
  });


  it('в досье seed-p6_mismatch валидирует ввод, фиксирует решение и сохраняет запись аудита', async () => {
    const user = userEvent.setup();
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    await renderWorkspace('/bank/applications/seed-p6_mismatch', { login: 'underwriter', gateway });

    await screen.findByRole('heading', { name: 'Досье заявки', level: 1 });
    expect(screen.getByText(/ООО · 7706789012/i)).toBeInTheDocument();
    expect(screen.getAllByText('Ручное рассмотрение').length).toBeGreaterThan(0);

    // Валидация комментария
    const submitBtn = screen.getByRole('button', { name: 'Подтвердить решение' });
    await user.click(submitBtn);
    await screen.findByText(/Укажите обязательный комментарий андеррайтера/i);

    // Ввод комментария
    const commentInput = screen.getByPlaceholderText(/Укажите результаты проверки отчётности/i);
    await user.type(commentInput, 'Обороты по счёту проверены, расхождения обоснованы сезонными контрактами');

    // Клик подтвердить решение -> модальное окно ConfirmDialog
    await user.click(submitBtn);
    await screen.findByRole('heading', { name: 'Подтверждение кредитного решения' });

    // Подтверждение в диалоге
    const confirmBtn = screen.getByRole('button', { name: 'Зафиксировать решение' });
    await user.click(confirmBtn);

    // Статус меняется на Одобрено
    await waitFor(() => {
      expect(screen.getAllByText('Одобрено').length).toBeGreaterThan(0);
    });

    // В аудите появляется запись
    expect(screen.getByText(/«Обороты по счёту проверены, расхождения обоснованы сезонными контрактами»/i)).toBeInTheDocument();
  });

  it('клиент P6 не имеет доступа к банковскому досье напрямую', async () => {
    await renderWorkspace('/bank/applications/seed-p6_mismatch', { login: 'p6' });
    await screen.findByRole('heading', { name: 'Нет доступа' });
    expect(screen.queryByText(/КРЕДИТНОЕ ДОСЬЕ ЗАЯВКИ/i)).not.toBeInTheDocument();
  });


  it('сквозной путь: клиент подаёт заявку P6 → банк одобряет → клиент принимает оффер, подписывает и получает выдачу', async () => {
    let now = Date.parse('2026-10-25T10:00:00Z');
    const gateway = new MockGateway(() => now);
    gateway.delayMs = 0;

    // 1. Клиент P6 логинится и подаёт заявку
    const clientLogin = await gateway.login('p6', 'demo');
    const draft = await gateway.save(clientLogin.token, {
      productCode: 'CAPEX',
      amount: '3000000.00',
      termMonths: 24,
      purpose: 'EQUIPMENT',
      consents: ['BKI_REQUEST', 'PD_PROCESSING'],
    });
    const submitted = await gateway.submit(clientLogin.token, draft.id, draft.version);
    expect(submitted.status).toBe('SUBMITTED');

    // Время идёт, статус переходит в UNDERWRITING
    now += 5000;
    const underReview = await gateway.application(clientLogin.token, draft.id);
    expect(underReview.status).toBe('UNDERWRITING');

    // 2. Сотрудник банка логинится и открывает досье
    const bankLogin = await gateway.login('underwriter', 'demo');
    const dossier = await gateway.dossier(bankLogin.token, draft.id);
    expect(dossier.application.status).toBe('UNDERWRITING');
    expect(dossier.allowedOutcomes).toContain('APPROVED');

    // Сотрудник банка выносит решение APPROVED
    const decided = await gateway.decide(bankLogin.token, draft.id, {
      outcome: 'APPROVED',
      offerId: dossier.eligibleOffers[0].id,
      comment: 'Обороты подтверждены договорами лизинга оборудования',
      version: dossier.application.version,
    });
    expect(decided.application.status).toBe('APPROVED');

    // 3. Клиент обновляет заявку: статус APPROVED, доступен оффер
    const clientApp = await gateway.application(clientLogin.token, draft.id);
    expect(clientApp.status).toBe('APPROVED');
    expect(clientApp.decision?.offers).toHaveLength(1);
    const offerId = clientApp.decision!.offers[0].id;

    // Клиент принимает оффер
    const accepted = await gateway.accept(clientLogin.token, draft.id, clientApp.version, offerId);
    expect(accepted.status).toBe('SIGNING');

    // Клиент получает код и подписывает
    const challenge = await gateway.challenge(clientLogin.token, draft.id);
    const signed = await gateway.sign(clientLogin.token, draft.id, accepted.version, challenge.id, challenge.code);
    expect(signed.status).toBe('SIGNED');

    // Через 1.5 секунды статус переходит в DISBURSED
    now += 1500;
    const disbursed = await gateway.application(clientLogin.token, draft.id);
    expect(disbursed.status).toBe('DISBURSED');
  });

  it('обязательный review-вариант P6 CAPEX 6 млн / 24 мес допускает только COUNTER_OFFER', async () => {
    let now = Date.parse('2026-10-25T10:00:00Z');
    const gateway = new MockGateway(() => now);
    gateway.delayMs = 0;

    // Клиент P6 подаёт заявку на 6 млн (превышение DSCR)
    const clientLogin = await gateway.login('p6', 'demo');
    const draft = await gateway.save(clientLogin.token, {
      productCode: 'CAPEX',
      amount: '6000000.00',
      termMonths: 24,
      purpose: 'EQUIPMENT',
      consents: ['BKI_REQUEST', 'PD_PROCESSING'],
    });
    await gateway.submit(clientLogin.token, draft.id, draft.version);
    now += 5000;

    // Банк открывает досье
    const bankLogin = await gateway.login('underwriter', 'demo');
    const dossier = await gateway.dossier(bankLogin.token, draft.id);
    expect(dossier.application.status).toBe('UNDERWRITING');
    // APPROVED запрещён политикой DSCR, разрешены только COUNTER_OFFER и REJECTED
    expect(dossier.allowedOutcomes).toEqual(['COUNTER_OFFER', 'REJECTED']);
    expect(dossier.eligibleOffers).toHaveLength(2);

    // Попытка вынести APPROVED отклоняется
    await expect(gateway.decide(bankLogin.token, draft.id, {
      outcome: 'APPROVED',
      comment: 'Попытка обойти ограничение DSCR',
      version: dossier.application.version,
    })).rejects.toMatchObject({ status: 422 });

    // Успешный контроффер (срез суммы или увеличение срока)
    const counterDecided = await gateway.decide(bankLogin.token, draft.id, {
      outcome: 'COUNTER_OFFER',
      offerId: dossier.eligibleOffers[0].id,
      comment: 'Согласована альтернатива с удлинением срока для соблюдения норматива DSCR',
      version: dossier.application.version,
    });
    expect(counterDecided.application.status).toBe('COUNTER_OFFER');

    // Клиент видит альтернативу и может её принять
    const clientApp = await gateway.application(clientLogin.token, draft.id);
    expect(clientApp.status).toBe('COUNTER_OFFER');
    expect(clientApp.decision?.offers).toHaveLength(1);
  });
});
