import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRelease, validateTarget } from '../check-release-readiness.mjs';

const target = { name: 'content', url: 'https://mc-example.bunny.run/ready', service: 'airank-content-worker', version: '1.0.0', flag: 'ready', http: 200 };
const manifest = { revision: 'reviewed-revision', probes: [target] };
const healthy = { service: target.service, version: target.version, revision: manifest.revision, ready: true };
test('uses only unauthenticated GET diagnostics and accepts the exact release', async () => {
  const rows = await checkRelease(manifest, async (url, init) => {
    assert.equal(url, target.url); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
    assert.equal(init.headers.authorization, undefined); assert.equal(init.body, undefined);
    return Response.json(healthy);
  });
  assert.equal(rows[0].pass, true);
});
test('rejects wrong service, version, revision and stale readiness', async () => {
  for (const patch of [{ service: 'other' }, { version: 'old' }, { revision: 'old' }, { ready: false }]) {
    assert.equal((await checkRelease(manifest, async () => Response.json({ ...healthy, ...patch })))[0].pass, false);
  }
});
test('checks protected route rejection rather than treating a missing route as working', async () => {
  const m = { probes: [{ name: 'auth', url: 'https://app.airank.me/api/airank/v1/app/content-projects', http: 401 }] };
  assert.equal((await checkRelease(m, async () => new Response('', { status: 401 })))[0].pass, true);
  assert.equal((await checkRelease(m, async () => new Response('', { status: 404 })))[0].pass, false);
});
test('does not expose unexpected upstream bodies or exception details', async () => {
  const marker = 'must-not-be-printed';
  for (const request of [
    async () => new Response(marker, { status: 500 }),
    async () => new Response(marker),
    async () => { throw Error(marker); },
    async () => Response.json({ ...healthy, unexpected: marker }),
    async () => new Response('x'.repeat(16385)),
  ]) assert.equal(JSON.stringify(await checkRelease(manifest, request)).includes(marker), false);
});
test('refuses writes, arbitrary hosts, credentials, queries and redirect paths', () => {
  for (const url of ['http://mc-example.bunny.run/health', 'https://other.test/health',
    'https://user:password@mc-example.bunny.run/health', 'https://mc-example.bunny.run/health?token=example',
    'https://mc-example.bunny.run/v1/jobs', 'https://evilbunny.run/ready']) {
    assert.throws(() => validateTarget({ url }));
  }
});
