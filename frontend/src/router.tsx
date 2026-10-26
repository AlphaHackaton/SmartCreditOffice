import { type ReactNode } from 'react';
import { useWorkspace } from './demo/provider';
import { ApiDashboard, ApiCreateApplication, ApiApplicationPage } from './api/views/client';
import { ApiBankQueue, ApiBankDossier, ApiBankMetrics } from './api/views/bank';
import { ApiUnavailable } from './api/views/common';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from './shared/components/AppLayout';
import { NotFoundPage } from './shared/components/NotFoundPage';
import { AuthProvider } from './auth/AuthProvider';
import { RequireRole } from './auth/RequireRole';
import { LoginPage } from './auth/LoginPage';
import { DashboardPage } from './client/DashboardPage';
import { NewApplicationPage } from './client/NewApplicationPage';
import { QueuePage } from './bank/QueuePage';
import { DossierPage } from './bank/DossierPage';
import { MetricsPage } from './bank/MetricsPage';
import { SandboxPanel } from './bank/panels/SandboxPanel';
import { ApplicationPage } from './client/ApplicationPage';

function DataView({ mock, api }: { mock: ReactNode; api: ReactNode }) { const { mode } = useWorkspace(); return mode === 'api' ? api : mock; }

export const routes: RouteObject[] = [{
  element: <AuthProvider><AppLayout /></AuthProvider>,
  children: [
    { path: '/', element: <Navigate to="/client" replace /> },
    { path: '/login', element: <LoginPage /> },
    { element: <RequireRole role="client" />, children: [
    { path: '/client', element: <DataView mock={<DashboardPage />} api={<ApiDashboard />} /> },
    { path: '/client/applications/new', element: <DataView mock={<NewApplicationPage />} api={<ApiCreateApplication />} /> },
    { path: '/client/applications/:id', element: <DataView mock={<ApplicationPage />} api={<ApiApplicationPage />} /> },
    ] },
    { element: <RequireRole role="bank" />, children: [
    { path: '/bank/applications', element: <DataView mock={<QueuePage />} api={<ApiBankQueue />} /> },
    { path: '/bank/applications/:id', element: <DataView mock={<DossierPage />} api={<ApiBankDossier />} /> },
    { path: '/bank/metrics', element: <DataView mock={<MetricsPage />} api={<ApiBankMetrics />} /> },
    { path: '/bank/sandbox', element: <DataView mock={<SandboxPanel />} api={<ApiUnavailable title="Синтетическая песочница" />} /> },
    ] },
    { path: '*', element: <NotFoundPage /> },
  ],
}];
