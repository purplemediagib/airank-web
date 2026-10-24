import { Router, json, type Request, type Response } from "express";
import {normalizeWebsiteAtEdge} from './website-edge.ts';
import { isContentRoute, contentQueryKeys } from './content-paths.ts';

const COOKIE_NAMES = new Set(["__Host-airank_session", "__Host-airank_app_oauth"]);
const methods = [
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/connections\/(?:ga4|gsc)(?:\/(?:properties|reports))?$/],
  ["POST", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/connections\/(?:ga4|gsc)\/(?:connect|sync)$/],
  ["PUT", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/connections\/(?:ga4|gsc)\/selection$/],
  ["DELETE", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/connections\/(?:ga4|gsc)$/],
  ["POST", /^\/v1\/app\/email\/(?:sign-up|sign-in|verify|reset-request|reset)$/],
  ["GET", /^\/v1\/measurement-context$/],
  ["GET", /^\/v1\/website-profiles\/[a-zA-Z0-9-]{1,80}$/],
  ["POST", /^\/v1\/website-profiles$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/reports(?:\/[a-zA-Z0-9-]{1,80})?$/],
  ["POST", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/reports$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/measurement-settings$/],
  ["PATCH", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/measurement-settings$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/opportunities$/],
  ["POST", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/opportunities$/],
  ["PATCH", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/opportunities\/[a-zA-Z0-9-]{1,80}$/],
  ["GET", /^\/v1\/industries(?:\/[a-zA-Z0-9_-]{1,80})?$/],
  ["POST", /^\/v1\/industries$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/schedule$/],
  ["PATCH", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/schedule$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/(?:research|evidence\/[a-zA-Z0-9-]{1,80})$/],
  ["POST", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/research$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/analytics$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/results(?:\/[a-zA-Z0-9_-]{1,160})?$/],
  ["POST", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/sentiment-backfill$/],
  ["POST", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/intelligence$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/(?:prompts|suggestions|monitoring-runs)(?:\/[a-zA-Z0-9-]{1,80})?$/],
  ["POST", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/(?:prompts|suggestions|monitoring-runs)(?:\/[a-zA-Z0-9-]{1,80})?$/],
  ["PATCH", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/suggestions\/[a-zA-Z0-9-]{1,80}$/],
  ["PATCH", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/prompts\/[a-zA-Z0-9-]{1,80}$/],
  ["POST", /^\/v1\/scans(?:\/preview)?$/],
  ["GET", /^\/v1\/scans\/[a-zA-Z0-9-]{1,80}$/],
  ["GET", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}\/scans$/],
  ["GET", /^\/v1\/app\/(?:session|google\/start|google\/callback)$/],
  ["POST", /^\/v1\/app\/logout$/],
  ["GET", /^\/v1\/projects(?:\/[a-zA-Z0-9-]{1,80}(?:\/versions)?)?$/],
  ["POST", /^\/v1\/projects(?:\/[a-zA-Z0-9-]{1,80}\/archive)?$/],
  ["PATCH", /^\/v1\/projects\/[a-zA-Z0-9-]{1,80}$/],
  ["GET", /^\/v1\/me\/preferences$/],
  ["PATCH", /^\/v1\/me\/preferences$/],
] as const;
export function safeCookies(header: string) {
  return header.split(";").map(s => s.trim()).filter(s => {
    const at = s.indexOf("=");
    return at > 0 && COOKIE_NAMES.has(s.slice(0, at)) && /^[A-Za-z0-9_-]*$/.test(s.slice(at + 1));
  }).join("; ");
}
export function safeSetCookie(value: string) {
  const name = value.slice(0, value.indexOf("="));
  return COOKIE_NAMES.has(name) && /;\s*Secure(?:;|$)/i.test(value) &&
    /;\s*HttpOnly(?:;|$)/i.test(value) && /;\s*SameSite=Lax(?:;|$)/i.test(value) &&
    /;\s*Path=\/(?:;|$)/i.test(value) && !/;\s*Domain=/i.test(value);
}
export function createAirankRouter(options: {
  origin?: string; upstream?: string; clientId?: string; transport?: typeof fetch;
} = {}) {
  const router = Router();
  const origin = options.origin || process.env.AIRANK_PUBLIC_ORIGIN ||
    (process.env.NODE_ENV === "development" && process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
  const upstream = options.upstream || process.env.AIRANK_API_ORIGIN || "https://mc-u87t7nkvtg.bunny.run";
  const clientId = options.clientId || process.env.AIRANK_OAUTH_CLIENT_ID || (process.env.NODE_ENV === "development" ? "replit-preview" : "app");
  const transport = options.transport || fetch;
  const error = (res: Response, status: number, code: string) => res.status(status).json({ error: { code } });
  router.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    if (!isContentRoute(req.method, req.path) && !methods.some(([method, path]) => req.method === method && path.test(req.path))) return void error(res, 404, "NOT_FOUND");
    try {
      if (!origin || new URL(origin).origin !== origin || !origin.startsWith("https://") ||
        new URL(upstream).origin !== upstream || !upstream.startsWith("https://")) throw new Error();
    } catch { return void error(res, 503, "APP_NOT_CONFIGURED"); }
    if (req.method !== "GET") {
      if (req.get("origin") !== origin) return void error(res, 403, "CSRF_INVALID");
      const emailAuth = /^\/v1\/app\/email\/(?:sign-up|sign-in|verify|reset-request|reset)$/.test(req.path);
      if (!emailAuth && !req.get("x-csrf-token")) return void error(res, 403, "CSRF_INVALID");
      if (!req.is("application/json")) return void error(res, 415, "JSON_REQUIRED");
    }
    next();
  });
  const standardJson = json({ limit: "64kb", strict: true });
  const contentJson = json({ limit: "512kb", strict: true });
  router.use((req, res, next) => (isContentRoute(req.method, req.path) ? contentJson : standardJson)(req, res, next));
  router.use(async (req: Request, res: Response) => {
    try {
      if(req.method==='POST'&&req.path==='/v1/website-profiles'){
        try{req.body={...req.body,website:normalizeWebsiteAtEdge(req.body?.website)};}catch{return void error(res,422,'INVALID_WEBSITE');}
      }
      const url = new URL(upstream + req.path);
      const incoming = new URL(req.originalUrl, origin);
      const allowedQuery = /\/connections\/(?:ga4|gsc)\/reports$/.test(req.path) && req.method === "GET" ? ["startDate","endDate","view","offset","limit","aiOnly"] : req.path.endsWith("/results") && req.method === "GET" ? ["page","pageSize","runId","promptId","provider","topic","from","to","state"] : req.path.endsWith("/analytics") && req.method === "GET" ? ["from","to","provider","topic","tag","surface","group","runId","promptId","promptVersion"] : req.path.endsWith("/prompts") && req.method === "GET" ? ["status","search","topic","tag","provider","outcome","sort","page"] : req.path.endsWith("/start") ? ["return_to"] : req.path.endsWith("/callback") ? ["code", "state", "error"] : [];
      for (const key of allowedQuery) {
        const value = incoming.searchParams.get(key);
        if (value !== null) {
          if (value.length > 4096) return void error(res, 400, "INVALID_QUERY");
          url.searchParams.set(key, value);
        }
      }
      for (const key of req.method === 'GET' ? contentQueryKeys(req.path) : []) {
        const value = incoming.searchParams.get(key);
        if (value !== null) {
          if (value.length > 4096) return void error(res, 400, "INVALID_QUERY");
          url.searchParams.set(key, value);
        }
      }
      const headers: Record<string, string> = { accept: "application/json", "x-airank-client": clientId };
      const cookies = safeCookies(req.get("cookie") || "");
      if (cookies) headers.cookie = cookies;
      if (req.method !== "GET") {
        headers.origin = origin;
        headers["content-type"] = "application/json";
        if (req.get("x-csrf-token")) headers["x-csrf-token"] = req.get("x-csrf-token")!;
      }
      // The legacy API also accepts /v1/scans but cannot atomically link projects.
      // Probe the owned extension before any scan POST; never fall back to legacy.
      if (req.method === "POST" && /^\/v1\/scans(?:\/preview)?$/.test(req.path)) {
        const projectId = req.body?.project_id;
        if (typeof projectId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(projectId))
          return void error(res, 422, "PROFILE_INVALID");
        const ready = await transport(new URL(`${upstream}/v1/projects/${projectId}/scans`), {
          method: "GET", headers, redirect: "manual", signal: AbortSignal.timeout(10000),
        });
        await ready.body?.cancel();
        if (!ready.ok) return void error(res, ready.status === 401 ? 401 : 503,
          ready.status === 401 ? "AUTH_REQUIRED" : "APP_NOT_CONFIGURED");
      }
      const response = await transport(url, {
        method: req.method, headers, redirect: "manual",
        signal: AbortSignal.timeout(req.path.includes('/connections/') ? 45000 : 15000),
        ...(req.method !== "GET" ? { body: JSON.stringify(req.body || {}) } : {}),
      });
      const setCookies = response.headers.getSetCookie().filter(safeSetCookie);
      if (response.status >= 300 && response.status < 400) {
        const location = new URL(response.headers.get("location") || "", upstream);
        const google = req.path.endsWith("/start") && location.origin === "https://accounts.google.com" && location.pathname === "/o/oauth2/v2/auth" &&
          location.searchParams.get("redirect_uri") === `${origin}/api/airank/v1/app/google/callback`;
        const callback = req.path.endsWith("/callback") && location.origin === origin &&
          /^\/(fi|en)\/(?:dashboard|start|settings|sign-in)(?:[/?#]|$)/.test(location.pathname) &&
          !location.username && !location.password;
        if (!google && !callback) return void error(res, 502, "UNSAFE_REDIRECT");
        if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
        res.redirect(302, location.href);
        return;
      }
      // Unsupported API 0.2.0 must not be interpreted as a signed-out app session.
      if (response.status === 404 && req.path === "/v1/app/session") return void error(res, 503, "APP_NOT_CONFIGURED");
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          const dataRead = req.method === "GET" && (/\/(?:analytics|research|reports|results|monitoring-runs)(?:\/|$)/.test(req.path) || isContentRoute(req.method, req.path));
          const reportWrite = req.method === "POST" && /\/reports$/.test(req.path);
          if (length > (dataRead || reportWrite ? 32 : 2) * 1024 * 1024) { await reader.cancel(); throw new Error("Oversize upstream"); }
          chunks.push(value);
        }
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString());
      if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter && /^\d{1,6}$/.test(retryAfter)) res.setHeader("Retry-After", retryAfter);
      if (!response.ok) {
        const code = payload?.error?.code;
        return void res.status(response.status).json({ error: {
          code: typeof code === "string" && /^[A-Z_]{1,80}$/.test(code) ? code : "UPSTREAM_UNAVAILABLE",
          ...(payload?.error?.fieldErrors ? { fieldErrors: payload.error.fieldErrors } : {}),
        } });
      }
      res.status(response.status).json(payload);
    } catch {
      if (req.path.endsWith("/callback")) {
        res.setHeader("Set-Cookie", "__Host-airank_app_oauth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
        res.redirect(302, `${origin}/fi/sign-in?error=oauth_failed`);
      } else error(res, 503, "UPSTREAM_UNAVAILABLE");
    }
  });
  router.use((err: { type?: string }, _req: Request, res: Response, _next: unknown) => {
    error(res, err.type === "entity.too.large" ? 413 : 400, err.type === "entity.too.large" ? "BODY_TOO_LARGE" : "INVALID_JSON");
  });
  return router;
}
