// Run directly from the repository root. Never imported by production.
import { installOfflineIsolation } from './offline-isolation.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { resolve, isAbsolute } from 'node:path';
import { randomBytes } from 'node:crypto';
import { isContentRoute } from '../../../api-server/src/routes/content-paths.ts';

const args = process.argv.slice(2);
if (args.some(a => a !== '--check' && !/^--port=\d+$/.test(a) && !a.startsWith('--content-source='))) {
  throw new Error('Usage: node artifacts/airank/test/scripts/offline-browser.mjs [--check] [--port=4178] [--content-source=/absolute/path/to/pinned/app]');
}
const port = Number(args.find(a => a.startsWith('--port='))?.split('=')[1] || 4178);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid offline port');
const origin = `http://127.0.0.1:${port}`;
installOfflineIsolation();
const { createOfflineFixture } = await import('./offline-fixture.mjs');
const contentSource = args.find(a => a.startsWith('--content-source='))?.slice('--content-source='.length);
let contentOptions;
if (contentSource) {
  if (!isAbsolute(contentSource)) throw new Error('Content source must be an absolute path to the reviewed backend app directory');
  const source = pathToFileURL(resolve(contentSource, 'src/app/service.mjs')).href;
  const { createAppService } = await import(source);
  const { migrateContent } = await import(pathToFileURL(resolve(contentSource, 'src/content/migration.mjs')).href);
  contentOptions = {
    serviceFactory: createAppService,
    extraEnv: { CONTENT_ENCRYPTION_KEY: randomBytes(32).toString('hex') },
    prepareDb: async db => {
      await migrateContent(db);
      await db.execute({sql:'INSERT INTO content_members VALUES (?,?,?)', args:['offline-fixture-alice','offline-bob','viewer']});
    },
  };
}
const fixture = await createOfflineFixture(origin, contentOptions);
const { service, db, credentials, projectId, otherProjectId } = fixture;
const baseHeaders = { 'x-airank-client': 'offline', origin, 'content-type': 'application/json' };
const call = (method, path, headers = {}, body, query = new URLSearchParams()) => service({ method, path, headers: { ...baseHeaders, ...headers }, body, query });
const denied = (promise, status, code) => assert.rejects(promise, e => e.status === status && e.code === code);
const authHeaders = r => ({ cookie: r.headers['set-cookie'][0].split(';')[0], 'x-csrf-token': r.data.csrfToken });

