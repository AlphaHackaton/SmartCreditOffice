import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../App';
import { AuthProvider, useAuth } from './AuthProvider';
import { MockGateway, type User } from '../demo/gateway';
import { useSession } from './session';

it('запоздалый вход после выхода не создаёт сессию', async () => {
  const gateway = new MockGateway(); gateway.delayMs = 0;
  let resolve!: (user: User) => void;
  const me = vi.spyOn(gateway, 'me').mockImplementation(() => new Promise<User>((done) => { resolve = done; }));
  function Probe() {
    const auth = useAuth(); const { token } = useSession();
    return <><p>{token ? 'сессия' : 'аноним'}</p><button onClick={() => { void auth.login('p1', 'demo').catch(() => {}); }}>Вход</button><button onClick={auth.logout}>Выход</button></>;
  }
  render(<AppProviders mockGateway={gateway} onSessionExpired={() => {}}><AuthProvider><Probe /></AuthProvider></AppProviders>);
  const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Вход' }));
  await waitFor(() => expect(me).toHaveBeenCalledOnce());
  await user.click(screen.getByRole('button', { name: 'Выход' }));
  await act(async () => resolve({ id: 'p1', name: 'Demo', login: 'p1', role: 'client', companyId: 'p1' }));
  expect(screen.getByText('аноним')).toBeInTheDocument();
});
