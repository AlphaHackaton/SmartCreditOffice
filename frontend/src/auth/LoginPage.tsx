import { useQuery } from '@tanstack/react-query';
import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoginView, type LoginValues } from './LoginView';
import { useAuth } from './AuthProvider';
import { safeReturnTo } from './RequireRole';
import { useWorkspace } from '../demo/provider';
import { ErrorBanner } from '../shared/components/ErrorBanner';

export function LoginPage() {
  const auth = useAuth(); const workspace = useWorkspace(); const navigate = useNavigate(); const location = useLocation();
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  const personas = useQuery({ queryKey: ['personas', workspace.mode, workspace.epoch], queryFn: ({ signal }) => workspace.gateway.personas(signal) });
  if (auth.user) return <Navigate replace to={auth.user.role === 'bank' ? '/bank/applications' : '/client'} />;
  async function submit(values: LoginValues) {
    if (pending) return; setPending(true); setError('');
    try { const user = await auth.login(values.login, values.password); await navigate(safeReturnTo(location.state?.returnTo, user.role), { replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось войти'); }
    finally { setPending(false); }
  }
  return <><LoginView onSubmit={submit} pending={pending} error={error} />
    {workspace.mode === 'mock' && <section className="demo-accounts" aria-labelledby="demo-accounts-title"><h2 id="demo-accounts-title">Демо-учётные записи</h2><p>Синтетические данные backend. Пароль: <strong>demo</strong>. Данные и вход сбрасываются при обновлении страницы.</p>
      {personas.isPending && <p role="status">Загружаем демо-персоны…</p>}
      <ErrorBanner message={personas.error?.message} onRetry={() => personas.refetch().then(() => {})} />
      <div className="demo-account-list">{personas.data?.map((p) => <ButtonDesktop type="button" view="secondary" size={40} key={p.login} disabled={pending} onClick={() => { void submit({ login: p.login, password: 'demo' }); }}>{p.label}</ButtonDesktop>)}</div>
    </section>}
    {workspace.mode === 'api' && <ErrorBanner message="API Dev 2 ещё не подключён. Переключитесь в mock для демонстрации." />}
  </>;
}
