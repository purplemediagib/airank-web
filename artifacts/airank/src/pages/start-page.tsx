import { useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetQuickCheckQueryKey,
  getGetProjectAnalyticsQueryKey,
  getListProjectQuickChecksQueryKey,
  useGetQuickCheck,
  useListProjectQuickChecks,
  type QuickCheckReport,
} from '@workspace/api-client-react';
import { useDocumentTitle, useI18n } from '@/i18n';
import { ProviderMark } from '@/components/airank/provider-brand';
import { useAccount } from '@/lib/account';
import { useProjects } from '@/lib/project-context';
import { readApiError } from '@/lib/api-errors';
import { measurementLabel, providerProgress } from '@/lib/measurement-status';
import { PageHeader, Panel, StatusBadge, ReasonNote, LoadingBlock, ErrorState, EmptyState, type Tone } from '@/components/airank/primitives';
import { KindBadge, PromptDialog } from '@/components/airank/prompt-parts';
import { DailyStatusStrip } from '@/components/airank/schedule-settings';
import { useSchedule } from '@/lib/use-industries';
import { usePromptList } from '@/lib/use-prompts';
import { atPromptLimit, type DailySchedule } from '@/lib/daily-tracking';
import { ProviderContextNotice } from '@/components/airank/context-select';
import { projectContext, useContextLabels } from '@/lib/measurement-context';
import { Button } from '@/components/ui/button';

