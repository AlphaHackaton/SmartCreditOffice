import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from './api/query-client';
import { ApiProvider } from './api/provider';
import { SessionProvider } from './auth/session';
import { WorkspaceProvider } from './demo/provider';
import type { DataMode, MockGateway } from './demo/gateway';

export function AppProviders({ children, onSessionExpired, queryClient, initialToken, mockGateway, initialMode }: {
  children: ReactNode;
  onSessionExpired: () => void;
  queryClient?: QueryClient;
  initialToken?: string | null;
  mockGateway?: MockGateway;
  initialMode?: DataMode;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <SessionProvider onExpired={onSessionExpired} initialToken={initialToken}>
        <ApiProvider><WorkspaceProvider mockGateway={mockGateway} initialMode={initialMode}>{children}</WorkspaceProvider></ApiProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
