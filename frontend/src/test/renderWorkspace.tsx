import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from '../App';
import { routes } from '../router';
import { AuthProvider } from '../auth/AuthProvider';
import { AppLayout } from '../shared/components/AppLayout';
import { DemoControls } from '../demo/DemoControls';

export const diagnosticRoutes = routes.map((route) => ({ ...route, element: <AuthProvider><DemoControls /><AppLayout /></AuthProvider> }));
import { MockGateway, type DataMode } from '../demo/gateway';
import { createQueryClient } from '../api/query-client';

export async function renderWorkspace(path = '/login', options: { login?: string; gateway?: MockGateway; mode?: DataMode; diagnostics?: boolean } = {}) {
  const gateway = options.gateway ?? new MockGateway(); gateway.delayMs = 0;
  const token = options.login ? (await gateway.login(options.login, 'demo')).token : null;
  const client = createQueryClient(); const router = createMemoryRouter(options.diagnostics ? diagnosticRoutes : routes, { initialEntries: [path] });
  const view = render(<AppProviders queryClient={client} mockGateway={gateway} initialToken={token} initialMode={options.mode ?? 'mock'} onSessionExpired={() => { void router.navigate('/login', { replace: true }); }}><RouterProvider router={router} /></AppProviders>);
  return { ...view, gateway, router, client, token };
}