/* Copy. Figma frames 18–23 (FI) and review-en. Questions/answers are never translated. */
const C = {
  fi: {
    title: 'Aloita tarkistus', subtitle: 'Anna yrityksen tiedot. Näet tarkat kysymykset ennen kuin mitään mitataan.',
    step1: 'Yrityksen tiedot', step2: 'Kysymysten tarkistus', domain: 'Verkkotunnus', domainHint: 'Vain projektin omat verkkotunnukset.',
    brand: 'Brändin nimi', aliases: 'Muut kirjoitusasut', aliasesHint: 'Erota pilkulla, enintään 8.', category: 'Palvelu tai tuote valitulla kielellä',
    categoryHint: 'Kuvaa palvelu valitulla kysymyskielellä ilman brändiä, verkkotunnusta tai linkkejä.', snapshot: 'Muutokset koskevat vain tätä tarkistusta, eivät tallennettua projektia.',
    preview: 'Esikatsele kysymykset', previewing: 'Haetaan esikatselua…', invalidated: 'Tiedot muuttuivat. Esikatsele kysymykset uudelleen.',
    reviewTitle: 'Vahvista ensimmäinen tarkistus', reviewSub: 'Vaihe 2 / 2 · Yrityksesi → Kysymykset → Tulokset',
    nPrompts: '{n} ei-brändättyä kysymystä',
    nPromptsNote: 'Tämä ensimmäinen kertatarkistus käyttää aktiivisia seurattavia kysymyksiäsi. Jatkoseuranta käyttää samaa kysymyslistaa.',
    colPrompt: 'Seurattava kysymys', providersNote: 'Alustojen saatavuus vahvistetaan tarkistuksessa.',
    questionsNote: 'Kysymykset eivät sisällä brändisi nimeä. Tämä on otos, ei koko markkinan arvio.',
    methodology: 'Menetelmä', paid: 'Maksulliset kutsut esikatselussa', edit: 'Muokkaa tietoja',
    confirm: 'Vahvistan, että tiedot ja kysymykset ovat oikein.', confirmNote: 'Vahvistus ei ole oikeudellinen omistajuuden todennus.',
    start: 'Aloita tarkistus', starting: 'Lähetetään…',
    uncertainTitle: 'Lähetyksen tila on epävarma', uncertainBody: 'Emme saaneet vastausta. Tarkistus on voinut käynnistyä. Emme lähetä sitä uudelleen automaattisesti.', refreshRuns: 'Päivitä omat tarkistukset',
    notFoundYet: 'Tarkistusta ei löytynyt vielä. Voit päivittää uudelleen tai aloittaa uuden tarkistuksen tietoisesti.', newAttempt: 'Aloita uusi yritys',
    runs: 'Aiemmat tarkistukset (alkuperäiset raportit)', noRuns: 'Ei aiempia tarkistuksia', noRunsBody: 'Erilliset tarkistukset on korvattu päivittäisellä mittauksella.', open: 'Avaa',
    progressTitle: 'Tarkistus käynnissä', progressSub: '{brand} · {n} kysymystä', waitingTitle: 'Tarkistus jonossa',
    collecting: 'Keräämme tekoälyn vastauksia', leave: 'Voit poistua tältä sivulta. Tarkistus jatkuu taustalla.',
    processed: '{done} / {total} vastausta käsitelty', colStage: 'Vaihe / alusta', colStatus: 'Tila', colAnswers: 'Vastauksia', stageSetup: 'Sivuston tiedot ja kysymykset',
    collectingNote: 'Onnistuneet vastaukset säilyvät, vaikka yksi alusta hidastuisi tai epäonnistuisi.', showSoFar: 'Näytä tähänastiset tulokset', hideSoFar: 'Piilota tähänastiset tulokset',
    resultsTitle: 'Tulokset', partialTitle: 'Osittaiset tulokset', legacyTitle: 'Vanha tulos', runSub: '{brand} · Tarkistus {date}',
    doneOf: '{done} / {total} vastausta valmistui', missingNote: 'Puuttuvia vastauksia ei lasketa nolliksi.',
    partialNote: 'Alustojen kattavuus poikkeaa, joten kokonaislukua on tulkittava varoen.',
    legacy: 'Pistettä ei laskettu nykyisellä menetelmällä.', unavailable: 'Kelvollisia vastauksia ei saatu, joten pistettä ei lasketa.',
    score: 'Näkyvyys', outOf: '/ 10', noScore: 'Ei laskettavissa', ofAnswers: '{n} / {total} vastauksesta', coverage: 'Vastauskattavuus', provCoverage: 'Alustakattavuus', mentions: 'Maininnat',
    colProvider: 'Alusta', colOk: 'Onnistui', colMissing: 'Puuttuu',
    failTitleFailed: 'Tarkistus epäonnistui', failTitleNone: 'Ei mittauksia', failBadgeFailed: 'VIRHE', failBadgeNone: 'EI MITTAUKSIA',
    failBodyFailed: 'Tarkistusta ei saatu suoritettua loppuun. Aiemmat tuloksesi säilyvät.',
    failBodyNone: 'Alustoilta ei saatu kelvollisia vastauksia. Aiemmat tuloksesi säilyvät.',
    newCheck: 'Takaisin seurantaan', back: 'Takaisin seurantaan', noScoreKept: 'Tälle tarkistukselle ei muodostettu pistettä. Aiemmat tuloksesi säilyvät.', runId: 'Tarkistustunnus',
    evidence: 'Alkuperäiset vastaukset', originalAnswer: 'Alkuperäinen vastaus', question: 'Kysymys', noAnswer: 'Ei vastausta', sources: 'Lähteet', loadFailed: 'Tarkistuksen lataus epäonnistui.',
    status: { pending: 'Odottaa', queued: 'Jonossa', running: 'Käsitellään', completed: 'Valmis', failed: 'Epäonnistui', no_measurements: 'Ei mittauksia', partial: 'Osittainen', complete: 'Valmis', legacy: 'Vanha tulos', unavailable: 'Ei saatavilla', ok: 'Valmis', success: 'Valmis', succeeded: 'Valmis', error: 'Epäonnistui', timeout: 'Aikakatkaisu', skipped: 'Ei käytössä', missing: 'Puuttuu' } as Record<string, string>,
    unknownStatus: 'Tuntematon tila',
    band: { low: 'Matala', limited: 'Rajallinen', moderate: 'Kohtalainen', high: 'Korkea' } as Record<string, string>,
     errors: { PROFILE_INVALID: 'Tiedot eivät kelpaa. Tarkista kentät.', PROFILE_CONFIRMATION_REQUIRED: 'Vahvista tiedot ennen aloitusta.', PREVIEW_CHANGED: 'Esikatselu on vanhentunut. Esikatsele uudelleen.', VERSION_CONFLICT: 'Projektia on muutettu. Lataa sivu ja esikatsele uudelleen.', AUTH_REQUIRED: 'Istunto päättyi. Kirjaudu uudelleen.', NOT_FOUND: 'Projektia tai tarkistusta ei löytynyt.', APP_NOT_CONFIGURED: 'Palvelua ei ole vielä määritetty.', DOMAIN_RATE_LIMIT: 'Tälle verkkotunnukselle on tehty jo 5 tarkistusta viimeisen 7 päivän aikana. Yritä uudelleen, kun vanhimmasta tarkistuksesta on yli 7 päivää.', RATE_LIMITED: 'Liian monta pyyntöä. Odota hetki.', generic: 'Pyyntö epäonnistui.' } as Record<string, string>,
    v: { brand: 'Nimen pituus 2–100 merkkiä.', category: 'Kuvauksen pituus 8–240 merkkiä.', aliases: 'Enintään 8 kirjoitusasua, kukin 2–100 merkkiä.' },
  },
  en: {
    title: 'Start a check', subtitle: 'Enter your business details. You see the exact questions before anything is measured.',
    step1: 'Business details', step2: 'Question review', domain: 'Domain', domainHint: 'Only domains owned by this project.',
    brand: 'Brand name', aliases: 'Other spellings', aliasesHint: 'Separate with commas, up to 8.', category: 'Service or product in the selected language',
    categoryHint: 'Describe the service in the selected question language, without brand, domain or links.', snapshot: 'Edits apply to this check only, not to the saved project.',
    preview: 'Preview prompts', previewing: 'Loading preview…', invalidated: 'Details changed. Preview the prompts again.',
    reviewTitle: 'Review your first check', reviewSub: 'Step 2 of 2 · Your business → Prompts → Results',
    nPrompts: '{n} non-branded prompts',
    nPromptsNote: 'This one-off first check uses your active tracked prompts. Future monitoring uses the same prompt list.',
    colPrompt: 'Prompt to check', providersNote: 'Platform availability is confirmed during the check.',
    questionsNote: 'Prompts do not contain your brand name. This is a sample, not a whole-market estimate.',
    methodology: 'Methodology', paid: 'Paid calls in preview', edit: 'Edit details',
    confirm: 'I confirm the details and prompts are correct.', confirmNote: 'Confirmation is not legal ownership verification.',
    start: 'Start check', starting: 'Submitting…',
    uncertainTitle: 'Submission status is uncertain', uncertainBody: 'We got no response. The check may have started. We will not resend it automatically.', refreshRuns: 'Refresh my checks',
    notFoundYet: 'The check was not found yet. Refresh again or deliberately start a new attempt.', newAttempt: 'Start a new attempt',
    runs: 'Earlier checks (original reports)', noRuns: 'No earlier checks', noRunsBody: 'Separate checks have been replaced by daily measurement.', open: 'Open',
    progressTitle: 'Check in progress', progressSub: '{brand} · {n} prompts', waitingTitle: 'Check queued',
    collecting: 'Collecting AI answers', leave: 'You can leave this page. The check continues in the background.',
    processed: '{done} / {total} answers processed', colStage: 'Stage / platform', colStatus: 'Status', colAnswers: 'Answers', stageSetup: 'Site details and prompts',
    collectingNote: 'Successful answers are kept even if one platform slows down or fails.', showSoFar: 'Show results so far', hideSoFar: 'Hide results so far',
    resultsTitle: 'Results', partialTitle: 'Partial results', legacyTitle: 'Legacy result', runSub: '{brand} · Check {date}',
    doneOf: '{done} / {total} answers completed', missingNote: 'Missing answers are not counted as zero.',
    partialNote: 'Platform coverage differs, so interpret the total with care.',
    legacy: 'No score under the current methodology.', unavailable: 'No valid answers, so no score is computed.',
    score: 'Visibility', outOf: '/ 10', noScore: 'Not computable', ofAnswers: '{n} / {total} answers', coverage: 'Answer coverage', provCoverage: 'Platform coverage', mentions: 'Mentions',
    colProvider: 'Platform', colOk: 'Succeeded', colMissing: 'Missing',
    failTitleFailed: 'The check failed', failTitleNone: 'No measurements', failBadgeFailed: 'ERROR', failBadgeNone: 'NO MEASUREMENTS',
    failBodyFailed: 'The check could not be completed. Your earlier results are kept.',
    failBodyNone: 'No valid answers were received from the platforms. Your earlier results are kept.',
    newCheck: 'Back to daily tracking', back: 'Back to daily tracking', noScoreKept: 'No score was produced for this check. Your earlier results are kept.', runId: 'Check ID',
    evidence: 'Original answers', originalAnswer: 'Original answer', question: 'Question', noAnswer: 'No answer', sources: 'Sources', loadFailed: 'Failed to load the check.',
    status: { pending: 'Pending', queued: 'Queued', running: 'Processing', completed: 'Completed', failed: 'Failed', no_measurements: 'No measurements', partial: 'Partial', complete: 'Completed', legacy: 'Legacy result', unavailable: 'Unavailable', ok: 'Completed', success: 'Completed', succeeded: 'Completed', error: 'Failed', timeout: 'Timed out', skipped: 'Not used', missing: 'Missing' } as Record<string, string>,
    unknownStatus: 'Unknown status',
    band: { low: 'Low', limited: 'Limited', moderate: 'Moderate', high: 'High' } as Record<string, string>,
     errors: { PROFILE_INVALID: 'Details are invalid. Check the fields.', PROFILE_CONFIRMATION_REQUIRED: 'Confirm the details before starting.', PREVIEW_CHANGED: 'Preview is out of date. Preview again.', VERSION_CONFLICT: 'The project changed. Reload and preview again.', AUTH_REQUIRED: 'Session expired. Sign in again.', NOT_FOUND: 'Project or check not found.', APP_NOT_CONFIGURED: 'The service is not configured yet.', DOMAIN_RATE_LIMIT: 'This domain has reached the limit of 5 checks in the last 7 days. Try again when your oldest check is more than 7 days old.', RATE_LIMITED: 'Too many requests. Wait a moment.', generic: 'Request failed.' } as Record<string, string>,
    v: { brand: 'Name must be 2–100 characters.', category: 'Description must be 8–240 characters.', aliases: 'Up to 8 spellings, each 2–100 characters.' },
  },
};
type Copy = typeof C.fi;

