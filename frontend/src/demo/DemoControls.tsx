import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from './provider';
import { useAuth } from '../auth/AuthProvider';
import { demoData } from './generated';
import type { FailurePlan, FailureTarget, FailureVariant } from './gateway';
import { ConfirmDialog } from '../shared/components/ConfirmDialog';
import { useHttpApi } from '../api/http';
import { useScenarios } from '../api/queries';

export function DemoControls() {
  const workspace = useWorkspace();
  const api = useHttpApi();
  const auth = useAuth();
  const navigate = useNavigate();

  const scenariosQuery = useScenarios();
  const scenarioList = scenariosQuery.data ?? demoData.scenarios;
  const activeScenarioId = workspace.mock.getActiveScenarioId();

  const [, setSelectedScenarioId] = useState(activeScenarioId);
  const [pendingScenarioId, setPendingScenarioId] = useState<string | null>(null);
  const [confirmScenarioOpen, setConfirmScenarioOpen] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState('');
  const [delay, setDelay] = useState(workspace.mock.delayMs);

  // Targeted failure form state
  const [failureKind, setFailureKind] = useState<'read' | 'command'>('command');
  const [failureTarget, setFailureTarget] = useState<FailureTarget>('sign');
  const [failureVariant, setFailureVariant] = useState<FailureVariant>(422);

  // Sync active failure status from mock
  const pendingFailures = workspace.mock.getPendingFailures();
  const currentPlan: FailurePlan | null = pendingFailures.command ?? pendingFailures.read;

  const currentScenario = scenarioList.find((s) => s.id === (activeScenarioId || 'factory')) ?? scenarioList[0];

  function onScenarioChange(nextId: string) {
    if (auth.user) {
      setPendingScenarioId(nextId);
      setConfirmScenarioOpen(true);
    } else {
      applyScenario(nextId);
    }
  }

  function applyScenario(scenarioId: string) {
    const sc = scenarioList.find((s) => s.id === scenarioId);
    workspace.loadScenario(scenarioId);
    setSelectedScenarioId(scenarioId);
    setNotice(`Загружен сценарий: ${sc?.title ?? scenarioId}. Для работы войдите как: ${sc?.personaLogin ?? 'p1'}`);
    void navigate('/login', { replace: true });
  }

  function planFailure() {
    try {
      workspace.mock.planFailure({
        kind: failureKind,
        target: failureTarget,
        variant: failureVariant,
      });
      setNotice(`Запланирован сбой [${failureKind}: ${failureTarget} → ${failureVariant}]`);
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'Недопустимая конфигурация сбоя');
    }
  }

  function cancelFailure() {
    workspace.mock.cancelFailure('read');
    workspace.mock.cancelFailure('command');
    setNotice('Ожидающие сбои отменены.');
  }

  return (
    <aside className="demo-controls" aria-label="Управление демо">
      <div className="demo-controls-row">
        <label>
          Данные{' '}
          <select
            aria-label="Режим данных"
            value={workspace.mode}
            onChange={(e) => {
              auth.logout();
              workspace.changeMode(e.target.value === 'api' ? 'api' : 'mock');
              void navigate('/login', { replace: true });
            }}
          >
            <option value="mock">Mock · демо</option>
            <option value="api">API · backend v0.1.0</option>
          </select>
        </label>

        {workspace.mode === 'api' && <ButtonDesktop type="button" size={32} view="text" onClick={() => setResetting(true)}>Сбросить данные API</ButtonDesktop>}
        {workspace.mode === 'mock' && (
          <>
            <label>
              Сценарий{' '}
              <select
                aria-label="Демо-сценарий"
                value={activeScenarioId}
                onChange={(e) => onScenarioChange(e.target.value)}
              >
                {scenarioList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Задержка{' '}
              <select
                aria-label="Задержка демо"
                value={delay}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDelay(val);
                  workspace.mock.delayMs = val;
                }}
              >
                <option value="0">Без задержки</option>
                <option value="400">400 мс</option>
                <option value="1500">1500 мс</option>
              </select>
            </label>

            <div className="failure-planner" aria-label="Планирование сбоев">
              <label>
                Сбой{' '}
                <select
                  aria-label="Тип операции"
                  value={failureKind}
                  onChange={(e) => {
                    const kind = e.target.value as 'read' | 'command';
                    setFailureKind(kind);
                    if (kind === 'read') {
                      setFailureTarget('application_read');
                      setFailureVariant(503);
                    } else {
                      setFailureTarget('sign');
                      setFailureVariant(422);
                    }
                  }}
                >
                  <option value="command">Команда</option>
                  <option value="read">Чтение</option>
                </select>
              </label>

              <label>
                Цель{' '}
                <select
                  aria-label="Цель сбоя"
                  value={failureTarget}
                  onChange={(e) => setFailureTarget(e.target.value as FailureTarget)}
                >
                  {failureKind === 'command' ? (
                    <>
                      <option value="sign">sign (Подписание)</option>
                      <option value="save">save (Черновик)</option>
                      <option value="submit">submit (Подача)</option>
                      <option value="accept">accept (Выбор оффера)</option>
                      <option value="decide">decide (Решение банка)</option>
                      <option value="login">login (Вход)</option>
                      <option value="any">any (Любая команда)</option>
                    </>
                  ) : (
                    <>
                      <option value="application_read">application_read (Заявка)</option>
                      <option value="dossier_read">dossier_read (Досье/Очередь)</option>
                      <option value="metrics_read">metrics_read (Метрики)</option>
                      <option value="sandbox_read">sandbox_read (Песочница)</option>
                      <option value="any">any (Любое чтение)</option>
                    </>
                  )}
                </select>
              </label>

              <label>
                Ответ{' '}
                <select
                  aria-label="Статус сбоя"
                  value={failureVariant}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFailureVariant(val === 'network' ? 'network' : (Number(val) as FailureVariant));
                  }}
                >
                  {failureKind === 'command' ? (
                    <>
                      <option value="422">422 Ошибка валидации</option>
                      <option value="409">409 Конфликт версии</option>
                      <option value="503">503 Недоступен</option>
                      <option value="network">Сбой сети</option>
                      <option value="401">401 Сессия истекла</option>
                      <option value="403">403 Запрещено</option>
                      <option value="404">404 Не найдено</option>
                    </>
                  ) : (
                    <>
                      <option value="503">503 Недоступен</option>
                      <option value="network">Сбой сети</option>
                      <option value="401">401 Сессия истекла</option>
                      <option value="403">403 Запрещено</option>
                      <option value="404">404 Не найдено</option>
                    </>
                  )}
                </select>
              </label>

              <ButtonDesktop type="button" size={32} view="secondary" onClick={planFailure}>
                Запланировать
              </ButtonDesktop>

              {currentPlan && currentPlan.state === 'pending' && (
                <div className="active-plan-badge">
                  <span>Ожидает: {currentPlan.kind}:{currentPlan.target} → {currentPlan.variant}</span>
                  <ButtonDesktop type="button" size={32} view="text" onClick={cancelFailure}>
                    Отменить
                  </ButtonDesktop>
                </div>
              )}
            </div>

            {auth.user?.role === 'bank' && (
              <ButtonDesktop
                type="button"
                size={32}
                view="secondary"
                onClick={() => void navigate('/bank/sandbox')}
              >
                Песочница скоринга
              </ButtonDesktop>
            )}

            <ButtonDesktop type="button" size={32} view="text" onClick={() => setResetting(true)}>
              Сбросить демо
            </ButtonDesktop>
          </>
        )}
      </div>

      {workspace.mode === 'mock' && currentScenario && (
        <div className="demo-scenario-info" role="region" aria-label="Описание текущего сценария">
          <span className="demo-scenario-badge">Старт: {currentScenario.startingStage}</span>
          <span className="demo-scenario-persona">
            Вход: <strong>{currentScenario.personaLogin}</strong> (пароль demo)
          </span>
          <span className="demo-scenario-steps">{currentScenario.expectedSteps}</span>
        </div>
      )}

      {notice && <span role="status" className="demo-notice">{notice}</span>}

      <ConfirmDialog
        open={confirmScenarioOpen}
        title="Сменить демо-сценарий?"
        description="Текущие действия и сессия будут очищены, данные заменены выбранным сценарием. Потребуется войти под указанной учётной записью."
        confirmLabel="Сменить сценарий"
        onCancel={() => {
          setConfirmScenarioOpen(false);
          setPendingScenarioId(null);
          setSelectedScenarioId(activeScenarioId);
        }}
        onConfirm={() => {
          if (pendingScenarioId) {
            auth.logout();
            applyScenario(pendingScenarioId);
          }
          setConfirmScenarioOpen(false);
          setPendingScenarioId(null);
        }}
      />

      <ConfirmDialog
        open={resetting}
        title="Сбросить демонстрацию?"
        description={workspace.mode === 'api' ? 'Сервер удалит все демонстрационные заявки и связанные данные всех пользователей. Вы выйдете из кабинета.' : 'Все заявки в памяти, аудит, пресеты и сбои будут удалены. Кабинет вернётся к заводскому состоянию из 6 примеров.'}
        confirmLabel="Сбросить"
        onCancel={() => setResetting(false)}
        onConfirm={async () => {
          if (workspace.mode === 'api') await api.reset();
          auth.logout();
          workspace.reset();
          setResetting(false);
          setNotice('Демо сброшено к заводскому состоянию.');
          setSelectedScenarioId('factory');
          void navigate('/login', { replace: true });
        }}
      />
    </aside>
  );
}
