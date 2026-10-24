import type { Dict } from '@/i18n';
import type { ProjectInput } from '@workspace/api-client-react';

export type ProjectErrors = Partial<Record<keyof ProjectInput, string>>;
type T = (s: string, vars?: Record<string, string | number>) => string;

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*\.([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i;

/**
 * Canonical owned domain, matching the backend/worker: accepts a bare host or a strict http(s) URL,
 * drops scheme, credentials-free path/query/port, converts IDN to punycode, lowercases and strips one leading www.
 * Unparseable input is returned trimmed+lowercased so validation can flag it.
 */
export function normaliseDomain(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if(/[\u0000-\u0020\u007f\\]/.test(v))return v.toLowerCase();
  const normalized=v.startsWith('//')?'https:'+v:v;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized);
  if (hasScheme && !/^https?:\/\//i.test(normalized)) return v.toLowerCase();
  if(/^[a-z][a-z0-9+.-]*:/i.test(normalized)&&!hasScheme)return v.toLowerCase();
  if (!hasScheme && /[\s@]/.test(v)) return v.toLowerCase();
  try {
    const u = new URL(hasScheme ? normalized : `https://${normalized}`);
    if (u.username || u.password || u.port) return v.toLowerCase();
    return u.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  } catch {
    return v.toLowerCase();
  }
}

export function isValidDomain(host: string) {
  return host.length <= 253 && DOMAIN_RE.test(host);
}

export const DEFAULT_MARKET = 'FI';
export const DEFAULT_LANGUAGE = 'fi';
export const emptyProjectInput: ProjectInput = { brandName: '', aliases: [], ownedDomains: [''], categoryFi: '', market: DEFAULT_MARKET, promptLanguage: DEFAULT_LANGUAGE };

const MARKET_RE = /^[A-Z]{2}$/;
const LANG_RE = /^[a-z]{2}$/;
export const normMarket = (m: string | null | undefined) => (m ?? '').trim().toUpperCase() || DEFAULT_MARKET;
export const normLanguage = (l: string | null | undefined) => (l ?? '').trim().toLowerCase() || DEFAULT_LANGUAGE;

/** Category text: the edited `categoryFi` field wins, neutral `category` is the fallback; both are sent equal. */
export function normaliseInput(v: ProjectInput): ProjectInput {
  const category = (v.categoryFi || v.category || '').trim();
  return {
    brandName: v.brandName.trim(),
    categoryFi: category,
    category,
    aliases: v.aliases.map((a) => a.trim()).filter(Boolean),
    ownedDomains: v.ownedDomains.map(normaliseDomain).filter(Boolean),
    market: normMarket(v.market),
    promptLanguage: normLanguage(v.promptLanguage),
  };
}

export function sameInput(a: ProjectInput, b: ProjectInput) {
  const x = normaliseInput(a);
  const y = normaliseInput(b);
  return x.brandName === y.brandName && x.market === y.market && x.promptLanguage === y.promptLanguage && x.categoryFi === y.categoryFi && x.aliases.join('\n') === y.aliases.join('\n') && x.ownedDomains.join('\n') === y.ownedDomains.join('\n');
}

export function validateProject(raw: ProjectInput, d: Dict, t: T): ProjectErrors {
  const v = normaliseInput(raw);
  const e: ProjectErrors = {};
  if (!v.brandName) e.brandName = d.validation.required;
  else if (v.brandName.length < 2) e.brandName = t(d.validation.min, { min: 2 });
  else if (v.brandName.length > 100) e.brandName = t(d.validation.max, { max: 100 });

  if (!v.ownedDomains.length) e.ownedDomains = d.auth.domainsMin;
  else if (v.ownedDomains.length > 8) e.ownedDomains = d.auth.domainsMax;
  else if (v.ownedDomains.some((x) => !isValidDomain(x))) e.ownedDomains = d.validation.domain;
  else if (new Set(v.ownedDomains).size !== v.ownedDomains.length) e.ownedDomains = d.auth.duplicate;

  const cat = v.categoryFi.toLowerCase();
  if (!v.categoryFi) e.categoryFi = d.validation.required;
  else if (v.categoryFi.length < 8) e.categoryFi = t(d.validation.min, { min: 8 });
  else if (v.categoryFi.length > 240) e.categoryFi = t(d.validation.max, { max: 240 });
  else if (
    /https?:|www\./i.test(cat) ||
    (v.brandName && cat.includes(v.brandName.toLowerCase())) ||
    v.aliases.some((a) => cat.includes(a.toLowerCase())) ||
    v.ownedDomains.some((x) => cat.includes(x))
  )
    e.categoryFi = d.validation.categoryBrand;

  if (!MARKET_RE.test(v.market ?? '')) e.market = d.auth.validationServer;
  if (!LANG_RE.test(v.promptLanguage ?? '')) e.promptLanguage = d.auth.validationServer;

  if (v.aliases.length > 8) e.aliases = d.validation.aliasesMax;
  else if (v.aliases.some((a) => a.length < 2 || a.length > 100)) e.aliases = d.validation.aliasLength;
  else if (new Set(v.aliases.map((a) => a.toLowerCase())).size !== v.aliases.length) e.aliases = d.auth.duplicate;
  return e;
}

/** Localised message for website-profile (AI autofill) failures, by server code. */
export function websiteProfileErrorMessage(code: string | null | undefined, d: Dict): string {
  const w = d.autofill.errors;
  switch (code) {
    case 'WEBSITE_PROFILE_DISABLED': return w.disabled;
    case 'WEBSITE_UNAVAILABLE': return w.websiteUnavailable;
    case 'AI_UNAVAILABLE': return w.aiUnavailable;
    case 'INVALID_WEBSITE': return w.invalidWebsite;
    case 'RATE_LIMITED': return w.rateLimited;
    case 'WEBSITE_PROFILE_FAILED':
    default: return w.failed;
  }
}

/** Maps server `fieldErrors` keys onto form fields with a localised message. */
export function mapServerFieldErrors(fieldErrors: Record<string, unknown> | null, d: Dict): ProjectErrors {
  if (!fieldErrors) return {};
  const e: ProjectErrors = {};
  for (const key of Object.keys(fieldErrors)) {
    const k = key.toLowerCase();
    if (k.includes('brand')) e.brandName = d.auth.validationServer;
    else if (k.includes('market')) e.market = d.auth.validationServer;
    else if (k.includes('lang')) e.promptLanguage = d.auth.validationServer;
    else if (k.includes('categ')) e.categoryFi = d.auth.validationServer;
    else if (k.includes('alias')) e.aliases = d.auth.validationServer;
    else if (k.includes('domain')) e.ownedDomains = d.auth.validationServer;
  }
  return e;
}
