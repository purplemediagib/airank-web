// GET-only public diagnostics. Never log response bodies, headers, or credentials.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const safePaths = new Set(['/health', '/ready', '/healthz', '/readyz', '/api/healthz', '/api/airank/v1/app/content-projects']);
export function validateTarget(target) {
  const u = new URL(target.url);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash ||
      !(u.hostname.endsWith('.bunny.run') || u.hostname === 'app.airank.me') ||
      !safePaths.has(u.pathname)) throw new Error('UNSAFE_DIAGNOSTIC_TARGET');
}

export async function checkRelease(manifest, fetchImpl = fetch) {
  return Promise.all(manifest.probes.map(async target => {
    const base = { name: target.name };
    try {
      validateTarget(target);
      const response = await fetchImpl(target.url, {
        method: 'GET', redirect: 'error', credentials: 'omit',
        headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000),
      });
      if (response.status !== target.http) {
        await response.body?.cancel();
        return { ...base, pass: false, http: response.status, reason: `expected_http_${target.http}` };
      }
      if (!target.service && !target.flag && !target.status) {
        await response.body?.cancel();
        return { ...base, pass: true, http: response.status };
      }
      // Bound the read before parsing; never echo unexpected upstream content.
      let text = '';
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 16384) { await reader.cancel(); throw new Error('DIAGNOSTIC_TOO_LARGE'); }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      }
      const data = JSON.parse(text);
      const failures = [];
      if (target.service && data.service !== target.service) failures.push('service_mismatch');
      if (target.version && data.version !== target.version) failures.push('version_mismatch');
      if (target.service && data.revision !== manifest.revision) failures.push('revision_mismatch');
      if (target.flag && data[target.flag] !== true) failures.push('not_ready');
      if (target.status && data.status !== target.status) failures.push('status_mismatch');
      return { ...base, pass: failures.length === 0, http: response.status,
        ...(failures.length ? { reason: failures.join(',') } : {}) };
    } catch {
      return { ...base, pass: false, reason: 'unavailable_or_invalid_diagnostic' };
    }
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length > 2) throw new Error('This command accepts no URL or credential arguments.');
  const manifest = JSON.parse(await readFile(new URL('../release/targets.json', import.meta.url), 'utf8'));
  const checks = await checkRelease(manifest);
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), readOnly: true, checks,
    limitations: ['Does not verify model keys, budgets, paid calls, email, CMS writes, or browser journeys.'],
  }, null, 2));
  process.exitCode = checks.every(x => x.pass) ? 0 : 1;
}
