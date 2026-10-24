import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from './api/query-client';
import { SessionProvider } from './auth/session';

export function AppProviders({ children, onSessionExpired, queryClient, initialToken }: {
  children: ReactNode;
  onSessionExpired: () => void;
  queryClient?: QueryClient;
  initialToken?: string | null;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <SessionProvider onExpired={onSessionExpired} initialToken={initialToken}>
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
