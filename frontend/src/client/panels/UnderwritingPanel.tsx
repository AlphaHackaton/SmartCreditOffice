import type { Application } from '../../demo/gateway';
import { FactorList } from '../../shared/components/FactorList';
import { ButtonLink } from '../../shared/components/ButtonLink';

export function UnderwritingPanel({ record }: { record: Application }) {
  return <section className="workspace-card" aria-labelledby="review-title"><h2 id="review-title">Заявка на ручном рассмотрении</h2><p>Для решения нужна проверка кредитного специалиста. Это ещё не одобрение и не отказ. Подписание сейчас недоступно.</p>
    {record.decision ? <><h3>Данные, требующие внимания</h3><FactorList factors={record.decision.factors} audience="client" /></> : <p>Специалист проверяет данные и подбирает подходящие условия финансирования.</p>}
    <p className="form-hint">Когда специалист примет решение, статус заявки обновится автоматически.</p><ButtonLink to="/client">Вернуться в кабинет</ButtonLink>
  </section>;
}
