import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useWorkspaceScope } from '../../api/queries';
import { useSession } from '../../auth/session';
import type { Application } from '../../demo/gateway';
import { ApiError } from '../../api/errors';

export function useApplicationCommand(id: string) {
  const scope = useWorkspaceScope(); const { getToken } = useSession(); const cache = useQueryClient();
  const alive = useRef(true); const busy = useRef(false); const [error, setError] = useState<string>();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const mutation = useMutation({ mutationFn: (command: () => Promise<Application>) => command() });
  async function execute(command: () => Promise<Application>) {
    if (busy.current) return false;
    const generation = scope.generation(); const token = scope.token;
    const current = () => alive.current && getToken() === token && scope.generation() === generation;
    busy.current = true; setError(undefined);
    try {
      const result = await mutation.mutateAsync(command);
      if (!current()) return false;
      cache.setQueryData([...scope.key, 'application', id], result);
      void cache.invalidateQueries({ queryKey: [...scope.key, 'applications'] });
      return true;
    } catch (cause) {
      if (current()) {
        setError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие. Повторите.');
        if (cause instanceof ApiError && cause.status === 409) await cache.invalidateQueries({ queryKey: [...scope.key, 'application', id] });
      }
      return false;
    } finally { busy.current = false; }
  }
  return { ...scope, execute, pending: mutation.isPending, error };
}
