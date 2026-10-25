import { ApiError } from '../api/errors';
import { demoData, type ApplicationStatus } from './generated';

// Temporary UI models. Dev 2's generated HTTP DTOs will be mapped by an adapter.
export type Role = 'client' | 'bank';
export type DataMode = 'mock' | 'api';
export interface User { id: string; login: string; name: string; role: Role; companyId: string | null }
export interface Company { id: string; name: string; inn: string; legal_form: string; registered_at: string; okved: string }
export interface Product { code: string; name: string; min_amount: string; max_amount: string; min_term: number; max_term: number }
export interface HistoryEvent { from: string | null; to: string; actor: string; at: string; reason?: string }
export interface ApplicationInput { productCode: string; amount: string; termMonths: number; purpose: string; consents: string[] }
export interface Application extends ApplicationInput { id: string; companyId: string; status: ApplicationStatus; version: number; history: HistoryEvent[]; createdAt: string }
export interface Persona { login: string; label: string }
export interface WorkspaceGateway {
  personas(signal?: AbortSignal): Promise<Persona[]>;
  login(login: string, password: string): Promise<{ token: string }>;
  me(token: string, signal?: AbortSignal): Promise<User>;
  company(token: string, signal?: AbortSignal): Promise<Company>;
  products(token: string, signal?: AbortSignal): Promise<Product[]>;
  applications(token: string, signal?: AbortSignal): Promise<Application[]>;
  application(token: string, id: string, signal?: AbortSignal): Promise<Application>;
  save(token: string, input: ApplicationInput, id?: string, version?: number): Promise<Application>;
  submit(token: string, id: string, version: number): Promise<Application>;
}
export type FailureStatus = 401 | 403 | 404 | 409 | 422 | 503;

const message = 'Демонстрационный сбой. Повторите действие.';
const error = (status: number, code: string, text = message) => new ApiError(status, code, text);

export function validateInput(input: ApplicationInput, product: Product | undefined, submitting: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!product) errors.productCode = 'Выберите продукт';
  // Exact integer cents are used only for input validation, never credit calculations.
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.amount) || input.amount.trim() !== input.amount) errors.amount = 'Введите сумму цифрами, до двух знаков после точки';
  else if (product) {
    const cents = (value: string) => { const [whole, part = ''] = value.split('.'); return BigInt(whole + part.padEnd(2, '0')); };
    const amount = cents(input.amount);
    if (amount < cents(product.min_amount) || amount > cents(product.max_amount)) errors.amount = 'Сумма вне границ выбранного продукта';
    else if (amount % cents(demoData.amountStep) !== 0n) errors.amount = `Сумма должна быть кратна ${demoData.amountStep} ₽`;
  }
  if (!Number.isInteger(input.termMonths) || !product || input.termMonths < product.min_term || input.termMonths > product.max_term || input.termMonths % demoData.termStep !== 0) errors.termMonths = `Выберите срок с шагом ${demoData.termStep} месяцев в границах продукта`;
  if (!['WORKING_CAPITAL', 'EQUIPMENT', 'OTHER'].includes(input.purpose)) errors.purpose = 'Выберите цель';
  if (submitting && !['BKI_REQUEST', 'PD_PROCESSING'].every((item) => input.consents.includes(item))) errors.consents = 'Примите оба обязательных согласия';
  return errors;
}

