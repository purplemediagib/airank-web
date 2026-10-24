import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/airank/primitives';
import { ConnectionsPanel } from '@/components/airank/connections';
import { useToast } from '@/hooks/use-toast';
import { useStudio } from './studio';
import { Banner, Card, Field, areaCls, inputCls, useErr, useFmt, useTx } from './ui';
import { EditButton } from './actions';

const SECTIONS = ['brand', 'connections', 'access', 'automation'] as const;

export function SettingsView() {
  const tx = useTx(); const s = useStudio(); const [loc, nav] = useLocation(); const search = useSearch();
  const cur = (new URLSearchParams(search).get('section') as typeof SECTIONS[number]) || 'brand';
  const labels = { brand: tx('Brand', 'Brändi'), connections: tx('Connections', 'Yhteydet'), access: tx('Access', 'Käyttöoikeudet'), automation: tx('Automation & usage', 'Automaatio ja käyttö') };
  const go = (k: string) => { const p = new URLSearchParams(search); p.set('section', k); nav(`${loc}?${p.toString()}`, { replace: true }); };
  return (
    <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label={tx('Settings sections', 'Asetusosiot')}><ul className="flex gap-1 overflow-x-auto lg:flex-col">{SECTIONS.map((k) => <li key={k}><button type="button" aria-current={cur === k ? 'page' : undefined} onClick={() => go(k)} className={'h-11 w-full whitespace-nowrap rounded-lg px-3 text-left text-sm font-medium ' + (cur === k ? 'bg-tint text-navy' : 'text-muted-ink hover:bg-canvas')}>{labels[k]}</button></li>)}</ul></nav>
      <div className="min-w-0">
        {!s.can.manage && cur !== 'brand' && <div className="mb-3"><Banner>{tx('Only the project owner can manage this section.', 'Vain projektin omistaja voi hallita tätä osiota.')}</Banner></div>}
        {cur === 'brand' && <BrandSection />}
        {cur === 'connections' && <ConnectionsSection />}
        {cur === 'access' && (s.can.manage ? <AccessSection /> : null)}
        {cur === 'automation' && (s.can.manage ? <AutomationSection /> : null)}
      </div>
    </div>
  );
}