async function verifyFixture() {
  await assert.rejects(globalThis.fetch('https://outbound-must-not-run.example.test'), e => e.code === 'OFFLINE_HARNESS_OUTBOUND_NETWORK_BLOCKED');
  assert.equal((await call('GET', '/v1/app/session')).data.authenticated, false);
  await denied(call('GET', '/v1/projects'), 401, 'AUTH_REQUIRED');
  await denied(call('POST', '/v1/app/email/sign-in', {}, { email: credentials.email, password: 'not the password', locale: 'en' }), 401, 'INVALID_CREDENTIALS');
  await denied(call('POST', '/v1/app/email/sign-in', { origin: 'https://hostile.example.test' }, { email: credentials.email, password: credentials.password, locale: 'en' }), 403, 'CSRF_INVALID');
  const alice = await call('POST', '/v1/app/email/sign-in', {}, { email: credentials.email, password: credentials.password, locale: 'en' });
  const bob = await call('POST', '/v1/app/email/sign-in', {}, { email: credentials.otherEmail, password: credentials.password, locale: 'en' });
  assert.equal(alice.data.authenticated, true);
  const ah = authHeaders(alice), bh = authHeaders(bob);
  assert.equal((await call('GET', '/v1/app/session', ah)).data.user.id, 'offline-alice');
  assert.deepEqual((await call('GET', '/v1/projects', ah)).data.map(p => p.id), [projectId]);
  assert.deepEqual((await call('GET', '/v1/projects', bh)).data.map(p => p.id), [otherProjectId]);
  for (const suffix of ['', '/analytics', '/results', '/prompts', '/monitoring-runs', '/connections/ga4', '/connections/gsc']) {
    await denied(call('GET', `/v1/projects/${projectId}${suffix}`), 401, 'AUTH_REQUIRED');
    await denied(call('GET', `/v1/projects/${projectId}${suffix}`, bh), 404, 'NOT_FOUND');
  }
  await denied(call('GET', `/v1/projects/${otherProjectId}`, ah), 404, 'NOT_FOUND');
  await denied(call('PATCH', '/v1/me/preferences', { cookie: ah.cookie }, { expectedVersion: 1, locale: 'fi' }), 403, 'CSRF_INVALID');
  await denied(call('PATCH', '/v1/me/preferences', { ...ah, origin: 'https://hostile.example.test' }, { expectedVersion: 1, locale: 'fi' }), 403, 'CSRF_INVALID');
  const results = (await call('GET', `/v1/projects/${projectId}/results`, ah, undefined, new URLSearchParams({ pageSize: '100' }))).data;
  assert.equal(results.total, 24);
  assert.equal(results.items.filter(e => e.state === 'success').length, 22);
  assert.equal(results.items.filter(e => e.state === 'skipped').length, 1);
  assert.equal(results.items.filter(e => e.state === 'failed').length, 1);
  const noCitations = results.items.find(e => e.id === 'offline-run-0-2');
  assert.equal(noCitations.observation.complete, true);
  assert.equal(noCitations.observation.citationObservation, 'not_observed');
  assert.equal(noCitations.citations.length, 0);
  const repeated = results.items.find(e => e.id === 'offline-run-0-0');
  assert.equal(repeated.observation.citationOccurrences.length, 3);
  assert.equal(new Set(repeated.observation.citationOccurrences.map(c => c.url)).size, 2);
  const filtered = (await call('GET', `/v1/projects/${projectId}/results`, ah, undefined, new URLSearchParams({ provider: 'claude', topic: 'Support' }))).data;
  assert.equal(filtered.total, 4);
  const analytics = (await call('GET', `/v1/projects/${projectId}/analytics`, ah)).data;
  assert.deepEqual([...analytics.availableTags].sort(), ['comparison', 'fixture', 'service']);
  assert.deepEqual([...analytics.availableSurfaces].sort(), ['consumer_web', 'model_api']);
  for (const query of [{ tag: 'service', surface: 'model_api' }, { surface: 'consumer_web' }, { promptId: 'offline-prompt-price', promptVersion: '1', provider: 'openai', topic: 'Price' }]) {
    assert.equal((await call('GET', `/v1/projects/${projectId}/analytics`, ah, undefined, new URLSearchParams(query))).status, 200);
  }
  for (const kind of ['ga4', 'gsc']) {
    const traffic = (await call('GET', `/v1/projects/${projectId}/connections/${kind}`, ah)).data;
    assert.equal(traffic.configured, false);
    assert.equal(traffic.connected, false);
    assert.equal(traffic.status, 'setup_required');
    await denied(call('POST', `/v1/projects/${projectId}/connections/${kind}/connect`, ah, {}), 503, 'GOOGLE_CONNECTOR_SETUP_REQUIRED');
  }
  for (const sql of [
    "SELECT count(*) n FROM mon_tasks WHERE status <> 'done'",
    "SELECT count(*) n FROM mon_immediate_outbox WHERE state='pending'",
    'SELECT count(*) n FROM app_project_schedules',
    'SELECT count(*) n FROM app_schedule_slots',
    'SELECT count(*) n FROM scan_jobs',
    'SELECT count(*) n FROM intelligence_jobs',
    'SELECT count(*) n FROM mon_collections',
  ]) assert.equal(Number((await db.execute(sql)).rows[0].n), 0, sql);
  if (contentSource) {
    const content = `/v1/projects/${projectId}/content`;
    await denied(call('GET', content), 401, 'AUTH_REQUIRED');
    assert.equal((await call('GET', content, bh)).data.role, 'viewer');
    await denied(call('POST', content + '/documents', bh, {title:'Viewer cannot edit',locale:'en',markdown:'Synthetic'}),403,'CONTENT_PERMISSION_DENIED');
    const doc = (await call('POST', content + '/documents', ah, {
      title:'Synthetic content contract test', description:'Only in memory',locale:'fi',
      markdown:'# Synteettinen testi\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',
    })).data;
    assert.equal(doc.version,1);
    const path = `${content}/documents/${doc.id}`;
    await denied(call('PATCH',path,ah,{expectedVersion:0,markdown:'Must not overwrite'}),409,'VERSION_CONFLICT');
    const saved=(await call('PATCH',path,ah,{expectedVersion:1,description:'Saved revision'})).data;
    assert.equal(saved.version,2);
    await denied(call('POST',path+'/review',ah,{expectedVersion:2,status:'approved',factsChecked:false}),422,'FACT_REVIEW_REQUIRED');
    const approved=(await call('POST',path+'/review',ah,{expectedVersion:2,status:'approved',factsChecked:true})).data;
    assert.equal(approved.status,'approved');assert.equal(approved.version,3);
    const changed=(await call('PATCH',path,ah,{expectedVersion:3,description:'Approval must reset'})).data;
    assert.equal(changed.status,'draft');assert.equal(changed.reviewedClaims,false);
    assert.equal((await call('GET',path+'/revisions',ah)).data.length,4);
    assert.match((await call('GET',path+'/export',ah)).data.markdown,/\| 1 \| 2 \|/);
    const body={kind:'audit',input:{documentId:doc.id,documentVersion:4,locale:'fi'},submissionId:'offline-content-contract-intent'};
    const queued=(await call('POST',content+'/jobs',ah,body)).data;
    assert.equal((await call('POST',content+'/jobs',ah,body)).data.id,queued.id);
    await denied(call('POST',content+'/jobs',ah,{...body,input:{...body.input,instructions:'Different intention'}}),409,'SUBMISSION_CONFLICT');
    assert.equal((await call('POST',content+`/jobs/${queued.id}/cancel`,ah,{})).data.status,'cancelled');
    // Keep browser start clean. Only delete the synthetic startup self-test rows.
    await db.execute({sql:'DELETE FROM content_jobs WHERE project_id=?',args:[projectId]});
    await db.execute({sql:'DELETE FROM content_revisions WHERE project_id=?',args:[projectId]});
    await db.execute({sql:'DELETE FROM content_records WHERE project_id=?',args:[projectId]});
    await db.execute({sql:'DELETE FROM content_events WHERE project_id=?',args:[projectId]});
    console.log('Content offline assertions passed: authenticated/shared permissions, Finnish Markdown/table retention, save conflict, exact revision approval/reset, history/export, idempotent queue and cancellation. No worker or external operation executed.');
  }
  // Validation never leaves a browser signed in, and no session is pre-seeded.
  await call('POST', '/v1/app/logout', ah, {});
  await call('POST', '/v1/app/logout', bh, {});
  assert.equal(Number((await db.execute('SELECT count(*) n FROM sessions')).rows[0].n), 0);
  // Do not spend the browser user's real login rate-limit budget in startup checks.
  await db.execute('DELETE FROM app_auth_limits');
  console.log('Offline startup assertions passed: password login, session, CSRF, anonymous rejection, cross-owner rejection, filters, observations, Traffic setup-required, zero schedulable work.');
}

