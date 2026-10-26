import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../demo/provider';

export function AppLayout() {
  const auth = useAuth(); const { mode } = useWorkspace(); const navigate = useNavigate();
  const bank = auth.user?.role === 'bank';
  return <div className={`workspace${auth.user ? '' : ' workspace--login'}`}>
    <a className="skip-link" href="#main">К содержимому</a>
    <header className="app-header">
      <NavLink className="brand" to={bank ? '/bank/applications' : '/client'} aria-label="Кредитный кабинет — главная"><span className="brand-mark" aria-hidden="true">А</span><span>Кредитный кабинет<span className="brand-subtitle">ДЛЯ ПРЕДПРИНИМАТЕЛЕЙ</span></span></NavLink>
      <span className="header-caption">Сервисы для бизнеса</span>
      {auth.user && <div className="header-account"><span>{auth.user.name}</span><ButtonDesktop size={32} view="text" onClick={() => { auth.logout(); void navigate('/login', { replace: true }); }}>Выйти</ButtonDesktop></div>}
    </header>
    <div className="app-body">
      {auth.user && <aside className="sidebar">
        <p className="nav-caption">{bank ? 'РАБОЧЕЕ ПРОСТРАНСТВО' : 'МОЙ КАБИНЕТ'}</p><p className="current-role">{bank ? 'Сотрудник банка' : 'Предприниматель'}</p>
        <p className="nav-caption section-caption">{bank ? 'Рабочее место кредитного специалиста' : 'ФИНАНСИРОВАНИЕ БИЗНЕСА'}</p>
        <nav className="section-nav" aria-label={bank ? 'Разделы сотрудника банка' : 'Разделы клиента'}>
          {bank ? <><NavLink to="/bank/applications" end>Очередь заявок</NavLink><NavLink to="/bank/metrics">Метрики конвейера</NavLink>{mode === 'mock' && <NavLink to="/bank/sandbox">Анализ условий</NavLink>}</> : <><NavLink to="/client" end>Обзор кабинета</NavLink><NavLink to="/client/applications/new">Новая заявка</NavLink></>}
        </nav>
        <div className="sidebar-footer">{bank ? 'Рассмотрение заявок и кредитные решения' : 'Заявки и решения по финансированию вашего бизнеса'}</div>
      </aside>}
      <main id="main" className="main-content" tabIndex={-1}><Outlet /></main>
    </div>
    <footer className="app-footer"><span>Кредитный кабинет предпринимателя</span><span>Финансирование бизнеса</span></footer>
  </div>;
}
