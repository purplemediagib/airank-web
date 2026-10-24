import { useQuery } from '@tanstack/react-query';
import { useAccount } from './account';
import { ContentError } from './content-api';

export interface ContentProjectIdentity {
  id: string; brandName: string; ownedDomains: string[]; status: string;
  promptLanguage?: string; [field: string]: unknown;
}
export function useContentProjects(enabled = true) {
  const { authenticated, user } = useAccount();
  return useQuery({
    queryKey: ['content-projects', user?.id],
    enabled: authenticated && enabled,
    retry: false,
    queryFn: async (): Promise<ContentProjectIdentity[]> => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const response = await fetch(`${base}/api/airank/v1/app/content-projects`, {
        credentials: 'same-origin', headers: { Accept: 'application/json' }, redirect: 'error',
      });
      const payload = await response.json();
      if (!response.ok) throw new ContentError(response.status, payload?.error?.code || 'REQUEST_FAILED');
      if (!Array.isArray(payload)) throw new ContentError(502, 'RESPONSE_UNAVAILABLE');
      return payload;
    },
  });
}