function BrandSection() {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast();
  const b = s.overview.brand; const ro = !s.can.manage;
  const [baseVersion, setBaseVersion] = useState(b?.version ?? 0);
  const [tone, setTone] = useState(b?.tone ?? ''); const [aud, setAud] = useState(b?.audience ?? ''); const [pc, setPc] = useState(b?.prohibitedClaims ?? '');
  const [facts, setFacts] = useState<any[]>(b?.facts ?? []); const [busy, setBusy] = useState(false);
  const upd = (i: number, k: string, v: unknown) => setFacts((x) => x.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const save = async () => {
    setBusy(true);
    try {
      const saved = await s.client.request('PUT', '/brand', { expectedVersion: baseVersion, tone, audience: aud, prohibitedClaims: pc, facts: facts.filter((f) => f.statement.trim()).map((f) => ({ id: f.id, statement: f.statement, ...(f.sourceUrl ? { sourceUrl: f.sourceUrl } : {}), verified: !!f.verified })) });
      setBaseVersion(saved.version);
      s.refresh(); toast({ title: tx('Brand settings saved', 'Brändiasetukset tallennettu') });
    } catch (e) { toast({ variant: 'destructive', title: tx('Save failed', 'Tallennus epäonnistui'), description: err(e) }); } finally { setBusy(false); }
  };
  return (
    <Card title={tx('Brand voice and facts', 'Brändin ääni ja faktat')}>
      <div className="flex flex-col gap-4">
        {ro && <Banner>{tx('Read-only. Only the owner edits brand facts.', 'Vain luku. Vain omistaja muokkaa brändifaktoja.')}</Banner>}
        <Field label={tx('Tone of voice', 'Äänensävy')} id="br-tone"><textarea id="br-tone" rows={2} readOnly={ro} className={areaCls} value={tone} onChange={(e) => setTone(e.target.value)} /></Field>
        <Field label={tx('Audience', 'Yleisö')} id="br-aud"><textarea id="br-aud" rows={2} readOnly={ro} className={areaCls} value={aud} onChange={(e) => setAud(e.target.value)} /></Field>
        <Field label={tx('Prohibited claims', 'Kielletyt väitteet')} id="br-pc"><textarea id="br-pc" rows={3} readOnly={ro} className={areaCls} value={pc} onChange={(e) => setPc(e.target.value)} /></Field>
        <div>
          <div className="flex items-center gap-2"><h3 className="flex-1 text-[14px] font-semibold">{tx('Brand facts', 'Brändifaktat')} ({facts.length}/100)</h3>{!ro && <Button size="sm" variant="secondary" disabled={facts.length >= 100} onClick={() => setFacts((x) => [...x, { id: crypto.randomUUID(), statement: '', sourceUrl: '', verified: false }])}><Plus aria-hidden /> {tx('Add fact', 'Lisää fakta')}</Button>}</div>
          {facts.length === 0 && <p className="mt-2 text-sm text-muted-ink">{tx('No facts yet. Verified facts let AI perception flag real inaccuracies.', 'Ei vielä faktoja. Varmennetut faktat mahdollistavat todellisten virheiden havaitsemisen.')}</p>}
          <ul className="mt-2 flex flex-col gap-3">{facts.map((f, i) => (
            <li key={f.id} className="rounded-lg border border-line p-3"><div className="flex flex-col gap-2">
              <textarea aria-label={tx('Fact statement', 'Faktaväite')} rows={2} readOnly={ro} maxLength={2000} className={areaCls} value={f.statement} onChange={(e) => upd(i, 'statement', e.target.value)} />
              <input aria-label={tx('Source URL', 'Lähdeosoite')} type="url" readOnly={ro} placeholder="https://" className={inputCls} value={f.sourceUrl ?? ''} onChange={(e) => upd(i, 'sourceUrl', e.target.value)} />
              <div className="flex items-center gap-3"><label className="flex flex-1 items-center gap-2 text-sm"><input type="checkbox" className="size-4" disabled={ro} checked={!!f.verified} onChange={(e) => upd(i, 'verified', e.target.checked)} />{tx('I verified this fact', 'Olen varmentanut tämän faktan')}</label>{!ro && <Button size="icon" variant="ghost" aria-label={tx('Remove fact', 'Poista fakta')} onClick={() => setFacts((x) => x.filter((_, j) => j !== i))}><Trash2 aria-hidden /></Button>}</div>
            </div></li>))}</ul>
        </div>
        {!ro && <div><Button disabled={busy} onClick={save}>{tx('Save brand settings', 'Tallenna brändiasetukset')}</Button></div>}
      </div>
    </Card>
  );
}

function ConnectionsSection() {
  const s = useStudio(); const tx = useTx();
  return (
    <div className="flex flex-col gap-5">
      {s.role === 'owner' ? <ConnectionsPanel projectId={s.projectId} readOnly={false} /> : <Card title={tx('Google connections', 'Google-yhteydet')}><p className="text-sm text-muted-ink">{tx('Google Analytics and Search Console connections are managed by the project owner.', 'Google Analytics- ja Search Console -yhteyksiä hallitsee projektin omistaja.')}</p></Card>}
      {s.can.manage ? <CmsCard /> : <Card title={tx('CMS connection', 'CMS-yhteys')}><p className="text-sm text-muted-ink">{tx('Only the owner can configure the CMS. Credentials are never shown.', 'Vain omistaja voi määrittää CMS:n. Tunnuksia ei koskaan näytetä.')}</p></Card>}
    </div>
  );
}

function CmsCard() {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast();
  const q = useQuery({ queryKey: s.key('cms'), queryFn: () => s.client.request<any>('GET', '/cms'), retry: false });
  const [type, setType] = useState<'wordpress' | 'webflow'>('wordpress');
  const [baseUrl, setBaseUrl] = useState(''); const [user, setUser] = useState(''); const [pw, setPw] = useState('');
  const [coll, setColl] = useState(''); const [tok, setTok] = useState(''); const [bodyF, setBodyF] = useState('post-body'); const [descF, setDescF] = useState('description');
  const [busy, setBusy] = useState(false); const [e, setE] = useState('');
  useEffect(() => { if (q.data?.type) setType(q.data.type); }, [q.data?.type]);
  const save = async () => {
    setBusy(true); setE('');
    try {
      const body = type === 'wordpress' ? { type, baseUrl, username: user, password: pw } : { type, collectionId: coll, token: tok, bodyField: bodyF, descriptionField: descF };
      await s.client.request('PUT', '/cms', { expectedVersion: q.data?.version ?? 0, ...body });
      setPw(''); setTok(''); setUser(''); await q.refetch(); toast({ title: tx('CMS connection saved', 'CMS-yhteys tallennettu') });
    } catch (x) { setE(err(x)); setPw(''); setTok(''); } finally { setBusy(false); }
  };
  const ok = type === 'wordpress' ? baseUrl && user && pw : /^[a-f0-9]{24}$/i.test(coll) && tok && bodyF;
  return (
    <Card title={tx('CMS connection', 'CMS-yhteys')}>
      {q.isPending ? <LoadingBlock rows={2} /> : q.isError ? <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} /> : <div className="flex flex-col gap-4">
        {q.data ? <Banner tone="success">{tx('Connected', 'Yhdistetty')}: {q.data.type}{q.data.baseUrl ? ` · ${q.data.baseUrl}` : ''}{q.data.collectionId ? ` · ${q.data.collectionId}` : ''}. {tx('Credentials are encrypted and never shown. Enter new ones to replace them.', 'Tunnukset salataan eikä niitä näytetä. Korvaa syöttämällä uudet.')}</Banner> : <Banner>{tx('No CMS connected. Manual publication works without one.', 'CMS:ää ei ole yhdistetty. Manuaalinen julkaisu toimii ilman.')}</Banner>}
        {e && <Banner tone="error">{e}</Banner>}
        <form autoComplete="off" onSubmit={(x) => { x.preventDefault(); if (ok) void save(); }} className="flex flex-col gap-4">
          <Field label={tx('CMS', 'CMS')} id="cms-type"><select id="cms-type" className={inputCls} value={type} onChange={(x) => setType(x.target.value as 'wordpress')}><option value="wordpress">WordPress</option><option value="webflow">Webflow</option></select></Field>
          {type === 'wordpress' ? <>
            <Field label={tx('Site address', 'Sivuston osoite')} id="cms-base"><input id="cms-base" type="url" className={inputCls} placeholder="https://" value={baseUrl} onChange={(x) => setBaseUrl(x.target.value)} autoComplete="off" /></Field>
            <Field label={tx('Application user', 'Sovelluskäyttäjä')} id="cms-user"><input id="cms-user" className={inputCls} value={user} onChange={(x) => setUser(x.target.value)} autoComplete="off" /></Field>
            <Field label={tx('Application password', 'Sovellussalasana')} id="cms-pw"><input id="cms-pw" type="password" className={inputCls} value={pw} onChange={(x) => setPw(x.target.value)} autoComplete="new-password" /></Field>
          </> : <>
            <Field label={tx('Collection ID (24 characters)', 'Kokoelman tunnus (24 merkkiä)')} id="cms-coll"><input id="cms-coll" className={inputCls + ' font-mono'} value={coll} onChange={(x) => setColl(x.target.value.trim())} autoComplete="off" /></Field>
            <Field label={tx('API token', 'API-avain')} id="cms-tok"><input id="cms-tok" type="password" className={inputCls} value={tok} onChange={(x) => setTok(x.target.value)} autoComplete="new-password" /></Field>
            <Field label={tx('Body field slug', 'Leipätekstikentän tunnus')} id="cms-bf"><input id="cms-bf" className={inputCls} value={bodyF} onChange={(x) => setBodyF(x.target.value)} /></Field>
            <Field label={tx('Description field slug (optional)', 'Kuvauskentän tunnus (valinnainen)')} id="cms-df"><input id="cms-df" className={inputCls} value={descF} onChange={(x) => setDescF(x.target.value)} /></Field>
          </>}
          <div><Button type="submit" disabled={busy || !ok}>{q.data ? tx('Replace connection', 'Korvaa yhteys') : tx('Save connection', 'Tallenna yhteys')}</Button></div>
        </form></div>}
    </Card>
  );
}

