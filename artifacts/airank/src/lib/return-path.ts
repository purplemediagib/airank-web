const SAFE = /^\/(fi|en)\/(dashboard|start|settings)(\/[A-Za-z0-9_\-/]*)?(\?[A-Za-z0-9_\-=&%.]*)?$/;

/** Only relative /fi|en + dashboard|start|settings routes are accepted as return targets. */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.length > 512 || raw.includes('//') || raw.includes('\\')) return null;
  return SAFE.test(raw) ? raw : null;
}

/** The language picked on the auth screen overrides a stale protected-route locale. */
export function localizedReturnPath(raw: string | null | undefined, locale: 'fi' | 'en') {
  return (safeReturnPath(raw) ?? `/${locale}/dashboard`).replace(/^\/(?:fi|en)(?=\/)/, `/${locale}`);
}

export function appBase() {
  return import.meta.env.BASE_URL.replace(/\/$/, '');
}

export function googleStartUrl(returnTo: string) {
  return `${appBase()}/api/airank/v1/app/google/start?return_to=${encodeURIComponent(returnTo)}`;
}
