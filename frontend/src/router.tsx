import { Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from './shared/components/AppLayout';
import { PlaceholderPage } from './shared/components/PlaceholderPage';
import { NotFoundPage } from './shared/components/NotFoundPage';
import { AuthProvider } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import { LoginPage } from './auth/LoginPage';
import { DashboardPage } from './client/DashboardPage';
import { NewApplicationPage } from './client/NewApplicationPage';
import { QueuePage } from './bank/QueuePage';
import { ApplicationPage } from './client/ApplicationPage';

export const routes: RouteObject[] = [{
  element: <AuthProvider><AppLayout /></AuthProvider>,
  children: [
    { path: '/', element: <Navigate to="/client" replace /> },
    { path: '/login', element: <LoginPage /> },
    { element: <RequireRole role="client" />, children: [
    { path: '/client', element: <DashboardPage /> },
    { path: '/client/applications/new', element: <NewApplicationPage /> },
    { path: '/client/applications/:id', element: <ApplicationPage /> },
    ] },
    { element: <RequireRole role="bank" />, children: [
    { path: '/bank/applications', element: <QueuePage /> },
    { path: '/bank/applications/:id', element: <PlaceholderPage bank title="Досье заявки" description="Здесь появятся материалы проверки и объяснение кредитного решения." /> },
    { path: '/bank/metrics', element: <PlaceholderPage bank title="Метрики конвейера" description="Здесь появятся показатели рассмотрения кредитных заявок." /> },
    ] },
    { path: '*', element: <NotFoundPage /> },
  ],
}];
