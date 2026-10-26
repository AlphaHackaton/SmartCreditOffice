import { describe, expect, it, vi } from 'vitest';
import { MockGateway } from './gateway';

describe('Demo scenarios presets, retiming and isolation', () => {
  it('loads factory preset and returns 6 seed dossiers in queue and metrics', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const result = gateway.loadScenario('factory');
    expect(result.success).toBe(true);
    expect(gateway.getActiveScenarioId()).toBe('factory');

    const bankLogin = await gateway.login('underwriter', 'demo');
    const queue = await gateway.queue(bankLogin.token);
    expect(queue).toHaveLength(6);
    expect(queue.every((q) => q.synthetic)).toBe(true);

    const metrics = await gateway.metrics(bankLogin.token);
    expect(metrics.total).toBe(6);
    expect(metrics.submitted).toBe(6);
  });

  it('loads all 12 presets and verifies starting stage and role access', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const scenarioList = await gateway.scenarios();
    expect(scenarioList).toHaveLength(12);

    for (const sc of scenarioList) {
      const res = gateway.loadScenario(sc.id);
      expect(res.success).toBe(true);
      expect(gateway.getActiveScenarioId()).toBe(sc.id);

      // Verify persona can log in
      const loginRes = await gateway.login(sc.personaLogin, 'demo');
      expect(loginRes.token).toBeDefined();

      if (sc.personaLogin !== 'underwriter') {
        const apps = await gateway.applications(loginRes.token);
        if (sc.id === 'factory') {
          expect(apps).toHaveLength(0);
        } else {
          expect(apps).toHaveLength(1);
          expect(apps[0].status).toBe(sc.startingStage);
        }
      } else {
        // Underwriter (e.g. p6-review)
        const queue = await gateway.queue(loginRes.token);
        const liveApp = queue.find((q) => !q.synthetic);
        expect(liveApp).toBeDefined();
        expect(liveApp?.status).toBe('UNDERWRITING');
      }
    }
  });

  it('re-anchors TTLs so p1-expired is expired and cannot be accepted', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    gateway.loadScenario('p1-expired');
    const login = await gateway.login('p1', 'demo');
    const apps = await gateway.applications(login.token);
    expect(apps[0].status).toBe('EXPIRED');

    const offer = apps[0].decision?.offers[0];
    expect(offer).toBeDefined();

    // Trying to accept expired offer fails with 409
    await expect(gateway.accept(login.token, apps[0].id, apps[0].version, offer!.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('re-anchors p1-signing with valid challenge and handles signature attempts', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    gateway.loadScenario('p1-signing');
    const login = await gateway.login('p1', 'demo');
    const apps = await gateway.applications(login.token);
    expect(apps[0].status).toBe('SIGNING');

    const challenge = await gateway.challenge(login.token, apps[0].id);
    expect(challenge.code).toBe('123456');
    expect(challenge.attemptsLeft).toBe(3);

    // Wrong code reduces attempts
    await expect(
      gateway.sign(login.token, apps[0].id, apps[0].version, challenge.id, '999999')
    ).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_CODE',
    });

    const updatedChallenge = await gateway.challenge(login.token, apps[0].id);
    expect(updatedChallenge.attemptsLeft).toBe(2);

    // Correct code signs
    const signedApp = await gateway.sign(login.token, apps[0].id, apps[0].version, challenge.id, '123456');
    expect(signedApp.status).toBe('SIGNED');
  });

  it('supports p6-review end-to-end: underwriter decides, client inspects outcome', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    gateway.loadScenario('p6-review');

    // Underwriter reviews live p6 application
    const bankLogin = await gateway.login('underwriter', 'demo');
    const queue = await gateway.queue(bankLogin.token);
    const p6Item = queue.find((q) => !q.synthetic)!;
    expect(p6Item.status).toBe('UNDERWRITING');

    const dossier = await gateway.dossier(bankLogin.token, p6Item.id);
    expect(dossier.engineRecommendation).toBe('APPROVED');
    expect(dossier.eligibleOffers.length).toBeGreaterThan(0);

    // Bank underwriter approves
    const approvedDossier = await gateway.decide(bankLogin.token, p6Item.id, {
      outcome: 'APPROVED',
      offerId: dossier.eligibleOffers[0].id,
      comment: 'Выручка верифицирована договорами лизинга оборудования.',
      version: dossier.application.version,
    });
    expect(approvedDossier.application.status).toBe('APPROVED');

    // Client p6 logs in and sees approved application with offer
    const clientLogin = await gateway.login('p6', 'demo');
    const clientApps = await gateway.applications(clientLogin.token);
    expect(clientApps[0].status).toBe('APPROVED');
    expect(clientApps[0].decision?.offers).toHaveLength(1);
  });
});

