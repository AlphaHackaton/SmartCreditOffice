import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSession } from '../auth/session';
import { createApiClient, type ApiClient } from './client';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken, expire } = useSession();
  const client = useMemo(() => createApiClient({ getToken, onUnauthorized: expire }), [getToken, expire]);
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApiClient требует ApiProvider');
  return client;
}
