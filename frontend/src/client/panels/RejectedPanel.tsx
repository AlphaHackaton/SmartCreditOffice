import type { Application } from '../../demo/gateway';
import { FactorList } from '../../shared/components/FactorList';
import { ButtonLink } from '../../shared/components/ButtonLink';

export function RejectedPanel({ record }: { record: Application }) {
  return <section className="workspace-card" aria-labelledby="rejected-title"><h2 id="rejected-title">Почему заявка отклонена</h2><FactorList factors={record.decision?.factors ?? []} audience="client" /><h3>Что можно сделать дальше</h3>
    {record.decision?.recommendations.length ? <ul>{record.decision.recommendations.map((text) => <li key={text}>{text}</li>)}</ul> : <p>Проверьте актуальность данных и устраните указанные причины перед новой заявкой. Изменение данных не гарантирует одобрение: потребуется новая проверка.</p>}
    <p>Текущая заявка завершена. Подписание и встречное предложение при стоп-факторах недоступны.</p><ButtonLink to="/client">В кабинет</ButtonLink>
  </section>;
}
