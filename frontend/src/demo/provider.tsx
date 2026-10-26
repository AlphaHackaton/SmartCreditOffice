import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../auth/session';
import { MockGateway, unavailableGateway, type DataMode, type LoadScenarioResult, type WorkspaceGateway } from './gateway';

interface Workspace {
  mode: DataMode;
  gateway: WorkspaceGateway;
  mock: MockGateway;
  epoch: number;
  generation: () => number;
  changeMode: (mode: DataMode) => void;
  reset: () => void;
  loadScenario: (scenarioId: string) => LoadScenarioResult;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children, mockGateway, initialMode }: { children: ReactNode; mockGateway?: MockGateway; initialMode?: DataMode }) {
  const { setToken, expire } = useSession(); const cache = useQueryClient();
  const [mock] = useState(() => mockGateway ?? new MockGateway(Date.now, expire));
  useEffect(() => { mock.setUnauthorized(expire); }, [mock, expire]);
  const [api] = useState(unavailableGateway);
  const [mode, setMode] = useState<DataMode>(initialMode ?? (import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'mock'));
  const [epoch, setEpoch] = useState(0); const epochRef = useRef(0);
  function reset() { epochRef.current++; mock.reset(); setToken(null); void cache.cancelQueries(); cache.clear(); setEpoch(epochRef.current); }
  function loadScenario(scenarioId: string): LoadScenarioResult {
    epochRef.current++;
    const result = mock.loadScenario(scenarioId);
    setToken(null);
    void cache.cancelQueries();
    cache.clear();
    setEpoch(epochRef.current);
    return result;
  }
  return <Context.Provider value={{ mode, gateway: mode === 'mock' ? mock : api, mock, epoch, generation: () => epochRef.current, reset, loadScenario, changeMode: (next) => { reset(); setMode(next); } }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('WorkspaceProvider отсутствует'); return value; }
