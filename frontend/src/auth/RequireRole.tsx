import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './session';
import { useAuth } from './AuthProvider';
import { ErrorBanner } from '../shared/components/ErrorBanner';
import type { Role } from '../demo/gateway';

export function RequireRole({ role }: { role: Role }) {
  const { token } = useSession(); const auth = useAuth(); const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ returnTo: location.pathname + location.search }} />;
  if (auth.loading) return <p role="status">Проверяем сессию…</p>;
  if (auth.error) return <ErrorBanner message={auth.error.message} onRetry={auth.retry} />;
  if (!auth.user || auth.user.role !== role) return <section><h1>Нет доступа</h1><p>Этот раздел недоступен для вашей роли.</p><Link to={auth.user?.role === 'bank' ? '/bank/applications' : '/client'}>В свой кабинет</Link></section>;
  return <Outlet />;
}
export function safeReturnTo(value: unknown, role: Role) {
  const fallback = role === 'bank' ? '/bank/applications' : '/client';
  if (typeof value !== 'string' || /[\\%#\s]/.test(value)) return fallback;
  const path = value.split('?')[0]; if (path.split('/').some((part) => part === '.' || part === '..')) return fallback;
  return role === 'client' ? /^\/client(?:\/|$)/.test(path) ? value : fallback : /^\/bank(?:\/|$)/.test(path) ? value : fallback;
}
