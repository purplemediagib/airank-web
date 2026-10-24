import { useMemo } from 'react';
import { getGetMeasurementContextQueryKey, useGetMeasurementContext, type Project } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { useAccount } from './account';
import { normLanguage, normMarket } from './project-validate';

export type ContextOption = { code: string; label: string; search: string };

function display(locale: string, type: 'region' | 'language', code: string, fallback?: string) {
  try {
    const n = new Intl.DisplayNames([locale], { type }).of(code);
    if (n && n !== code) return n;
  } catch { /* unsupported code or browser */ }
  return fallback || code;
}

/** Localised label for a market / language code; names come from Intl, server English name as fallback. */
export function useContextLabels() {
  const { locale } = useI18n();
  return useMemo(() => ({
    market: (code: string | null | undefined, fallback?: string) => { const c = normMarket(code); return `${display(locale, 'region', c, fallback)} (${c})`; },
    language: (code: string | null | undefined, fallback?: string) => { const c = normLanguage(code); return `${display(locale, 'language', c, fallback)} (${c})`; },
  }), [locale]);
}

/** Effective context of a project; legacy projects default to FI / fi. */
export const projectContext = (p: Partial<Pick<Project, 'market' | 'promptLanguage'>> | null | undefined) => ({ market: normMarket(p?.market), language: normLanguage(p?.promptLanguage) });

/** Global market/language catalogue (all ISO countries except excluded ones; ISO 639-1 languages). */
export function useMeasurementCatalog() {
  const { user } = useAccount();
  const { locale } = useI18n();
  const q = useGetMeasurementContext({ query: { queryKey: [...getGetMeasurementContextQueryKey(), user?.id ?? 'anon'], staleTime: 60 * 60_000, retry: 1, enabled: !!user } });
  const options = useMemo(() => {
    const data = q.data;
    const excluded = new Set((data?.excludedMarkets ?? []).map((x) => x.toUpperCase()));
    const coll = new Intl.Collator(locale);
    const build = (rows: { code: string; name: string }[], type: 'region' | 'language') =>
      rows.map((r) => {
        const code = type === 'region' ? r.code.toUpperCase() : r.code.toLowerCase();
        const local = display(locale, type, code, r.name);
        return { code, label: local, search: `${local} ${r.name} ${code}`.toLowerCase() };
      }).sort((a, b) => coll.compare(a.label, b.label));
    return {
      markets: build((data?.markets ?? []).filter((m) => !excluded.has(m.code.toUpperCase())), 'region'),
      languages: build(data?.languages ?? [], 'language'),
      notice: data?.notice ?? '',
    };
  }, [q.data, locale]);
  return { ...options, isPending: q.isPending && !!user, isError: q.isError, refetch: q.refetch };
}
