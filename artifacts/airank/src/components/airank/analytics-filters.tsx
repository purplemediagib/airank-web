import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import type { ProjectAnalytics } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { FilterSelect } from './data';
import { useL, groupLabel } from './analytics';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/lib/account';
import { useProjectsOptional } from '@/lib/project-context';
import type { useAnalyticsFilters } from '@/lib/use-analytics';

type F = ReturnType<typeof useAnalyticsFilters>;
/** Parent-owned extensions; older/mocked filter objects may omit them. */
type Ext = Partial<{ tag: string; setTag: (v: string) => void; surface: string; setSurface: (v: string) => void; promptId: string; setPromptId: (v: string) => void; promptVersion: string; setPromptVersion: (v: string) => void; setDates: (from: string, to: string) => void; reset: () => void }>;

const KEYS = ['range', 'provider', 'topic', 'group', 'tag', 'tags', 'tagMode', 'market', 'language', 'surface', 'promptId', 'promptVersion', 'from', 'to'] as const;
const MAX_PRESETS = 5;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
interface Preset { name: string; query: Record<string, string> }

export const validDates = (from: string, to: string): 'ok' | 'invalid' | 'inverted' =>
  !DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) ||
  new Date(from).toISOString().slice(0,10) !== from || new Date(to).toISOString().slice(0,10) !== to ? 'invalid' : from > to ? 'inverted' : 'ok';

export function readPresets(raw: string | null): Preset[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return v.filter((p) => p && typeof p.name === 'string' && p.query && typeof p.query === 'object').slice(0, MAX_PRESETS)
      .map((p) => ({ name: p.name.slice(0, 40), query: Object.fromEntries(Object.entries(p.query).filter(([k, x]) => (KEYS as readonly string[]).includes(k) && typeof x === 'string' && String(x).length <= (k === 'tags' ? 1024 : 120)).map(([k,x])=>[k,String(x)])) }));
  } catch { return []; }
}

function Presets() {
  const L = useL();
  const [location, navigate] = useLocation();
  const uid = useAccount().user?.id ?? '';
  const pid = useProjectsOptional()?.project?.id ?? '';
  const key = `airank.filters.${uid}.${pid}`;
  const [list, setList] = useState<Preset[]>([]);
  const [name, setName] = useState('');
  const [storageError,setStorageError] = useState(false);
  const [loadedKey,setLoadedKey] = useState('');
  useEffect(() => {
    setList([]); setName(''); setStorageError(false);
    if (uid && pid) {
      try { setList(readPresets(localStorage.getItem(key))); }
      catch { setStorageError(true); }
    }
    setLoadedKey(key);
  }, [key,uid,pid]);
  const persist = (n: Preset[]) => {
    try { localStorage.setItem(key, JSON.stringify(n)); setList(n); setStorageError(false); }
    catch { setStorageError(true); }
  };
  const save = () => {
    const p = new URLSearchParams(window.location.search);
    const query: Record<string, string> = {};
    for (const k of KEYS) { const v = p.get(k); if (v) query[k] = v; }
    const n = name.trim().slice(0, 40);
    if (!n) return;
    persist([{ name: n, query }, ...list.filter((x) => x.name !== n)].slice(0, MAX_PRESETS));
    setName('');
  };
  const load = (pr: Preset) => {
    const p = new URLSearchParams(window.location.search);
    for (const k of KEYS) p.delete(k);
    for (const k of ['run','runId','answer','evidenceBrand','evidence','answersPage','src','page']) p.delete(k);
    for (const [k, v] of Object.entries(pr.query)) p.set(k, v);
    navigate(`${location}?${p.toString()}`, { replace: true });
  };
  if (!uid || !pid || loadedKey !== key) return null;
  return (
    <details className="w-full text-[12px]" data-testid="presets">
      <summary className="cursor-pointer text-link">{L('Tallennetut suodattimet (vain tämä selain)', 'Saved filters (this browser only)')}</summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label={L('Esiasetuksen nimi', 'Preset name')} placeholder={L('Nimi', 'Name')} className="h-8 rounded-md border border-line bg-card px-2" data-testid="input-preset-name" />
        <Button size="sm" variant="secondary" onClick={save} disabled={!name.trim()} data-testid="button-preset-save">{L('Tallenna', 'Save')}</Button>
        {list.map((p) => (
          <span key={p.name} className="inline-flex items-center overflow-hidden rounded-md border border-line">
            <button type="button" className="px-2 py-1 hover:bg-canvas" onClick={() => load(p)} data-testid={`button-preset-load-${p.name}`}>{p.name}</button>
            <button type="button" className="border-l border-line px-2 py-1 text-danger hover:bg-canvas" onClick={() => persist(list.filter((x) => x.name !== p.name))} aria-label={`${L('Poista', 'Delete')}: ${p.name}`} data-testid={`button-preset-delete-${p.name}`}>x</button>
          </span>
        ))}
        <span className="text-muted-ink">{L(`Enintään ${MAX_PRESETS}. Mittaussuodattimet tallennetaan, ei lähde- tai tekstihakua.`, `Up to ${MAX_PRESETS}. Measurement filters only; source and text searches are not saved.`)}</span>
        {storageError && <span role="status" className="text-danger">{L('Selaimen suodattimien tallennus ei ole käytettävissä.', 'Filter storage is unavailable in this browser.')}</span>}
      </div>
    </details>
  );
}

