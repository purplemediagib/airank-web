import type { ReactNode } from 'react';
import type { Candidate } from '@workspace/api-client-react';
import { StatusBadge } from '@/components/airank/primitives';
import { useL } from '@/components/airank/analytics';
import { WebsiteFavicon } from '@/components/airank/website-favicon';

/** Proposed domains are unverified suggestions, never ownership facts. */
export const proposedDomains = (c: Candidate) => c.proposedDomains ?? [];

/** Candidate name, unverified badge and proposed domains (shown only as review hints). */
export function CandidateIdentity({ c, children }: { c: Candidate; children?: ReactNode }) {
  const L = useL();
  const domains = proposedDomains(c);
  return (
    <>
      <WebsiteFavicon domain={domains[0]} brand={c.name} className="mt-0.5 size-8 text-[12px]" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink" data-testid={`text-candidate-name-${c.id}`}>{c.name}{c.reviewRequired && <span className="ml-2 align-middle"><StatusBadge tone="warning" data-testid={`badge-unverified-${c.id}`}>{L('Ehdotus · tarkistamaton', 'Suggested · unverified')}</StatusBadge></span>}</p>
        {domains.length > 0 && <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-ink" data-testid={`text-proposed-domains-${c.id}`}>{L('Ehdotetut verkkotunnukset (ei vahvistettu):', 'Proposed domains (unverified):')} {domains.map((d) => <span key={d} className="rounded bg-canvas px-1.5 font-mono ring-1 ring-line">{d}</span>)}</p>}
        {children}
      </div>
    </>
  );
}
