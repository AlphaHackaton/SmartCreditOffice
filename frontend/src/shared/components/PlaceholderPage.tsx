import { TitleDesktop, Text } from '@alfalab/core-components-typography/esm';
import { useParams } from 'react-router-dom';

export function PlaceholderPage({ title, description, bank = false }: {
  title: string;
  description: string;
  bank?: boolean;
}) {
  const { id } = useParams();
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">{bank ? 'СОТРУДНИК БАНКА' : 'КЛИЕНТСКИЙ КОНТУР'}</p>
        <TitleDesktop tag="h1" view="large" font="system" defaultMargins={false}>{title}</TitleDesktop>
        <Text tag="p" view="primary-large" className="page-description">{description}</Text>
        {id && <p className="identifier">Идентификатор: <span>{id}</span></p>}
      </div>
      <section className="empty-panel" aria-labelledby="section-coming-soon">
        <div className="document-illustration" aria-hidden="true">
          <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
            <rect x="12" y="8" width="56" height="70" rx="9" fill="white" stroke="#D5D8DC" strokeWidth="1.5" />
            <path d="M25 28H54M25 39H48M25 50H42" stroke="#B6BCC4" strokeWidth="3" strokeLinecap="round" />
            <circle cx="63" cy="64" r="17" fill="#EF3124" />
            <path d="M56 64H70M63 57V71" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <TitleDesktop tag="h2" view="small" font="system" defaultMargins={false} id="section-coming-soon">Раздел готовится</TitleDesktop>
        <Text tag="p" view="primary-medium" className="empty-description">Здесь появятся данные и действия по вашему запросу.<br />Сейчас доступен предварительный просмотр разделов.</Text>
        <span className="availability"><span aria-hidden="true" />Функциональность пока недоступна</span>
      </section>
      <section className="journey" aria-label="Этапы кредитования">
        <p className="nav-caption">ПУТЬ К ФИНАНСИРОВАНИЮ</p>
        <ol>{['Потребность', 'Заявка', 'Скоринг', 'Решение', 'Подписание', 'Кредит выдан'].map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol>
        <p className="journey-note">Этапы процесса. Статус действующей заявки здесь не отображается.</p>
      </section>
    </>
  );
}
