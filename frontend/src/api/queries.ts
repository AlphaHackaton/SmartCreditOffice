import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/session';
import { useWorkspace } from '../demo/provider';
import { POLLING_STATUSES } from '../demo/generated';

export function useWorkspaceScope() {
  const { user } = useAuth(); const { token } = useSession(); const workspace = useWorkspace();
  return { ...workspace, token: token!, enabled: Boolean(user && token && user.role === 'client'), key: ['workspace', workspace.mode, workspace.epoch, user?.id] as const };
}
export function useCompany() {
  const scope = useWorkspaceScope();
  return useQuery({ queryKey: [...scope.key, 'company'], queryFn: ({ signal }) => scope.gateway.company(scope.token, signal), enabled: scope.enabled, staleTime: 300000 });
}
export function useProducts() {
  const scope = useWorkspaceScope();
  return useQuery({ queryKey: [...scope.key, 'products'], queryFn: ({ signal }) => scope.gateway.products(scope.token, signal), enabled: scope.enabled, staleTime: 300000 });
}
export function useApplications() {
  const scope = useWorkspaceScope();
  return useQuery({ queryKey: [...scope.key, 'applications'], queryFn: ({ signal }) => scope.gateway.applications(scope.token, signal), enabled: scope.enabled });
}
export function useApplication(id: string) {
  const scope = useWorkspaceScope();
  return useQuery({
    queryKey: [...scope.key, 'application', id],
    queryFn: ({ signal }) => scope.gateway.application(scope.token, id, signal),
    enabled: scope.enabled && Boolean(id),
    refetchInterval: (query) => !query.state.error && query.state.data && POLLING_STATUSES.includes(query.state.data.status) ? 1500 : false,
  });
}
