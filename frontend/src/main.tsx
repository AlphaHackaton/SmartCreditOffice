import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders onSessionExpired={() => window.location.assign('/login')}>
      <h1>Кредитный кабинет предпринимателя</h1>
    </AppProviders>
  </StrictMode>,
);
