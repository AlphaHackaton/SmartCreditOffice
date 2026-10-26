import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface Session {
  token: string | null;
  getToken: () => string | null;
  setToken: (token: string | null) => void;
  expire: (requestToken: string | null) => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children, onExpired, initialToken = null }: {
  children: ReactNode;
  onExpired: () => void;
  initialToken?: string | null;
}) {
  const queryClient = useQueryClient();
  const [token, updateToken] = useState(initialToken);
  const tokenRef = useRef(token);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const getToken = useCallback(() => tokenRef.current, []);
  const setToken = useCallback((next: string | null) => {
    if (next !== tokenRef.current) {
      void queryClient.cancelQueries();
      queryClient.clear();
    }
    tokenRef.current = next;
    updateToken(next);
  }, [queryClient]);
  const expire = useCallback((requestToken: string | null) => {
    // A late response from a previous session must not sign out the new user.
    if (requestToken !== tokenRef.current) return;
    setToken(null);
    // Public requests can also receive 401; always clear the cache in that case.
    void queryClient.cancelQueries();
    queryClient.clear();
    onExpiredRef.current();
  }, [queryClient, setToken]);
  const value = useMemo(() => ({ token, getToken, setToken, expire }), [token, getToken, setToken, expire]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession требует SessionProvider');
  return session;
}
