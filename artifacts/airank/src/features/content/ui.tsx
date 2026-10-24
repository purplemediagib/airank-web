import { useMemo, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { StatusBadge, type Tone } from '@/components/airank/primitives';
import { ContentError } from '@/lib/content-api';
import { cn } from '@/lib/utils';

export type Tx = (en: string, fi: string) => string;
export function useTx(): Tx {
  const { locale } = useI18n();
  return (en, fi) => (locale === 'fi' ? fi : en);
}

const ERR: Record<string, [string, string]> = {
  AUTH_REQUIRED: ['Your session expired. Sign in again.', 'Istunto vanheni. Kirjaudu uudelleen.'],
  CONTENT_PERMISSION_DENIED: ['Your Content Studio role does not allow this action.', 'Roolisi ei salli tätä toimintoa.'],
  NOT_FOUND: ['Record not found.', 'Tietuetta ei löytynyt.'],
  VERSION_CONFLICT: ['Someone saved a newer version. Your changes are kept locally.', 'Uudempi versio on tallennettu. Muutoksesi säilyvät tällä laitteella.'],
  REVISION_CHANGED: ['The document changed after this result was created. Refresh and run it again.', 'Asiakirja muuttui tuloksen luomisen jälkeen. Päivitä ja aja uudelleen.'],
  CHANGE_ANCHOR_CONFLICT: ['A selected passage no longer matches the text. Refresh and run again.', 'Valittu kohta ei enää vastaa tekstiä. Päivitä ja aja uudelleen.'],
  OVERLAPPING_CHANGES: ['Selected changes overlap. Choose fewer changes.', 'Valitut muutokset menevät päällekkäin. Valitse vähemmän.'],
  CONTENT_BUDGET_EXCEEDED: ['The daily AI allowance is used up. Try again after it resets.', 'Päivän tekoälykiintiö on käytetty. Yritä uudelleen myöhemmin.'],
  CONTENT_MIGRATION_REQUIRED: ['Content Studio is not ready on the server yet.', 'Sisältöstudio ei ole vielä valmis palvelimella.'],
  CONTENT_MODEL_NOT_CONFIGURED: ['No AI model is configured for this deployment.', 'Tekoälymallia ei ole määritetty.'],
  SOURCE_FETCH_FAILED: ['The page could not be fetched. Paste the content instead.', 'Sivua ei voitu hakea. Liitä sisältö käsin.'],
  ROBOTS_DISALLOWED: ['The site robots rules disallow fetching. Paste the content instead.', 'Sivuston robots-säännöt estävät haun. Liitä sisältö käsin.'],
  OWNED_URL_REQUIRED: ['The URL must belong to this project’s owned domains.', 'Osoitteen on kuuluttava projektin omiin verkkotunnuksiin.'],
  FACT_REVIEW_REQUIRED: ['Confirm the facts were checked before approving.', 'Vahvista faktat tarkistetuiksi ennen hyväksymistä.'],
  APPROVED_REVISION_REQUIRED: ['Only the current approved revision can be published.', 'Vain nykyinen hyväksytty versio voidaan julkaista.'],
  PUBLICATION_UNCERTAIN: ['The CMS result is uncertain. Check the CMS, then reconcile. Do not retry.', 'CMS-tulos on epävarma. Tarkista CMS ja täsmäytä. Älä yritä uudelleen.'],
  PUBLICATION_RECONCILIATION_REQUIRED: ['Resolve the uncertain publication first.', 'Selvitä ensin epävarma julkaisu.'],
  CMS_NOT_CONFIGURED: ['Connect a CMS in Settings first.', 'Yhdistä CMS asetuksissa ensin.'],
  CMS_REMOTE_CHANGED: ['The remote item changed in the CMS. Reload the selection.', 'Kohde muuttui CMS:ssä. Lataa valinta uudelleen.'],
  CMS_DOCUMENT_MISMATCH: ['The selected CMS item does not match the document page.', 'Valittu CMS-kohde ei vastaa asiakirjan sivua.'],
  CMS_READ_FAILED: ['The CMS could not be read.', 'CMS:ää ei voitu lukea.'],
  WEBFLOW_LOCALE_REQUIRED: ['Choose the Webflow locale.', 'Valitse Webflow-kieliversio.'],
  INVALID_WEBFLOW_CONFIG: ['Check the Webflow collection ID, token and body field.', 'Tarkista Webflow-kokoelman tunnus, avain ja leipätekstikenttä.'],
  CMS_CREDENTIALS_REQUIRED: ['Username and application password are required.', 'Käyttäjätunnus ja sovellussalasana vaaditaan.'],
  EXISTING_ACCOUNT_REQUIRED: ['That email has no AI Rank account yet.', 'Tällä sähköpostilla ei ole AI Rank -tiliä.'],
  OWNER_ROLE_FIXED: ['The owner role cannot be changed.', 'Omistajan roolia ei voi muuttaa.'],
  PROJECT_ARCHIVED: ['The project is archived and read-only.', 'Projekti on arkistoitu ja vain luku.'],
  SUBMISSION_CONFLICT: ['This request was already sent with different content.', 'Pyyntö on jo lähetetty eri sisällöllä.'],
  CONNECTION_UNCERTAIN: ['The connection dropped. The request may have gone through; check Jobs before retrying.', 'Yhteys katkesi. Pyyntö on voinut mennä läpi; tarkista työt ennen uutta yritystä.'],
  INVALID_DOCUMENT: ['The document fields are not valid (title, 100 000 characters max).', 'Asiakirjan kentät eivät kelpaa.'],
  INVALID_SLUG: ['Use lowercase letters, digits and hyphens for the slug.', 'Käytä slugissa pieniä kirjaimia, numeroita ja väliviivoja.'],
  MODEL_INVALID_JSON: ['The AI answer was not usable. Retry the job.', 'Tekoälyn vastaus ei kelvannut. Yritä työtä uudelleen.'],
  MONITORING_DATA_UNAVAILABLE: ['Monitoring data was unavailable.', 'Seurantadata ei ollut saatavilla.'],
  NO_MONITORING_EVIDENCE: ['There is no monitoring evidence yet to assess.', 'Arvioitavaa seurantanäyttöä ei vielä ole.'],
  NO_PUBLISHED_REVISION: ['This document has no recorded publication yet.', 'Asiakirjalla ei ole vielä kirjattua julkaisua.'],
  CONTENT_QUEUE_FULL: ['The job queue is full. Try again later.', 'Työjono on täynnä. Yritä myöhemmin.'],
};
export function useErr() {
  const tx = useTx();
  return (e: unknown, fallback?: string): string => {
    const code = typeof e === 'string' ? e : e instanceof ContentError ? e.code : e instanceof Error ? e.message : '';
    const hit = ERR[code];
    if (hit) return tx(hit[0], hit[1]);
    return fallback ?? tx(`Request failed${code ? ` (${code})` : ''}.`, `Pyyntö epäonnistui${code ? ` (${code})` : ''}.`);
  };
}
export const errCode = (e: unknown) => (e instanceof ContentError ? e.code : '');

export function useFmt() {
  const { locale } = useI18n();
  const loc = locale === 'fi' ? 'fi-FI' : 'en-GB';
  return {
    dt: (v?: number | string | null) => (v == null || v === '' ? '—' : new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v))),
    d: (v?: number | string | null) => (v == null || v === '' ? '—' : new Intl.DateTimeFormat(loc, { dateStyle: 'medium' }).format(new Date(v))),
    n: (v?: number | null, o?: Intl.NumberFormatOptions) => (v == null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat(loc, o).format(v)),
  };
}