describe('Targeted failure planning and recovery matrix', () => {
  it('rejects invalid failure plan pairs', () => {
    const gateway = new MockGateway();

    // Read cannot have 409 or 422
    expect(() =>
      gateway.planFailure({ kind: 'read', target: 'application_read', variant: 409 })
    ).toThrow('Недопустимый статус 409');

    expect(() =>
      gateway.planFailure({ kind: 'read', target: 'application_read', variant: 422 })
    ).toThrow('Недопустимый статус 422');

    // Read cannot target a command
    expect(() =>
      gateway.planFailure({ kind: 'read', target: 'sign', variant: 503 })
    ).toThrow('Недопустимая цель sign');

    // Command cannot target a read
    expect(() =>
      gateway.planFailure({ kind: 'command', target: 'application_read', variant: 503 })
    ).toThrow('Недопустимая цель application_read');
  });

  it('consumes targeted failure only on matching operation', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 10;
    gateway.loadScenario('p1-signing');
    const login = await gateway.login('p1', 'demo');
    const app = (await gateway.applications(login.token))[0];
    const challenge = await gateway.challenge(login.token, app.id);

    // Plan failure specifically for sign
    gateway.planFailure({ kind: 'command', target: 'sign', variant: 422 });

    const pending = gateway.getPendingFailures();
    expect(pending.command?.state).toBe('pending');

    // Intermediate read succeeds without consuming plan
    const readApp = await gateway.application(login.token, app.id);
    expect(readApp.id).toBe(app.id);
    expect(gateway.getPendingFailures().command?.state).toBe('pending');

    // Sign triggers planned 422 with field error
    await expect(
      gateway.sign(login.token, app.id, app.version, challenge.id, challenge.code)
    ).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION',
      details: { code: 'Неверный код' },
    });

    expect(gateway.getPendingFailures().command?.state).toBe('consumed');

    // Next sign succeeds normally without failure
    const signed = await gateway.sign(login.token, app.id, app.version, challenge.id, challenge.code);
    expect(signed.status).toBe('SIGNED');
  });

  it('does not consume plan when request is aborted', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 100;
    const login = await gateway.login('underwriter', 'demo');

    gateway.planFailure({ kind: 'read', target: 'metrics_read', variant: 503 });

    const ac = new AbortController();
    setTimeout(() => ac.abort(), 10);

    await expect(gateway.metrics(login.token, undefined, ac.signal)).rejects.toThrow('Aborted');

    // Plan was not consumed
    expect(gateway.getPendingFailures().read?.state).toBe('pending');

    // Regular call now consumes it
    await expect(gateway.metrics(login.token)).rejects.toMatchObject({ status: 503 });
    expect(gateway.getPendingFailures().read?.state).toBe('consumed');
  });

  it('fails only the first of two concurrent matching requests', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 20;
    const login = await gateway.login('underwriter', 'demo');

    gateway.planFailure({ kind: 'read', target: 'metrics_read', variant: 503 });

    const [res1, res2] = await Promise.allSettled([
      gateway.metrics(login.token),
      gateway.metrics(login.token),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain('rejected');
    expect(statuses).toContain('fulfilled');
  });

  it('handles 401 failure by deleting session and invoking unauthorized callback', async () => {
    const onUnauthorized = vi.fn();
    const gateway = new MockGateway(Date.now, onUnauthorized);
    gateway.delayMs = 10;
    const login = await gateway.login('p1', 'demo');

    gateway.planFailure({ kind: 'command', target: 'save', variant: 401 });

    await expect(
      gateway.save(login.token, {
        productCode: 'WC_FLEX',
        amount: '1000000.00',
        termMonths: 12,
        purpose: 'WORKING_CAPITAL',
        consents: [],
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledWith(login.token);

    // Token is deleted
    await expect(gateway.me(login.token)).rejects.toMatchObject({ status: 401 });
  });

  it('handles network failure variant', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 10;
    const login = await gateway.login('underwriter', 'demo');

    gateway.planFailure({ kind: 'read', target: 'dossier_read', variant: 'network' });

    await expect(gateway.queue(login.token)).rejects.toMatchObject({
      status: null,
      code: 'NETWORK_ERROR',
    });
  });

  it('cancels pending failure plan cleanly', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 10;
    const login = await gateway.login('underwriter', 'demo');

    gateway.planFailure({ kind: 'read', target: 'metrics_read', variant: 503 });
    expect(gateway.getPendingFailures().read).not.toBeNull();

    gateway.cancelFailure('read');
    expect(gateway.getPendingFailures().read).toBeNull();

    // Call succeeds without error
    const metrics = await gateway.metrics(login.token);
    expect(metrics.total).toBe(6);
  });
});

