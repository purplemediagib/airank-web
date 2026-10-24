// Test process only. Install before importing Vite or backend modules.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';

export function installOfflineIsolation() {
  // Do not inherit any database, OAuth, provider, mail or Replit deployment config.
  for (const key of Object.keys(process.env)) {
    if (!['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'TERM', 'NO_COLOR'].includes(key)) {
      delete process.env[key];
    }
  }
  process.env.NODE_ENV = 'test';
  const blocked = () => {
    throw Object.assign(new Error('OFFLINE_HARNESS_OUTBOUND_NETWORK_BLOCKED'), { code: 'OFFLINE_HARNESS_OUTBOUND_NETWORK_BLOCKED' });
  };
  // A listening server needs no outbound socket connections. Also block DNS and
  // fetch explicitly, so accidentally enabled providers fail before doing I/O.
  net.Socket.prototype.connect = blocked;
  http.request = http.get = https.request = https.get = blocked;
  const localLookup = (hostname, options, callback) => {
    if (hostname !== '127.0.0.1') return blocked();
    const cb = typeof options === 'function' ? options : callback;
    queueMicrotask(() => options?.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4));
  };
  dns.lookup = localLookup;
  dns.resolve = blocked;
  dns.promises.lookup = async (hostname, options) => {
    if (hostname !== '127.0.0.1') return blocked();
    const value = { address: '127.0.0.1', family: 4 };
    return options?.all ? [value] : value;
  };
  dns.promises.resolve = blocked;
  globalThis.fetch = async () => blocked();
  syncBuiltinESMExports();
}
