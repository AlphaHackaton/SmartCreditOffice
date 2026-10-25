import { isApplicationStatus, STATUS_VIEW, statusLabel } from '../status';
import './status.css';

export function StatusBadge({ status }: { status: string }) {
  const tone = isApplicationStatus(status) ? STATUS_VIEW[status].tone : 'neutral';
  return <span className={`status-badge status-${tone}`}>{statusLabel(status)}</span>;
}
