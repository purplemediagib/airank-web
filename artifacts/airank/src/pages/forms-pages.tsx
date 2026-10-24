import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useProjectsOptional } from '@/lib/project-context';
import { useDocumentTitle, useI18n } from '@/i18n';
import { emptyDraft, validateDraft, type ProjectDraft } from '@/lib/validate';
import { PageHeader, Panel, DisabledAction, ReasonNote, StatusBadge } from '@/components/airank/primitives';
import { TextField } from '@/components/airank/forms';
import { Button } from '@/components/ui/button';
export { SettingsPage } from './settings-page';

function ProjectFields({ draft, setDraft, errors, showValid }: { draft: ProjectDraft; setDraft: (d: ProjectDraft) => void; errors: Partial<Record<keyof ProjectDraft, string>>; showValid: boolean }) {
  const { d } = useI18n();
  const s = d.settings;
  const ok = (k: keyof ProjectDraft) => (showValid && !errors[k] && draft[k] ? ' ' : undefined);
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <TextField label={s.brandName} hint={s.brandHint} value={draft.brand} onChange={(v) => setDraft({ ...draft, brand: v })} error={errors.brand} success={ok('brand')} testId="input-brand" autoComplete="organization" />
      <TextField label={s.domain} hint={s.domainHint} value={draft.domain} onChange={(v) => setDraft({ ...draft, domain: v })} error={errors.domain} success={ok('domain')} testId="input-domain" inputMode="url" placeholder="yritys.fi" />
      <div className="md:col-span-2">
        <TextField multiline label={s.category} hint={s.categoryHint} value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} error={errors.category} success={ok('category')} testId="input-category" />
      </div>
      <div className="md:col-span-2">
        <TextField optional label={s.aliases} hint={s.aliasesHint} value={draft.aliases} onChange={(v) => setDraft({ ...draft, aliases: v })} error={errors.aliases} testId="input-aliases" />
      </div>
    </div>
  );
}

function useDraftForm() {
  const { d, t, plural } = useI18n();
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateDraft(draft, d, t) : {};
  const count = Object.keys(errors).length;
  return { draft, setDraft, submitted, setSubmitted, errors, count, summary: count ? plural(d.validation.summary, count) : null };
}

export function NotFoundPage() {
  const { d, t } = useI18n();
  const { projectHref } = useProjectsLinks();
  const [location] = useLocation();
  useDocumentTitle(d.notFound.title);
  return (
    <Panel className="ar-rise mx-auto mt-10 flex w-full max-w-[520px] flex-col items-start gap-3 p-6">
      <StatusBadge tone="neutral">404</StatusBadge>
      <h1 className="text-[26px] font-semibold text-ink" data-testid="text-page-title">{d.notFound.title}</h1>
      <p className="break-all text-sm text-muted-ink">{t(d.notFound.body, { path: location })}</p>
      <Button asChild><Link href={projectHref('/dashboard')} data-testid="link-not-found-home">{d.notFound.home}</Link></Button>
    </Panel>
  );
}

function useProjectsLinks() {
  const ctx = useProjectsOptional();
  const { href } = useI18n();
  return { projectHref: ctx?.projectHref ?? href };
}

export { StartPage } from './start-page';
