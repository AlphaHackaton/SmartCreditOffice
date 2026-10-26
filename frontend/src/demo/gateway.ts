import { ApiError } from '../api/errors';
import { bankDemoData, demoData, type ApplicationStatus } from './generated';
import {
  type MetricSourceFilter,
  type MetricsFilter,
  type PipelineMetrics,
  validateMetricsFilter,
  calculatePipelineMetrics,
} from './metrics';

export type { MetricSourceFilter, MetricsFilter, PipelineMetrics };

// Temporary UI models. Dev 2's generated HTTP DTOs will be mapped by an adapter.
export type Role = 'client' | 'bank';
export type DataMode = 'mock' | 'api';
export interface User { id: string; login: string; name: string; role: Role; companyId: string | null }
export interface Company { id: string; name: string; inn: string; legal_form: string; registered_at: string; okved: string }
export interface Product { code: string; name: string; min_amount: string; max_amount: string; min_term: number; max_term: number }
export interface HistoryEvent { from: string | null; to: string; actor: string; at: string; reason?: string }
export interface ApplicationInput { productCode: string; amount: string; termMonths: number; purpose: string; consents: string[] }
export interface Factor { code: string; text: string; hint: string | null; impact: string }
export interface Offer { id: string; kind: string; amount: string; term_months: number; rate_pct: string; monthly_payment: string; overpayment: string; expiresAt: string }
export interface QueueItem { id: string; companyName: string; inn: string; productCode: string; productName: string; amount: string; termMonths: number; status: ApplicationStatus; createdAt: string; synthetic: boolean }
export interface Simulation { amount: string; termMonths: number; outcome: string; requiresReview: boolean; offers: Omit<Offer, 'id' | 'expiresAt'>[]; constraints: Decision['constraints']; maxAmount: string; headroom: string }
export interface SimulationOptions { amounts: string[]; terms: number[] }
export interface SigningChallenge { id: string; code: string; expiresAt: string; attemptsLeft: number }
export interface Decision { factors: Factor[]; offers: Offer[]; constraints: { name: string; limit: string; binding: boolean }[]; binding: string | null; recommendations: string[]; policyVersion: string }
export interface Application extends ApplicationInput { id: string; companyId: string; status: ApplicationStatus; version: number; history: HistoryEvent[]; createdAt: string; decision?: Decision; selectedOffer?: Offer; companyName?: string }
export interface Persona { login: string; label: string }

export interface BankBin {
  lower: string | null;
  upper: string | null;
  inclusive_upper: boolean;
  points: number;
  code: string;
  rule: string;
}

export interface BankFactor {
  code: string;
  source: string;
  value: string;
  points: number;
  maxPoints: number;
  impact: string;
  ruleId: string;
  clientText: string;
  hint: string | null;
  bin: BankBin | null;
}

export interface ScoringRun {
  id: string;
  inputHash: string;
  resultHash: string;
  evaluatedAt: string;
  policyVersion: string;
  metrics: Record<string, string | number | null>;
  factors: BankFactor[];
  constraints: { name: string; limit: string; binding: boolean }[];
  result: {
    recommendation: string;
    route: string;
    score: number | null;
    grade: string | null;
    bindingConstraint: string | null;
    topReasons: string[];
    reviewFlags: string[];
  };
  offers: Omit<Offer, 'id' | 'expiresAt'>[];
}

export interface AuditEntry {
  id: string;
  action: 'DECISION' | 'OVERRIDE' | 'REPLAY';
  actorId: string;
  at: string;
  versionBefore: number;
  versionAfter: number;
  engineOutcome: string;
  selectedOutcome: string;
  override: boolean;
  offerId?: string;
  comment?: string;
  policyVersion: string;
}

export interface BankDossier {
  application: Application;
  source: 'example' | 'session';
  inputsSnapshot: Record<string, unknown>;
  runs: ScoringRun[];
  currentRunId: string;
  engineRecommendation: string;
  allowedOutcomes: ('APPROVED' | 'COUNTER_OFFER' | 'REJECTED')[];
  eligibleOffers: Offer[];
  audit: AuditEntry[];
}

export interface ReplayResult {
  match: boolean;
  run: ScoringRun;
  message: string;
}

export interface DecideInput {
  outcome: 'APPROVED' | 'COUNTER_OFFER' | 'REJECTED';
  offerId?: string;
  comment: string;
  version: number;
}

export interface WorkspaceGateway {
  personas(signal?: AbortSignal): Promise<Persona[]>;
  login(login: string, password: string): Promise<{ token: string }>;
  me(token: string, signal?: AbortSignal): Promise<User>;
  company(token: string, signal?: AbortSignal): Promise<Company>;
  products(token: string, signal?: AbortSignal): Promise<Product[]>;
  applications(token: string, signal?: AbortSignal): Promise<Application[]>;
  application(token: string, id: string, signal?: AbortSignal): Promise<Application>;
  save(token: string, input: ApplicationInput, id?: string, version?: number): Promise<Application>;
  queue(token: string, signal?: AbortSignal): Promise<QueueItem[]>;
  simulationOptions(token: string, id: string, signal?: AbortSignal): Promise<SimulationOptions>;
  simulate(token: string, id: string, amount: string, termMonths: number, signal?: AbortSignal): Promise<Simulation>;
  challenge(token: string, id: string, signal?: AbortSignal): Promise<SigningChallenge>;
  sign(token: string, id: string, version: number, challengeId: string, code: string): Promise<Application>;
  accept(token: string, id: string, version: number, offerId: string): Promise<Application>;
  submit(token: string, id: string, version: number): Promise<Application>;
  dossier(token: string, id: string, signal?: AbortSignal): Promise<BankDossier>;
  decide(token: string, id: string, input: DecideInput): Promise<BankDossier>;
  replayDossier(token: string, id: string, runId: string, signal?: AbortSignal): Promise<ReplayResult>;
  metrics(token: string, filter?: Partial<MetricsFilter>, signal?: AbortSignal): Promise<PipelineMetrics>;
  scenarios(signal?: AbortSignal): Promise<DemoScenario[]>;
  sandboxCatalog(token: string, signal?: AbortSignal): Promise<SandboxCatalog>;
  sandboxRun(token: string, input: SandboxRunInput, signal?: AbortSignal): Promise<SandboxResult>;
}
export type FailureStatus = 401 | 403 | 404 | 409 | 422 | 503;

