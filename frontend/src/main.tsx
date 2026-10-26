import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from './App';
import { routes } from './router';
import '@alfalab/core-components-vars/index.css';
import './shared/styles.css';

const router = createBrowserRouter(routes);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders initialMode={import.meta.env.VITE_DATA_MODE === 'mock' ? 'mock' : 'api'} onSessionExpired={() => { void router.navigate('/login', { replace: true }); }}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