export function MeasurementContextFilters({f,a}: {f:F;a?:ProjectAnalytics}) {
  const L=useL(),tags=a?.availableTags??[];
  return <>
    {f.setTags && tags.length > 0 && <details className="relative text-[12px]" data-testid="filter-tags">
      <summary className="cursor-pointer rounded-md border border-line bg-card px-3 py-2">{L('Tunnisteet', 'Tags')} ({f.tags.length}/12)</summary>
      <fieldset className="absolute z-20 max-h-72 min-w-48 overflow-auto rounded-md border border-line bg-card p-3 shadow-lg">
        <legend className="sr-only">{L('Valitut tunnisteet', 'Selected tags')}</legend>
        {tags.map(t=><label key={t} className="flex items-center gap-2 py-1"><input type="checkbox" checked={f.tags.includes(t)} disabled={!f.tags.includes(t)&&f.tags.length>=12} onChange={e=>f.setTags(e.target.checked?[...f.tags,t]:f.tags.filter(v=>v!==t))}/>{t}</label>)}
        <button type="button" className="mt-2 text-link" onClick={()=>f.setTags([])}>{L('Tyhjennä', 'Clear')}</button>
      </fieldset>
    </details>}
    {f.setTagMode && <FilterSelect label={L('Tunnisteiden ehto', 'Tag matching')} value={f.tagMode} onChange={f.setTagMode} testId="filter-tag-mode"
      options={[{value:'or',label:L('TAI (jokin)', 'OR (any)')},{value:'and',label:L('JA (kaikki)', 'AND (all)')}]} />}
    {f.setMarket && <FilterSelect label={L('Markkina', 'Market')} value={f.market} onChange={f.setMarket} testId="filter-market" disabled={!a}
      options={[{value:'all',label:L('Kaikki markkinat', 'All markets')},...(a?.availableMarkets??[]).map(value=>({value,label:value}))]} />}
    {f.setLanguage && <FilterSelect label={L('Kieli', 'Language')} value={f.language} onChange={f.setLanguage} testId="filter-language" disabled={!a}
      options={[{value:'all',label:L('Kaikki kielet', 'All languages')},...(a?.availableLanguages??[]).map(value=>({value,label:value}))]} />}
  </>;
}

