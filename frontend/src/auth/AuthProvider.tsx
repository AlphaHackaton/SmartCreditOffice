import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useSession } from './session';
import { useWorkspace } from '../demo/provider';
import { ApiError } from '../api/errors';
import type { User } from '../demo/gateway';

interface Auth { user: User | undefined; loading: boolean; error: Error | null; retry: () => void; login: (login: string, password: string) => Promise<User>; logout: () => void }
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { token, setToken } = useSession(); const workspace = useWorkspace(); const client = useQueryClient(); const sequence = useRef(0);
  const me = useQuery({ queryKey: ['me', workspace.mode, workspace.epoch, token], queryFn: ({ signal }) => workspace.gateway.me(token!, signal), enabled: Boolean(token), staleTime: Infinity });
  async function login(login: string, password: string) {
    const attempt = ++sequence.current; const generation = workspace.generation();
    const result = await workspace.gateway.login(login, password); const user = await workspace.gateway.me(result.token);
    if (attempt !== sequence.current || generation !== workspace.generation()) {
      if (workspace.mode === 'mock') void workspace.mock.logout(result.token);
      throw new ApiError(null, 'STALE_LOGIN', 'Попытка входа отменена. Повторите вход.');
    }
    if (user.role !== 'client' && user.role !== 'bank') throw new ApiError(403, 'UNKNOWN_ROLE', 'Неизвестная роль пользователя');
    setToken(result.token); client.setQueryData(['me', workspace.mode, workspace.epoch, result.token], user); return user;
  }
  function logout() { sequence.current++; if (token && workspace.mode === 'mock') void workspace.mock.logout(token); setToken(null); void client.cancelQueries(); client.clear(); }
  return <Context.Provider value={{ user: token ? me.data : undefined, loading: Boolean(token) && me.isPending, error: me.error, retry: () => { void me.refetch(); }, login, logout }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider отсутствует'); return value; }
