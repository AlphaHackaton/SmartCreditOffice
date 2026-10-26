import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from './App';
import { useSession } from './auth/session';

function Probe() {
  const client = useQueryClient();
  const session = useSession();
  const previous = client.getQueryData(['probe']);
  client.setQueryData(['probe'], previous ?? 'свежий кеш');
  return <p>{String(previous ?? 'пустой кеш')} / {session.token ?? 'без сессии'}</p>;
}

const ignoreExpiry = () => {};

describe('провайдеры приложения', () => {
  it('сохраняют QueryClient при повторном рендере', () => {
    const { rerender } = render(<AppProviders onSessionExpired={ignoreExpiry}><Probe /></AppProviders>);
    expect(screen.getByText('пустой кеш / без сессии')).toBeInTheDocument();
    rerender(<AppProviders onSessionExpired={ignoreExpiry}><Probe /></AppProviders>);
    expect(screen.getByText('свежий кеш / без сессии')).toBeInTheDocument();
  });

  it('создают изолированный кеш для нового приложения', () => {
    render(<AppProviders onSessionExpired={ignoreExpiry}><Probe /></AppProviders>);
    expect(screen.getByText('пустой кеш / без сессии')).toBeInTheDocument();
  });
});
