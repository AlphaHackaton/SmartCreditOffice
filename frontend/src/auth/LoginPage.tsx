import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoginView, type LoginValues } from './LoginView';
import { useAuth } from './AuthProvider';
import { safeReturnTo } from './RequireRole';

export function LoginPage() {
  const auth = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  if (auth.user) return <Navigate replace to={safeReturnTo(location.state?.returnTo, auth.user.role)} />;
  async function submit(values: LoginValues) {
    if (pending) return; setPending(true); setError('');
    try { const user = await auth.login(values.login, values.password); await navigate(safeReturnTo(location.state?.returnTo, user.role), { replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось войти'); }
    finally { setPending(false); }
  }
  return <LoginView onSubmit={submit} pending={pending} error={error} />;
}
