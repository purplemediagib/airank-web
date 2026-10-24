import { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Archive, Check, GitMerge, Pencil, Plus, Sparkles, Users, X } from 'lucide-react';
import { WebsiteFavicon } from '@/components/airank/website-favicon';
import { CandidateIdentity, proposedDomains } from '@/components/airank/candidate-identity';
import type { AnalyticsEvidence, Brand, Candidate, Research, ResearchInput } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useDocumentTitle, useI18n } from '@/i18n';
import { writeErrorMessage } from '@/lib/api-errors';
import { useProjects } from '@/lib/project-context';
import { useQueryParam } from '@/lib/use-query-param';
import { useResearch, useResearchWrite } from '@/lib/use-research';
import { EmptyState, LoadingBlock, PageHeader, Panel, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { FilterSelect, SearchInput } from '@/components/airank/data';
import { ConfirmDialog, SubTabs } from '@/components/airank/forms';
import { useL } from '@/components/airank/analytics';
import { useAnalytics, useAnalyticsFilters } from '@/lib/use-analytics';
import { AnalyticsFilterBar } from '@/components/airank/analytics-filters';
import { DiscoveryPanel } from '@/components/airank/intelligence-workbench';
import { BrandDialog, BrandStatus, Chips, EvidenceLinks, PAGE_SIZE, Pager, ResearchFailure, brandToDraft, clampPage, type BrandDraft } from '@/components/airank/research-parts';

type Dlg = { mode: 'create' } | { mode: 'edit'; brand: Brand } | { mode: 'accept'; cand: Candidate } | { mode: 'merge'; cand: Candidate } | null;

function useListState() {
  const [q, setQ] = useQueryParam('q', '');
  const [status, setStatus] = useQueryParam('status', 'all');
  const [sort, setSort] = useQueryParam('sort', 'name');
  const [pageRaw, setPage] = useQueryParam('page', '1');
  return { q, setQ: (v: string) => { setQ(v); setPage('1'); }, status, setStatus: (v: string) => { setStatus(v); setPage('1'); }, sort, setSort, pageRaw, setPage };
}

function Tracked({ r, readOnly, onEdit, onArchive, busy }: { r: Research; readOnly: boolean; onEdit: (b: Brand, el: HTMLElement) => void; onArchive: (b: Brand) => void; busy: boolean }) {
  const L = useL();
  const { num } = useI18n();
  const { projectHref } = useProjects();
  const s = useListState();
  const [confirm, setConfirm] = useState<string | null>(null);
  const merged = useMemo(() => { const m = new Map<string, number>(); r.candidates.forEach((c) => { if (c.brandId) m.set(c.brandId, (m.get(c.brandId) ?? 0) + c.evidenceIds.length); }); return m; }, [r]);
  const needle = s.q.trim().toLocaleLowerCase();
  const rows = r.competitors
    .filter((b) => (s.status === 'all' ? b.status === 'active' : s.status === 'any' ? true : b.status === s.status))
    .filter((b) => !needle || [b.name, ...b.aliases, ...b.domains].some((x) => x.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => (s.sort === 'evidence' ? (merged.get(b.id) ?? 0) - (merged.get(a.id) ?? 0) : 0) || a.name.localeCompare(b.name));
  const page = clampPage(s.pageRaw, rows.length);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <Panel className="overflow-hidden" as="div">
      <div className="flex flex-col gap-2 border-b border-line p-4 md:flex-row md:items-center">
        <SearchInput value={s.q} onChange={s.setQ} label={L('Hae nimellä, aliaksella tai verkkotunnuksella', 'Search name, alias or domain')} testId="input-search" />
        <div className="flex flex-wrap gap-2">
          <FilterSelect label={L('Tila', 'Status')} value={s.status} onChange={s.setStatus} testId="select-status" options={[{ value: 'all', label: L('Seurannassa', 'Tracked') }, { value: 'archived', label: L('Arkistoidut', 'Archived') }, { value: 'any', label: L('Kaikki tilat', 'All states') }]} />
          <FilterSelect label={L('Järjestys', 'Sort')} value={s.sort} onChange={s.setSort} testId="select-sort" options={[{ value: 'name', label: L('Nimi A–Ö', 'Name A–Z') }, { value: 'evidence', label: L('Eniten havaintoja', 'Most evidence') }]} />
        </div>
      </div>
      {!rows.length ? (
        s.q || s.status !== 'all' ? <EmptyState title={L('Ei osumia', 'No matches')} body={L('Muuta hakua tai tilasuodatinta.', 'Change the search or status filter.')} /> :
        <EmptyState icon={<Users className="size-[18px]" aria-hidden />} title={L('Ei vielä seurattuja kilpailijoita', 'No tracked competitors yet')} body={L('Lisää kilpailija tai hyväksy havaittu brändi. Vertailu tehdään samoilla neutraaleilla kysymyksillä.', 'Add a competitor or accept a discovered brand. Comparisons use the same neutral questions.')} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="table-competitors">
              <caption className="sr-only">{L('Seuratut kilpailijat', 'Tracked competitors')}</caption>
              <thead className="hidden md:table-header-group"><tr className="border-b border-line text-[12px] text-muted-ink">
                <th scope="col" className="h-10 px-4 font-medium">{L('Brändi', 'Brand')}</th>
                <th scope="col" className="px-4 font-medium">{L('Aliakset', 'Aliases')}</th>
                <th scope="col" className="px-4 font-medium">{L('Verkkotunnukset', 'Domains')}</th>
                <th scope="col" className="px-4 font-medium">{L('Yhdistetyt havainnot', 'Merged evidence')}</th>
                <th scope="col" className="px-4 font-medium">{L('Tila', 'Status')}</th>
                <th scope="col" className="px-4"><span className="sr-only">{L('Toiminnot', 'Actions')}</span></th>
              </tr></thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.id} className="grid gap-2 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas/70 md:table-row md:p-0" data-testid={`row-competitor-${b.id}`}>
                    <td className="md:px-4 md:py-3"><span className="inline-flex items-center gap-2.5 align-middle"><WebsiteFavicon domain={b.domains[0]} brand={b.name} className="size-7 text-[12px]" /><Link href={projectHref(`/dashboard/competitors/${encodeURIComponent(b.id)}`)} className="font-semibold text-ink hover:text-link hover:underline" data-testid={`link-competitor-${b.id}`}>{b.name}</Link></span><span className="ml-2 text-[12px] text-muted-ink">v{b.version}</span></td>
                    <td className="md:px-4"><Chips items={b.aliases} /></td>
                    <td className="md:px-4">{b.domains.length ? <Chips items={b.domains} mono /> : <span className="text-[12px] text-muted-ink">{L('Ei vahvistettu', 'Not confirmed')}</span>}</td>
                    <td className="tabular text-[13px] md:px-4">{num(merged.get(b.id) ?? 0)}</td>
                    <td className="md:px-4"><BrandStatus status={b.status} /></td>
                    <td className="md:px-4 md:text-right">
                      {b.status === 'active' && <div className="flex gap-1 md:justify-end">
                        <Button variant="ghost" size="sm" disabled={readOnly || busy} onClick={(e) => onEdit(b, e.currentTarget)} aria-label={`${L('Muokkaa', 'Edit')}: ${b.name}`} data-testid={`button-edit-${b.id}`}><Pencil aria-hidden /><span className="hidden lg:inline">{L('Muokkaa', 'Edit')}</span></Button>
                        <ConfirmDialog open={confirm === b.id} onOpenChange={(v) => setConfirm(v ? b.id : null)} destructive
                          title={L(`Arkistoidaanko ${b.name}?`, `Archive ${b.name}?`)}
                          body={L('Brändi poistuu tulevista kohorteista. Aiemmat mittaukset ja niiden kohortti säilyvät muuttumattomina.', 'The brand leaves future cohorts. Past measurements and their cohort remain unchanged.')}
                          confirmLabel={L('Arkistoi', 'Archive')} onConfirm={() => onArchive(b)}
                          trigger={<Button variant="ghost" size="sm" disabled={readOnly || busy} aria-label={`${L('Arkistoi', 'Archive')}: ${b.name}`} data-testid={`button-archive-${b.id}`}><Archive aria-hidden /><span className="hidden lg:inline">{L('Arkistoi', 'Archive')}</span></Button>} />
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={rows.length} onPage={(p) => s.setPage(String(p))} label={L(`${rows.length} kilpailijaa`, `${rows.length} competitors`)} />
        </>
      )}
    </Panel>
  );
}

function Discovered({ r, readOnly, busy, onAccept, onDismiss, onMerge }: { r: Research; readOnly: boolean; busy: boolean; onAccept: (c: Candidate, el: HTMLElement) => void; onDismiss: (c: Candidate) => void; onMerge: (c: Candidate, el: HTMLElement) => void }) {
  const L = useL();
  const { num } = useI18n();
  const s = useListState();
  const [open, setOpen] = useState<Candidate | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const evidence = useMemo(() => new Map<string, AnalyticsEvidence>(r.evidence.map((e) => [e.id, e])), [r.evidence]);
  const brands = useMemo(() => new Map(r.competitors.map((b) => [b.id, b])), [r.competitors]);
  const needle = s.q.trim().toLocaleLowerCase();
  const rows = r.candidates
    .filter((c) => (s.status === 'all' ? c.status === 'pending' : s.status === 'any' ? true : c.status === s.status))
    .filter((c) => !needle || c.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => (s.sort === 'name' ? 0 : b.evidenceIds.length - a.evidenceIds.length) || a.name.localeCompare(b.name));
  const page = clampPage(s.pageRaw, rows.length);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActive = r.competitors.some((b) => b.status === 'active');
  return (
    <div className="flex flex-col gap-3">
      <ReasonNote>{L('Ehdokkaat poimitaan tallennetuista vastauksista vain numeroiduista tai lihavoiduista nimikkeistä. Niitä ei arvata, eikä verkkotunnuksia päätellä. Jokainen ehdokas linkittyy havaittuihin vastauksiin.', 'Candidates are extracted from stored answers only from numbered or bold labels. They are not guessed, and domains are never inferred. Each candidate links to observed answers.')}</ReasonNote>
      <Panel className="overflow-hidden" as="div">
        <div className="flex flex-col gap-2 border-b border-line p-4 md:flex-row md:items-center">
          <SearchInput value={s.q} onChange={s.setQ} label={L('Hae ehdokasta', 'Search candidates')} testId="input-search-candidates" />
          <div className="flex flex-wrap gap-2">
            <FilterSelect label={L('Tila', 'Status')} value={s.status} onChange={s.setStatus} testId="select-candidate-status" options={[{ value: 'all', label: L('Odottaa arviota', 'Awaiting review') }, { value: 'accepted', label: L('Hyväksytyt', 'Accepted') }, { value: 'merged', label: L('Yhdistetyt', 'Merged') }, { value: 'dismissed', label: L('Hylätyt', 'Dismissed') }, { value: 'any', label: L('Kaikki tilat', 'All states') }]} />
            <FilterSelect label={L('Järjestys', 'Sort')} value={s.sort === 'name' ? 'name' : 'evidence'} onChange={s.setSort} testId="select-candidate-sort" options={[{ value: 'evidence', label: L('Eniten havaintoja', 'Most evidence') }, { value: 'name', label: L('Nimi A–Ö', 'Name A–Z') }]} />
          </div>
        </div>
        {!rows.length ? <EmptyState title={s.q || s.status !== 'all' ? L('Ei osumia', 'No matches') : L('Ei arvioitavia ehdokkaita', 'No candidates to review')} body={L('Uudet ehdokkaat ilmestyvät, kun tallennetuissa vastauksissa on nimettyjä listakohtia.', 'New candidates appear when stored answers contain labelled list items.')} /> : (
          <>
            <ul className="divide-y divide-line" data-testid="list-candidates">
              {shown.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between" data-testid={`row-candidate-${c.id}`}>
                  <div className="flex min-w-0 gap-3">
                    <CandidateIdentity c={c}>
                    <p className="mt-0.5 text-[12px] text-muted-ink">
                      <button type="button" className="font-medium text-link underline-offset-2 hover:underline" onClick={(e) => { trigger.current = e.currentTarget; setOpen(c); }} data-testid={`button-candidate-evidence-${c.id}`}>{L(`${num(c.evidenceIds.length)} havaittua vastausta`, `${num(c.evidenceIds.length)} observed answers`)}</button>
                      {c.brandId && brands.get(c.brandId) && <> · {L('Linkitetty', 'Linked to')} {brands.get(c.brandId)!.name}</>}
                    </p>
                    </CandidateIdentity>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <BrandStatus status={c.status} />
                    {c.status === 'pending' && <>
                      <Button size="sm" disabled={readOnly || busy} onClick={(e) => onAccept(c, e.currentTarget)} data-testid={`button-accept-${c.id}`}><Check aria-hidden />{L('Hyväksy', 'Accept')}</Button>
                      <Button size="sm" variant="secondary" disabled={readOnly || busy || !hasActive} title={!hasActive ? L('Yhdistäminen vaatii aktiivisen kilpailijan', 'Merging requires an active competitor') : undefined} onClick={(e) => onMerge(c, e.currentTarget)} data-testid={`button-merge-${c.id}`}><GitMerge aria-hidden />{L('Yhdistä', 'Merge')}</Button>
                      <Button size="sm" variant="ghost" disabled={readOnly || busy} onClick={() => onDismiss(c)} data-testid={`button-dismiss-${c.id}`}><X aria-hidden />{L('Hylkää', 'Dismiss')}</Button>
                    </>}
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={page} total={rows.length} onPage={(p) => s.setPage(String(p))} label={L(`${rows.length} ehdokasta`, `${rows.length} candidates`)} />
          </>
        )}
      </Panel>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" onCloseAutoFocus={(e) => { e.preventDefault(); trigger.current?.focus(); }}>
          {open && <div className="flex flex-col gap-4" data-testid="drawer-candidate">
            <SheetHeader>
              <SheetTitle>{open.name}</SheetTitle>
              <SheetDescription>{L('Vastaukset, joista nimi poimittiin. Avaa vastaus nähdäksesi alkuperäisen tekstin.', 'Answers the name was extracted from. Open an answer to see the original text.')}</SheetDescription>
            </SheetHeader>
            <EvidenceLinks ids={open.evidenceIds} evidence={evidence} testId="list-candidate-evidence" />
          </div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DiscoveredIntelligence({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const f = useAnalyticsFilters();
  const q = useAnalytics(projectId, f.params);
  const L = useL();
  const a = q.data;
  const ctx = '&' + new URLSearchParams(Object.entries(f.params).map(([k, v]) => [k, String(v)])).toString();
  return (
    <div className="flex flex-col gap-3" data-testid="section-intelligence">
      <AnalyticsFilterBar f={f} a={a} />
      {q.isPending ? <Panel className="p-4"><LoadingBlock rows={4} /></Panel> : q.isError || !a ? <Panel><ResearchFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel>
        : <DiscoveryPanel a={a} projectId={projectId} context={ctx} refetch={() => void q.refetch()} readOnly={readOnly} />}
      <p className="text-[12px] text-muted-ink">{L('Brändien tarkistus ei muuta seurattua kilpailijalistaa.', 'Reviewing detected brands does not change the tracked competitor list.')}</p>
    </div>
  );
}


export default function CompetitorsPage() {
  const L = useL();
  const { d } = useI18n();
  const { toast } = useToast();
  const { project } = useProjects();
  const pid = project?.id ?? '';
  const q = useResearch(pid);
  const write = useResearchWrite(pid);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [target, setTarget] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const focusRef = useRef<HTMLElement | null>(null);
  useDocumentTitle(L('Kilpailijat', 'Competitors'));
  if (!project) return null;
  const readOnly = project.status === 'archived';
  const r = q.data;

  const send = (body: Omit<ResearchInput, 'expectedVersion'>, ok: string, inDialog: boolean) => {
    if (!r) return;
    setFormErr(null);
    write.mutate({ projectId: pid, data: { ...body, expectedVersion: r.version } }, {
      onSuccess: () => { toast({ title: ok }); if (inDialog) setDlg(null); },
      onError: (err) => { const m = writeErrorMessage(err, d); if (inDialog) setFormErr(m); else toast({ variant: 'destructive', title: m }); },
    });
  };
  const openDlg = (v: Dlg, el?: HTMLElement) => { focusRef.current = el ?? null; setFormErr(null); setDlg(v); };
  const draft: BrandDraft = !dlg ? brandToDraft() : dlg.mode === 'edit' ? brandToDraft(dlg.brand) : dlg.mode === 'accept' ? { name: dlg.cand.name, aliases: [], domains: [] } : brandToDraft();
  const active = r?.competitors.filter((b) => b.status === 'active') ?? [];
  const suggested = r?.candidates.filter((c) => c.reviewRequired) ?? [];
  const listBased = r?.candidates.filter((c) => !c.reviewRequired) ?? [];
  const acceptHint = dlg?.mode === 'accept' && proposedDomains(dlg.cand).length ? L(` Ehdotetut verkkotunnukset (${proposedDomains(dlg.cand).join(', ')}) ovat tarkistamattomia — lisää vain ne, jotka olet itse vahvistanut.`, ` Proposed domains (${proposedDomains(dlg.cand).join(', ')}) are unverified — add only the ones you have confirmed yourself.`) : '';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L('Kilpailijat', 'Competitors')} subtitle={L('Vahvistettu vertailukohortti ja vastauksista havaitut brändit.', 'Confirmed comparison cohort and brands observed in answers.')}
        actions={<Button disabled={readOnly || !r} onClick={(e) => openDlg({ mode: 'create' }, e.currentTarget)} data-testid="button-add-competitor"><Plus aria-hidden />{L('Lisää kilpailija', 'Add competitor')}</Button>} />
      {readOnly && <ReasonNote tone="warning">{L('Arkistoitu projekti on vain luku -tilassa.', 'Archived projects are read-only.')}</ReasonNote>}
      {r && <p className="-mt-2 text-[12px] text-muted-ink" data-testid="text-cohort-version">{L(`Kohorttiversio ${r.version} · ${active.length} seurannassa`, `Cohort version ${r.version} · ${active.length} tracked`)}</p>}
      <SubTabs label={L('Kilpailijat', 'Competitors')} fallback="tracked" tabs={[{ value: 'tracked', label: r ? `${L('Seuratut', 'Tracked')} (${active.length})` : L('Seuratut', 'Tracked') }, { value: 'discovered', label: L('Havaitut brändit', 'Discovered brands') }]}>
        {(tab) => q.isPending ? <Panel className="p-4"><LoadingBlock rows={6} /></Panel> : q.isError || !r ? <Panel><ResearchFailure unavailable={q.unavailable} onRetry={() => void q.refetch()} /></Panel>
          : tab === 'discovered'
            ? <div className="flex flex-col gap-4">
              <Panel className="overflow-hidden" aria-labelledby="ctx-sugg-title">
                <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-[640px]">
                    <h2 id="ctx-sugg-title" className="text-[16px] font-semibold text-ink">{L('Ehdotetut kilpailijat', 'Suggested competitors')}</h2>
                    <p className="mt-1 text-[13px] leading-[19px] text-muted-ink">{L('Tekoäly ehdottaa kilpailijoita projektin toimialan, markkinan ja kielen perusteella. Ehdotetut verkkotunnukset ovat tarkistamattomia: ne eivät vaikuta mittaukseen ennen kuin hyväksyt brändin ja vahvistat verkkotunnukset itse.', 'AI suggests competitors from your project category, market and language. Proposed domains are unverified: nothing affects measurement until you accept the brand and confirm its domains yourself.')}</p>
                  </div>
                  <Button variant="secondary" disabled={readOnly || write.isPending} loading={write.isPending && write.variables?.data.action === 'suggest'} onClick={() => send({ action: 'suggest' }, L('Ehdotukset päivitetty', 'Suggestions refreshed'), false)} data-testid="button-suggest-competitors"><Sparkles aria-hidden />{L('Ehdota kilpailijoita', 'Suggest competitors')}</Button>
                </div>
                {suggested.length ? <div className="p-4"><Discovered key="s" r={{ ...r, candidates: suggested }} readOnly={readOnly} busy={write.isPending} onAccept={(c, el) => openDlg({ mode: 'accept', cand: c }, el)} onMerge={(c, el) => { setTarget(active[0]?.id ?? ''); openDlg({ mode: 'merge', cand: c }, el); }} onDismiss={(c) => send({ action: 'dismiss', id: c.id }, L('Ehdokas hylätty', 'Candidate dismissed'), false)} /></div>
                  : <EmptyState icon={<Sparkles className="size-[18px]" aria-hidden />} title={L('Ei ehdotuksia vielä', 'No suggestions yet')} body={L('Muodosta ehdotukset ja tarkista jokainen ennen kohorttiin lisäämistä.', 'Generate suggestions and review each one before adding it to your cohort.')} />}
              </Panel>
              <DiscoveredIntelligence projectId={pid} readOnly={readOnly} />{listBased.length>0&&<details className="rounded-lg border border-line bg-white p-4"><summary className="cursor-pointer text-sm text-muted-ink">{L('Aiemmat listapohjaiset ehdotukset', 'Earlier list-based suggestions')} ({listBased.length})</summary><div className="mt-4"><Discovered key="d" r={{ ...r, candidates: listBased }} readOnly={readOnly} busy={write.isPending} onAccept={(c, el) => openDlg({ mode: 'accept', cand: c }, el)} onMerge={(c, el) => { setTarget(active[0]?.id ?? ''); openDlg({ mode: 'merge', cand: c }, el); }} onDismiss={(c) => send({ action: 'dismiss', id: c.id }, L('Ehdokas hylätty', 'Candidate dismissed'), false)} /></div></details>}</div>
            : <Tracked key="t" r={r} readOnly={readOnly} busy={write.isPending} onEdit={(b, el) => openDlg({ mode: 'edit', brand: b }, el)} onArchive={(b) => send({ action: 'archive', id: b.id }, L('Kilpailija arkistoitu', 'Competitor archived'), false)} />}
      </SubTabs>

      <BrandDialog open={!!dlg && dlg.mode !== 'merge'} onOpenChange={(v) => !v && setDlg(null)} returnFocus={focusRef}
        title={dlg?.mode === 'edit' ? L('Muokkaa kilpailijaa', 'Edit competitor') : dlg?.mode === 'accept' ? L('Hyväksy havaittu brändi', 'Accept discovered brand') : L('Lisää kilpailija', 'Add competitor')}
        description={L('Muutos luo uuden kohorttiversion. Aiemmat mittaukset säilyvät alkuperäisellä kohortillaan.', 'The change creates a new cohort version. Past measurements keep their original cohort.') + acceptHint}
        initial={draft} pending={write.isPending} error={formErr} submitLabel={dlg?.mode === 'accept' ? L('Hyväksy kohorttiin', 'Accept into cohort') : L('Tallenna', 'Save')}
        onSubmit={(v) => dlg?.mode === 'edit' ? send({ action: 'update', id: dlg.brand.id, ...v }, L('Kilpailija päivitetty', 'Competitor updated'), true)
          : dlg?.mode === 'accept' ? send({ action: 'accept', id: dlg.cand.id, ...v }, L(`Brändi lisätty kohorttiin · ${active.length + 1} seurannassa`, `Brand added to cohort · ${active.length + 1} tracked`), true)
          : send({ action: 'create', ...v }, L('Kilpailija lisätty', 'Competitor added'), true)} />

      <BrandMergeDialog open={dlg?.mode === 'merge'} onOpenChange={(v) => !v && setDlg(null)} cand={dlg?.mode === 'merge' ? dlg.cand : null} active={active} target={target} setTarget={setTarget}
        pending={write.isPending} error={formErr} returnFocus={focusRef}
        onConfirm={() => dlg?.mode === 'merge' && target && send({ action: 'merge', id: dlg.cand.id, targetId: target }, L('Ehdokas yhdistetty aliakseksi', 'Candidate merged as alias'), true)} />
    </div>
  );
}

function BrandMergeDialog({ open, onOpenChange, cand, active, target, setTarget, pending, error, onConfirm, returnFocus }: { open: boolean; onOpenChange: (v: boolean) => void; cand: Candidate | null; active: Brand[]; target: string; setTarget: (v: string) => void; pending: boolean; error: string | null; onConfirm: () => void; returnFocus: React.RefObject<HTMLElement | null> }) {
  const L = useL();
  const t = active.find((b) => b.id === target);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-[12px] border-line" onCloseAutoFocus={(e) => { if (returnFocus.current) { e.preventDefault(); returnFocus.current.focus(); } }}>
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-ink">{L('Yhdistä olemassa olevaan kilpailijaan', 'Merge into existing competitor')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-ink">{L(`Nimi "${cand?.name ?? ''}" lisätään valitun kilpailijan aliakseksi. Havaitut vastaukset säilyvät linkitettyinä.`, `"${cand?.name ?? ''}" is added as an alias of the selected competitor. Observed answers stay linked.`)}</DialogDescription>
        </DialogHeader>
        <FilterSelect label={L('Kohdekilpailija', 'Target competitor')} value={target} onChange={setTarget} testId="select-merge-target" className="w-full" options={active.map((b) => ({ value: b.id, label: b.name }))} />
        {t && <p className="text-[12px] text-muted-ink">{L('Aliakset yhdistämisen jälkeen', 'Aliases after merge')}: <span className="text-ink">{[...t.aliases, cand?.name ?? ''].join(', ')}</span></p>}
        {error && <p className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger" role="alert">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-merge-cancel">{L('Peruuta', 'Cancel')}</Button>
          <Button disabled={!target} loading={pending} onClick={onConfirm} data-testid="button-merge-confirm"><GitMerge aria-hidden />{L('Yhdistä', 'Merge')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