describe('Synthetic scoring sandbox', () => {
  it('forbids client access to sandboxCatalog and sandboxRun', async () => {
    const gateway = new MockGateway();
    const clientLogin = await gateway.login('p1', 'demo');

    await expect(gateway.sandboxCatalog(clientLogin.token)).rejects.toMatchObject({ status: 403 });
    await expect(
      gateway.sandboxRun(clientLogin.token, {
        personaId: 'p1_ideal',
        turnoverVariant: 'baseline',
        overdueDays: 0,
        businessAgeMonths: 48,
        policyId: 'policy_v1',
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns catalog with 6 personas and 3 policies for bank underwriter', async () => {
    const gateway = new MockGateway();
    const bankLogin = await gateway.login('underwriter', 'demo');
    const catalog = await gateway.sandboxCatalog(bankLogin.token);

    expect(catalog.personas).toHaveLength(6);
    expect(catalog.policies).toHaveLength(3);
    expect(catalog.turnoverVariants).toHaveLength(2);
    expect(catalog.overdueVariants).toHaveLength(2);
    expect(catalog.businessAgeVariants).toHaveLength(2);
  });

  it('evaluates exact baseline for all 6 personas across all 3 policies', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const bankLogin = await gateway.login('underwriter', 'demo');
    const catalog = await gateway.sandboxCatalog(bankLogin.token);

    for (const persona of catalog.personas) {
      for (const policy of catalog.policies) {
        const result = await gateway.sandboxRun(bankLogin.token, {
          personaId: persona.id,
          turnoverVariant: 'baseline',
          overdueDays: 0,
          businessAgeMonths: 48,
          policyId: policy.id,
          isExactBaseline: true,
        });

        expect(result.inputHash).toBeDefined();
        expect(result.resultHash).toBeDefined();
        expect(result.policyId).toBe(policy.id);
        expect(result.policyVersion).toBe(policy.version);
        expect(result.keyRatePct).toBe(policy.keyRatePct);
      }
    }
  });

  it('evaluates all 144 combinations and produces correct outcomes and hashes', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const bankLogin = await gateway.login('underwriter', 'demo');
    const catalog = await gateway.sandboxCatalog(bankLogin.token);

    let count = 0;
    for (const persona of catalog.personas) {
      for (const turnover of catalog.turnoverVariants) {
        for (const overdue of catalog.overdueVariants) {
          for (const age of catalog.businessAgeVariants) {
            for (const policy of catalog.policies) {
              const result = await gateway.sandboxRun(bankLogin.token, {
                personaId: persona.id,
                turnoverVariant: turnover.id,
                overdueDays: overdue.id,
                businessAgeMonths: age.id,
                policyId: policy.id,
              });

              expect(result.policyId).toBe(policy.id);
              expect(result.result.recommendation).toMatch(/APPROVED|COUNTER_OFFER|REJECTED/);
              count++;
            }
          }
        }
      }
    }

    expect(count).toBe(144);
  });

  it('rejects unknown combination with 422 SANDBOX_COMBINATION_NOT_FOUND', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const bankLogin = await gateway.login('underwriter', 'demo');

    await expect(
      gateway.sandboxRun(bankLogin.token, {
        personaId: 'unknown_persona',
        turnoverVariant: 'baseline',
        overdueDays: 0,
        businessAgeMonths: 48,
        policyId: 'policy_v1',
      })
    ).rejects.toMatchObject({
      status: 422,
      code: 'SANDBOX_COMBINATION_NOT_FOUND',
    });
  });

  it('demonstrates identical inputHash across policies and different rates', async () => {
    const gateway = new MockGateway();
    gateway.delayMs = 0;
    const bankLogin = await gateway.login('underwriter', 'demo');

    const [v1, minus2, plus2] = await Promise.all([
      gateway.sandboxRun(bankLogin.token, {
        personaId: 'p1_ideal',
        turnoverVariant: 'baseline',
        overdueDays: 0,
        businessAgeMonths: 48,
        policyId: 'policy_v1',
      }),
      gateway.sandboxRun(bankLogin.token, {
        personaId: 'p1_ideal',
        turnoverVariant: 'baseline',
        overdueDays: 0,
        businessAgeMonths: 48,
        policyId: 'policy_minus_2',
      }),
      gateway.sandboxRun(bankLogin.token, {
        personaId: 'p1_ideal',
        turnoverVariant: 'baseline',
        overdueDays: 0,
        businessAgeMonths: 48,
        policyId: 'policy_plus_2',
      }),
    ]);

    // Same input hash!
    expect(v1.inputHash).toBe(minus2.inputHash);
    expect(v1.inputHash).toBe(plus2.inputHash);

    // Different policy versions and key rates
    expect(minus2.keyRatePct).toBe('14.50');
    expect(v1.keyRatePct).toBe('16.50');
    expect(plus2.keyRatePct).toBe('18.50');

    // Rates in offers differ accordingly
    expect(Number(minus2.offers[0].rate_pct)).toBeLessThan(Number(v1.offers[0].rate_pct));
    expect(Number(v1.offers[0].rate_pct)).toBeLessThan(Number(plus2.offers[0].rate_pct));

    // Sandbox run does not alter queue or metrics
    const queue = await gateway.queue(bankLogin.token);
    expect(queue).toHaveLength(6);
    const metrics = await gateway.metrics(bankLogin.token);
    expect(metrics.total).toBe(6);
  });
});