export function useStatusLabels() {
  const tx = useTx();
  const doc: Record<string, [string, Tone]> = {
    draft: [tx('Draft', 'Luonnos'), 'neutral'],
    in_review: [tx('In review', 'Tarkistuksessa'), 'warning'],
    approved: [tx('Approved', 'Hyväksytty'), 'success'],
    changes_requested: [tx('Changes requested', 'Muutoksia pyydetty'), 'error'],
  };
  const job: Record<string, [string, Tone]> = {
    queued: [tx('Queued', 'Jonossa'), 'neutral'],
    running: [tx('Running', 'Käynnissä'), 'info'],
    completed: [tx('Completed', 'Valmis'), 'success'],
    failed: [tx('Failed', 'Epäonnistui'), 'error'],
    cancelled: [tx('Cancelled', 'Peruttu'), 'neutral'],
    uncertain: [tx('Uncertain', 'Epävarma'), 'warning'],
  };
  const kind: Record<string, string> = {
    import: tx('Import page', 'Sivun tuonti'), sitemap: tx('Sitemap import', 'Sivukartan tuonti'), audit: tx('Content audit', 'Sisältöauditointi'),
    research: tx('Research and brief', 'Tutkimus ja brief'), rewrite: tx('Suggested changes', 'Muutosehdotukset'), create: tx('Full draft', 'Koko luonnos'),
    opportunities: tx('Find opportunities', 'Etsi mahdollisuudet'), perception: tx('AI perception', 'Tekoälyn brändikuva'), impact: tx('Impact check', 'Vaikutuksen tarkistus'), publish: tx('Publish to CMS', 'Julkaisu CMS:ään'),
  };
  return { doc, job, kind };
}
export const DocBadge = ({ status }: { status: string }) => { const [l, t] = useStatusLabels().doc[status] ?? [status, 'neutral' as Tone]; return <StatusBadge tone={t}>{l}</StatusBadge>; };
export const JobBadge = ({ status }: { status: string }) => { const [l, t] = useStatusLabels().job[status] ?? [status, 'neutral' as Tone]; return <StatusBadge tone={t}>{l}</StatusBadge>; };

