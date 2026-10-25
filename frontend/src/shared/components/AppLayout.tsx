import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../demo/provider';
import { DemoControls } from '../../demo/DemoControls';

export function AppLayout() {
  const auth = useAuth(); const { mode } = useWorkspace(); const navigate = useNavigate();
  const bank = auth.user?.role === 'bank';
  return <div className="workspace">
    <a className="skip-link" href="#main">К содержимому</a>
    <header className="app-header">
      <NavLink className="brand" to={bank ? '/bank/applications' : '/client'} aria-label="Кредитный кабинет — главная"><span className="brand-mark" aria-hidden="true">А</span><span>Кредитный кабинет<span className="brand-subtitle">ДЛЯ ПРЕДПРИНИМАТЕЛЕЙ</span></span></NavLink>
      <span className="header-caption">Сервисы для бизнеса</span>
      <span className="preview-label"><span aria-hidden="true" />{mode === 'mock' ? 'Демо-режим · синтетические данные' : 'Режим API'}</span>
      {auth.user && <ButtonDesktop size={32} view="text" onClick={() => { auth.logout(); void navigate('/login', { replace: true }); }}>Выйти</ButtonDesktop>}
    </header>
    <DemoControls />
    <div className="app-body">
      <aside className="sidebar">
        <p className="nav-caption">КОНТУР</p><p className="current-role">{auth.user ? bank ? 'Сотрудник банка' : 'Клиент' : 'Вход в кабинет'}</p>
        <p className="nav-caption section-caption">{bank ? 'Рабочее место кредитного специалиста' : 'МОЙ КАБИНЕТ'}</p>
        {auth.user && <nav className="section-nav" aria-label={bank ? 'Разделы сотрудника банка' : 'Разделы клиента'}>
          {bank ? <><NavLink to="/bank/applications" end>Очередь заявок</NavLink><NavLink to="/bank/metrics">Метрики конвейера</NavLink></> : <><NavLink to="/client" end>Обзор кабинета</NavLink><NavLink to="/client/applications/new">Новая заявка</NavLink></>}
        </nav>}
        <div className="sidebar-note"><span className="note-icon" aria-hidden="true">i</span><p>{auth.user?.name ?? 'Демонстрация кабинета'}</p><span>{mode === 'mock' ? 'Данные в памяти. Обновление страницы сбрасывает демонстрацию.' : 'Требуется подключение API Dev 2.'}</span></div>
        <div className="sidebar-footer">Клиент и сотрудник — в одном кабинете</div>
      </aside>
      <main id="main" className="main-content" tabIndex={-1}><Outlet /></main>
    </div>
    <footer className="app-footer"><span>Умный кредитный кабинет предпринимателя</span><span>Альфа-Будущее · 2026</span></footer>
  </div>;
}
