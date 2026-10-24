import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateProject, type Project, type ProjectInput } from '@workspace/api-client-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from './account';
import { useProjectListKey } from './project-context';
import { invalidateSchedules } from './use-industries';
import { readApiError, writeErrorMessage } from './api-errors';
import { mapServerFieldErrors, normaliseInput, type ProjectErrors } from './project-validate';

/** POSTs a project once (no automatic retry), patches the owner-scoped cache and reports localised errors. */
export function useCreateProjectFlow(onCreated: (p: Project) => void) {
  const { d } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { writeRequest } = useAccount();
  const listKey = useProjectListKey();
  const create = useCreateProject({ request: writeRequest, mutation: { retry: false } });
  const [serverErrors, setServerErrors] = useState<ProjectErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  // Synchronous in-flight/created guard: double clicks or a later selection/preference failure can never trigger a second POST.
  const lock = useRef<'idle' | 'pending' | 'created'>('idle');

  const submit = (input: ProjectInput) => {
    if (lock.current !== 'idle') return;
    lock.current = 'pending';
    setServerErrors({});
    setMessage(null);
    create.mutate(
      { data: normaliseInput(input) },
      {
        onSuccess: (p) => {
          lock.current = 'created';
          qc.setQueryData(listKey, (old: Project[] | undefined) => [...(old ?? []).filter((x) => x.id !== p.id), p]);
          void qc.invalidateQueries({ queryKey: listKey });
          invalidateSchedules(qc);
          toast({ title: d.auth.created });
          onCreated(p);
        },
        onError: (err) => {
          // Explicit user resubmission only; an ambiguous network failure is reported, never replayed.
          lock.current = 'idle';
          setServerErrors(mapServerFieldErrors(readApiError(err).fieldErrors, d));
          setMessage(writeErrorMessage(err, d));
        },
      },
    );
  };
  return { submit, pending: create.isPending || lock.current === 'created', serverErrors, message };
}
