import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';
import { PublicCheckError, useEmailPublicReport, usePublicDelivery, type PublicCapabilities, type PublicDelivery } from '@/lib/public-check-api';
import { C, errText, type Loc } from './copy';

export function EmailPanel({ id, token, loc, caps }: { id: string; token: string; loc: Loc; caps: PublicCapabilities }) {
  const c = C[loc];
  const [email, setEmail] = useState(''); const [marketing, setMarketing] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  const inFlight = useRef(false);
  const completedRequest = useRef<string | null>(null);
  const mail = useEmailPublicReport(id, token);
  const poll = usePublicDelivery(requestId, token);
  const d: PublicDelivery | undefined = poll.data ?? mail.data;
  const sentRef = useRef(false);
  const requestKey = JSON.stringify([id, email.trim().toLowerCase(), caps.marketingEnabled && marketing, loc]);
  useEffect(() => { if (!sentRef.current && d && (d.status === 'sent' || d.status === 'delivered')) { sentRef.current = true; track('report_email_sent', loc, id); } }, [d, loc, id]);
  const submit = (resend: boolean) => {
    // Mutation state updates on the next render; the ref closes the same-tick double-submit gap.
    if (inFlight.current || mail.isPending || (!resend && completedRequest.current === requestKey)) return;
    inFlight.current = true;
    track('report_email_requested', loc, resend ? undefined : id);
    mail.mutate({ email: email.trim(), marketingConsent: caps.marketingEnabled && marketing, locale: loc, ...(resend ? { resend: true } : {}) }, {
      onSuccess: r => {
        completedRequest.current = requestKey;
        setCompletedKey(requestKey);
        setRequestId(r.requestId);
        if (r.requestId === requestId) void poll.refetch();
      },
      onSettled: () => { inFlight.current = false; },
    });
  };
  const msg = !d ? null : { sending: c.dSending, sent: c.dSent, delivered: c.dDelivered, bounced: c.dBounced, failed: c.dFailed, uncertain: c.dUncertain }[d.status];
  const mk = d ? { pending: c.mkPending, subscribed: c.mkSubscribed, failed: c.mkFailed, unavailable: c.mkUnavailable, not_requested: null }[d.marketingStatus] : null;
  const bad = d && (d.status === 'failed' || d.status === 'bounced');
  return (
    <section className="rounded-xl bg-navy p-5 text-white sm:p-6" aria-labelledby="pc-email">
      <h2 id="pc-email" className="text-xl font-bold text-white">{c.emailTitle}</h2>
      <p className="text-sm text-white/80">{c.emailLead}</p>
      <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); submit(false); }}>
        <label className="block text-sm"><span className="mb-1 block font-medium text-white">{c.email}</span>
          <Input className="bg-white text-ink" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} /></label>
        <label className={`flex items-start gap-2 text-sm ${caps.marketingEnabled ? '' : 'opacity-60'}`}>
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#181f6b]" checked={caps.marketingEnabled && marketing} disabled={!caps.marketingEnabled} onChange={e => setMarketing(e.target.checked)} />
          <span>{caps.marketingEnabled ? c.marketing : c.marketingOff}</span></label>
        <Button type="submit" className="w-full bg-white text-navy hover:bg-white/90 sm:w-auto" disabled={mail.isPending || completedKey === requestKey || d?.status === 'sending' && !mail.isError}>{mail.isPending ? c.sending : c.send}</Button>
      </form>
      <div role="status" aria-live="polite" className="mt-3 text-sm">
        {msg && <p className="rounded bg-white p-2 font-medium text-navy">{msg}</p>}
        {mk && <p className="text-white/80">{mk}</p>}
      </div>
      {mail.isError && <p role="alert" className="mt-2 rounded bg-danger-bg p-2 text-sm text-danger">{mail.error instanceof PublicCheckError && mail.error.status === 0 ? c.eGeneric : errText(mail.error, c)}</p>}
      {bad && <Button type="button" variant="secondary" className="mt-2 bg-white text-navy" disabled={mail.isPending} onClick={() => submit(true)}>{c.retry}</Button>}
    </section>
  );
}
