import { useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button, type ButtonProps } from '@/components/ui/button';
import { DisabledAction } from '@/components/airank/primitives';
import type { ContentJob, JobKind } from '@/lib/content-api';
import { useStudio } from './studio';
import { useErr, useTx } from './ui';

export const PAID_KINDS: JobKind[] = ['audit', 'research', 'rewrite', 'create', 'perception'];

/** Submits through the persistent idempotent submitter. Never auto-retries. */
export function useRunJob() {
  const s = useStudio(); const err = useErr(); const tx = useTx(); const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (kind: JobKind, input: Record<string, unknown>): Promise<ContentJob | null> => {
    setBusy(true);
    try {
      const job = await s.submitter.submit(kind, input);
      s.refresh();
      toast({ title: tx('Job queued', 'Työ jonossa'), description: tx('Results appear when it completes. Nothing is changed automatically.', 'Tulokset näkyvät valmistuttua. Mitään ei muuteta automaattisesti.') });
      return job;
    } catch (e) { toast({ variant: 'destructive', title: tx('Could not queue the job', 'Työn jonotus epäonnistui'), description: err(e) }); return null; }
    finally { setBusy(false); }
  };
  return { run, busy };
}
export function useOpenJob() {
  const s = useStudio(); const [, nav] = useLocation();
  return (j: ContentJob | null) => { if (j) nav(s.ph(`/dashboard/content/jobs/${j.id}`)); };
}

/** Button for AI-model actions: explains why when the model or role blocks it. Editing is never blocked. */
export function PaidButton({ kind, children, ...p }: ButtonProps & { kind?: JobKind; children: ReactNode }) {
  const s = useStudio(); const tx = useTx();
  void kind;
  if (!s.can.edit) return <DisabledAction reason={tx('Your role is read-only for editing and AI jobs.', 'Roolillasi ei voi muokata tai ajaa tekoälytöitä.')} {...p}>{children}</DisabledAction>;
  if (!s.modelOk) return <DisabledAction reason={tx('No AI model is configured on this deployment. You can still edit and save.', 'Tekoälymallia ei ole määritetty. Voit silti muokata ja tallentaa.')} {...p}>{children}</DisabledAction>;
  return <Button {...p}>{children}</Button>;
}
export function EditButton({ children, ...p }: ButtonProps & { children: ReactNode }) {
  const s = useStudio(); const tx = useTx();
  if (!s.can.edit) return <DisabledAction reason={tx('Your role is read-only.', 'Roolisi on vain luku.')} {...p}>{children}</DisabledAction>;
  return <Button {...p}>{children}</Button>;
}
