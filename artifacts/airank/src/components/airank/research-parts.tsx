import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { AnalyticsEvidence, Brand } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useProjects } from '@/lib/project-context';
import { splitList } from '@/lib/use-research';
import { toMs } from '@/lib/use-analytics';
import { ProviderMark } from './provider-brand';
import { EmptyState, ErrorState, StatusBadge } from './primitives';
import { useL } from './analytics';

export const PAGE_SIZE = 25;

export function ResearchFailure({ unavailable, onRetry }: { unavailable: boolean; onRetry: () => void }) {
  const L = useL();
  return unavailable
    ? <EmptyState title={L('Kilpailija- ja lähdetiedot eivät ole vielä käytettävissä tällä palvelimella', 'Competitor and source data are not available on this server yet')} body={L('Palvelin ei vielä tarjoa tätä rajapintaa. Mitään esimerkkidataa ei näytetä.', 'The server does not offer this API yet. No demonstration data is shown.')} />
    : <ErrorState body={L('Tietojen lataus epäonnistui', 'Data could not be loaded')} onRetry={onRetry} />;
}

export function Pager({ page, total, onPage, label }: { page: number; total: number; onPage: (p: number) => void; label: string }) {
  const L = useL();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12px] text-muted-ink">
      <span data-testid="text-total">{label}</span>
      <div className="flex items-center gap-1">
        <span className="mr-2" aria-live="polite">{L(`Sivu ${page} / ${pages}`, `Page ${page} of ${pages}`)}</span>
        <Button variant="ghost" size="icon" className="size-11 md:size-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={L('Edellinen sivu', 'Previous page')} data-testid="button-page-prev"><ChevronLeft aria-hidden /></Button>
        <Button variant="ghost" size="icon" className="size-11 md:size-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={L('Seuraava sivu', 'Next page')} data-testid="button-page-next"><ChevronRight aria-hidden /></Button>
      </div>
    </div>
  );
}

export const clampPage = (raw: string, total: number) => Math.min(Math.max(1, Number.parseInt(raw, 10) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));

export function useEvidenceHref() {
  const { projectHref } = useProjects();
  return (id: string) => projectHref(`/dashboard/evidence/${encodeURIComponent(id)}`);
}

/** Compact list of linked observed answers; each opens the response evidence page. */
export function EvidenceLinks({ ids, evidence, max = 50, testId }: { ids: string[]; evidence: Map<string, AnalyticsEvidence>; max?: number; testId: string }) {
  const L = useL();
  const { date } = useI18n();
  const evHref = useEvidenceHref();
  if (!ids.length) return <p className="text-[13px] text-muted-ink">{L('Ei linkitettyjä vastauksia', 'No linked answers')}</p>;
  return (
    <ul className="divide-y divide-line rounded-lg ring-1 ring-line" data-testid={testId}>
      {ids.slice(0, max).map((id) => {
        const e = evidence.get(id);
        return (
          <li key={id}>
            <Link href={evHref(id)} className="flex items-start gap-3 px-3 py-2.5 hover:bg-canvas" data-testid={`link-evidence-${id}`}>
              <FileText className="mt-0.5 size-4 shrink-0 text-link" aria-hidden />
              <span className="min-w-0 flex-1">
                {e ? <>
                  <span className="line-clamp-2 text-[13px] font-medium text-ink">{e.text} <span className="text-muted-ink">v{e.promptVersion}</span></span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-ink"><ProviderMark provider={e.provider} />{e.model} · {date(new Date(toMs(e.observedAt)), { dateStyle: 'medium' })}</span>
                </> : <span className="font-mono text-[12px] text-ink">{id}</span>}
              </span>
            </Link>
          </li>
        );
      })}
      {ids.length > max && <li className="px-3 py-2 text-[12px] text-muted-ink">{L(`+${ids.length - max} muuta vastausta`, `+${ids.length - max} more answers`)}</li>}
    </ul>
  );
}

export function BrandStatus({ status }: { status: string }) {
  const L = useL();
  const map: Record<string, [Parameters<typeof StatusBadge>[0]['tone'], string, string]> = {
    active: ['success', 'Seurannassa', 'Tracked'],
    archived: ['neutral', 'Arkistoitu', 'Archived'],
    pending: ['info', 'Odottaa arviota', 'Awaiting review'],
    accepted: ['success', 'Hyväksytty', 'Accepted'],
    dismissed: ['neutral', 'Hylätty', 'Dismissed'],
    merged: ['warning', 'Yhdistetty', 'Merged'],
  };
  const [tone, fi, en] = map[status] ?? ['neutral', status, status];
  return <StatusBadge tone={tone} data-testid={`status-${status}`}>{L(fi, en)}</StatusBadge>;
}