export type FailureTarget =
  | 'any'
  | 'login'
  | 'application_read'
  | 'dossier_read'
  | 'metrics_read'
  | 'sandbox_read'
  | 'save'
  | 'submit'
  | 'accept'
  | 'sign'
  | 'decide';

export type FailureVariant = FailureStatus | 'network';

export interface FailurePlan {
  kind: 'read' | 'command';
  target: FailureTarget;
  variant: FailureVariant;
  state: 'pending' | 'consumed';
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  personaLogin: string;
  startingStage: string;
  expectedSteps: string;
}

export interface LoadScenarioResult {
  success: boolean;
  scenarioId: string;
  personaLogin: string;
}

export interface SandboxCatalog {
  personas: { id: string; label: string; companyName: string; inn: string; productCode: string }[];
  turnoverVariants: { id: 'baseline' | 'reduced'; label: string }[];
  overdueVariants: { id: number; label: string }[];
  businessAgeVariants: { id: number; label: string }[];
  policies: { id: string; name: string; keyRatePct: string; version: string }[];
}

export interface SandboxRunInput {
  personaId: string;
  turnoverVariant: 'baseline' | 'reduced';
  overdueDays: number;
  businessAgeMonths: number;
  policyId: string;
  isExactBaseline?: boolean;
}

export interface SandboxResult {
  inputHash: string;
  resultHash: string;
  policyId: string;
  policyVersion: string;
  keyRatePct: string;
  inputSnapshot: Record<string, unknown>;
  metrics: Record<string, string | number | null>;
  result: {
    recommendation: string;
    route: string;
    score: number | null;
    grade: string | null;
    bindingConstraint: string | null;
    topReasons: string[];
    reviewFlags: string[];
  };
  offers: Omit<Offer, 'id' | 'expiresAt'>[];
  constraints: { name: string; limit: string; binding: boolean }[];
  factors: { code: string; impact: string; clientText: string; hint: string | null }[];
  disclaimer: string;
}

