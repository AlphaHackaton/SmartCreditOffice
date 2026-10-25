import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from './provider';
import { useAuth } from '../auth/AuthProvider';
import type { FailureStatus } from './gateway';
import { ConfirmDialog } from '../shared/components/ConfirmDialog';

export function DemoControls() {
  const workspace = useWorkspace(); const auth = useAuth(); const navigate = useNavigate();
  const [resetting, setResetting] = useState(false); const [notice, setNotice] = useState('');
  return <aside className="demo-controls" aria-label="Управление демо">
    <label>Данные <select aria-label="Режим данных" value={workspace.mode} onChange={(e) => { auth.logout(); workspace.changeMode(e.target.value === 'api' ? 'api' : 'mock'); void navigate('/login', { replace: true }); }}><option value="mock">Mock · демо</option><option value="api">API · пока не подключён</option></select></label>
    {workspace.mode === 'mock' && <>
      <label>Задержка <select defaultValue={workspace.mock.delayMs} aria-label="Задержка демо" onChange={(e) => { workspace.mock.delayMs = Number(e.target.value); }}><option value="0">Без задержки</option><option value="400">400 мс</option><option value="1500">1500 мс</option></select></label>
      <label>Следующее чтение <select aria-label="Ошибка следующего чтения" value="" onChange={(e) => { workspace.mock.failNext('read', Number(e.target.value) as FailureStatus); setNotice(`Следующее чтение: ошибка ${e.target.value}`); }}><option value="" disabled>Без сбоя</option>{[401, 403, 404, 503].map((n) => <option key={n}>{n}</option>)}</select></label>
      <label>Следующая команда <select aria-label="Ошибка следующей команды" value="" onChange={(e) => { workspace.mock.failNext('command', Number(e.target.value) as FailureStatus); setNotice(`Следующая команда: ошибка ${e.target.value}`); }}><option value="" disabled>Без сбоя</option>{[409, 422, 503].map((n) => <option key={n}>{n}</option>)}</select></label>
      <ButtonDesktop type="button" size={32} view="text" onClick={() => setResetting(true)}>Сбросить демо</ButtonDesktop>{notice && <span role="status">{notice}</span>}
    </>}
    <ConfirmDialog open={resetting} title="Сбросить демонстрацию?" description="Заявки в памяти будут удалены, потребуется повторный вход." confirmLabel="Сбросить" onCancel={() => setResetting(false)} onConfirm={() => { auth.logout(); workspace.reset(); setResetting(false); setNotice(''); void navigate('/login', { replace: true }); }} />
  </aside>;
}