const POLLING = new Set(['pending', 'queued', 'running', 'processing']);

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const statusLabel = (s: string, c: Copy) => c.status[s === 'processing' ? 'running' : s] ?? c.unknownStatus;
const bandLabel = (b: string | null, c: Copy) => (b ? c.band[b] ?? b : null);

function errMsg(err: unknown, c: Copy) {
  const { status, code } = readApiError(err);
  if (code && c.errors[code]) return c.errors[code];
  if (status === 401) return c.errors.AUTH_REQUIRED;
  if (status === 404) return c.errors.NOT_FOUND;
  if (status === 409) return c.errors.VERSION_CONFLICT;
  if (status === 429) return c.errors.RATE_LIMITED;
  return c.errors.generic;
}
function statusTone(s: string): Tone {
  if (s === 'completed' || s === 'complete' || s === 'ok' || s === 'success' || s === 'succeeded') return 'success';
  if (s === 'failed' || s === 'error') return 'error';
  if (s === 'no_measurements' || s === 'partial' || s === 'timeout' || s === 'missing') return 'warning';
  if (POLLING.has(s)) return 'info';
  return 'neutral';
}
function safeHref(u: string) {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null; } catch { return null; }
}

/* Figma table primitives: bg #f7f9fc 44px heading row, 11px muted headings, 13px cells, 12px padding. */
function FTable({ heads, children, cols }: { heads: string[]; children: ReactNode; cols: string }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-line bg-card">
      <div className={`grid min-w-[560px] ${cols} bg-canvas`}>
        {heads.map((h) => <div key={h} className="p-3 text-[11px] font-medium leading-4 text-muted-ink">{h}</div>)}
      </div>
      <div className="min-w-[560px] divide-y divide-line border-t border-line">{children}</div>
    </div>
  );
}

