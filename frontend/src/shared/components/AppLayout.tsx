import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

export function AppLayout() {
  const { pathname } = useLocation();
  const bank = pathname.startsWith('/bank');
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">К содержимому</a>
      <header className="app-header">
        <NavLink className="brand" to="/client" aria-label="Кредитный кабинет — главная">
          <span className="brand-mark" aria-hidden="true">А</span>
          <span>Кредитный кабинет<span className="brand-subtitle">ДЛЯ ПРЕДПРИНИМАТЕЛЕЙ</span></span>
        </NavLink>
        <span className="header-caption">Сервисы для бизнеса</span>
        <span className="preview-label"><span aria-hidden="true" />Предварительный просмотр</span>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <p className="nav-caption">КОНТУР</p>
          <nav className="context-nav" aria-label="Выбор контура">
            <Link to="/client" className={!bank ? 'context-link selected' : 'context-link'} aria-current={!bank ? 'page' : undefined}>Клиент</Link>
            <Link to="/bank/applications" aria-current={bank ? 'page' : undefined} className={bank ? 'context-link selected' : 'context-link'}>Банк</Link>
          </nav>
          <p className="nav-caption section-caption">{bank ? 'РАБОЧЕЕ МЕСТО БАНКА' : 'МОЙ КАБИНЕТ'}</p>
          <nav className="section-nav" aria-label={bank ? 'Разделы банка' : 'Разделы клиента'}>
            {bank ? <>
              <NavLink to="/bank/applications" end><span aria-hidden="true">≡</span>Очередь заявок</NavLink>
              <NavLink to="/bank/metrics"><span aria-hidden="true">▥</span>Метрики конвейера</NavLink>
            </> : <>
              <NavLink to="/client" end><span aria-hidden="true">⌂</span>Обзор кабинета</NavLink>
              <NavLink to="/client/applications/new"><span aria-hidden="true">＋</span>Новая заявка</NavLink>
            </>}
          </nav>
          <div className="sidebar-note">
            <span className="note-icon" aria-hidden="true">i</span>
            <p>Знакомство с кабинетом</p>
            <span>Без авторизации и банковских данных</span>
          </div>
          <div className="sidebar-footer">Клиент и банк — в одном кабинете</div>
        </aside>
        <main id="main" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <footer className="app-footer"><span>Умный кредитный кабинет предпринимателя</span><span>Альфа-Будущее · 2026</span></footer>
    </div>
  );
}
