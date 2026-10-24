import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';
import { readApiError, writeErrorMessage } from '@/lib/api-errors';
import { useMeasurementSettings, useMeasurementSettingsWrite } from '@/lib/use-reports';
import { EmptyState, ErrorState, LoadingBlock, Panel, ReasonNote, StatusBadge } from './primitives';
import { useL } from './analytics';
import { ProviderMark } from './provider-brand';

/** Provider selection for future monitoring snapshots. "Configured" means a credential is present, not that calls succeed. */
export function MeasurementSettingsPanel({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const L = useL();
  const { d, num, date } = useI18n();
  const { toast } = useToast();
  const q = useMeasurementSettings(projectId);
  const write = useMeasurementSettingsWrite(projectId);
  const [sel, setSel] = useState<string[] | null>(null);
  const [base, setBase] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const init = useRef<string | null>(null);
  const s = q.data;
  useEffect(() => { if (s && init.current !== projectId) { init.current = projectId; setSel(s.providers); setBase(s.version); } }, [s, projectId]);
  if (q.isPending || (s && !sel)) return <Panel className="p-6"><LoadingBlock rows={4} /></Panel>;
  if (q.isError || !s || !sel) return <Panel>{q.unavailable ? <EmptyState title={L('Mittausasetukset eivät ole vielä käytettävissä tällä palvelimella', 'Measurement settings are not available on this server yet')} /> : <ErrorState onRetry={() => void q.refetch()} />}</Panel>;
  const stale = base !== null && base !== s.version;
  const dirty = stale || [...sel].sort().join() !== [...s.providers].sort().join();
  const est = s.prompts * sel.filter((p) => s.available.some((a) => a.provider === p)).length;
  const reload = () => { setSel(s.providers); setBase(s.version); setErr(null); };
  const save = () => {
    setErr(null);
    if (!sel.length) { setErr(L('Valitse vähintään yksi palvelu.', 'Select at least one provider.')); return; }
    write.mutate({ projectId, data: { expectedVersion: base ?? s.version, providers: sel } }, {
      onSuccess: (n) => { setSel(n.providers); setBase(n.version); toast({ title: L('Mittausasetukset tallennettu', 'Measurement settings saved') }); },
      onError: (e) => setErr(readApiError(e).status === 409 ? L('Asetuksia on muutettu muualla tai projekti on arkistoitu. Lataa uusin versio.', 'Settings changed elsewhere or the project is archived. Load the latest version.') : writeErrorMessage(e, d)),
    });
  };
  return (
    <Panel className="flex flex-col gap-4 p-5 md:p-6" aria-labelledby="ms-h">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="ms-h" className="text-[16px] font-semibold text-ink">{L('Mitattavat palvelut', 'Measured providers')}</h2>
          <p className="mt-1 text-[13px] text-muted-ink">{L('Muutos koskee vain tulevia seuranta-ajoja. Aiemmat mittaukset säilyvät alkuperäisellä koostumuksellaan.', 'Changes apply only to future monitoring runs. Past measurements keep their original composition.')}</p>
        </div>
        <span className="tabular text-[12px] text-muted-ink">v{s.version}{s.updatedAt ? ` · ${date(new Date(s.updatedAt), { dateStyle: 'medium' })}` : ''}</span>
      </div>
      {stale && <ReasonNote tone="warning"><span className="flex flex-wrap gap-2">{L('Asetuksia on muutettu muualla.', 'Settings were changed elsewhere.')}<button type="button" className="font-medium underline" onClick={reload} data-testid="button-ms-reload">{L('Lataa uusin versio', 'Load latest version')}</button></span></ReasonNote>}
      {!s.available.length ? <p className="text-sm text-muted-ink">{L('Palvelimelle ei ole määritetty mittausreittejä.', 'No measurement routes are configured on this server.')}</p> : (
        <fieldset disabled={readOnly} className="flex flex-col divide-y divide-line rounded-lg ring-1 ring-line">
          <legend className="sr-only">{L('Palvelut', 'Providers')}</legend>
          {s.available.map((a) => (
            <label key={a.provider} className="flex cursor-pointer items-start gap-3 px-3 py-3" data-testid={`row-provider-${a.provider}`}>
              <input type="checkbox" className="mt-0.5 size-4" checked={sel.includes(a.provider)} onChange={(e) => setSel(e.target.checked ? [...sel, a.provider] : sel.filter((x) => x !== a.provider))} data-testid={`checkbox-provider-${a.provider}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink"><ProviderMark provider={a.provider} /><StatusBadge tone={a.configured ? 'info' : 'warning'}>{a.configured ? L('API:n tunnus määritetty', 'API credential configured') : L('Worker-tunnusta ei vahvistettu', 'Worker credential not verified')}</StatusBadge></span>
                <span className="block font-mono text-[12px] text-muted-ink">{a.model}</span>
                <span className="block text-[12px] text-muted-ink">{a.measurementSurface === 'consumer_web' ? L('Verkkokäyttöliittymän vastaus', 'Consumer-web answer') : L('Mallin API-vastaus', 'Model API answer')}</span>
                {a.collectionEnabled === false && <span className="mt-1 block text-xs text-amber-800" data-testid={`collection-disabled-${a.provider}`}>{L('Verkkovastausten keruu on poistettu käytöstä palvelimella.', 'Web-answer collection is disabled on the server.')}</span>}
                {a.budgetConfigured === false && <span className="mt-1 block text-xs text-amber-800">{L('Keruun budjetti on määritettävä ennen käyttöönottoa.', 'A collection budget must be configured before activation.')}</span>}
                {a.provider === 'google_aio' && <span className="mt-1 block text-xs text-muted-ink">{L('Googlen hakutulosten havainto. Ei AI-yhteenvetoa ja tukematon alue eivät tarkoita nollanäkyvyyttä.', 'Google search-result observation. No AI Overview and unsupported locations are not zero visibility.')}</span>}
              </span>
            </label>))}
        </fieldset>
      )}
      <p className="text-[12px] leading-[18px] text-muted-ink">{L('Tämä API ei voi vahvistaa erillisen worker-kontin tunnuksia. Määritä tunnukset worker-kontissa; onnistuminen vahvistetaan vain uudella mittauksella.', 'This API cannot verify credentials in the separate worker container. Configure them on the worker; only a new measurement confirms successful calls.')}</p>
      <dl className="grid grid-cols-3 gap-3 text-sm" data-testid="measurement-capacity">
        <div><dt className="text-[12px] text-muted-ink">{L('Aktiiviset ei-brändätyt kysymykset', 'Active non-branded prompts')}</dt><dd className="tabular font-semibold text-ink">{num(s.prompts)}</dd></div>
        <div><dt className="text-[12px] text-muted-ink">{L('Kutsua / ajo (tallennettu)', 'Calls / run (saved)')}</dt><dd className="tabular font-semibold text-ink">{num(s.requiredCalls)}{dirty && <span className="block text-[11px] font-normal text-muted-ink">{L(`valinnalla ${num(est)}`, `with selection ${num(est)}`)}</span>}</dd></div>
        <div><dt className="text-[12px] text-muted-ink">{L('Kapasiteetti / ajo', 'Capacity / run')}</dt><dd className="tabular font-semibold text-ink">{num(s.capacity)}</dd></div>
      </dl>
      {est > s.capacity && <ReasonNote tone="warning">{L('Valinta ylittää ajokohtaisen kapasiteetin; ajo estetään.', 'The selection exceeds per-run capacity; runs will be blocked.')}</ReasonNote>}
      {err && <p className="rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger" role="alert" data-testid="text-ms-error">{err}</p>}
      <div className="flex gap-2">
        <Button disabled={readOnly || !dirty || !sel.length} loading={write.isPending} onClick={save} data-testid="button-save-providers">{L('Tallenna palvelut', 'Save providers')}</Button>
        {dirty && !stale && <Button variant="ghost" onClick={reload}>{L('Peruuta muutokset', 'Discard changes')}</Button>}
      </div>
    </Panel>
  );
}