export function StartPage() {
  const { locale } = useI18n();
  const c = C[locale];
  useDocumentTitle(c.title);
  const search = useSearch();
  const scanId = new URLSearchParams(search).get('scan');
  const { project } = useProjects();
  if (!project) return null;
  return (
    <div className="flex w-full max-w-[1144px] flex-col gap-6">
      {scanId ? <RunView key={scanId} scanId={scanId} c={c} /> : project.status === 'archived' ? <ReasonNote>{locale === 'fi' ? 'Arkistoitu projekti. Aiemmat tarkistukset ovat edelleen saatavilla.' : 'Archived project. Previous checks remain available.'}</ReasonNote> : <TrackedSetup c={c} />}
      <RunList projectId={project.id} c={c} activeId={scanId} />
    </div>
  );
}

function useScanNav() {
  const [location, navigate] = useLocation();
  return (id: string | null) => {
    const p = new URLSearchParams(window.location.search);
    if (id) p.set('scan', id); else p.delete('scan');
    navigate(`${location}?${p.toString()}`);
  };
}

/** Onboarding after identity: the one canonical neutral prompt set and its daily schedule. No preview or manual run. */
function TrackedSetup({ c }: { c: Copy }) {
  const { project, activeProjects, projectHref } = useProjects();
  const { locale, href } = useI18n();
  const labels = useContextLabels();
  const p = project!;
  const ctx = projectContext(p);
  const L = (fi: string, en: string) => (locale === 'fi' ? fi : en);
  const [adding, setAdding] = useState(false);
  const sched = useSchedule(p.id);
  const schedule = sched.data as DailySchedule | undefined;
  const prompts = usePromptList(p.id, { status: 'active', page: 1, sort: 'updated' });
  const items = prompts.data?.items ?? [];
  const conflict = schedule?.status === 'conflict';
  const blocked = conflict || atPromptLimit(schedule) || schedule?.status === 'limit_unconfigured';
  const settingsHref = (tab: string) => `${href('/settings')}?project=${encodeURIComponent(p.id)}&tab=${tab}`;
  return (
    <>
      <PageHeader title={L('Seurattavat kysymykset', 'Tracked prompts')} subtitle={L('Yksi neutraali kysymyslista mitataan automaattisesti joka päivä. Erillisiä tarkistuksia ei enää käynnistetä.', 'One neutral prompt list is measured automatically every day. Separate checks are no longer started.')}
        actions={<Button asChild variant="secondary"><Link href={projectHref('/dashboard/prompts')} data-testid="link-manage-prompts">{L('Hallitse kysymyksiä', 'Manage prompts')}</Link></Button>} />
      <ol className="flex flex-wrap gap-2 text-[13px]">
        <li><StatusBadge tone="success">1 · {c.step1}</StatusBadge></li>
        <li><StatusBadge tone="info">2 · {L('Kysymykset ja päivittäinen mittaus', 'Prompts and daily measurement')}</StatusBadge></li>
      </ol>
      {conflict && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-bg p-4 text-[13px] text-warning" data-testid="state-prompt-set-conflict">
          <p>{L('Palvelin on päivitettävä tukemaan useita työtiloja. Aiemmat projektit ja vastaukset säilyvät.', 'The server needs an update to support multiple workspaces. Existing projects and answers are preserved.')}</p>
        </div>
      )}
      <Panel className="ar-rise flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[20px] font-semibold leading-[29px] text-ink" data-testid="text-review-identity">{p.brandName} · {p.ownedDomains[0] ?? ''}</p>
          <p className="text-[14px] leading-5 text-muted-ink"><span lang={ctx.language}>{p.categoryFi || p.category}</span> · <span data-testid="text-quick-context">{labels.market(ctx.market)} · {labels.language(ctx.language)}</span></p>
        </div>
        <Button asChild variant="secondary" size="sm"><Link href={settingsHref('project')} data-testid="button-edit-details">{c.edit}</Link></Button>
      </Panel>
      <DailyStatusStrip projectId={p.id} testId="strip-start-daily" />
      <Panel className="ar-rise ar-rise-1 overflow-hidden" aria-labelledby="start-prompts-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div>
            <h2 id="start-prompts-h" className="text-[16px] font-semibold text-ink">{L('Aktiiviset seurattavat kysymykset', 'Active tracked prompts')}</h2>
            <p className="mt-1 text-[12px] text-muted-ink">{c.questionsNote}</p>
          </div>
          <Button size="sm" disabled={blocked} onClick={() => setAdding(true)} data-testid="button-start-add-prompt"><Plus aria-hidden />{L('Lisää kysymys', 'Add prompt')}</Button>
        </div>
        {prompts.isPending ? <LoadingBlock rows={3} /> : prompts.isError ? <ErrorState onRetry={() => void prompts.refetch()} /> : !items.length ? (
          <EmptyState compact title={L('Ei vielä kysymyksiä', 'No prompts yet')} body={L('Lisää ei-brändätty tai brändätty kysymys, tai hyväksy ehdotuksia Kysymykset-näkymässä.', 'Add a non-branded or branded prompt, or accept suggestions on the Prompts screen.')} />
        ) : (
          <ul className="divide-y divide-line" data-testid="list-start-prompts">
            {items.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]" data-testid={`text-prompt-${x.id}`}>
                <span className="min-w-0 font-medium text-ink" lang={x.language ?? ctx.language}>{x.text}</span>
                <KindBadge kind={x.kind} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ProviderContextNotice />
      <PromptDialog open={adding} onOpenChange={setAdding} project={p} />
    </>
  );
}

/** Per-provider coverage derived only from returned observations (no estimation). */
function providerRows(r: QuickCheckReport) {
  const perProvider = r.prompts.length;
  return r.score.providers_requested.map((pr) => {
    const obs = r.observations.filter((o) => o.provider === pr);
    // Match the backend score: only explicitly successful observations qualify.
    // Empty answers with unconfigured/budget_blocked/no_overview statuses are not successes.
    const ok = obs.filter((o) => o.provider_status === 'success').length;
    const settled = obs.filter((o) => !POLLING.has(o.provider_status)).length;
    return { provider: pr, ok, settled, expected: perProvider, measured: r.score.providers_measured.includes(pr), status: providerProgress(obs.map(o => o.provider_status), perProvider) };
  });
}

function RunView({ scanId, c }: { scanId: string; c: Copy }) {
  const { user } = useAccount();
  const { project } = useProjects();
  const go = useScanNav();
  const qc = useQueryClient();
  const q = useGetQuickCheck(scanId, {
    query: {
      queryKey: [...getGetQuickCheckQueryKey(scanId), user?.id],
      refetchInterval: (query) => {
        if ([401, 403, 404].includes(readApiError(query.state.error).status ?? 0)) return false;
        const s = query.state.data?.status;
        return !s || POLLING.has(s) ? 4000 : false;
      },
      refetchOnWindowFocus: false,
    },
  });
  useEffect(() => {
    if (q.data) void qc.invalidateQueries({queryKey:getListProjectQuickChecksQueryKey(q.data.project_id)});
    if (q.data && !POLLING.has(q.data.status)) {
      void qc.invalidateQueries({queryKey:getGetProjectAnalyticsQueryKey(q.data.project_id)});
    }
  }, [qc, q.data?.status, q.data?.project_id]);
  if (q.isPending) return <Panel className="p-6" aria-busy="true"><LoadingBlock rows={5} /></Panel>;
  if (q.data && q.data.project_id !== project?.id) return <Panel><ErrorState body={c.errors.NOT_FOUND} onRetry={() => go(null)} /></Panel>;
  if (q.isError && (!q.data || [401, 403, 404].includes(readApiError(q.error).status ?? 0))) return <Panel><ErrorState body={readApiError(q.error).status === 404 ? c.errors.NOT_FOUND : c.loadFailed} onRetry={() => void q.refetch()} /></Panel>;
  const r = q.data;
  if (POLLING.has(r.status)) return <ProgressView r={r} c={c} />;
  if ((r.status === 'failed' || r.status === 'no_measurements') && !r.score.valid_answers) return <FailureView r={r} c={c} />;
  return <ResultView r={r} c={c} />;
}

function useBrand() {
  const { project } = useProjects();
  return project?.brandName ?? '';
}

function ProgressView({ r, c }: { r: QuickCheckReport; c: Copy }) {
  const { num } = useI18n();
  const brand = useBrand();
  const [showSoFar, setShowSoFar] = useState(true);
  const rows = providerRows(r);
  const total = r.score.expected_answers;
  const done = rows.reduce((n, x) => n + x.settled, 0);
  const pct = total > 0 ? Math.min(1, done / total) : null;
  return (
    <>
      <PageHeader title={['running', 'processing'].includes(r.status) ? c.progressTitle : c.waitingTitle} subtitle={fill(c.progressSub, { brand, n: r.prompts.length })} />
      <Panel className="ar-rise flex flex-col gap-6 p-6 md:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[24px] font-semibold leading-[35px] text-ink md:text-[28px] md:leading-[41px]">{c.collecting}</h2>
          <StatusBadge tone="info" data-testid="status-run">{statusLabel(r.status, c)}</StatusBadge>
        </div>
        <p className="text-[16px] leading-[23px] text-muted-ink">{c.leave}</p>
        {pct !== null && (
          <>
            <div className="flex items-center gap-4">
              <p className="tabular text-[18px] font-semibold leading-[26px] text-ink" data-testid="text-processed">{fill(c.processed, { done, total })}</p>
              <div className="flex-1" />
              <p className="tabular text-[24px] font-semibold leading-[35px] text-navy">{num(pct * 100, { maximumFractionDigits: 0 })} %</p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-[5px] bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
              <div className="h-full w-full origin-left rounded-[5px] bg-cyan transition-transform duration-500" style={{ transform: `scaleX(${pct})` }} />
            </div>
          </>
        )}
        <FTable heads={[c.colStage, c.colStatus, c.colAnswers]} cols="grid-cols-[1fr_200px_120px] md:grid-cols-[506px_316px_1fr]">
          <div className="grid grid-cols-[1fr_200px_120px] md:grid-cols-[506px_316px_1fr]">
            <div className="p-3 text-[13px] font-medium text-ink">{c.stageSetup}</div>
            <div className="p-3 text-[13px] text-muted-ink">{statusLabel(r.prompts.length > 0 ? 'completed' : r.status, c)}</div>
            <div className="tabular p-3 text-[13px] text-muted-ink">{r.prompts.length > 0 ? `${r.prompts.length} / ${r.prompts.length}` : '—'}</div>
          </div>
          {rows.map((x) => (
            <div key={x.provider} className="grid grid-cols-[1fr_200px_120px] md:grid-cols-[506px_316px_1fr]" data-testid={`row-provider-${x.provider}`}>
              <div className="p-3 text-[13px] font-medium text-ink"><ProviderMark provider={x.provider} /></div>
              <div className="p-3 text-[13px] text-muted-ink">{statusLabel(x.status, c)}</div>
              <div className="tabular p-3 text-[13px] text-muted-ink">{x.ok} / {x.expected}</div>
            </div>
          ))}
        </FTable>
        <p className="text-[13px] text-muted-ink">{c.collectingNote}</p>
      </Panel>
      {r.observations.length > 0 && (
        <div><Button variant="secondary" className="min-w-[270px]" onClick={() => setShowSoFar((s) => !s)} data-testid="button-show-so-far">{showSoFar ? c.hideSoFar : c.showSoFar}</Button></div>
      )}
      {showSoFar && <Evidence r={r} c={c} />}
    </>
  );
}

function FailureView({ r, c }: { r: QuickCheckReport; c: Copy }) {
  const { date } = useI18n();
  const brand = useBrand();
  const go = useScanNav();
  const failed = r.status === 'failed';
  return (
    <>
      <PageHeader title={c.title} subtitle={fill(c.runSub, { brand, date: date(new Date(r.created_at)) })} />
      <Panel className="ar-rise flex flex-col items-start gap-6 p-6 md:p-12">
        <StatusBadge tone={failed ? 'error' : 'warning'} dot={false} className="min-w-[196px] justify-center" data-testid="status-run">{failed ? c.failBadgeFailed : c.failBadgeNone}</StatusBadge>
        <h2 className="text-[30px] font-semibold leading-[44px] text-navy md:text-[38px] md:leading-[55px]">{failed ? c.failTitleFailed : c.failTitleNone}</h2>
        <p className="max-w-[740px] text-[18px] leading-[26px] text-muted-ink">{failed ? c.failBodyFailed : c.failBodyNone}</p>
        <div className="flex flex-wrap gap-4">
          <Button className="min-w-[210px]" onClick={() => go(null)} data-testid="button-new-check">{c.newCheck}</Button>
        </div>
        <div className="h-px w-full bg-line" />
        <p className="text-[15px] leading-[22px] text-ink">{c.noScoreKept}</p>
        <p className="text-[12px] leading-[17px] text-muted-ink">{statusLabel(r.status, c)} · {c.runId}: <span className="font-mono">{r.id}</span></p>
      </Panel>
      {r.observations.length > 0 && <Evidence r={r} c={c} />}
    </>
  );
}

function ResultView({ r, c }: { r: QuickCheckReport; c: Copy }) {
  const { num, date } = useI18n();
  const brand = useBrand();
  const go = useScanNav();
  const s = r.score;
  const rows = providerRows(r);
  const title = s.state === 'partial' ? c.partialTitle : s.state === 'legacy' ? c.legacyTitle : c.resultsTitle;
  const band = bandLabel(s.band, c);
  return (
    <>
      <PageHeader title={title} subtitle={fill(c.runSub, { brand, date: date(new Date(r.created_at)) })}
        actions={<Button variant="secondary" onClick={() => go(null)} data-testid="button-back-start">{c.back}</Button>} />
      {s.state === 'partial' && (
        <div className="ar-rise flex flex-col gap-1 rounded-xl bg-warning-bg p-4">
          <p className="tabular text-[14px] font-semibold leading-5 text-warning">{fill(c.doneOf, { done: s.valid_answers, total: s.expected_answers })}</p>
          <p className="text-[12px] leading-[17px] text-muted-ink">{c.partialNote} {c.missingNote}</p>
        </div>
      )}
      {s.state === 'legacy' && <ReasonNote tone="warning">{c.legacy}</ReasonNote>}
      {s.state === 'unavailable' && <ReasonNote tone="warning">{c.unavailable} {c.missingNote}</ReasonNote>}
      <div className="ar-rise ar-rise-1 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={c.score} testId="text-score"
          value={s.value === null ? c.noScore : `${num(s.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${c.outOf}`}
          aside={band} sub={`${statusLabel(s.state, c)} · ${fill(c.ofAnswers, { n: s.valid_answers, total: s.expected_answers })}`} />
        <Metric label={c.coverage} testId="text-answer-coverage" value={`${s.valid_answers} / ${s.expected_answers}`} />
        <Metric label={c.provCoverage} testId="text-provider-coverage" value={`${s.providers_measured.length} / ${s.providers_requested.length}`} sub={s.providers_measured.join(', ') || '—'} />
        <Metric label={c.mentions} testId="text-mentions" value={String(s.mentions)} sub={fill(c.ofAnswers, { n: s.mentions, total: s.valid_answers })} />
      </div>
      {rows.length > 0 && (
        <FTable heads={[c.colProvider, c.colOk, c.colMissing, c.colStatus]} cols="grid-cols-[1fr_120px_120px_1fr] md:grid-cols-[290px_170px_170px_1fr]">
          {rows.map((x) => {
            const missing = Math.max(0, x.expected - x.ok);
            const st = !x.measured ? (x.settled > 0 ? 'failed' : 'missing') : missing > 0 ? 'partial' : 'completed';
            return (
              <div key={x.provider} className="grid grid-cols-[1fr_120px_120px_1fr] md:grid-cols-[290px_170px_170px_1fr]" data-testid={`row-provider-${x.provider}`}>
                <div className="p-3 text-[13px] font-medium text-ink"><ProviderMark provider={x.provider} /></div>
                <div className="tabular p-3 text-[13px] text-muted-ink">{x.ok} / {x.expected}</div>
                <div className="tabular p-3 text-[13px] text-muted-ink">{missing}</div>
                <div className="p-3"><StatusBadge tone={statusTone(st)}>{statusLabel(st, c)}</StatusBadge></div>
              </div>
            );
          })}
        </FTable>
      )}
      <p className="font-mono text-[12px] text-muted-ink">{c.methodology}: {s.methodology}</p>
      {r.observations.length > 0 && <Evidence r={r} c={c} />}
    </>
  );
}

function Metric({ label, value, sub, aside, testId }: { label: string; value: string; sub?: string; aside?: string | null; testId: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-card p-5">
      <p className="text-[13px] font-medium leading-[19px] text-muted-ink">{label}</p>
      <div className="flex items-baseline gap-3">
        <p className="tabular text-[28px] font-semibold leading-[46px] text-ink md:text-[32px]" data-testid={testId}>{value}</p>
        {aside && <p className="text-[12px] font-medium leading-[17px] text-navy">{aside}</p>}
      </div>
      {sub && <p className="truncate text-[12px] leading-[17px] text-muted-ink">{sub}</p>}
    </div>
  );
}

/** Answers are rendered verbatim as React text (escaped); their language is not classified, so no lang attribute. */
function Evidence({ r, c }: { r: QuickCheckReport; c: Copy }) {
  const { project } = useProjects();
  const promptText = new Map(r.prompts.map((x) => [x.id, x.prompt_text]));
  const promptLang = (r as { language?: string }).language ?? projectContext(project).language;
  return (
    <Panel className="flex flex-col gap-3 p-5 md:p-6">
      <h3 className="text-[16px] font-semibold text-ink">{c.evidence}</h3>
      {r.observations.map((o, i) => (
        <article key={`${o.prompt_id}-${o.provider}-${i}`} className="rounded-xl border border-line p-4" data-testid={`card-observation-${i}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-ink">
            <span className="font-medium text-ink"><ProviderMark provider={o.provider} /></span>
            <StatusBadge tone={statusTone(o.provider_status)}>{measurementLabel(o.provider_status, c === C.fi)}</StatusBadge>
            {o.model && <span className="font-mono">{o.model}</span>}
          </div>
          {promptText.get(o.prompt_id) && (
            <p className="mb-2 text-[13px] text-ink"><span className="text-muted-ink">{c.question}: </span><span lang={promptLang} className="font-medium">{promptText.get(o.prompt_id)}</span></p>
          )}
          <p className="mb-1 text-[11px] font-medium text-muted-ink">{c.originalAnswer}</p>
          <p className="whitespace-pre-wrap text-[14px] text-ink">{o.answer_text ?? <span className="text-muted-ink">{c.noAnswer}</span>}</p>
          {o.citations.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-[13px]"><li className="text-muted-ink">{c.sources}</li>
              {o.citations.map((ct, j) => { const h = safeHref(ct.url); return (
                <li key={j} className="break-all">{h ? <a href={h} target="_blank" rel="noopener noreferrer nofollow" className="text-link underline">{ct.title || ct.url}</a> : <span>{ct.title || ct.url}</span>}</li>
              ); })}
            </ul>
          )}
        </article>
      ))}
    </Panel>
  );
}

function RunList({ projectId, c, activeId }: { projectId: string; c: Copy; activeId: string | null }) {
  const { user } = useAccount();
  const { date } = useI18n();
  const [location] = useLocation();
  const q = useListProjectQuickChecks(projectId, {query:{queryKey:[...getListProjectQuickChecksQueryKey(projectId),user?.id]}});
  const hrefFor = (id: string) => { const p = new URLSearchParams(window.location.search); p.set('scan', id); return `${location}?${p.toString()}`; };
  return (
    <Panel className="flex flex-col gap-3 p-5 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-ink">{c.runs}</h2>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching} data-testid="button-refresh-list">{c.refreshRuns}</Button>
      </div>
      {q.isPending ? <LoadingBlock rows={3} /> : q.isError ? <ErrorState body={c.loadFailed} onRetry={() => void q.refetch()} /> : q.data.length === 0 ? (
        <EmptyState compact title={c.noRuns} body={c.noRunsBody} />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.map((r) => (
            <li key={r.id} className={`flex items-center justify-between gap-3 py-2.5 ${r.id === activeId ? 'font-semibold' : ''}`}>
              <span className="min-w-0 truncate text-[14px] text-ink">{r.domain} <span className="text-[12px] font-normal text-muted-ink">· {date(new Date(r.created_at))}</span></span>
              <span className="flex items-center gap-2"><StatusBadge tone={statusTone(r.status)}>{statusLabel(r.status, c)}</StatusBadge>
                <Link href={hrefFor(r.id)} className="text-[13px] text-link underline" data-testid={`link-run-${r.id}`}>{c.open}</Link></span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