try {
  await verifyFixture();
} catch (error) {
  db.close();
  throw error; // Fail closed: never fall back to a remote API or another database.
}
if (args.includes('--check')) {
  db.close();
  process.exit(0);
}

const { createServer: createViteServer } = await import('vite');
const { default: react } = await import('@vitejs/plugin-react');
const { default: tailwindcss } = await import('@tailwindcss/vite');
const frontendRoot = fileURLToPath(new URL('../../', import.meta.url));
const localCookie = `airank_offline_${port}_session`;
const localOauthCookie = `airank_offline_${port}_oauth`;
const browserCookies = header => (header || '').split(';').map(part => part.trim()).filter(part =>
  part.startsWith(`${localCookie}=`) || part.startsWith(`${localOauthCookie}=`)
).map(part => part.replace(`${localCookie}=`, '__Host-airank_session=').replace(`${localOauthCookie}=`, '__Host-airank_app_oauth=')).join('; ');
const localSetCookie = value => {
  assert.match(value, /^__Host-airank_(session|app_oauth)=/);
  return value.replace('__Host-airank_session=', `${localCookie}=`).replace('__Host-airank_app_oauth=', `${localOauthCookie}=`).replace(/;\s*Secure(?=;|$)/ig, '');
};
const server = http.createServer();
const vite = await createViteServer({
  configFile: false, envFile: false, root: frontendRoot, base: '/',
  cacheDir: fileURLToPath(new URL('./.offline-generated/vite', import.meta.url)),
  plugins: [
    {
      name: 'offline-only-browser-guard',
      enforce: 'pre',
      transform(code, id) {
        if (id.split('?')[0] === `${frontendRoot}src/index.css`) {
          return code.replace(/@import\s+url\(['"]https?:\/\/[^)]+\);\s*/g, '');
        }
      },
      transformIndexHtml(html) {
        return html.replace(/<link[^>]*rel="preconnect"[^>]*>/g, '').replace('<body>', '<body><div style="position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#6b2100;color:#fff;text-align:center;font:11px system-ui;padding:3px;pointer-events:none">OFFLINE SYNTHETIC FIXTURE · NOT REAL PROVIDER DATA · NOT GOOGLE REVIEW EVIDENCE</div>');
      },
    },
    react(), tailwindcss(),
  ],
  resolve: { alias: { '@': `${frontendRoot}src`, '@assets': fileURLToPath(new URL('../../../../attached_assets', import.meta.url)) }, dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', middlewareMode: true, hmr: { server, host: '127.0.0.1', port }, allowedHosts: ['127.0.0.1'], fs: { strict: true } },
});
const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
server.on('request', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:${port}; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'`);
  if (req.headers.host !== `127.0.0.1:${port}`) return json(res, 403, { error: { code: 'OFFLINE_HOST_REJECTED' } });
  const url = new URL(req.url, origin);
  if (!url.pathname.startsWith('/api/airank')) {
    // Do not accidentally send any other API request into a frontend proxy.
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: { code: 'OFFLINE_API_NOT_AVAILABLE' } });
    return vite.middlewares(req, res, () => json(res, 404, { error: { code: 'NOT_FOUND' } }));
  }
  const path = url.pathname.slice('/api/airank'.length);
  try {
    const headers = {
      'x-airank-client': 'offline',
      cookie: browserCookies(req.headers.cookie),
      origin: req.headers.origin || '',
      'content-type': req.headers['content-type'] || '',
      'x-csrf-token': req.headers['x-csrf-token'] || '',
    };
    // Keep the fixture frozen: only genuine login/logout and real preferences
    // writes are exposed. No scans, schedules, provider calls or email actions.
    if (req.method !== 'GET' && !(
      req.method === 'POST' && ['/v1/app/email/sign-in', '/v1/app/logout'].includes(path) ||
      req.method === 'PATCH' && path === '/v1/me/preferences' ||
      contentSource && isContentRoute(req.method, path)
    )) {
      const session = await service({ method: 'GET', path: '/v1/app/session', headers });
      return json(res, session.data.authenticated ? 409 : 401, { error: { code: session.data.authenticated ? 'OFFLINE_FIXTURE_READ_ONLY' : 'AUTH_REQUIRED' } });
    }
    let body;
    if (req.method !== 'GET') {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > (contentSource && isContentRoute(req.method, path) ? 524288 : 65536)) return json(res, 413, { error: { code: 'BODY_TOO_LARGE' } });
        chunks.push(chunk);
      }
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
      catch { return json(res, 400, { error: { code: 'INVALID_JSON' } }); }
    }
    const result = await service({ method: req.method, path, query: url.searchParams, headers, body });
    for (const [key, value] of Object.entries(result.headers || {})) {
      if (key.toLowerCase() === 'set-cookie') res.setHeader(key, (Array.isArray(value) ? value : [value]).map(localSetCookie));
      else if (key.toLowerCase() !== 'location') res.setHeader(key, value);
    }
    // No OAuth or external redirects are ever followed or exposed.
    if (result.status >= 300 && result.status < 400) return json(res, 409, { error: { code: 'OFFLINE_REDIRECT_BLOCKED' } });
    json(res, result.status, result.data);
  } catch (error) {
    if (!error.status) console.error('Offline request failed:', error.message);
    json(res, error.status || 500, { error: { code: error.code || 'OFFLINE_HARNESS_ERROR', ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) } });
  }
});
server.once('error', async error => {
  console.error('Offline harness could not listen:', error.message);
  await vite.close();
  db.close();
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({
    mode: 'OFFLINE SYNTHETIC FIXTURE — NOT GOOGLE REVIEW EVIDENCE',
    url: `${origin}/en/sign-in`, dashboard: `${origin}/en/dashboard`,
    results: `${origin}/en/dashboard/results`, sources: `${origin}/en/dashboard/sources`,
    traffic: `${origin}/en/dashboard/traffic`, prompts: `${origin}/en/dashboard/prompts`,
    email: credentials.email, password: credentials.password, otherOwnerEmail: credentials.otherEmail,
    projectId, observationDates: { from: fixture.from, to: fixture.today },
    expected: { prompts: 3, runs: 4, observations: 24, success: 22, skipped: 1, failed: 1, surfaces: ['model_api', 'consumer_web'], topics: ['Price', 'Support'], tags: ['comparison', 'fixture', 'service'], traffic: 'setup_required', schedulableWork: 0 },
    database: 'node:sqlite :memory: (destroyed on exit)', pid: process.pid,
  }, null, 2));
});
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await vite.close();
  server.close();
  server.closeAllConnections();
  db.close();
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