export function Banner({ tone = 'info', children, action }: { tone?: 'info' | 'warning' | 'error' | 'success'; children: ReactNode; action?: ReactNode }) {
  const c = { info: 'border-[#bfe9f6] bg-tint text-navy', warning: 'border-[#f1d9a5] bg-[#fff8e8] text-ink', error: 'border-[#f0c4c4] bg-[#fff1f1] text-danger', success: 'border-[#bfe3cd] bg-[#eefaf2] text-ink' }[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] leading-5', c)}><div className="min-w-0 flex-1">{children}</div>{action}</div>;
}

export function Modal({ open, onClose, title, description, children, wide, footer }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const tx = useTx();
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content aria-describedby={undefined} className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[12px] border border-line bg-white shadow-xl focus:outline-none', wide ? 'max-w-[920px]' : 'max-w-[600px]')}>
          <div className="flex items-start gap-3 border-b border-line p-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[18px] font-semibold text-ink">{title}</Dialog.Title>
              {description && <p className="mt-0.5 text-[13px] text-muted-ink">{description}</p>}
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label={tx('Close', 'Sulje')}><X aria-hidden /></Button></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line p-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const tx = useTx();
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col bg-white shadow-xl focus:outline-none">
          <div className="flex items-center gap-3 border-b border-line p-4">
            <Dialog.Title className="flex-1 text-[18px] font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label={tx('Close', 'Sulje')}><X aria-hidden /></Button></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const inputCls = 'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-muted-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan disabled:bg-canvas disabled:text-muted-ink';
export const areaCls = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm leading-6 text-ink placeholder:text-muted-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan disabled:bg-canvas';
export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">{label}</label>
      {children}
      {hint && <p className="text-[12px] text-muted-ink">{hint}</p>}
    </div>
  );
}
export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[12px] border border-line bg-white', className)}>
      {(title || actions) && <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3"><h2 className="flex-1 text-[15px] font-semibold text-ink">{title}</h2>{actions}</header>}
      <div className="p-4">{children}</div>
    </section>
  );
}
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return <div className="rounded-lg border border-line bg-white p-4"><p className="text-[12px] font-semibold uppercase tracking-wide text-muted-ink">{label}</p><p className="mt-1 text-[26px] font-semibold leading-8 text-ink">{value}</p>{sub && <p className="mt-0.5 text-[12px] text-muted-ink">{sub}</p>}</div>;
}
export const Dash = '—';

/** Markdown preview: GFM via marked, always sanitized; raw HTML in the source is stripped here and flagged elsewhere. */
export function MarkdownPreview({ markdown, className }: { markdown: string; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(markdown, { gfm: true, async: false }) as string;
    DOMPurify.addHook('afterSanitizeAttributes', (n) => { if (n.tagName === 'A') { n.setAttribute('rel', 'noopener noreferrer'); n.setAttribute('target', '_blank'); } });
    const out = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'iframe'], FORBID_ATTR: ['style'] });
    DOMPurify.removeHook('afterSanitizeAttributes');
    return out;
  }, [markdown]);
  return <div className={cn('ar-md text-[15px] leading-7 text-ink [&_a]:text-link [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_h1]:mb-3 [&_h1]:text-[26px] [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-[17px] [&_h3]:font-semibold [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-canvas [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'iframe'], FORBID_ATTR: ['style'] });
}
/** Raw HTML outside code fences/spans: unsupported by the Markdown dialect, must be flagged. */
export function findRawHtml(md: string): string[] {
  const stripped = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return stripped.match(/<\/?[a-zA-Z][^>\n]*>|<!--[\s\S]*?-->/g) ?? [];
}
export const safeHttps = (u?: string | null) => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
export function ExtLink({ href, children }: { href?: string | null; children?: ReactNode }) {
  const s = safeHttps(href);
  if (!s) return <span className="break-all text-muted-ink">{children ?? href ?? Dash}</span>;
  return <a href={s} target="_blank" rel="noopener noreferrer" className="break-all text-link underline-offset-4 hover:underline">{children ?? s}</a>;
}
