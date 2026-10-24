import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { useRef, useState } from 'react';
import './feedback.css';

export interface ErrorBannerProps {
  message?: string | null;
  onRetry?: () => void | Promise<void>;
  pending?: boolean;
}

export function ErrorBanner({ message, onRetry, pending = false }: ErrorBannerProps) {
  const inFlight = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const busy = pending || retrying;

  async function retry() {
    if (!onRetry || pending || inFlight.current) return;
    inFlight.current = true;
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // Keep the owner's safe message; raw errors may contain private details.
    } finally {
      inFlight.current = false;
      setRetrying(false);
    }
  }

  if (!message?.trim()) return null;
  return (
    <div className="error-banner">
      <p role="alert" className="error-banner-message">{message}</p>
      {onRetry && <ButtonDesktop type="button" view="secondary" size={40} disabled={busy} onClick={() => { void retry(); }}>
        {busy ? 'Повторяем…' : 'Повторить'}
      </ButtonDesktop>}
      {busy && <span role="status" className="feedback-progress">Выполняется повторная попытка</span>}
    </div>
  );
}