function AccessSection() {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast();
  const q = useQuery({ queryKey: s.key('access'), queryFn: () => s.client.request<any[]>('GET', '/access'), retry: false });
  const [email, setEmail] = useState(''); const [role, setRole] = useState('viewer'); const [busy, setBusy] = useState(false);
  const roleLabel = (r: string) => ({ viewer: tx('Viewer', 'Katselija'), editor: tx('Editor', 'Muokkaaja'), reviewer: tx('Reviewer', 'Tarkastaja'), remove: tx('Remove access', 'Poista oikeus') }[r] ?? r);
  const go = async () => {
    setBusy(true);
    try { await s.client.request('PUT', '/access', { expectedVersion: 0, email: email.trim(), role }); setEmail(''); await q.refetch(); toast({ title: tx('Access updated', 'Käyttöoikeus päivitetty') }); }
    catch (e) { toast({ variant: 'destructive', title: tx('Could not update access', 'Käyttöoikeuden päivitys epäonnistui'), description: err(e) }); } finally { setBusy(false); }
  };
  return (
    <Card title={tx('Sharing', 'Jakaminen')}>
      <div className="flex flex-col gap-4">
        <Banner>{tx('Roles apply to Content Studio only. They never grant access to monitoring data, billing or other projects. The person needs an existing AI Rank account.', 'Roolit koskevat vain Sisältöstudiota. Ne eivät anna pääsyä seurantadataan, laskutukseen tai muihin projekteihin. Henkilöllä on oltava AI Rank -tili.')}</Banner>
        {q.isPending ? <LoadingBlock rows={2} /> : q.isError ? <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} /> : (q.data ?? []).length === 0 ? <EmptyState compact title={tx('Not shared with anyone', 'Ei jaettu kenellekään')} /> : <ul className="divide-y divide-line text-sm">{q.data!.map((m) => <li key={m.user_id} className="flex justify-between py-2"><span className="font-mono text-[12px]">{m.user_id}</span><span>{roleLabel(m.role)}</span></li>)}</ul>}
        <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end" onSubmit={(x) => { x.preventDefault(); if (email) void go(); }}>
          <Field label={tx('Account email', 'Tilin sähköposti')} id="ac-mail"><input id="ac-mail" type="email" className={inputCls} value={email} onChange={(x) => setEmail(x.target.value)} /></Field>
          <Field label={tx('Role', 'Rooli')} id="ac-role"><select id="ac-role" className={inputCls} value={role} onChange={(x) => setRole(x.target.value)}>{['viewer', 'editor', 'reviewer', 'remove'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></Field>
          <Button type="submit" disabled={busy || !email}>{role === 'remove' ? tx('Remove', 'Poista') : tx('Share', 'Jaa')}</Button>
        </form>
        <p className="text-[12px] text-muted-ink">{tx('Editors can edit and run jobs; reviewers can approve and publish; viewers read only.', 'Muokkaajat voivat muokata ja ajaa töitä; tarkastajat hyväksyä ja julkaista; katselijat vain lukea.')}</p>
      </div>
    </Card>
  );
}

function AutomationSection() {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const f = useFmt(); const { toast } = useToast();
  const q = useQuery({ queryKey: s.key('automation'), queryFn: () => s.client.request<any>('GET', '/settings'), retry: false });
  const usage = useQuery({ queryKey: s.key('usage'), queryFn: () => s.client.request<any[]>('GET', '/usage'), retry: false });
  const events = useQuery({ queryKey: s.key('events'), queryFn: () => s.client.request<any[]>('GET', '/events'), retry: false });
  const [en, setEn] = useState(false); const [hours, setHours] = useState(168); const [lang, setLang] = useState<'fi' | 'en'>('fi'); const [busy, setBusy] = useState(false); const [init, setInit] = useState(false);
  const [baseVersion, setBaseVersion] = useState(0);
  useEffect(() => { if (q.isSuccess && !init) { setInit(true); if (q.data) { setBaseVersion(q.data.version); setEn(!!q.data.enabled); setHours(q.data.refreshHours ?? 168); setLang(q.data.locale ?? 'fi'); } } }, [q.isSuccess, q.data, init]);
  const save = async () => {
    setBusy(true);
    try { const saved = await s.client.request('PUT', '/settings', { expectedVersion: baseVersion, enabled: en, refreshHours: hours, locale: lang }); setBaseVersion(saved.version); await q.refetch(); toast({ title: tx('Automation saved', 'Automaatio tallennettu') }); }
    catch (e) { toast({ variant: 'destructive', title: tx('Save failed', 'Tallennus epäonnistui'), description: err(e) }); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-5">
      <Card title={tx('Recurring opportunity and impact refresh', 'Toistuva mahdollisuuksien ja vaikutuksen päivitys')}>
        {q.isPending ? <LoadingBlock rows={2} /> : q.isError ? <ErrorState body={err(q.error)} onRetry={() => void q.refetch()} /> : <div className="flex max-w-[460px] flex-col gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={en} onChange={(e) => setEn(e.target.checked)} />{tx('Refresh automatically', 'Päivitä automaattisesti')}</label>
          <Field label={tx('Interval (hours, 24–720)', 'Väli (tuntia, 24–720)')} id="au-h"><input id="au-h" type="number" min={24} max={720} className={inputCls} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></Field>
          <Field label={tx('Language of results', 'Tulosten kieli')} id="au-l"><select id="au-l" className={inputCls} value={lang} onChange={(e) => setLang(e.target.value as 'fi')}><option value="fi">Suomi</option><option value="en">English</option></select></Field>
          <p className="text-[12px] text-muted-ink">{tx('Automation only collects opportunities and impact. It never edits, approves or publishes.', 'Automaatio kerää vain mahdollisuuksia ja vaikutusta. Se ei koskaan muokkaa, hyväksy tai julkaise.')}</p>
          <div><Button disabled={busy || hours < 24 || hours > 720 || !Number.isInteger(hours)} onClick={save}>{tx('Save', 'Tallenna')}</Button></div></div>}
      </Card>
      <Card title={tx('AI usage', 'Tekoälyn käyttö')}>
        {usage.isPending ? <LoadingBlock rows={3} /> : usage.isError ? <ErrorState body={err(usage.error)} onRetry={() => void usage.refetch()} /> : (usage.data ?? []).length === 0 ? <EmptyState compact title={tx('No AI usage recorded', 'Ei kirjattua tekoälykäyttöä')} /> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[12px] uppercase text-muted-ink"><tr><th className="py-2">{tx('Day', 'Päivä')}</th><th>{tx('Calls', 'Kutsut')}</th><th>{tx('Cost (USD)', 'Kustannus (USD)')}</th><th>{tx('Estimated calls', 'Arvioidut kutsut')}</th><th>{tx('Tokens in/out', 'Tokenit sis./ulos')}</th></tr></thead>
            <tbody className="divide-y divide-line">{usage.data!.map((u) => <tr key={u.day}><td className="py-2">{u.day}</td><td>{f.n(Number(u.calls))}</td><td>{f.n(Number(u.accountedUsd), { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{Number(u.estimatedCalls) > 0 ? '*' : ''}</td><td>{f.n(Number(u.estimatedCalls))}</td><td>{f.n(Number(u.inputTokens))} / {f.n(Number(u.outputTokens))}</td></tr>)}</tbody></table>
            <p className="mt-2 text-[12px] text-muted-ink">* {tx('Includes reserved estimates for calls whose actual cost is not yet known.', 'Sisältää varausarvioita kutsuille, joiden todellista kustannusta ei vielä tiedetä.')}</p></div>)}
      </Card>
      <Card title={tx('Audit events', 'Auditointitapahtumat')}>
        {events.isPending ? <LoadingBlock rows={3} /> : events.isError ? <ErrorState body={err(events.error)} onRetry={() => void events.refetch()} /> : (events.data ?? []).length === 0 ? <EmptyState compact title={tx('No events', 'Ei tapahtumia')} /> : <ul className="max-h-[320px] divide-y divide-line overflow-auto text-sm">{events.data!.map((ev, i) => <li key={i} className="flex flex-wrap gap-x-3 py-1.5"><span className="font-mono text-[12px]">{ev.kind}</span><span className="text-[12px] text-muted-ink">{f.dt(ev.created_at)}</span></li>)}</ul>}
      </Card>
    </div>
  );
}
