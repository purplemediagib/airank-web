import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { fi } from './fi';
import { en } from './en';

export type Dict = typeof fi;
export type Locale = 'fi' | 'en';
export const LOCALES: Locale[] = ['fi', 'en'];
export const DEFAULT_LOCALE: Locale = 'fi';
const STORAGE_KEY = 'airank.locale';

const DICTS: Record<Locale, Dict> = { fi, en };

export type PluralForms = { zero?: string; one: string; other: string };
type Vars = Record<string, string | number>;

export function isLocale(v: unknown): v is Locale {
  return v === 'fi' || v === 'en';
}

/** Only an explicit user choice is stored (account preferences arrive in Batch 03). */
export function getStoredLocale(): Locale | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}
function storeLocale(l: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* storage unavailable */
  }
}

/** Splits "/fi/dashboard/x" into locale + remainder. */
export function splitLocalePath(path: string): { locale: Locale | null; rest: string } {
  const m = path.match(/^\/(fi|en)(\/.*)?$/);
  if (!m) return { locale: null, rest: path };
  return { locale: m[1] as Locale, rest: m[2] ?? '' };
}

interface I18nValue {
  locale: Locale;
  d: Dict;
  t: (template: string, vars?: Vars) => string;
  plural: (forms: PluralForms, count: number, vars?: Vars) => string;
  num: (n: number, opts?: Intl.NumberFormatOptions) => string;
  pct: (fraction: number, digits?: number) => string;
  date: (d: Date | string, opts?: Intl.DateTimeFormatOptions) => string;
  setLocale: (l: Locale) => void;
  href: (path: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { locale: urlLocale } = splitLocalePath(location);
  const locale: Locale = urlLocale ?? getStoredLocale() ?? DEFAULT_LOCALE;
  const d = DICTS[locale];
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB';

  useEffect(() => {
    document.documentElement.lang = locale;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', d.meta.description);
    setMeta('property', 'og:description', d.meta.description);
    setMeta('name', 'twitter:description', d.meta.description);
    setMeta('property', 'og:locale', locale === 'fi' ? 'fi_FI' : 'en_GB');
  }, [locale, d]);

  const t = useCallback(
    (template: string, vars?: Vars) =>
      vars ? template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : template,
    [],
  );
  const num = useCallback(
    (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, opts).format(n),
    [tag],
  );
  const plural = useCallback(
    (forms: PluralForms, count: number, vars?: Vars) => {
      const rule = new Intl.PluralRules(tag).select(count);
      const tpl = count === 0 && forms.zero ? forms.zero : rule === 'one' ? forms.one : forms.other;
      return t(tpl, { count: num(count), ...vars });
    },
    [tag, t, num],
  );
  const pct = useCallback(
    (fraction: number, digits = 1) =>
      new Intl.NumberFormat(tag, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(fraction),
    [tag],
  );
  const date = useCallback(
    (v: Date | string, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(tag, opts ?? { day: 'numeric', month: 'short' }).format(typeof v === 'string' ? new Date(v) : v),
    [tag],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      storeLocale(next);
      const { rest } = splitLocalePath(location);
      const search = window.location.search;
      const hash = window.location.hash;
      navigate(`/${next}${rest || '/dashboard'}${search}${hash}`, { replace: true });
    },
    [location, navigate],
  );
  const href = useCallback((path: string) => `/${locale}${path}`, [locale]);

  const value = useMemo(
    () => ({ locale, d, t, plural, num, pct, date, setLocale, href }),
    [locale, d, t, plural, num, pct, date, setLocale, href],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useDocumentTitle(title: string) {
  const { d } = useI18n();
  useEffect(() => {
    const full = `${title} · ${d.meta.titleSuffix}`;
    document.title = full;
    setMeta('property', 'og:title', full);
    setMeta('name', 'twitter:title', full);
  }, [title, d]);
}
