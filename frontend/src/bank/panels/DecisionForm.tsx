import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError } from '../../api/errors';
import { useWorkspaceScope } from '../../api/queries';
import { recordValue } from '../../shared/components/RecordDetails';
import type { BankDossier } from '../../demo/gateway';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { MoneyText } from '../../shared/components/MoneyText';

interface Props {
  dossier: BankDossier;
}

export function DecisionForm({ dossier }: Props) {
  const scope = useWorkspaceScope();
  const cache = useQueryClient();
  const { application, allowedOutcomes, eligibleOffers, engineRecommendation } = dossier;

  const [selectedOutcome, setSelectedOutcome] = useState<'APPROVED' | 'COUNTER_OFFER' | 'REJECTED' | ''>(
    allowedOutcomes[0] ?? ''
  );
  const [selectedOfferId, setSelectedOfferId] = useState<string>(
    eligibleOffers[0]?.id ?? ''
  );
  const [comment, setComment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isSubmittingRef = useRef(false);

  if (application.status !== 'UNDERWRITING' || allowedOutcomes.length === 0) {
    return (
      <section className="workspace-card" aria-label="Форма решения андеррайтера">
        <h2>Решение андеррайтера</h2>
        <p className="muted">
          Решение по заявке уже принято (текущий статус: <strong>{application.status}</strong>).
          Ручное рассмотрение завершено.
        </p>
      </section>
    );
  }

  const isOverride = selectedOutcome !== '' && selectedOutcome !== engineRecommendation;
  const isPositive = selectedOutcome === 'APPROVED' || selectedOutcome === 'COUNTER_OFFER';
  const chosenOffer = eligibleOffers.find((o) => o.id === selectedOfferId);

  // Filter offers matching kind
  const filteredOffers = eligibleOffers.filter((o) => {
    if (selectedOutcome === 'APPROVED') return o.kind === 'REQUESTED';
    if (selectedOutcome === 'COUNTER_OFFER') return o.kind === 'LONGER_TERM' || o.kind === 'REDUCED_AMOUNT';
    return false;
  });

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const trimmed = comment.trim();
    if (!trimmed) {
      errors.comment = 'Укажите обязательный комментарий андеррайтера (от 1 до 2000 символов).';
    } else if (trimmed.length > 2000) {
      errors.comment = 'Комментарий не может превышать 2000 символов.';
    }

    if (!selectedOutcome) {
      errors.outcome = 'Выберите итоговое решение.';
    }

    if (isPositive && !filteredOffers.some((o) => o.id === selectedOfferId)) {
      errors.offerId = 'Выберите подходящее кредитное предложение.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleOpenConfirm(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);
    if (validate()) {
      setConfirmOpen(true);
    }
  }

  async function handleConfirmDecision() {
    if (isSubmittingRef.current || !selectedOutcome) return;
    isSubmittingRef.current = true;
    setPending(true);
    setGeneralError(null);

    try {
      await scope.gateway.decide(scope.token, application.id, {
        outcome: selectedOutcome,
        offerId: isPositive ? selectedOfferId : undefined,
        comment: comment.trim(),
        version: application.version,
      });

      // Invalidate relevant queries
      await Promise.all([
        cache.invalidateQueries({ queryKey: [...scope.key, 'bank-dossier', application.id] }),
        cache.invalidateQueries({ queryKey: [...scope.key, 'queue'] }),
        cache.invalidateQueries({ queryKey: [...scope.key, 'bank-metrics'] }),
        cache.invalidateQueries({ queryKey: ['workspace', scope.mode, scope.epoch] }),
      ]);
      setConfirmOpen(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // Version conflict or stage change: refetch dossier
          await cache.invalidateQueries({ queryKey: [...scope.key, 'bank-dossier', application.id] });
          setGeneralError('Заявка изменилась в другом окне. Данные обновлены, проверьте актуальный статус.');
        } else if (err.status === 422 && typeof err.details === 'object' && err.details !== null) {
          const extracted: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.details as Record<string, unknown>)) {
            if (typeof v === 'string') {
              extracted[k] = v;
            }
          }
          setFieldErrors(extracted);
          setGeneralError(err.message);
        } else {
          setGeneralError(err.message);
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Не удалось зафиксировать решение. Повторите попытку.');
      }
      setConfirmOpen(false);
    } finally {
      isSubmittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <section className="workspace-card" aria-label="Форма решения андеррайтера">
      <TitleDesktop tag="h2" view="medium" font="system" defaultMargins={false} style={{ marginBottom: 16 }}>
        Принятие ручного решения андеррайтера
      </TitleDesktop>
      <p className="page-description" style={{ marginBottom: 20 }}>
        Заявка находится на этапе ручного рассмотрения . Выберите исход, зафиксируйте предложение и внесите обязательное обоснование.
      </p>

      {generalError && <ErrorBanner message={generalError} />}

      <form className="application-form" onSubmit={handleOpenConfirm} noValidate>
        <fieldset>
          <legend>1. Итоговый вердикт</legend>
          <div className="outcome-options" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allowedOutcomes.map((outcome) => (
              <label key={outcome} className="consent-field" style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="outcome"
                  value={outcome}
                  checked={selectedOutcome === outcome}
                  onChange={() => {
                    setSelectedOutcome(outcome);
                    setFieldErrors((prev) => ({ ...prev, outcome: '' }));
                    // Auto-select first matching offer if switching to positive
                    if (outcome === 'APPROVED') {
                      const reqOffer = eligibleOffers.find((o) => o.kind === 'REQUESTED');
                      if (reqOffer) setSelectedOfferId(reqOffer.id);
                    } else if (outcome === 'COUNTER_OFFER') {
                      const counterOffer = eligibleOffers.find((o) => o.kind === 'LONGER_TERM' || o.kind === 'REDUCED_AMOUNT');
                      if (counterOffer) setSelectedOfferId(counterOffer.id);
                    }
                  }}
                />
                <div>
                  <strong>{recordValue(outcome)}</strong>
                  {outcome === 'APPROVED' && ' — Одобрить на запрошенных условиях'}
                  {outcome === 'COUNTER_OFFER' && ' — Сформировать встречное предложение (альтернатива)'}
                  {outcome === 'REJECTED' && ' — Отказать в выдаче кредита'}
                </div>
              </label>
            ))}
          </div>
          {fieldErrors.outcome && <p className="field-error">{fieldErrors.outcome}</p>}
        </fieldset>

        {isPositive && (
          <fieldset>
            <legend>2. Выбор кредитного предложения</legend>
            {filteredOffers.length === 0 ? (
              <p className="muted">Нет доступных предложений для выбранного исхода.</p>
            ) : (
              <div className="offers-grid">
                {filteredOffers.map((offer) => (
                  <label
                    key={offer.id}
                    className={`offer-card ${selectedOfferId === offer.id ? 'offer-card--selected' : ''}`}
                    style={{
                      cursor: 'pointer',
                      border: selectedOfferId === offer.id ? '2px solid #ef3124' : '1px solid #dcdfe3',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="radio"
                        name="offerId"
                        value={offer.id}
                        checked={selectedOfferId === offer.id}
                        onChange={() => {
                          setSelectedOfferId(offer.id);
                          setFieldErrors((prev) => ({ ...prev, offerId: '' }));
                        }}
                      />
                      <strong>
                        {offer.kind === 'REQUESTED' ? 'Запрошенные условия' : `Альтернатива (${offer.kind})`}
                      </strong>
                    </div>
                    <p style={{ margin: '4px 0' }}>Сумма: <strong><MoneyText value={offer.amount} /></strong></p>
                    <p style={{ margin: '4px 0' }}>Срок: <strong>{offer.term_months} мес.</strong></p>
                    <p style={{ margin: '4px 0' }}>Ставка: <strong>{offer.rate_pct}%</strong></p>
                    <p style={{ margin: '4px 0' }}>Ежемесячный платёж: <strong><MoneyText value={offer.monthly_payment} /></strong></p>
                    <p style={{ margin: '4px 0' }} className="muted">Переплата: <MoneyText value={offer.overpayment} /></p>
                  </label>
                ))}
              </div>
            )}
            {fieldErrors.offerId && <p className="field-error">{fieldErrors.offerId}</p>}
          </fieldset>
        )}

        <fieldset>
          <legend>3. Обоснование решения</legend>
          <label className="form-field">
            <span>Комментарий андеррайтера (обязательно от 1 до 2000 символов):</span>
            <textarea
              name="comment"
              rows={4}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: fieldErrors.comment ? '1px solid #b72920' : '1px solid #b9bec6',
                font: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
              }}
              value={comment}
              aria-invalid={Boolean(fieldErrors.comment)}
              placeholder="Укажите результаты проверки отчётности, контрактов или стоп-причин..."
              onChange={(e) => {
                setComment(e.target.value);
                setFieldErrors((prev) => ({ ...prev, comment: '' }));
              }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7380' }}>
            <span>{fieldErrors.comment ? <span className="field-error">{fieldErrors.comment}</span> : 'Комментарий будет зафиксирован в аудите.'}</span>
            <span>{comment.trim().length} / 2000</span>
          </div>
        </fieldset>

        {isOverride && (
          <div
            className="override-warning"
            style={{
              padding: '16px',
              backgroundColor: '#fff4e6',
              borderLeft: '4px solid #e4791a',
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <strong>Изменение рекомендации:</strong> Выбранный исход (<strong>{recordValue(selectedOutcome)}</strong>) отличается от рекомендации скорингового ядра (<strong>{recordValue(engineRecommendation)}</strong>). Переопределение будет явно зафиксировано в журнале аудита.
          </div>
        )}

        <div className="form-actions">
          <ButtonDesktop
            type="submit"
            view="primary"
            size={48}
            disabled={pending || !selectedOutcome}
          >
            Подтвердить решение
          </ButtonDesktop>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Подтверждение кредитного решения"
        description={
          `Вы уверены, что хотите зафиксировать решение «${recordValue(selectedOutcome)}»? ${
            isPositive && chosenOffer
              ? `Выбранные условия: ${chosenOffer.amount} ₽ на ${chosenOffer.term_months} мес. под ${chosenOffer.rate_pct}%. `
              : ''
          }${
            isOverride
              ? `Внимание: Действие приведёт к переопределению автоматической рекомендации ядра (${recordValue(engineRecommendation)} → ${recordValue(selectedOutcome)}). `
              : ''
          }Комментарий: «${comment.trim()}»`
        }
        confirmLabel="Зафиксировать решение"
        pending={pending}
        onConfirm={handleConfirmDecision}
        onCancel={() => { if (!pending) setConfirmOpen(false); }}
      />

    </section>
  );
}
