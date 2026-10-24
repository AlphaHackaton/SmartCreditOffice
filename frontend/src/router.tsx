import { Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from './shared/components/AppLayout';
import { PlaceholderPage } from './shared/components/PlaceholderPage';
import { NotFoundPage } from './shared/components/NotFoundPage';

export const routes: RouteObject[] = [{
  element: <AppLayout />,
  children: [
    { path: '/', element: <Navigate to="/client" replace /> },
    { path: '/login', element: <PlaceholderPage title="Вход в кабинет" description="Единая точка входа для предпринимателя и сотрудника банка." /> },
    { path: '/client', element: <PlaceholderPage title="Кабинет предпринимателя" description="Заявки, решения и условия финансирования вашего бизнеса — в одном месте." /> },
    { path: '/client/applications/new', element: <PlaceholderPage title="Новая заявка" description="Здесь можно будет выбрать сумму, срок и цель финансирования." /> },
    { path: '/client/applications/:id', element: <PlaceholderPage title="Заявка на финансирование" description="Здесь появятся этапы рассмотрения, решение и доступные условия." /> },
    { path: '/bank/applications', element: <PlaceholderPage bank title="Очередь заявок" description="Рабочее пространство для рассмотрения кредитных заявок." /> },
    { path: '/bank/applications/:id', element: <PlaceholderPage bank title="Досье заявки" description="Здесь появятся материалы проверки и объяснение кредитного решения." /> },
    { path: '/bank/metrics', element: <PlaceholderPage bank title="Метрики конвейера" description="Здесь появятся показатели рассмотрения кредитных заявок." /> },
    { path: '*', element: <NotFoundPage /> },
  ],
}];