const message = 'Не удалось выполнить действие. Повторите попытку.';
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
  private readPlan: FailurePlan | null = null;
  private commandPlan: FailurePlan | null = null;
  private activeScenarioId: string = 'factory';
  private sessions = new Map<string, User>();
  private records = new Map<string, Application>();
  private accepted = new Map<string, { offer: Offer; event: HistoryEvent; challenge: SigningChallenge; signedAt?: number }>();
  private submitted = new Map<string, number>();
  private seedDossiers = new Map<string, BankDossier>();
  private liveDecisions = new Map<string, { outcome: 'APPROVED' | 'COUNTER_OFFER' | 'REJECTED'; offer?: Offer; event: HistoryEvent; version: number }>();
  private liveAudit = new Map<string, AuditEntry[]>();
  private now: () => number;
  constructor(now = Date.now, private unauthorized: (token: string) => void = () => {}) {
    this.now = now;
    this.initSeedDossiers();
  }
  setUnauthorized(callback: (token: string) => void) { this.unauthorized = callback; }
  failNext(kind: 'read' | 'command', status: FailureStatus) { if (kind === 'read') this.nextRead = status; else this.nextCommand = status; }
  planFailure(plan: Omit<FailurePlan, 'state'>) {
    const readTargets: FailureTarget[] = ['any', 'application_read', 'dossier_read', 'metrics_read', 'sandbox_read'];
    const commandTargets: FailureTarget[] = ['any', 'login', 'save', 'submit', 'accept', 'sign', 'decide'];
    if (plan.kind === 'read') {
      if (!readTargets.includes(plan.target)) {
        throw new Error(`Недопустимая цель ${plan.target} для операции чтения`);
      }
      if (plan.variant === 409 || plan.variant === 422) {
        throw new Error(`Недопустимый статус ${plan.variant} для операции чтения`);
      }
      this.readPlan = { ...plan, state: 'pending' };
    } else {
      if (!commandTargets.includes(plan.target)) {
        throw new Error(`Недопустимая цель ${plan.target} для команды`);
      }
      this.commandPlan = { ...plan, state: 'pending' };
    }
  }
  cancelFailure(kind: 'read' | 'command') {
    if (kind === 'read') this.readPlan = null;
    else this.commandPlan = null;
  }
  getPendingFailures(): { read: FailurePlan | null; command: FailurePlan | null } {
    return { read: this.readPlan, command: this.commandPlan };
  }
  getActiveScenarioId(): string {
    return this.activeScenarioId;
  }
  loadScenario(scenarioId: string): LoadScenarioResult {
    const presets = bankDemoData.scenarioPresets as unknown as Record<string, {
      scenario: DemoScenario;
      application: (Application & { challenge?: { id: string; code: string; attemptsLeft: number; expiresInMs: number } }) | null;
    }>;
    const preset = presets[scenarioId];
    if (!preset) throw error(404, 'SCENARIO_NOT_FOUND', `Сценарий ${scenarioId} не найден.`);

    this.generation++;
    this.records.clear();
    this.sessions.clear();
    this.submitted.clear();
    this.accepted.clear();
    this.liveDecisions.clear();
    this.liveAudit.clear();
    this.readPlan = null;
    this.commandPlan = null;
    this.nextRead = null;
    this.nextCommand = null;
    this.activeScenarioId = scenarioId;
    this.initSeedDossiers();

    if (preset.application) {
      const rawApp: Application = structuredClone(preset.application);
      const now = this.now();

      if (scenarioId === 'p1-apply') {
        rawApp.createdAt = new Date(now).toISOString();
        rawApp.history = [{ from: null, to: 'DRAFT', actor: 'CLIENT', at: rawApp.createdAt }];
        this.records.set(rawApp.id, rawApp);
      } else if (scenarioId === 'p1-expired') {
        const at = now - 35 * 60_000;
        this.submitted.set(rawApp.id, at);
        rawApp.createdAt = new Date(at - 1000).toISOString();
        this.records.set(rawApp.id, rawApp);
      } else if (scenarioId === 'p1-signing') {
        const at = now - 5000;
        this.submitted.set(rawApp.id, at);
        rawApp.createdAt = new Date(at - 1000).toISOString();
        this.records.set(rawApp.id, rawApp);
        const offer = rawApp.decision!.offers[0];
        const challenge: SigningChallenge = {
          id: 'challenge-p1-signing',
          code: '123456',
          attemptsLeft: 3,
          expiresAt: new Date(now + 5 * 60_000).toISOString(),
        };
        const event = demoData.decisionEvents.APPROVED_SIGNING;
        this.accepted.set(rawApp.id, {
          offer: { ...offer, id: `${rawApp.id}-offer-0`, expiresAt: new Date(now + 30 * 60_000).toISOString() },
          event: { ...event, at: new Date(now).toISOString() },
          challenge,
        });
      } else if (scenarioId === 'p1-signed') {
        const at = now - 5000;
        this.submitted.set(rawApp.id, at);
        rawApp.createdAt = new Date(at - 1000).toISOString();
        this.records.set(rawApp.id, rawApp);
        const offer = rawApp.decision!.offers[0];
        const challenge: SigningChallenge = {
          id: 'challenge-p1-signed',
          code: '123456',
          attemptsLeft: 3,
          expiresAt: new Date(now + 5 * 60_000).toISOString(),
        };
        const event = demoData.decisionEvents.APPROVED_SIGNING;
        this.accepted.set(rawApp.id, {
          offer: { ...offer, id: `${rawApp.id}-offer-0`, expiresAt: new Date(now + 30 * 60_000).toISOString() },
          event: { ...event, at: new Date(now).toISOString() },
          challenge,
          signedAt: now,
        });
      } else if (scenarioId === 'p1-disbursed') {
        const at = now - 10000;
        this.submitted.set(rawApp.id, at);
        rawApp.createdAt = new Date(at - 1000).toISOString();
        this.records.set(rawApp.id, rawApp);
        const offer = rawApp.decision!.offers[0];
        const challenge: SigningChallenge = {
          id: 'challenge-p1-disbursed',
          code: '123456',
          attemptsLeft: 3,
          expiresAt: new Date(now + 5 * 60_000).toISOString(),
        };
        const event = demoData.decisionEvents.APPROVED_SIGNING;
        this.accepted.set(rawApp.id, {
          offer: { ...offer, id: `${rawApp.id}-offer-0`, expiresAt: new Date(now + 30 * 60_000).toISOString() },
          event: { ...event, at: new Date(now).toISOString() },
          challenge,
          signedAt: now - 3000,
        });
      } else {
        const at = now - 5000;
        this.submitted.set(rawApp.id, at);
        rawApp.createdAt = new Date(at - 1000).toISOString();
        this.records.set(rawApp.id, rawApp);
      }
    }

    return {
      success: true,
      scenarioId,
      personaLogin: preset.scenario.personaLogin,
    };
  }
  reset() {
    this.generation++;
    this.records.clear();
    this.sessions.clear();
    this.submitted.clear();
    this.accepted.clear();
    this.liveDecisions.clear();
    this.liveAudit.clear();
    this.readPlan = null;
    this.commandPlan = null;
    this.nextRead = null;
    this.nextCommand = null;
    this.activeScenarioId = 'factory';
    this.initSeedDossiers();
  }
  async logout(token: string) { this.sessions.delete(token); }
  private async wait(kind: 'read' | 'command', target: FailureTarget = 'any', signal?: AbortSignal, token?: string) {
    const generation = this.generation;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, this.delayMs);
      signal?.addEventListener('abort', abort, { once: true });
    });
    if (generation !== this.generation) throw error(409, 'DEMO_RESET', 'Данные обновлены. Войдите снова.');

    // Check targeted failure plan
    const plan = kind === 'read' ? this.readPlan : this.commandPlan;
    if (plan && plan.state === 'pending' && (plan.target === 'any' || plan.target === target)) {
      plan.state = 'consumed';
      if (plan.variant === 'network') {
        throw new ApiError(null, 'NETWORK_ERROR', 'Сетевой сбой. Проверьте подключение к интернету.');
      }
      const status = plan.variant as FailureStatus;
      if (status === 401 && token) {
        this.sessions.delete(token);
        this.unauthorized(token);
      }
      if (status === 422) {
        let fieldErrors: Record<string, string> | undefined;
        let msg = 'Ошибка валидации данных.';
        if (target === 'save') {
          fieldErrors = { amount: 'Некорректная сумма' };
          msg = 'Проверьте поля заявки';
        } else if (target === 'sign') {
          fieldErrors = { code: 'Неверный код' };
          msg = 'Неверный код. Осталось попыток: 2';
        } else if (target === 'decide') {
          fieldErrors = { comment: 'Обязательный комментарий (от 1 до 2000 символов)' };
          msg = 'Укажите комментарий андеррайтера (от 1 до 2000 символов).';
        }
        throw new ApiError(422, 'VALIDATION', msg, fieldErrors);
      }
      throw error(status, `DEMO_${status}`);
    }

    // Legacy global nextRead / nextCommand
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
  private initSeedDossiers() {
    this.seedDossiers.clear();
    for (const raw of demoData.personas) {
      const seedData = bankDemoData.dossiers[raw.id as keyof typeof bankDemoData.dossiers];
      const app: Application = {
        id: `seed-${raw.id}`,
        companyId: raw.id,
        companyName: raw.company.name,
        productCode: raw.request.product_code,
        amount: raw.request.amount,
        termMonths: raw.request.term_months,
        purpose: 'WORKING_CAPITAL',
        consents: ['BKI_REQUEST', 'PD_PROCESSING'],
        status: seedData.status as ApplicationStatus,
        version: seedData.journey.length,
        history: seedData.journey.map((e, index) => ({
          from: e.from,
          to: e.to,
          actor: e.actor,
          at: new Date(Date.parse('2026-10-25T09:00:00Z') + index * 1000).toISOString(),
        })),
        createdAt: new Date(Date.parse('2026-10-25T09:00:00Z')).toISOString(),
      };
      const scoringRun: ScoringRun = structuredClone(seedData.runs[0] as unknown as ScoringRun);
      const eligibleOffers: Offer[] = seedData.eligibleOffers.map((o, i) => ({
        ...o,
        id: `seed-${raw.id}-eligible-${i}`,
        expiresAt: new Date(this.now() + 30 * 60_000).toISOString(),
      }));

      this.seedDossiers.set(`seed-${raw.id}`, {
        application: app,
        source: 'example',
        inputsSnapshot: structuredClone(seedData.inputsSnapshot as unknown as Record<string, unknown>),
        runs: [scoringRun],
        currentRunId: scoringRun.id,
        engineRecommendation: seedData.engineRecommendation,
        allowedOutcomes: [...seedData.allowedOutcomes] as ('APPROVED' | 'COUNTER_OFFER' | 'REJECTED')[],
        eligibleOffers,
        audit: [],
      });
    }
  }
  async personas(signal?: AbortSignal) {
    await this.wait('read', 'any', signal);
    return [...demoData.personas.map(({ login, label }) => ({ login, label })), { login: 'underwriter', label: 'Сотрудник банка · демо' }];
  }
  async login(login: string, password: string) {
    await this.wait('command', 'login');
    const persona = demoData.personas.find((p) => p.login === login);
    if (password !== 'demo' || (!persona && login !== 'underwriter')) throw error(401, 'BAD_CREDENTIALS', 'Проверьте логин и пароль');
    const token = `demo-${crypto.randomUUID()}`;
    this.sessions.set(token, { id: persona?.id ?? 'underwriter', login, name: persona?.company.name ?? 'Кредитный специалист', role: persona ? 'client' : 'bank', companyId: persona?.id ?? null });
    return { token };
  }
  async me(token: string, signal?: AbortSignal) { await this.wait('read', 'any', signal, token); return { ...this.user(token) }; }
  async company(token: string, signal?: AbortSignal) {
    await this.wait('read', 'any', signal, token);
    const user = this.user(token, true);
    return { ...demoData.personas.find((p) => p.id === user.companyId)!.company };
  }
  async products(token: string, signal?: AbortSignal) { await this.wait('read', 'any', signal, token); this.user(token); return demoData.products.map((p) => ({ ...p })); }
  async applications(token: string, signal?: AbortSignal) {
    await this.wait('read', 'application_read', signal, token); const user = this.user(token, true);
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
    const isP6CapexReview = record.companyId === 'p6_mismatch' && record.productCode === 'CAPEX' && record.amount.replace(/\.0+$/, '') === '6000000' && record.termMonths === 24;
    const exact = isP6CapexReview || (record.productCode === persona.request.product_code && record.amount.replace(/\.0+$/, '') === persona.request.amount.replace(/\.0+$/, '') && record.termMonths === persona.request.term_months);
    const journey = isP6CapexReview ? bankDemoData.reviewVariants.p6_capex_6m_24m.journey : exact ? persona.journey : demoData.customJourney;
    const phase = at === undefined ? 0 : this.now() - at >= 4500 ? 3 : this.now() - at >= 1500 ? 2 : 1;
    const history: HistoryEvent[] = journey.slice(0, phase + 1).map((event, index) => ({ ...event, at: index === 0 ? record.createdAt : new Date(at! + [0, 0, 1500, 4500][index]).toISOString() }));
    let status: ApplicationStatus = journey[phase].to;
    const expiresAt = new Date((at ?? this.now()) + 4500 + 30 * 60_000).toISOString();

    let decision: Decision | undefined = undefined;
    if (phase === 3) {
      if (isP6CapexReview) {
        const variant = bankDemoData.reviewVariants.p6_capex_6m_24m;
        decision = {
          ...variant.clientDecision,
          recommendations: [...variant.clientDecision.recommendations],
          factors: variant.clientDecision.factors.map((f) => ({ ...f })),
          constraints: variant.clientDecision.constraints.map((c) => ({ ...c })),
          offers: variant.eligibleOffers.map((offer, i) => ({ ...offer, id: `${record.id}-offer-${i}`, expiresAt })),
        };
      } else if (exact) {
        decision = {
          ...persona.decision,
          recommendations: [...persona.decision.recommendations],
          factors: persona.decision.factors.map((f) => ({ ...f })),
          constraints: persona.decision.constraints.map((c) => ({ ...c })),
          offers: persona.decision.offers.map((offer, i) => ({ ...offer, id: `${record.id}-offer-${i}`, expiresAt })),
        };
      }
    }

    const bankDecision = this.liveDecisions.get(record.id);
    if (bankDecision) {
      history.push(bankDecision.event);
      status = bankDecision.outcome;
      if (bankDecision.offer) {
        const publicFactors = isP6CapexReview
          ? bankDemoData.reviewVariants.p6_capex_6m_24m.clientDecision.factors
          : persona.decision.factors;
        decision = {
          factors: publicFactors.map((f) => ({ ...f })),
          offers: [bankDecision.offer],
          constraints: isP6CapexReview
            ? bankDemoData.reviewVariants.p6_capex_6m_24m.clientDecision.constraints.map((c) => ({ ...c }))
            : persona.decision.constraints.map((c) => ({ ...c })),
          binding: isP6CapexReview
            ? bankDemoData.reviewVariants.p6_capex_6m_24m.clientDecision.binding
            : persona.decision.binding,
          recommendations: isP6CapexReview
            ? [...bankDemoData.reviewVariants.p6_capex_6m_24m.clientDecision.recommendations]
            : [...persona.decision.recommendations],
          policyVersion: bankDemoData.policy.version,
        };
      } else {
        const publicFactors = isP6CapexReview
          ? bankDemoData.reviewVariants.p6_capex_6m_24m.clientDecision.factors
          : persona.decision.factors;
        decision = {
          factors: publicFactors.map((f) => ({ ...f })),
          offers: [],
          constraints: [],
          binding: null,
          recommendations: isP6CapexReview
            ? [...bankDemoData.reviewVariants.p6_capex_6m_24m.clientDecision.recommendations]
            : [...persona.decision.recommendations],
          policyVersion: bankDemoData.policy.version,
        };
      }
    }

    const accepted = this.accepted.get(record.id);
    if (accepted) {
      history.push(accepted.event); status = 'SIGNING';
      if (accepted.signedAt !== undefined) {
        const signed = demoData.signingEvents.SIGNING_SIGNED;
        history.push({ ...signed, at: new Date(accepted.signedAt).toISOString() }); status = signed.to;
        if (this.now() >= accepted.signedAt + 1500) {
          const issued = demoData.signingEvents.SIGNED_DISBURSED;
          history.push({ ...issued, at: new Date(accepted.signedAt + 1500).toISOString() }); status = issued.to;
        }
      } else if (this.now() >= Date.parse(accepted.challenge.expiresAt)) {
        const expired = demoData.signingEvents.SIGNING_EXPIRED;
        history.push({ ...expired, at: accepted.challenge.expiresAt }); status = expired.to;
      }
    }
    else if ((status === 'APPROVED' || status === 'COUNTER_OFFER') && this.now() >= Date.parse(expiresAt)) {
      const event = demoData.decisionEvents[`${status}_EXPIRED`];
      history.push({ ...event, at: expiresAt }); status = event.to;
    }
    return structuredClone({ ...record, status, version: record.version + history.length - 1, history, decision, selectedOffer: accepted?.offer });
  }
  async application(token: string, id: string, signal?: AbortSignal) { await this.wait('read', 'application_read', signal, token); return this.snapshot(this.owned(token, id)); }
  async save(token: string, input: ApplicationInput, id?: string, version?: number) {
    await this.wait('command', 'save', undefined, token); const user = this.user(token, true);
    const existing = id ? this.owned(token, id) : undefined;
    if (existing && (this.submitted.has(existing.id) || existing.version !== version)) throw error(409, 'VERSION_CONFLICT', 'Черновик изменился. Обновите страницу заявки.');
    const errors = validateInput(input, demoData.products.find((p) => p.code === input.productCode), false);
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION', 'Проверьте поля заявки', errors);
    const createdAt = existing?.createdAt ?? new Date(this.now()).toISOString();
    const record: Application = { ...structuredClone(input), id: id ?? crypto.randomUUID(), companyId: user.companyId!, status: 'DRAFT', version: existing ? existing.version + 1 : 1, history: [], createdAt };
    this.records.set(record.id, record); return this.snapshot(record);
  }
  async queue(token: string, signal?: AbortSignal): Promise<QueueItem[]> {
    await this.wait('read', 'dossier_read', signal, token);
    if (this.user(token).role !== 'bank') throw error(403, 'FORBIDDEN', 'Очередь доступна только сотруднику банка.');
    const examples: QueueItem[] = demoData.personas.map((p) => {
      const seedDossier = this.seedDossiers.get(`seed-${p.id}`)!;
      return {
        id: seedDossier.application.id,
        companyName: p.company.name,
        inn: p.company.inn,
        productCode: seedDossier.application.productCode,
        productName: demoData.products.find((v) => v.code === seedDossier.application.productCode)!.name,
        amount: seedDossier.application.amount,
        termMonths: seedDossier.application.termMonths,
        status: seedDossier.application.status,
        createdAt: seedDossier.application.createdAt,
        synthetic: true,
      };
    });
    const live: QueueItem[] = [...this.records.values()].map((record) => {
      const app = this.snapshot(record); const p = demoData.personas.find((v) => v.id === app.companyId)!;
      return { id: app.id, companyName: p.company.name, inn: p.company.inn, productCode: app.productCode, productName: demoData.products.find((v) => v.code === app.productCode)!.name, amount: app.amount, termMonths: app.termMonths, status: app.status, createdAt: app.createdAt, synthetic: false };
    });
    return structuredClone([...examples, ...live]);
  }
  async simulationOptions(token: string, id: string, signal?: AbortSignal) {
    await this.wait('read', 'application_read', signal, token); const record = this.owned(token, id);
    const persona = demoData.personas.find((p) => p.id === record.companyId)!;
    if (record.productCode !== persona.request.product_code) throw error(422, 'NO_DEMO_SIMULATION', 'Предварительный расчёт для этого продукта пока недоступен.');
    return { amounts: [...persona.simulation.amounts], terms: [...persona.simulation.terms] };
  }
  async simulate(token: string, id: string, amount: string, termMonths: number, signal?: AbortSignal): Promise<Simulation> {
    await this.wait('read', 'application_read', signal, token); const record = this.owned(token, id);
    const persona = demoData.personas.find((p) => p.id === record.companyId)!;
    const result = record.productCode === persona.request.product_code ? persona.simulation.rows.find((r) => r.amount.replace(/\.0+$/, '') === amount.replace(/\.0+$/, '') && r.termMonths === termMonths) : undefined;
    if (!result) throw error(422, 'NO_DEMO_SIMULATION', 'Расчёт для выбранных условий недоступен. Выберите другую сумму и срок.');
    return structuredClone({ ...result, offers: result.offers.map((o) => ({ ...o })), constraints: result.constraints.map((c) => ({ ...c })) });
  }
  async challenge(token: string, id: string, signal?: AbortSignal) {
    await this.wait('read', 'application_read', signal, token); const current = this.snapshot(this.owned(token, id));
    if (current.status !== 'SIGNING') throw error(409, 'CHALLENGE_UNAVAILABLE', 'Подтверждение недоступно или истекло. Обновите заявку.');
    return structuredClone(this.accepted.get(id)!.challenge);
  }
  async sign(token: string, id: string, version: number, challengeId: string, code: string) {
    await this.wait('command', 'sign', undefined, token); const record = this.owned(token, id); const current = this.snapshot(record);
    if (current.status !== 'SIGNING' || current.version !== version) throw error(409, 'VERSION_CONFLICT', 'Заявка изменилась или подтверждение истекло. Обновите заявку.');
    const state = this.accepted.get(id)!;
    if (state.challenge.id !== challengeId || state.challenge.attemptsLeft === 0) throw error(409, 'CHALLENGE_BLOCKED', 'Подписание заблокировано. Отмените заявку и создайте новую.');
    if (code !== state.challenge.code) {
      state.challenge.attemptsLeft--;
      throw new ApiError(422, 'INVALID_CODE', `Неверный код. Осталось попыток: ${state.challenge.attemptsLeft}`, { code: 'Неверный код' });
    }
    state.signedAt = this.now(); return this.snapshot(record);
  }
  async accept(token: string, id: string, version: number, offerId: string) {
    await this.wait('command', 'accept', undefined, token); const record = this.owned(token, id); const current = this.snapshot(record);
    if (current.version !== version || (current.status !== 'APPROVED' && current.status !== 'COUNTER_OFFER')) throw error(409, 'VERSION_CONFLICT', 'Условия изменились или истекли. Обновите заявку.');
    const offer = current.decision?.offers.find((o) => o.id === offerId);
    if (!offer || this.now() >= Date.parse(offer.expiresAt)) throw error(409, 'OFFER_EXPIRED', 'Предложение недоступно. Обновите заявку.');
    const event = demoData.decisionEvents[`${current.status}_SIGNING`];
    this.accepted.set(id, { offer, event: { ...event, at: new Date(this.now()).toISOString() }, challenge: { id: crypto.randomUUID(), code: '123456', expiresAt: new Date(this.now() + 5 * 60_000).toISOString(), attemptsLeft: 3 } });
    return this.snapshot(record);
  }
  async submit(token: string, id: string, version: number) {
    await this.wait('command', 'submit', undefined, token); const record = this.owned(token, id);
    if (this.submitted.has(id) || record.version !== version) throw error(409, 'VERSION_CONFLICT', 'Заявка уже подана или изменена. Обновите её.');
    const errors = validateInput(record, demoData.products.find((p) => p.code === record.productCode), true);
    if (Object.keys(errors).length) throw new ApiError(422, 'VALIDATION', 'Проверьте поля заявки', errors);
    if ([...this.records.values()].some((a) => a.id !== id && a.companyId === record.companyId && ['SUBMITTED', 'SCORING', 'UNDERWRITING', 'APPROVED', 'COUNTER_OFFER', 'SIGNING', 'SIGNED'].includes(this.snapshot(a).status))) throw error(409, 'ACTIVE_APPLICATION', 'У компании уже есть активная заявка.');
    this.submitted.set(id, this.now()); return this.snapshot(record);
  }

  private buildLiveDossier(record: Application): BankDossier {
    const app = this.snapshot(record);
    const persona = demoData.personas.find((p) => p.id === record.companyId)!;
    const isP6CapexReview = record.companyId === 'p6_mismatch' && record.productCode === 'CAPEX' && record.amount.replace(/\.0+$/, '') === '6000000' && record.termMonths === 24;

    let run: ScoringRun;
    let inputsSnapshot: Record<string, unknown>;
    let engineRecommendation: string;
    let allowedOutcomes: ('APPROVED' | 'COUNTER_OFFER' | 'REJECTED')[];
    let eligibleOffers: Offer[];

    if (isP6CapexReview) {
      const variant = bankDemoData.reviewVariants.p6_capex_6m_24m;
      run = structuredClone(variant.scoringRun as unknown as ScoringRun);
      inputsSnapshot = structuredClone(bankDemoData.dossiers.p6_mismatch.inputsSnapshot as unknown as Record<string, unknown>);
      engineRecommendation = variant.scoringRun.result.recommendation;
      allowedOutcomes = app.status === 'UNDERWRITING' ? [...variant.allowedOutcomes] as ('APPROVED' | 'COUNTER_OFFER' | 'REJECTED')[] : [];
      eligibleOffers = variant.eligibleOffers.map((o, i) => ({
        ...o,
        id: `${record.id}-eligible-${i}`,
        expiresAt: new Date(this.now() + 30 * 60_000).toISOString(),
      }));
    } else {
      const seedData = bankDemoData.dossiers[persona.id as keyof typeof bankDemoData.dossiers];
      run = structuredClone(seedData.runs[0] as unknown as ScoringRun);
      inputsSnapshot = structuredClone(seedData.inputsSnapshot as unknown as Record<string, unknown>);
      engineRecommendation = seedData.engineRecommendation;
      allowedOutcomes = app.status === 'UNDERWRITING' ? [...seedData.allowedOutcomes] as ('APPROVED' | 'COUNTER_OFFER' | 'REJECTED')[] : [];
      eligibleOffers = seedData.eligibleOffers.map((o, i) => ({
        ...o,
        id: `${record.id}-eligible-${i}`,
        expiresAt: new Date(this.now() + 30 * 60_000).toISOString(),
      }));
    }

    const audit = structuredClone(this.liveAudit.get(record.id) ?? []);

    return {
      application: app,
      source: 'session',
      inputsSnapshot,
      runs: [run],
      currentRunId: run.id,
      engineRecommendation,
      allowedOutcomes,
      eligibleOffers,
      audit,
    };
  }

  async dossier(token: string, id: string, signal?: AbortSignal): Promise<BankDossier> {
    await this.wait('read', 'dossier_read', signal, token);
    const user = this.user(token);
    if (user.role !== 'bank') throw error(403, 'FORBIDDEN', 'Досье доступно только сотруднику банка.');

    if (id.startsWith('seed-')) {
      const seed = this.seedDossiers.get(id);
      if (!seed) throw error(404, 'NOT_FOUND', 'Заявка не найдена.');
      return structuredClone(seed);
    }

    const record = this.records.get(id);
    if (!record) throw error(404, 'NOT_FOUND', 'Заявка не найдена.');

    return this.buildLiveDossier(record);
  }

  async decide(token: string, id: string, input: DecideInput): Promise<BankDossier> {
    await this.wait('command', 'decide', undefined, token);
    const user = this.user(token);
    if (user.role !== 'bank') throw error(403, 'FORBIDDEN', 'Принятие решения доступно только сотруднику банка.');

    const isSeed = id.startsWith('seed-');
    const dossier = isSeed
      ? this.seedDossiers.get(id)
      : this.records.get(id) ? this.buildLiveDossier(this.records.get(id)!) : undefined;

    if (!dossier) throw error(404, 'NOT_FOUND', 'Заявка не найдена.');

    if (dossier.application.status !== 'UNDERWRITING') {
      throw error(409, 'STAGE_CONFLICT', 'Решение можно принять только для заявки на ручном рассмотрении (UNDERWRITING).');
    }

    if (dossier.application.version !== input.version) {
      throw error(409, 'VERSION_CONFLICT', 'Версия заявки изменилась. Обновите досье.');
    }

    const trimmedComment = input.comment?.trim() ?? '';
    if (!trimmedComment || trimmedComment.length > 2000) {
      throw new ApiError(422, 'VALIDATION', 'Укажите комментарий андеррайтера (от 1 до 2000 символов).', {
        comment: 'Обязательный комментарий (от 1 до 2000 символов)',
      });
    }

    if (!['APPROVED', 'COUNTER_OFFER', 'REJECTED'].includes(input.outcome)) {
      throw error(422, 'INVALID_OUTCOME', 'Недопустимый исход решения.');
    }

    if (!dossier.allowedOutcomes.includes(input.outcome)) {
      throw error(422, 'OUTCOME_NOT_ALLOWED', `Исход ${input.outcome} недопустим для текущих условий заявки.`);
    }

    let selectedEligibleOffer: Offer | undefined;
    if (input.outcome === 'APPROVED' || input.outcome === 'COUNTER_OFFER') {
      selectedEligibleOffer = dossier.eligibleOffers.find((o) => o.id === input.offerId);
      if (!selectedEligibleOffer) {
        throw new ApiError(422, 'OFFER_REQUIRED', 'Для положительного решения выберите готовое кредитное предложение.', {
          offerId: 'Выберите кредитное предложение',
        });
      }
    } else if (input.offerId) {
      throw error(422, 'OFFER_NOT_ALLOWED', 'Отказ не должен содержать кредитное предложение.');
    }

    const nowIso = new Date(this.now()).toISOString();
    const isOverride = input.outcome !== dossier.engineRecommendation;
    const versionBefore = dossier.application.version;
    const versionAfter = versionBefore + 1;

    const event: HistoryEvent = {
      from: 'UNDERWRITING',
      to: input.outcome,
      actor: 'BANK',
      at: nowIso,
      reason: trimmedComment,
    };

    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      action: isOverride ? 'OVERRIDE' : 'DECISION',
      actorId: user.id,
      at: nowIso,
      versionBefore,
      versionAfter,
      engineOutcome: dossier.engineRecommendation,
      selectedOutcome: input.outcome,
      override: isOverride,
      offerId: selectedEligibleOffer?.id,
      comment: trimmedComment,
      policyVersion: bankDemoData.policy.version,
    };

    if (isSeed) {
      dossier.application.status = input.outcome;
      dossier.application.version = versionAfter;
      dossier.application.history.push(event);
      dossier.allowedOutcomes = [];
      dossier.audit.push(auditEntry);
      return structuredClone(dossier);
    } else {
      const liveOffer: Offer | undefined = selectedEligibleOffer
        ? {
            ...selectedEligibleOffer,
            id: `${id}-offer-0`,
            expiresAt: new Date(this.now() + 30 * 60_000).toISOString(),
          }
        : undefined;

      this.liveDecisions.set(id, {
        outcome: input.outcome,
        offer: liveOffer,
        event,
        version: versionAfter,
      });

      const audits = this.liveAudit.get(id) ?? [];
      audits.push(auditEntry);
      this.liveAudit.set(id, audits);

      return this.buildLiveDossier(this.records.get(id)!);
    }
  }

  async replayDossier(token: string, id: string, runId: string, signal?: AbortSignal): Promise<ReplayResult> {
    await this.wait('read', 'dossier_read', signal, token);
    const user = this.user(token);
    if (user.role !== 'bank') throw error(403, 'FORBIDDEN', 'Сверка досье доступна только сотруднику банка.');

    const dossier = id.startsWith('seed-')
      ? this.seedDossiers.get(id)
      : this.records.get(id) ? this.buildLiveDossier(this.records.get(id)!) : undefined;

    if (!dossier) throw error(404, 'NOT_FOUND', 'Заявка не найдена.');

    const run = dossier.runs.find((r) => r.id === runId);
    if (!run) throw error(404, 'NOT_FOUND', 'Скоринговый прогон не найден.');

    return {
      match: true,
      run: structuredClone(run),
      message: 'Подготовленный прогон, не новый расчёт. Снимки входов и результатов полностью совпадают с расчётным ядром Python.',
    };
  }

  async metrics(token: string, filter?: Partial<MetricsFilter>, signal?: AbortSignal): Promise<PipelineMetrics> {
    await this.wait('read', 'metrics_read', signal, token);
    const user = this.user(token);
    if (user.role !== 'bank') throw error(403, 'FORBIDDEN', 'Метрики конвейера доступны только сотруднику банка.');

    const validatedFilter = validateMetricsFilter(filter, demoData.products);

    const apps: (Application & { synthetic: boolean })[] = [];
    for (const seed of this.seedDossiers.values()) {
      apps.push({ ...seed.application, synthetic: true });
    }
    for (const record of this.records.values()) {
      apps.push({ ...this.snapshot(record), synthetic: false });
    }

    const calculated = calculatePipelineMetrics(apps, validatedFilter, new Date(this.now()).toISOString());
    return structuredClone(calculated);
  }

  async scenarios(signal?: AbortSignal): Promise<DemoScenario[]> {
    await this.wait('read', 'any', signal);
    return structuredClone(demoData.scenarios as unknown as DemoScenario[]);
  }

  async sandboxCatalog(token: string, signal?: AbortSignal): Promise<SandboxCatalog> {
    await this.wait('read', 'sandbox_read', signal, token);
    const user = this.user(token);
    if (user.role !== 'bank') throw error(403, 'FORBIDDEN', 'Анализ условий доступен только сотруднику банка.');
    return structuredClone(bankDemoData.sandboxCatalog as unknown as SandboxCatalog);
  }

  async sandboxRun(token: string, input: SandboxRunInput, signal?: AbortSignal): Promise<SandboxResult> {
    await this.wait('read', 'sandbox_read', signal, token);
    const user = this.user(token);
    if (user.role !== 'bank') throw error(403, 'FORBIDDEN', 'Анализ условий доступен только сотруднику банка.');

    const key = input.isExactBaseline
      ? `${input.personaId}:exact_baseline:${input.policyId}`
      : `${input.personaId}:${input.turnoverVariant}:${input.overdueDays}:${input.businessAgeMonths}:${input.policyId}`;

    const entry = (bankDemoData.sandboxRegistry as unknown as Record<string, SandboxResult>)[key];
    if (!entry) {
      throw error(422, 'SANDBOX_COMBINATION_NOT_FOUND', 'Расчёт для выбранных условий недоступен.');
    }

    return structuredClone(entry);
  }
}

export function unavailableGateway(): WorkspaceGateway {
  const unavailable = async (): Promise<never> => { throw error(503, 'API_NOT_CONFIGURED', 'Сервис временно недоступен. Повторите попытку позже.'); };
  return {
    personas: unavailable,
    login: unavailable,
    me: unavailable,
    company: unavailable,
    products: unavailable,
    applications: unavailable,
    application: unavailable,
    save: unavailable,
    accept: unavailable,
    queue: unavailable,
    simulationOptions: unavailable,
    simulate: unavailable,
    challenge: unavailable,
    sign: unavailable,
    submit: unavailable,
    dossier: unavailable,
    decide: unavailable,
    replayDossier: unavailable,
    metrics: unavailable,
    scenarios: unavailable,
    sandboxCatalog: unavailable,
    sandboxRun: unavailable,
  };
}
