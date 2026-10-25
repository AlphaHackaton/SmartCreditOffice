import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from '../App';
import { routes } from '../router';
import { MockGateway, type DataMode } from '../demo/gateway';
import { createQueryClient } from '../api/query-client';

export async function renderWorkspace(path = '/login', options: { login?: string; gateway?: MockGateway; mode?: DataMode } = {}) {
  const gateway = options.gateway ?? new MockGateway(); gateway.delayMs = 0;
  const token = options.login ? (await gateway.login(options.login, 'demo')).token : null;
  const client = createQueryClient(); const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<AppProviders queryClient={client} mockGateway={gateway} initialToken={token} initialMode={options.mode ?? 'mock'} onSessionExpired={() => { void router.navigate('/login', { replace: true }); }}><RouterProvider router={router} /></AppProviders>);
  return { ...view, gateway, router, client, token };
}
