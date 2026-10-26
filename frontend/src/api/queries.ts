import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/session';
import { useWorkspace } from '../demo/provider';
import { POLLING_STATUSES } from '../demo/generated';
import type { MetricsFilter } from '../demo/metrics';
import type { SandboxRunInput } from '../demo/gateway';

export function useWorkspaceScope() {
  const { user } = useAuth(); const { token } = useSession(); const workspace = useWorkspace();
  return { ...workspace, token: token!, enabled: Boolean(user && token && user.role === 'client'), bankEnabled: Boolean(user && token && user.role === 'bank'), key: ['workspace', workspace.mode, workspace.epoch, user?.id] as const };
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
    refetchInterval: (query) => !query.state.error && query.state.data && (POLLING_STATUSES.includes(query.state.data.status) || query.state.data.status === 'SIGNED') ? 1500 : false,
  });
}

export function useQueue() {
  const scope = useWorkspaceScope();
  return useQuery({ queryKey: [...scope.key, 'queue'], queryFn: ({ signal }) => scope.gateway.queue(scope.token, signal), enabled: scope.bankEnabled });
}

export function useBankDossier(id: string) {
  const scope = useWorkspaceScope();
  return useQuery({
    queryKey: [...scope.key, 'bank-dossier', id],
    queryFn: ({ signal }) => scope.gateway.dossier(scope.token, id, signal),
    enabled: scope.bankEnabled && Boolean(id),
  });
}

export function useBankMetrics(filter?: MetricsFilter) {
  const scope = useWorkspaceScope();
  const canonicalFilterKey = filter ? JSON.stringify(filter) : 'default';
  return useQuery({
    queryKey: [...scope.key, 'bank-metrics', canonicalFilterKey],
    queryFn: ({ signal }) => scope.gateway.metrics(scope.token, filter, signal),
    enabled: scope.bankEnabled,
  });
}

export function useScenarios() {
  const workspace = useWorkspace();
  return useQuery({
    queryKey: ['scenarios', workspace.mode, workspace.epoch],
    queryFn: ({ signal }) => workspace.gateway.scenarios(signal),
    enabled: workspace.mode === 'mock',
    staleTime: 300000,
  });
}

export function useSandboxCatalog() {
  const scope = useWorkspaceScope();
  return useQuery({
    queryKey: [...scope.key, 'sandbox-catalog'],
    queryFn: ({ signal }) => scope.gateway.sandboxCatalog(scope.token, signal),
    enabled: scope.bankEnabled,
    staleTime: 300000,
  });
}

export function useSandboxRun(input: SandboxRunInput | null) {
  const scope = useWorkspaceScope();
  const canonicalInputKey = input ? JSON.stringify(input) : null;
  return useQuery({
    queryKey: [...scope.key, 'sandbox-run', canonicalInputKey],
    queryFn: ({ signal }) => scope.gateway.sandboxRun(scope.token, input!, signal),
    enabled: scope.bankEnabled && Boolean(input),
  });
}