export function Chips({ items, mono }: { items: string[]; mono?: boolean }) {
  if (!items.length) return <span className="text-muted-ink">–</span>;
  return <span className="flex flex-wrap gap-1">{items.map((x) => <span key={x} className={`rounded bg-canvas px-1.5 py-0.5 text-[12px] text-ink ring-1 ring-line ${mono ? 'font-mono' : ''}`}>{x}</span>)}</span>;
}

export interface BrandDraft { name: string; aliases: string[]; domains: string[] }

/** Explicit identity form: name, aliases and domains are always sent; domains may be empty and are never guessed. */
export function BrandDialog({ open, onOpenChange, title, description, initial, submitLabel, pending, error, onSubmit, returnFocus, extra }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description: string; initial: BrandDraft; submitLabel: string; pending: boolean; error: string | null; onSubmit: (d: BrandDraft) => void; returnFocus?: React.RefObject<HTMLElement | null>; extra?: ReactNode;
}) {
  const L = useL();
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [domains, setDomains] = useState('');
  const [touched, setTouched] = useState(false);
  const was = useRef(false);
  useEffect(() => {
    if (open && !was.current) { setName(initial.name); setAliases(initial.aliases.join(', ')); setDomains(initial.domains.join(', ')); setTouched(false); }
    was.current = open;
  }, [open, initial]);
  const n = name.trim();
  const al = splitList(aliases);
  const dm = splitList(domains).map((x) => x.toLowerCase());
  const nameErr = n.length < 2 || n.length > 100 ? L('Nimen on oltava 2–100 merkkiä.', 'Name must be 2–100 characters.') : null;
  const aliasErr = al.some((a) => a.length < 2 || a.length > 100) ? L('Jokaisen aliaksen on oltava 2–100 merkkiä.', 'Each alias must be 2–100 characters.') : null;
  const domErr = dm.some((x) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x) || x.includes('..')) ? L('Anna verkkotunnukset ilman https:// tai polkua, esim. esimerkki.fi.', 'Enter domains without https:// or paths, e.g. example.com.') : null;
  const submit = (e: FormEvent) => { e.preventDefault(); setTouched(true); if (!nameErr && !aliasErr && !domErr) onSubmit({ name: n, aliases: al, domains: dm }); };
  const field = 'mt-1 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm aria-[invalid=true]:border-danger md:h-10';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] rounded-[12px] border-line" onCloseAutoFocus={(e) => { if (returnFocus?.current) { e.preventDefault(); returnFocus.current.focus(); } }}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-ink">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-ink">{description}</DialogDescription>
          </DialogHeader>
          {extra}
          <label className="text-[13px] font-medium text-ink">{L('Brändin nimi', 'Brand name')}
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} aria-invalid={touched && !!nameErr} data-testid="input-brand-name" autoFocus />
            {touched && nameErr && <span className="mt-1 block text-[12px] text-danger" role="alert">{nameErr}</span>}
          </label>
          <label className="text-[13px] font-medium text-ink">{L('Aliakset (pilkulla erotettuna)', 'Aliases (comma-separated)')}
            <input value={aliases} onChange={(e) => setAliases(e.target.value)} className={field} aria-invalid={touched && !!aliasErr} data-testid="input-brand-aliases" />
            <span className="mt-1 block text-[12px] font-normal text-muted-ink">{L('Vain aidot kirjoitusasut. Maininnat tunnistetaan kirjaimellisesti.', 'Genuine spellings only. Mentions are matched literally.')}</span>
            {touched && aliasErr && <span className="mt-1 block text-[12px] text-danger" role="alert">{aliasErr}</span>}
          </label>
          <label className="text-[13px] font-medium text-ink">{L('Verkkotunnukset (valinnainen)', 'Domains (optional)')}
            <input value={domains} onChange={(e) => setDomains(e.target.value)} className={field} aria-invalid={touched && !!domErr} data-testid="input-brand-domains" />
            <span className="mt-1 block text-[12px] font-normal text-muted-ink">{L('Jätä tyhjäksi, jos verkkotunnusta ei ole vahvistettu. Sitä ei arvata.', 'Leave empty if the domain is not confirmed. It is never guessed.')}</span>
            {touched && domErr && <span className="mt-1 block text-[12px] text-danger" role="alert">{domErr}</span>}
          </label>
          {error && <p className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger" role="alert" data-testid="text-form-error">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel">{L('Peruuta', 'Cancel')}</Button>
            <Button type="submit" loading={pending} data-testid="button-submit-brand">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function brandToDraft(b?: Brand | null): BrandDraft {
  return { name: b?.name ?? '', aliases: b?.aliases ?? [], domains: b?.domains ?? [] };
}