export function AnalyticsFilterBar({ f, a }: { f: F; a?: ProjectAnalytics }) {
  const { d, plural } = useI18n();
  const L = useL();
  const x = f as unknown as Ext;
  const groups = a?.groups ?? [];
  const selected = f.group || a?.selectedGroup || '';
  const [from, setFrom] = useState(f.from);
  const [to, setTo] = useState(f.to);
  useEffect(() => { setFrom(f.from); setTo(f.to); }, [f.from, f.to]);
  const check = validDates(from, to);
  const tags = a?.availableTags ?? [];
  const surfaces = a?.availableSurfaces ?? [];
  const prompts = a?.availablePrompts ?? [];
  const ver = x.promptVersion ?? '';
  const verBad = ver !== '' && !/^[1-9]\d*$/.test(ver);
  return (
    <div className="ar-rise ar-rise-1 flex flex-wrap items-center gap-2">
      <FilterSelect label={d.overview.range} value={f.range} onChange={f.setRange} testId="filter-range" className="min-w-[110px]"
        options={[...['7', '28', '90'].map((v) => ({ value: v, label: plural(d.common.days, Number(v)) })), ...(x.setDates ? [{ value: 'custom', label: L('Mukautettu', 'Custom') }] : [])]} />
      <FilterSelect label={d.overview.platform} value={f.provider} onChange={f.setProvider} testId="filter-platform" disabled={!a}
        options={[{ value: 'all', label: d.overview.platformAll }, ...(a?.availableProviders ?? []).map((p) => ({ value: p, label: p }))]} />
      <FilterSelect label={d.overview.topic} value={f.topic} onChange={f.setTopic} testId="filter-topic" disabled={!a}
        options={[{ value: 'all', label: d.overview.topicAll }, ...(a?.topics ?? []).map((t) => ({ value: t, label: t }))]} />
       <MeasurementContextFilters f={f} a={a} />
       {!f.setTags && x.setTag && tags.length > 0 && <FilterSelect label={L('Tunniste', 'Tag')} value={x.tag || 'all'} onChange={(v) => x.setTag?.(v === 'all' ? '' : v)} testId="filter-tag"
        options={[{ value: 'all', label: L('Kaikki tunnisteet', 'All tags') }, ...tags.map((t) => ({ value: t, label: t }))]} />}
      {x.setSurface && surfaces.length > 0 && <FilterSelect label={L('Keräystapa', 'Collection method')} value={x.surface || 'all'} onChange={(v) => x.setSurface?.(v === 'all' ? '' : v)} testId="filter-surface"
        options={[{ value: 'all', label: L('Kaikki keräystavat', 'All collection methods') }, ...surfaces.map((t) => ({ value: t, label: t === 'consumer_web' ? L('Kuluttajapalvelu', 'Consumer interface') : t === 'model_api' ? L('Mallin API', 'Model API') : t }))]} />}
      {x.setPromptId && prompts.length > 0 && <FilterSelect label={L('Kehote', 'Prompt')} value={x.promptId || 'all'} onChange={(v) => x.setPromptId?.(v === 'all' ? '' : v)} testId="filter-prompt" className="min-w-[200px] max-w-[320px]"
        options={[{ value: 'all', label: L('Kaikki kehotteet', 'All prompts') }, ...prompts.map((p) => ({ value: p.id, label: p.text.length > 70 ? `${p.text.slice(0, 70)}...` : p.text }))]} />}
      {x.setPromptVersion && x.promptId && <label className="flex items-center gap-1 text-[12px] text-muted-ink">{L('Versio', 'Version')}
        <input inputMode="numeric" value={ver} onChange={(e) => x.setPromptVersion?.(e.target.value)} aria-invalid={verBad} className="h-9 w-16 rounded-md border border-line bg-card px-2 text-ink" data-testid="input-prompt-version" /></label>}
      {groups.length > 0 && <FilterSelect label={L('Ryhmä', 'Group')} value={selected} onChange={f.setGroup} testId="filter-group" className="min-w-[200px]"
        options={groups.map((g) => ({ value: g.id, label: `${groupLabel(a, g.id, L)} (${g.runCount})` }))} />}
      {f.runId && <Button size="sm" variant="secondary" onClick={() => f.setRunId('')} data-testid="button-clear-run">{L('Poista ajorajaus', 'Clear run filter')}</Button>}
      {x.reset && <Button size="sm" variant="ghost" onClick={() => x.reset?.()} data-testid="button-reset-filters">{L('Nollaa suodattimet', 'Reset filters')}</Button>}
      <p className="w-full text-[12px] text-muted-ink sm:ml-auto sm:w-auto" data-testid="text-range">{f.from} – {f.to} UTC</p>
      {verBad && <p role="alert" className="w-full text-[12px] text-danger" data-testid="error-prompt-version">{L('Version on oltava positiivinen kokonaisluku.', 'Version must be a positive integer.')}</p>}
      {f.range === 'custom' && x.setDates && (
        <form className="flex w-full flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (check === 'ok') x.setDates?.(from, to); }} data-testid="form-custom-dates">
          <label className="flex flex-col text-[12px] text-muted-ink">{L('Alkaen (UTC)', 'From (UTC)')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-line bg-card px-2 text-ink" data-testid="input-date-from" /></label>
          <label className="flex flex-col text-[12px] text-muted-ink">{L('Asti (UTC)', 'To (UTC)')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-line bg-card px-2 text-ink" data-testid="input-date-to" /></label>
          <Button size="sm" type="submit" disabled={check !== 'ok'} data-testid="button-apply-dates">{L('Käytä', 'Apply')}</Button>
          {check !== 'ok' && <p role="alert" className="text-[12px] text-danger" data-testid="error-dates">{check === 'inverted' ? L('Alkupäivä on loppupäivän jälkeen.', 'Start date is after end date.') : L('Anna kelvolliset päivämäärät.', 'Enter valid dates.')}</p>}
        </form>
      )}
      <Presets />
    </div>
  );
}
