import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Banner, Card, Field, areaCls, inputCls, useTx } from './ui';
import { PaidButton, useOpenJob, useRunJob } from './actions';
import { useStudio } from './studio';
import { useToast } from '@/hooks/use-toast';
import { useErr } from './ui';

/** Research & brief for new content: topic, expert input, optional sources. */
export function NewContentView() {
  const s = useStudio(); const tx = useTx(); const err = useErr(); const { toast } = useToast(); const [, nav] = useLocation();
  const p = new URLSearchParams(useSearch());
  const [topic, setTopic] = useState(p.get('topic') ?? ''); const [expertise, setExpertise] = useState(''); const [instr, setInstr] = useState(''); const [urls, setUrls] = useState('');
  const [locale, setLocale] = useState<'fi' | 'en'>((s.overview.project?.promptLanguage as 'fi' | 'en') ?? 'fi');
  const { run, busy } = useRunJob(); const open = useOpenJob(); const [blank, setBlank] = useState(false);
  const input = () => ({ topic: topic.trim(), expertise, instructions: instr, locale, ...(urls.trim() ? { sourceUrls: urls.split(/\s+/).filter(Boolean) } : {}) });
  const valid = topic.trim().length > 2;
  const createBlank = async () => {
    setBlank(true);
    try { const d = await s.client.create({ title: topic.trim() || tx('Untitled', 'Nimetön'), description: '', markdown: '', locale, topic: topic.trim(), expertise }); s.refresh(); nav(s.ph(`/dashboard/content/documents/${d.id}`)); }
    catch (e) { toast({ variant: 'destructive', title: tx('Could not create', 'Luonti epäonnistui'), description: err(e) }); } finally { setBlank(false); }
  };
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <Banner>{tx('Give the model your own expertise and facts first. Anything it cannot support from sources is reported as missing information, not invented.', 'Anna mallille ensin oma asiantuntemuksesi ja faktasi. Mitä se ei voi tukea lähteillä, raportoidaan puuttuvana tietona, ei keksitä.')}</Banner>
      <Card title={tx('Research and brief', 'Tutkimus ja brief')}>
        <div className="flex flex-col gap-4">
          <Field label={tx('Topic or question', 'Aihe tai kysymys')} id="nc-topic"><input id="nc-topic" className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)} /></Field>
          <Field label={tx('Your expertise and facts', 'Oma asiantuntemus ja faktat')} hint={tx('Specific, verifiable details your readers need.', 'Tarkkoja, todennettavia tietoja lukijoillesi.')} id="nc-exp"><textarea id="nc-exp" rows={5} className={areaCls} value={expertise} onChange={(e) => setExpertise(e.target.value)} /></Field>
          <Field label={tx('Instructions (optional)', 'Ohjeet (valinnainen)')} id="nc-ins"><textarea id="nc-ins" rows={2} className={areaCls} value={instr} onChange={(e) => setInstr(e.target.value)} /></Field>
          <Field label={tx('Source URLs to compare (https, one per line, max 12)', 'Vertailtavat lähdeosoitteet (https, yksi per rivi, enintään 12)')} id="nc-urls"><textarea id="nc-urls" rows={3} className={areaCls + ' font-mono'} value={urls} onChange={(e) => setUrls(e.target.value)} /></Field>
          <Field label={tx('Language', 'Kieli')} id="nc-lang"><select id="nc-lang" className={inputCls + ' max-w-[200px]'} value={locale} onChange={(e) => setLocale(e.target.value as 'fi' | 'en')}><option value="fi">Suomi</option><option value="en">English</option></select></Field>
          <div className="flex flex-wrap gap-2">
            <PaidButton disabled={!valid || busy} onClick={async () => open(await run('research', input()))}>{tx('Research and build brief', 'Tutki ja luo brief')}</PaidButton>
            <PaidButton variant="secondary" disabled={!valid || busy} onClick={async () => open(await run('create', input()))}>{tx('Generate full draft', 'Luo koko luonnos')}</PaidButton>
            <Button variant="ghost" disabled={!s.can.edit || blank} onClick={createBlank}>{tx('Start blank document', 'Aloita tyhjä asiakirja')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
