// Non-destructive smoke: creates its own demo applications, never calls demo/reset.
// Usage: node frontend/scripts/smoke-api.mjs [http://localhost:8000]
import assert from 'node:assert/strict';
const base = `${process.argv[2] ?? 'http://localhost:8000'}/api/v1`;
async function call(path, token, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}/${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${data.code ?? data.detail ?? ''}`);
  return data;
}
const login = async (name) => (await call('auth/login', null, 'POST', { login: name, password: 'demo' })).access_token;
const own = async (token, id) => (await call('applications', token)).items.find((a) => a.id === id);
async function wait(token, id, statuses) {
  for (let i = 0; i < 50; i++) { const row = await own(token, id); if (statuses.includes(row.status)) return row; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('Status did not settle');
}
const health = await call('health'); assert.equal(health.status, 'ok');
assert.equal((await call('demo/personas')).length, 6);
const client = await login('p1'); const bank = await login('underwriter');
assert.equal((await call('auth/me', client)).role, 'CLIENT');
assert.ok((await call('companies/me', client)).inn);
assert.ok((await call('products')).items.some((p) => p.code === 'WC_FLEX'));
let row = await call('applications', client, 'POST', { product_code: 'WC_FLEX', amount: '1000000.00', term_months: 24 }, 201);
row = await call(`applications/${row.id}?version=${row.version}`, client, 'PATCH', { product_code: 'WC_FLEX', amount: '2000000.00', term_months: 24 });
await call(`applications/${row.id}/submit?version=${row.version}`, client, 'POST');
row = await wait(client, row.id, ['APPROVED', 'COUNTER_OFFER']);
assert.ok(row.decision.offers.length);
const simulated = await call(`applications/${row.id}/simulate`, client, 'POST', { amount: '1500000.00', term_months: 24 }); assert.equal(typeof simulated.max_amount_for_term, 'string');
const challenge = await call(`applications/${row.id}/accept?version=${row.version}&offer_id=${row.decision.offers[0].id}`, client, 'POST');
row = await own(client, row.id);
await call(`applications/${row.id}/sign?version=${row.version}`, client, 'POST', { code: challenge.code });
row = await wait(client, row.id, ['DISBURSED']);
const cancelled = await call('applications', client, 'POST', { product_code: 'WC_FLEX', amount: '500000.00', term_months: 12 }, 201);
assert.equal((await call(`applications/${cancelled.id}/cancel?version=${cancelled.version}`, client, 'POST')).status, 'CANCELLED');
const manualClient = await login('p6');
let manual = await call('applications', manualClient, 'POST', { product_code: 'WC_FLEX', amount: '2000000.00', term_months: 24 }, 201);
await call(`applications/${manual.id}/submit?version=${manual.version}`, manualClient, 'POST'); manual = await wait(manualClient, manual.id, ['UNDERWRITING']);
await call(`bank/applications/${manual.id}/rescore`, bank, 'POST');
await call(`bank/applications/${manual.id}/decision`, bank, 'POST', { outcome: 'REJECTED', comment: 'Frontend HTTP smoke: synthetic review' });
assert.ok((await call('bank/applications', bank)).items.some((a) => a.id === row.id));
assert.equal((await call(`bank/applications/${row.id}`, bank)).application.id, row.id);
assert.ok(Array.isArray(await call(`bank/applications/${row.id}/scoring-runs`, bank)));
assert.ok((await call('bank/metrics', bank)).total_applications >= 3);
await call('applications', null, 'GET', undefined, 401); await call('bank/applications', client, 'GET', undefined, 403);
assert.ok(!(await call('applications', manualClient)).items.some((a) => a.id === row.id));
console.log(`HTTP smoke OK (${health.mode}): profile, catalog, PATCH, scoring, simulation, offer, OTP, DISBURSED, cancel, bank review, audit/runs/metrics, 401/403/ownership. Reset intentionally excluded.`);
