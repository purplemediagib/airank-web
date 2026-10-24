import { useState } from 'react';
import { Link } from 'wouter';
import { Check, Pencil, X } from 'lucide-react';
import type { PromptSuggestion } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/airank/primitives';
import { KindBadge } from '@/components/airank/prompt-parts';
import { useL } from '@/components/airank/analytics';

export type SuggestionKind = 'neutral' | 'diagnostic';
export type SuggestionDraft = PromptSuggestion;
export interface AcceptEdits { text: string; kind: SuggestionKind; topic: string; tags: string[] }

/** Topic hints come only from this draft batch and existing prompt metadata — never fabricated measurements. */
export function topicHints(list: SuggestionDraft[], existing: string[]): string[] {
  const seen = new Map<string, string>();
  for (const t of [...existing, ...list.map((s) => s.topic ?? '')]) {
    const v = t.trim();
    if (v && !seen.has(v.toLocaleLowerCase())) seen.set(v.toLocaleLowerCase(), v);
  }
  return [...seen.values()].slice(0, 12);
}

export function SuggestionMix({ list }: { list: SuggestionDraft[] }) {
  const L = useL();
  const pending = list.filter((s) => s.status === 'pending');
  const typed = pending.filter((s) => s.kind);
  if (!typed.length) return null;
  const neutral = typed.filter((s) => s.kind === 'neutral').length;
  const diag = typed.length - neutral;
  return (
    <div className="border-b border-line bg-canvas/60 px-4 py-3" data-testid="panel-suggestion-mix">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-medium text-ink">{L('Ehdotusten jakauma', 'Suggestion mix')}</span>
        <span className="inline-flex items-center gap-1.5" data-testid="text-mix-neutral"><span className="size-2 rounded-full bg-cyan" aria-hidden />{L(`${neutral} ei-brändättyä`, `${neutral} non-branded`)}</span>
        <span className="inline-flex items-center gap-1.5" data-testid="text-mix-diagnostic"><span className="size-2 rounded-full bg-warning" aria-hidden />{L(`${diag} brändättyä`, `${diag} branded`)}</span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full ring-1 ring-line" aria-hidden>
        <span className="bg-cyan" style={{ width: `${(neutral / typed.length) * 100}%` }} />
        <span className="bg-warning" style={{ width: `${(diag / typed.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-[12px] leading-[17px] text-muted-ink">
        {L('Ei-brändätyt kysymykset eivät mainitse brändiäsi, joten ne mittaavat löydettävyyttä. Brändätyt (diagnostiset) kysymykset jätetään näkyvyysluvuista pois, mutta niiden tallennetut vastaukset ovat avattavissa kysymyksen sivulla ja seuranta-ajoissa.',
          'Non-branded prompts never name your brand, so they measure discovery. Branded (diagnostic) prompts are excluded from discovery visibility numbers, but their tracked answers stay accessible on the prompt page and in monitoring runs.')}
      </p>
    </div>
  );
}

export function SuggestionRow({ s, lang, hints, readOnly, busyAction, disabled, sourceLabel, statusLabel, tone, openHref, openLabel, onAccept, onReject }: {
  s: SuggestionDraft; lang: string; hints: string[]; readOnly: boolean; busyAction: 'accept' | 'reject' | null; disabled: boolean;
  sourceLabel: string; statusLabel: string; tone: 'info' | 'success' | 'neutral'; openHref: string; openLabel: string;
  onAccept: (edits: AcceptEdits | null) => void; onReject: () => void;
}) {
  const L = useL();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(s.text);
  const [kind, setKind] = useState<SuggestionKind>(s.kind === 'diagnostic' ? 'diagnostic' : 'neutral');
  const [topic, setTopic] = useState(s.topic ?? '');
  const typed = !!s.kind;
  const pending = s.status === 'pending';
  const textErr = text.trim().length < 8 ? L('Kysymyksessä on oltava vähintään 8 merkkiä.', 'Prompt needs at least 8 characters.') : null;
  const accept = () => {
    if (!typed) return onAccept(null);
    if (editing && textErr) return;
    onAccept({ text: text.trim(), kind, topic: topic.trim().slice(0, 80), tags: s.tags ?? [] });
  };
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5" data-testid={`row-suggestion-${s.id}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} lang={lang} rows={2} maxLength={1000} aria-label={L('Kysymyksen teksti', 'Prompt text')} aria-invalid={!!textErr}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid={`input-suggestion-text-${s.id}`} />
          ) : <p lang={lang} className="text-sm font-medium text-ink">{s.text}</p>}
          {editing && textErr && <p className="mt-1 text-[12px] text-danger">{textErr}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-ink">
            {typed && <span title={kind === 'diagnostic' ? L('Brändätty: mainitsee brändisi', 'Branded: names your brand') : L('Ei-brändätty: ei mainitse brändiäsi', 'Non-branded: does not name your brand')}>
              <KindBadge kind={pending ? kind : s.kind} /></span>}
            {typed && <span data-testid={`text-suggestion-branding-${s.id}`}>{(pending ? kind : s.kind) === 'diagnostic' ? L('Brändätty', 'Branded') : L('Ei-brändätty', 'Non-branded')}</span>}
            {(pending ? topic : s.topic) && <span className="rounded-full bg-tint px-2 py-0.5 text-link" data-testid={`text-suggestion-topic-${s.id}`}>{pending ? topic : s.topic}</span>}
            <span>{sourceLabel}: <span className="font-mono">{s.source}</span></span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusBadge tone={tone} data-testid={`status-suggestion-${s.id}`}>{statusLabel}</StatusBadge>
          {pending ? <>
            {typed && <Button size="sm" variant="ghost" disabled={readOnly || disabled} aria-expanded={editing} onClick={() => setEditing((v) => !v)} data-testid={`button-edit-suggestion-${s.id}`}><Pencil aria-hidden />{L('Muokkaa', 'Edit')}</Button>}
            <Button size="sm" disabled={readOnly || disabled || (editing && !!textErr)} loading={busyAction === 'accept'} onClick={accept} data-testid={`button-accept-${s.id}`}><Check aria-hidden />{L('Hyväksy', 'Accept')}</Button>
            <Button size="sm" variant="ghost" disabled={readOnly || disabled} loading={busyAction === 'reject'} onClick={onReject} data-testid={`button-reject-${s.id}`}><X aria-hidden />{L('Hylkää', 'Reject')}</Button>
          </> : s.promptId ? <Link href={openHref} className="text-[13px] font-medium text-link hover:underline" data-testid={`link-suggestion-prompt-${s.id}`}>{openLabel}</Link> : null}
        </div>
      </div>
      {pending && typed && editing && (
        <div className="grid gap-3 rounded-lg border border-line bg-canvas/60 p-3 md:grid-cols-[auto_1fr]" data-testid={`panel-edit-suggestion-${s.id}`}>
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-medium text-ink">{L('Kysymyksen tyyppi', 'Prompt type')}</legend>
            <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-line" role="radiogroup">
              {(['neutral', 'diagnostic'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} data-testid={`button-kind-${k}-${s.id}`}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${kind === k ? (k === 'neutral' ? 'bg-tint text-link' : 'bg-warning-bg text-warning') : 'text-muted-ink hover:text-ink'}`}>
                  {k === 'neutral' ? L('Ei-brändätty', 'Non-branded') : L('Brändätty', 'Branded')}
                </button>
              ))}
            </div>
            <p className="mt-1.5 max-w-[260px] text-[11px] leading-[15px] text-muted-ink">{L('Palvelin tarkistaa, ettei ei-brändätty kysymys mainitse brändiäsi.', 'The server checks that a non-branded prompt does not name your brand.')}</p>
          </fieldset>
          <div>
            <label htmlFor={`topic-${s.id}`} className="mb-1.5 block text-[12px] font-medium text-ink">{L('Aihe', 'Topic')}</label>
            <input id={`topic-${s.id}`} value={topic} maxLength={80} onChange={(e) => setTopic(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-white px-3 text-sm" data-testid={`input-suggestion-topic-${s.id}`} />
            {hints.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5" aria-label={L('Aihe-ehdotukset', 'Topic suggestions')}>
              {hints.filter((h) => h !== topic).map((h) => (
                <button key={h} type="button" onClick={() => setTopic(h)} className="rounded-full bg-white px-2.5 py-0.5 text-[12px] text-muted-ink ring-1 ring-line hover:text-ink hover:ring-cyan" data-testid={`button-topic-hint-${s.id}-${h}`}>{h}</button>
              ))}
            </div>}
            <p className="mt-1.5 text-[11px] text-muted-ink">{L('Aiheet tulevat tämän erän luonnoksista ja nykyisistä kysymyksistäsi.', 'Topics come from this draft batch and your existing prompts.')}</p>
          </div>
        </div>
      )}
    </li>
  );
}
