import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { TitleDesktop } from '@alfalab/core-components-typography/esm';
import { useEffect, useId, useRef, useState } from 'react';
import './feedback.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Отмена', pending = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || submitting;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current!;
    const initiator = document.activeElement;
    setError(null);
    dialog.showModal();
    if (cancelRef.current && !cancelRef.current.disabled) cancelRef.current.focus();
    else dialog.focus();
    return () => {
      dialog.close();
      if (initiator instanceof HTMLElement && initiator.isConnected) initiator.focus();
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (busy) dialog.focus();
    else if (document.activeElement === dialog) cancelRef.current?.focus();
  }, [open, busy]);

  function cancel() {
    if (!pending && !inFlight.current) onCancel();
  }

  async function confirm() {
    if (!open || pending || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Не удалось выполнить действие. Попробуйте ещё раз.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="confirm-dialog" tabIndex={-1} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy}
      onCancel={(event) => { event.preventDefault(); cancel(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        // Native modality blocks the page, but Tab can still reach browser chrome.
        if (busy) { event.preventDefault(); dialogRef.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === cancelRef.current || document.activeElement === dialogRef.current)) {
          event.preventDefault(); confirmRef.current?.focus();
        } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
          event.preventDefault(); cancelRef.current?.focus();
        }
      }}>
      <TitleDesktop tag="h2" view="small" font="system" defaultMargins={false} id={`${id}-title`}>{title}</TitleDesktop>
      <p className="confirm-dialog-description" id={`${id}-description`}>{description}</p>
      {error && <p role="alert" className="confirm-dialog-error">{error}</p>}
      {busy && <p role="status" className="feedback-progress">Выполняется действие…</p>}
      <div className="confirm-dialog-actions">
        <ButtonDesktop ref={cancelRef} type="button" view="secondary" size={48} disabled={busy} onClick={cancel}>{cancelLabel}</ButtonDesktop>
        <ButtonDesktop ref={confirmRef} type="button" view="primary" size={48} disabled={busy} onClick={() => { void confirm(); }}>{confirmLabel}</ButtonDesktop>
      </div>
    </dialog>
  );
}
