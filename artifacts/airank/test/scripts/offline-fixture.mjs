// Synthetic offline browser data; not observations from any real AI provider.
import { DatabaseSync } from 'node:sqlite';
import { migrations } from '../../../../services/bunny-api/src/migrate.mjs';
import { hashPassword } from '../../../../services/bunny-api/src/app/password.mjs';
import { createAppService } from '../../../../services/bunny-api/src/app/service.mjs';
import { collectionMethodVersion, apiObservation } from '../../../../services/bunny-api/src/common/observations.mjs';

export const credentials = Object.freeze({
  email: 'offline-alice@example.test',
  password: 'Offline fixture password 42!',
  otherEmail: 'offline-bob@example.test',
});
export const projectId = 'offline-fixture-alice';
export const otherProjectId = 'offline-fixture-bob';

export async function createOfflineFixture(origin, { serviceFactory = createAppService, prepareDb = async () => {}, extraEnv = {} } = {}) {
  // Same real SQLite adapter as monitoring.test.mjs; no libsql package needed.
  // The literal database location cannot be overridden by config or CLI.
  const sqlite = new DatabaseSync(':memory:');
  const executeStatement = async q => {
    const sql = typeof q === 'string' ? q : q.sql;
    const args = typeof q === 'string' ? [] : q.args || [];
    const statement = sqlite.prepare(sql);
    if (/^\s*(SELECT|PRAGMA)|RETURNING/i.test(sql)) return { rows: statement.all(...args) };
    return { rows: [], rowsAffected: Number(statement.run(...args).changes) };
  };
  let transactionTail = Promise.resolve();
  const db = {
    execute: executeStatement,
    transaction: async () => {
      let release;
      const next = new Promise(resolve => { release = resolve; });
      const previous = transactionTail;
      transactionTail = next;
      await previous;
      try { sqlite.exec('BEGIN IMMEDIATE'); }
      catch (error) { release(); throw error; }
      return {
        execute: executeStatement,
        commit: async () => sqlite.exec('COMMIT'),
        rollback: async () => sqlite.exec('ROLLBACK'),
        close: release,
      };
    },
    close: () => sqlite.close(),
  };
  await db.execute('PRAGMA foreign_keys=ON');
  for (const sql of migrations) await db.execute(sql);
  // Keep the real migrations and checksums, including current observation schema.
  const steps = [
    ['app/migration.mjs', 'migrateApp'],
    ['app/scan-migration.mjs', 'migrateProjectScans'],
    ['monitoring/migration.mjs', 'migrateMonitoring'],
    ['research/migration.mjs', 'migrateResearch'],
    ['scheduling/migration.mjs', 'migrateScheduling'],
    ['opportunities/migration.mjs', 'migrateOpportunities'],
    ['reports/migration.mjs', 'migrateReports'],
    ['website-profile/migration.mjs', 'migrateWebsiteProfiles'],
    ['common/context-migration.mjs', 'migrateContextDrafts'],
    ['app/email-migration.mjs', 'migrateEmailAuth'],
    ['public-check/migration.mjs', 'migratePublicCheck'],
    ['sentiment/migration.mjs', 'migrateSentiment'],
    ['scheduling/daily-migration.mjs', 'migrateDailyScheduling'],
    ['collectors/migration.mjs', 'migrateCollectors'],
    ['intelligence/migration.mjs', 'migrateIntelligence'],
    ['monitoring/budget-migration.mjs', 'migrateApiBudget'],
    ['monitoring/immediate-migration.mjs', 'migrateImmediate'],
  ];
  for (const [path, name] of steps) {
    const module = await import(new URL(`../../../../services/bunny-api/src/${path}`, import.meta.url));
    await module[name](db);
  }
  const execute = (sql, args = []) => db.execute({ sql, args });
  // Anchored once at startup, then immutable. The three recent UTC dates match
  // the frontend's default recent-date filter without an artificial app clock.
  const today = new Date().toISOString().slice(0, 10);
  const frozenAt = Date.parse(`${today}T12:00:00Z`);
  const passwordHash = await hashPassword(credentials.password);
  for (const [id, email, name, project] of [
    ['offline-alice', credentials.email, 'OFFLINE FIXTURE Alice', projectId],
    ['offline-bob', credentials.otherEmail, 'OFFLINE FIXTURE Bob', otherProjectId],
  ]) {
    await execute('INSERT INTO users VALUES (?,?,?,?,?,?,?)', [id, `email:${id}`, email, name, '', frozenAt, frozenAt]);
    await execute('INSERT INTO app_email_credentials VALUES (?,?,?,?)', [email, id, passwordHash, frozenAt]);
    await execute('INSERT INTO app_projects VALUES (?,?,?,?,?)', [project, id, 'active', 1, new Date(frozenAt).toISOString()]);
    const identity = { brandName: 'Fixture Atlas', aliases: ['Fixture Atlas Oy'], ownedDomains: ['atlas.example.test'], categoryFi: 'Offline fixture software', category: 'Offline fixture software', market: 'FI', promptLanguage: 'en' };
    await execute('INSERT INTO app_identity_versions VALUES (?,?,?,?)', [project, 1, JSON.stringify(identity), new Date(frozenAt).toISOString()]);
    await execute('INSERT INTO app_preferences VALUES (?,?,?,?,?)', [id, 'en', 'Europe/Helsinki', project, 1]);
  }
  const prompts = [
    { id: 'offline-prompt-price', text: '[OFFLINE FIXTURE] Which software options are affordable?', topic: 'Price', tags: ['fixture', 'comparison'] },
    { id: 'offline-prompt-support', text: '[OFFLINE FIXTURE] Which software options offer support?', topic: 'Support', tags: ['fixture', 'service'] },
    { id: 'offline-prompt-choice', text: '[OFFLINE FIXTURE] Which software options should a team compare?', topic: 'Price', tags: ['fixture', 'comparison'] },
  ].map(p => ({ ...p, version: 1, kind: 'neutral', status: 'active', market: 'FI', language: 'en' }));
  for (const p of prompts) {
    await execute('INSERT INTO mon_prompts VALUES (?,?,?,?,?,?)', [p.id, projectId, 1, 'active', p.id, frozenAt]);
    await execute('INSERT INTO mon_prompt_versions VALUES (?,?,?,?)', [p.id, 1, JSON.stringify(p), frozenAt]);
  }
  const identity = JSON.parse((await execute('SELECT identity_json FROM app_identity_versions WHERE project_id=?', [projectId])).rows[0].identity_json);
  for (let run = 0; run < 4; run++) {
    const runId = `offline-run-${run}`, consumer = run === 3;
    const stamp = frozenAt - (consumer ? 0 : run) * 86400000 - run * 60000;
    const routes = ['openai', 'claude'].map(provider => ({
      provider, model: `offline-fixture-${provider}`, route: 'offline-fixture',
      measurement_surface: consumer ? 'consumer_web' : 'model_api',
    }));
    const snapshot = { identity, identityVersion: 1, prompts, routes, market: 'FI', language: 'en', kind: 'neutral', methodology: 'OFFLINE-SYNTHETIC-FIXTURE-NOT-PROVIDER-EVIDENCE', collectionMethod: collectionMethodVersion,
      cohort: { brands: [identity, { brandName: 'Fixture Rival', aliases: [], ownedDomains: ['rival.example.test'] }] } };
    await execute('INSERT INTO mon_runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [runId, projectId, 'offline-alice', runId, runId, 'neutral', run === 1 || run === 2 ? 'partial' : 'completed', JSON.stringify(snapshot), 6, stamp, stamp + 10000, 'offline_fixture']);
    for (const [pIndex, p] of prompts.entries()) for (const [rIndex, route] of routes.entries()) {
      const index = pIndex * 2 + rIndex, id = `${runId}-${index}`;
      const status = run === 1 && index === 5 ? 'not_configured' : run === 2 && index === 4 ? 'provider_failed' : 'success';
      const answer = status !== 'success' ? '' : index === 3
        ? '[OFFLINE SYNTHETIC FIXTURE — NOT A REAL PROVIDER ANSWER]\nFixture Rival is an option.'
        : '[OFFLINE SYNTHETIC FIXTURE — NOT A REAL PROVIDER ANSWER]\nI recommend Fixture Atlas.\nFixture Rival is another option.';
      const references = index === 2 ? [] : [
        { url: 'https://atlas.example.test/fixture-only', title: 'Synthetic fixture source', provenance: 'offline_fixture' },
        { url: 'https://atlas.example.test/fixture-only', title: 'Repeated synthetic fixture source', provenance: 'offline_fixture' },
        { url: 'https://rival.example.test/fixture-only', title: 'Synthetic fixture comparison', provenance: 'offline_fixture' },
      ];
      const evidence = { id, runId, promptId: p.id, promptVersion: 1, text: p.text, provider: route.provider, model: route.model, status, answer,
        citations: references.map(({ url, title }) => ({ url, title })), observedAt: stamp + 1000, kind: 'neutral', methodology: snapshot.methodology,
        fixture: true, observation: apiObservation({ complete: status === 'success', occurrences: references }),
        ...(consumer ? { collection: { version: 'offline-fixture-only', supplier: 'offline_fixture', surface: 'consumer_web', citationObservation: references.length ? 'observed' : 'not_observed', sourceReferences: references.map(r => ({ ...r, kind: 'citation' })) } } : {}) };
      await execute('INSERT INTO mon_tasks VALUES (?,?,?,?,?,?,?,?,?,?)', [id, runId, p.id, 1, p.text, route.provider, JSON.stringify(route), 'done', null, null]);
      await execute('INSERT INTO mon_evidence VALUES (?,?,?,?)', [id, runId, JSON.stringify(evidence), stamp + 1000]);
    }
  }
  // Real immediate-insert triggers must not leave schedulable work behind.
  await execute("UPDATE mon_immediate_outbox SET state='cancelled',reason='offline_fixture_no_worker'");
  const env = Object.freeze({
    APP_ENV: 'test', EMAIL_AUTH_ENABLED: 'true',
    RESEND_API_KEY: 'offline-fixture-not-a-real-key',
    AUTH_EMAIL_FROM: 'OFFLINE FIXTURE <offline@example.test>',
    RATE_LIMIT_SECRET: 'offline-fixture-only-rate-limit-secret-42',
    MONITORING_ENABLED: 'false', PROJECT_SCHEDULER_ENABLED: 'false',
    BENCHMARK_ENABLED: 'false', BENCHMARK_SCHEDULER_ENABLED: 'false',
    WEBSITE_PROFILE_ENABLED: 'false', ENABLED_PROVIDERS: '',
    ...extraEnv,
  });
  const forbidden = async () => { throw new Error('OFFLINE_HARNESS_EXTERNAL_SERVICE_BLOCKED'); };
  await prepareDb(db);
  const service = serviceFactory({ db, env, clients: { offline: { origin, redirectUri: `${origin}/api/airank/v1/app/google/callback` } }, sendMail: forbidden, exchange: forbidden, verify: forbidden });
  return { db, service, today, from: new Date(frozenAt - 2 * 86400000).toISOString().slice(0, 10), projectId, otherProjectId, credentials };
}
