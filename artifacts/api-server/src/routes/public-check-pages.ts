import type { Express } from "express";
import { readFile } from "node:fs/promises";
export const embedCsp = "frame-ancestors https://airank.me https://www.airank.me";
export function redactPublicPath(value?: string) {
  return value?.split("?")[0].replace(/\/reports?\/[^/]+/g, "/report/[redacted]");
}
export function registerPublicCheckPages(app: Express, loadHtml?: () => Promise<string>) {
  app.get(/^\/(fi|en)\/(?:free-check\/embed|report\/[^/]+)\/?$/, async (req, res) => {
    res.removeHeader("X-Frame-Options");
    res.set({
      "Content-Security-Policy": req.path.includes("/free-check/") ? embedCsp : "frame-ancestors 'none'",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    try {
      let html: string;
      if (loadHtml) {
        html = await loadHtml();
      } else if (process.env.NODE_ENV === "development") {
        const page = await fetch(`http://127.0.0.1:25438${req.path}`, { signal: AbortSignal.timeout(5000) });
        if (!page.ok) throw Error();
        html = await page.text();
      } else {
        html = await readFile(new URL("../../airank/dist/public/index.html", import.meta.url), "utf8");
      }
      res.type("html").send(html);
    } catch { res.status(503).type("text").send("AI Rank is temporarily unavailable. Please try again."); }
  });
}
