import { useMemo } from 'react';
import type { components } from './schema';
import { useApiClient } from './provider';
import type { ApiClient, RequestOptions } from './client';
import { ApiError } from './errors';
import type { Application, User, WorkspaceGateway } from '../demo/gateway';

type DTO = components['schemas'];
export type ApiApplication = DTO['ApplicationOut'];
export type ApiDossier = DTO['BankDossierOut'];
export type ApiQueueItem = DTO['BankApplicationSummary'];
export type ApiMetrics = DTO['MetricsOut'];
export type ApiApplicationInput = DTO['ApplicationIn'];
export type ApiDecisionInput = DTO['UnderwriterDecisionIn'];
export const unsupported = async (): Promise<never> => { throw new ApiError(501, 'API_UNSUPPORTED', 'Эта возможность ещё не опубликована в API. Доступна только в mock-режиме.'); };

export function createHttpApi(client: ApiClient) {
  async function request<T>(path: string, options?: RequestOptions): Promise<T> { return await client(path, options) as T; }
  const auth = (token: string, signal?: AbortSignal) => ({ authToken: token, signal });
  const api = {
    health: (signal?: AbortSignal) => request<DTO['HealthOut']>('health', { signal, authToken: null }),
    personas: (signal?: AbortSignal) => request<DTO['PersonaOut'][]>('demo/personas', { signal, authToken: null }),
    login: (login: string, password: string) => request<DTO['LoginOut']>('auth/login', { method: 'POST', body: { login, password } satisfies DTO['LoginIn'], authToken: null }),
    me: (token: string, signal?: AbortSignal) => request<DTO['UserOut']>('auth/me', auth(token, signal)),
    applications: (token: string, signal?: AbortSignal) => request<DTO['ApplicationListOut']>('applications', auth(token, signal)),
    create: (token: string, body: ApiApplicationInput) => request<ApiApplication>('applications', { ...auth(token), method: 'POST', body }),
    submit: (token: string, id: string, version = 1) => request<ApiApplication>(`applications/${encodeURIComponent(id)}/submit?version=${version}`, { ...auth(token), method: 'POST' }),
    products: (signal?: AbortSignal) => request<DTO['ProductsOut']>('products', { signal, authToken: null }),
    company: (token: string, signal?: AbortSignal) => request<DTO['CompanyOut']>('companies/me', auth(token, signal)),
    update: (token: string, id: string, version: number, body: ApiApplicationInput) => request<ApiApplication>(`applications/${encodeURIComponent(id)}?version=${version}`, { ...auth(token), method: 'PATCH', body }),
    simulate: (token: string, id: string, body: DTO['SimulationIn'], signal?: AbortSignal) => request<DTO['SimulationOut']>(`applications/${encodeURIComponent(id)}/simulate`, { ...auth(token, signal), method: 'POST', body }),
    accept: (token: string, id: string, version: number, offerId: string) => request<DTO['SigningChallenge']>(`applications/${encodeURIComponent(id)}/accept?version=${version}&offer_id=${encodeURIComponent(offerId)}`, { ...auth(token), method: 'POST' }),
    sign: (token: string, id: string, version: number, code: string) => request<ApiApplication>(`applications/${encodeURIComponent(id)}/sign?version=${version}`, { ...auth(token), method: 'POST', body: { code } satisfies DTO['SignIn'] }),
    cancel: (token: string, id: string, version: number) => request<ApiApplication>(`applications/${encodeURIComponent(id)}/cancel?version=${version}`, { ...auth(token), method: 'POST' }),
    reset: () => request<DTO['ResetOut']>('demo/reset', { method: 'POST', authToken: null }),
    scoringRuns: (token: string, id: string, signal?: AbortSignal) => request<DTO['ScoringRunOut'][]>(`bank/applications/${encodeURIComponent(id)}/scoring-runs`, auth(token, signal)),
    queue: (token: string, signal?: AbortSignal) => request<DTO['BankQueueOut']>('bank/applications', auth(token, signal)),
    dossier: (token: string, id: string, signal?: AbortSignal) => request<ApiDossier>(`bank/applications/${encodeURIComponent(id)}`, auth(token, signal)),
    decide: (token: string, id: string, body: ApiDecisionInput) => request<ApiApplication>(`bank/applications/${encodeURIComponent(id)}/decision`, { ...auth(token), method: 'POST', body }),
    rescore: (token: string, id: string) => request<ApiApplication>(`bank/applications/${encodeURIComponent(id)}/rescore`, { ...auth(token), method: 'POST' }),
    metrics: (token: string, signal?: AbortSignal) => request<ApiMetrics>('bank/metrics', auth(token, signal)),
  };
  return { ...api, application: async (token: string, id: string, signal?: AbortSignal) => {
    const list = await api.applications(token, signal);
    if (!Array.isArray(list.items)) throw new ApiError(502, 'INVALID_RESPONSE', 'API вернул некорректный список заявок.');
    const record = list.items.find((a) => a.id === id);
    if (!record) throw new ApiError(404, 'APPLICATION_NOT_FOUND', 'Заявка не найдена в доступном вам списке.');
    return record;
  } };
}
export type HttpApi = ReturnType<typeof createHttpApi>;
export function useHttpApi() { const client = useApiClient(); return useMemo(() => createHttpApi(client), [client]); }

function user(data: DTO['UserOut']): User {
  if (!data.id || !data.login || !['CLIENT', 'BANK'].includes(data.role)) throw new ApiError(502, 'INVALID_USER', 'API вернул неизвестного пользователя или роль.');
  return { id: data.id, login: data.login, name: data.login, role: data.role === 'BANK' ? 'bank' : 'client', companyId: data.company_id ?? null };
}
function application(data: ApiApplication): Application {
  return { id: data.id, companyId: data.company_id, productCode: data.product_code, amount: data.amount, termMonths: data.term_months, purpose: '', consents: [], status: data.status, version: data.version,
    createdAt: data.history?.[0]?.at ?? '', history: (data.history ?? []).map((e) => ({ from: e.from_status ?? null, to: e.to_status, actor: e.actor, at: e.at, reason: e.reason ?? undefined })) };
}
export function createHttpGateway(api: HttpApi): WorkspaceGateway {
  return {
    personas: async (signal) => (await api.personas(signal)).map((p) => ({ login: p.login, label: `${p.company_name} · ИНН ${p.inn}` })),
    login: async (login, password) => ({ token: (await api.login(login, password)).access_token }),
    me: async (token, signal) => user(await api.me(token, signal)),
    applications: async (token, signal) => (await api.applications(token, signal)).items.map(application),
    application: async (token, id, signal) => application(await api.application(token, id, signal)),
    save: async (token, input, id) => id ? unsupported() : application(await api.create(token, { product_code: input.productCode, amount: input.amount, term_months: input.termMonths, purpose: input.purpose })),
    submit: async (token, id) => application(await api.submit(token, id)),
    company: unsupported, products: unsupported, queue: unsupported, simulationOptions: unsupported, simulate: unsupported, challenge: unsupported, sign: unsupported, accept: unsupported,
    dossier: unsupported, decide: unsupported, replayDossier: unsupported, metrics: unsupported, scenarios: unsupported, sandboxCatalog: unsupported, sandboxRun: unsupported,
  };
}