export class MockGateway implements WorkspaceGateway {
  delayMs = 400;
  private generation = 0;
  private nextRead: FailureStatus | null = null;
  private nextCommand: FailureStatus | null = null;
  private sessions = new Map<string, User>();
  private records = new Map<string, Application>();
  private submitted = new Map<string, number>();
  private now: () => number;
  constructor(now = Date.now, private unauthorized: (token: string) => void = () => {}) { this.now = now; }
  failNext(kind: 'read' | 'command', status: FailureStatus) { if (kind === 'read') this.nextRead = status; else this.nextCommand = status; }
  reset() { this.generation++; this.records.clear(); this.sessions.clear(); this.submitted.clear(); this.nextRead = null; this.nextCommand = null; }
  async logout(token: string) { this.sessions.delete(token); }
  private async wait(kind: 'read' | 'command', signal?: AbortSignal, token?: string) {
    const generation = this.generation;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, this.delayMs);
      signal?.addEventListener('abort', abort, { once: true });
    });
    if (generation !== this.generation) throw error(409, 'DEMO_RESET', 'Демо было сброшено. Войдите снова.');
    const failure = kind === 'read' ? this.nextRead : this.nextCommand;
    if (failure) {
      if (kind === 'read') this.nextRead = null; else this.nextCommand = null;
      if (failure === 401 && token) { this.sessions.delete(token); this.unauthorized(token); }
      throw error(failure, `DEMO_${failure}`);
    }
  }
  private user(token: string, client = false) {
    const user = this.sessions.get(token);
    if (!user) { this.unauthorized(token); throw error(401, 'UNAUTHORIZED', 'Сессия истекла. Войдите снова.'); }
    if (client && user.role !== 'client') throw error(403, 'FORBIDDEN', 'Раздел доступен только клиенту.');
    return user;
  }
  async personas(signal?: AbortSignal) {
    await this.wait('read', signal);
    return [...demoData.personas.map(({ login, label }) => ({ login, label })), { login: 'underwriter', label: 'Сотрудник банка · демо' }];
  }
  async login(login: string, password: string) {
    await this.wait('command');
    const persona = demoData.personas.find((p) => p.login === login);
    if (password !== 'demo' || (!persona && login !== 'underwriter')) throw error(401, 'BAD_CREDENTIALS', 'Проверьте логин и пароль');
    const token = `demo-${crypto.randomUUID()}`;
    this.sessions.set(token, { id: persona?.id ?? 'underwriter', login, name: persona?.label ?? 'Кредитный специалист', role: persona ? 'client' : 'bank', companyId: persona?.id ?? null });
    return { token };
  }
  async me(token: string, signal?: AbortSignal) { await this.wait('read', signal, token); return { ...this.user(token) }; }
  async company(token: string, signal?: AbortSignal) {
    await this.wait('read', signal, token);
    const user = this.user(token, true);
    return { ...demoData.personas.find((p) => p.id === user.companyId)!.company };
  }
  async products(token: string, signal?: AbortSignal) { await this.wait('read', signal, token); this.user(token); return demoData.products.map((p) => ({ ...p })); }
  async applications(token: string, signal?: AbortSignal) {
    await this.wait('read', signal, token); const user = this.user(token, true);
    return [...this.records.values()].filter((a) => a.companyId === user.companyId).map((a) => this.snapshot(a));
  }
  private owned(token: string, id: string) {
    const user = this.user(token, true); const record = this.records.get(id);
    if (!record || record.companyId !== user.companyId) throw error(404, 'NOT_FOUND', 'Заявка не найдена или недоступна.');
    return record;
  }
  private snapshot(record: Application): Application {
    const at = this.submitted.get(record.id);
    const persona = demoData.personas.find((p) => p.id === record.companyId)!;
    const exact = record.productCode === persona.request.product_code && record.amount.replace(/\.0+$/, '') === persona.request.amount.replace(/\.0+$/, '') && record.termMonths === persona.request.term_months;
    const journey = exact ? persona.journey : demoData.customJourney;
    const phase = at === undefined ? 0 : this.now() - at >= 4500 ? 3 : this.now() - at >= 1500 ? 2 : 1;
    const history = journey.slice(0, phase + 1).map((event, index) => ({ ...event, at: index === 0 ? record.createdAt : new Date(at! + [0, 0, 1500, 4500][index]).toISOString() }));
    return structuredClone({ ...record, status: journey[phase].to, version: record.version + phase, history });
  }
  async application(token: string, id: string, signal?: AbortSignal) { await this.wait('read', signal, token); return this.snapshot(this.owned(token, id)); }
  async save(token: string, input: ApplicationInput, id?: string, version?: number) {
    await this.wait('command', undefined, token); const user = this.user(token, true);
    const existing = id ? this.owned(token, id) : undefined;
    if (existing && (this.submitted.has(existing.id) || existing.version !== version)) throw error(409, 'VERSION_CONFLICT', 'Черновик изменился. Обновите страницу заявки.');
    const errors = validateInput(input, demoData.products.find((p) => p.code === input.productCode), false);
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION', 'Проверьте поля заявки', errors);
    const createdAt = existing?.createdAt ?? new Date(this.now()).toISOString();
    const record: Application = { ...structuredClone(input), id: id ?? crypto.randomUUID(), companyId: user.companyId!, status: 'DRAFT', version: existing ? existing.version + 1 : 1, history: [], createdAt };
    this.records.set(record.id, record); return this.snapshot(record);
  }
  async submit(token: string, id: string, version: number) {
    await this.wait('command', undefined, token); const record = this.owned(token, id);
    if (this.submitted.has(id) || record.version !== version) throw error(409, 'VERSION_CONFLICT', 'Заявка уже подана или изменена. Обновите её.');
    const errors = validateInput(record, demoData.products.find((p) => p.code === record.productCode), true);
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION', 'Проверьте поля заявки', errors);
    if ([...this.records.values()].some((a) => a.id !== id && a.companyId === record.companyId && ['SUBMITTED', 'SCORING', 'UNDERWRITING', 'APPROVED', 'COUNTER_OFFER', 'SIGNING', 'SIGNED'].includes(this.snapshot(a).status))) throw error(409, 'ACTIVE_APPLICATION', 'У компании уже есть активная заявка.');
    this.submitted.set(id, this.now()); return this.snapshot(record);
  }
}

export function unavailableGateway(): WorkspaceGateway {
  const unavailable = async (): Promise<never> => { throw error(503, 'API_NOT_CONFIGURED', 'API Dev 2 ещё не подключён. Выберите mock-режим для демонстрации.'); };
  return { personas: unavailable, login: unavailable, me: unavailable, company: unavailable, products: unavailable, applications: unavailable, application: unavailable, save: unavailable, submit: unavailable };
}
