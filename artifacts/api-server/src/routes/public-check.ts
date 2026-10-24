import express, { type Request } from "express";
import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
type Options = { env?: NodeJS.ProcessEnv; transport?: typeof fetch; allowHttpForTests?: boolean };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");
const paths: [string, RegExp][] = [
  ["GET", /^\/v1\/capabilities$/],
  ["POST", /^\/v1\/(prepare|preview|scans)$/],
  ["GET", /^\/v1\/scans\/[a-f0-9-]{36}$/],
  ["POST", /^\/v1\/scans\/[a-f0-9-]{36}\/email$/],
  ["GET", /^\/v1\/deliveries\/[a-f0-9-]{36}$/],
  ["GET", /^\/v1\/reports\/[A-Za-z0-9_-]{40,100}$/],
];
/** Trust only the explicitly configured number of proxy-appended hops, never the first XFF entry. */
export function clientAddress(req: Request, hops: number): string {
  const chain = [...String(req.get("x-forwarded-for") || "").split(",").map(s => s.trim()).filter(Boolean), req.socket.remoteAddress || ""];
  const address = chain[Math.max(0, chain.length - 1 - hops)];
  return isIP(address) ? address.replace(/^::ffff:/, "") : req.socket.remoteAddress || "unknown";
}
export function createPublicCheckRouter(options: Options = {}) {
  const router = express.Router(), env = options.env || process.env, transport = options.transport || fetch;
  const bursts = new Map<string, { count: number; until: number }>();
  const origin = env.AIRANK_PUBLIC_ORIGIN || (env.NODE_ENV === "development" && env.REPLIT_DEV_DOMAIN ? `https://${env.REPLIT_DEV_DOMAIN}` : "");
  const upstream = env.AIRANK_API_ORIGIN || "https://mc-u87t7nkvtg.bunny.run";
  const error = (res: express.Response, status: number, code: string) => res.status(status).json({ error: { code } });
  router.use((req, res, next) => {
    res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" });
    if (!paths.some(([method, path]) => req.method === method && path.test(req.path))) return void error(res, 404, "NOT_FOUND");
    try {
      if (new URL(upstream).origin !== upstream || !(upstream.startsWith("https://") || options.allowHttpForTests)) throw Error();
      if (!origin || new URL(origin).origin !== origin || !(origin.startsWith("https://") || options.allowHttpForTests)) throw Error();
    } catch { return void error(res, 503, "APP_NOT_CONFIGURED"); }
    if (req.method === "POST" && (req.get("origin") !== origin || !req.is("application/json"))) return void error(res, 403, "ORIGIN_INVALID");
    const hops = Number(env.PUBLIC_CHECK_TRUST_PROXY_HOPS || 0);
    if (!Number.isInteger(hops) || hops < 0 || hops > 5) return void error(res, 503, "APP_NOT_CONFIGURED");
    const address = clientAddress(req, hops), time = Date.now();
    const burst = bursts.get(address);
    if (burst && burst.until > time && burst.count >= 60) return void error(res, 429, "REQUEST_RATE_LIMIT");
    if (!burst || burst.until <= time) {
      if (bursts.size > 5000) for (const [key, value] of bursts) if (value.until <= time) bursts.delete(key);
      if (bursts.size > 5000) return void error(res, 429, "REQUEST_RATE_LIMIT");
      bursts.set(address, { count: 1, until: time + 60000 });
    } else burst.count++;
    next();
  });
  router.use(express.json({ limit: "16kb", strict: true }));
  router.use(async (req, res) => {
    const secret = env.PUBLIC_CHECK_PROXY_SECRET || "";
    if (secret.length < 32 && req.path !== "/v1/capabilities") return void error(res, 503, "APP_NOT_CONFIGURED");
    let path = req.path.replace(/^\/v1/, "/v1/public-check"), method = req.method;
    let body = method === "POST" ? JSON.stringify(req.body) : "";
    // Report tokens are sent to Bunny in a signed body, not an access-log URL.
    const report = req.path.match(/^\/v1\/reports\/([A-Za-z0-9_-]{40,100})$/);
    if (report) { path = "/v1/public-check/reports/open"; method = "POST"; body = JSON.stringify({ token: report[1] }); }
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    const token = req.get("x-scan-token");
    if (token && /^[A-Za-z0-9_-]{40,100}$/.test(token)) headers["X-Scan-Token"] = token;
    if (secret.length >= 32) {
      const timestamp = String(Date.now()), address = clientAddress(req, Number(env.PUBLIC_CHECK_TRUST_PROXY_HOPS || 0)), visitor = hmac(address, secret);
      headers["X-Check-Address"] = address;
      headers["X-Check-Time"] = timestamp; headers["X-Check-Visitor"] = visitor;
      headers["X-Check-Proof"] = hmac([method, path, timestamp, visitor, digest(body)].join("\n"), secret);
    }
    try {
      const response = await transport(`${upstream}${path}`, { method, headers, ...(body ? { body } : {}), redirect: "error", signal: AbortSignal.timeout(path.endsWith("/prepare") || path.endsWith("/email") ? 70000 : 30000) });
      if (!response.headers.get("content-type")?.includes("application/json")) return void error(res, 502, "PUBLIC_CHECK_UNAVAILABLE");
      // A malformed upstream response cannot grow an unbounded public proxy buffer.
      const reader = response.body?.getReader(); if (!reader) return void error(res, 502, "PUBLIC_CHECK_UNAVAILABLE");
      const chunks: Buffer[] = []; let length = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 2_000_000) { await reader.cancel(); throw Error(); } chunks.push(Buffer.from(value)); }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (req.path === "/v1/capabilities" && secret.length < 32) Object.assign(data, { enabled: false, emailEnabled: false, marketingEnabled: false, autofillEnabled: false });
      res.status(response.status).json(data);
    } catch { error(res, 502, "PUBLIC_CHECK_UNAVAILABLE"); }
  });
  router.use((err: { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    error(res, err.type === "entity.too.large" ? 413 : 400, "BODY_INVALID");
  });
  return router;
}
