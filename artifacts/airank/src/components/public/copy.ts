import { PublicCheckError } from '@/lib/public-check-api';
export type Loc = 'fi' | 'en';
export const C = {
  en: {
    eAi: 'AI-assisted profile suggestions are unavailable. Fill in the profile manually.', ePreview: 'The preview expired. Preview the questions again before starting.', eEmail: 'Email delivery is unavailable right now. Your result is kept; try again later.', checkBtn: 'Check my AI visibility', formNote: 'Free preview · No account required · Scan results unique to your website', noFinland: 'The market catalog does not include Finland, so the check cannot run right now.', visByModel: 'Visibility by AI model',
    title: 'Free AI visibility check', lead: 'We ask AI assistants real, neutral questions about your category and record whether your brand is mentioned. No account required.',
    website: 'Website', websiteHint: 'For example example.fi', market: 'Market', language: 'Measurement language', continue: 'Review profile', back: 'Back',
    reviewTitle: 'Review your brand profile', brand: 'Brand name', brandHint: 'Written exactly as customers see it.', aliases: 'Aliases', aliasesHint: 'Other names, one per line or comma separated.', category: 'Neutral category', categoryHint: 'Describe the category without your brand name.', domain: 'Domain',
    autofill: 'Suggest with AI', autofilling: 'Reading your site…', suggestions: 'AI suggestions', apply: 'Use suggestions', dismiss: 'Dismiss', autofillNote: 'Suggestions are only applied when you choose. Check them before continuing.',
    preview: 'Preview questions', previewing: 'Preparing preview…', previewTitle: 'Questions and AI providers', previewLead: 'These are the exact neutral questions we will ask. Your brand name is not included in them.', providers: 'AI providers',
    confirm: 'I have reviewed the profile and questions and want to start the check.', start: 'Start check', starting: 'Starting…', paidCalls: 'AI calls used for this preview: {n}',
    progress: 'Progress', answers: '{c} of {e} answers recorded', score: 'AI visibility score', outOf: 'out of {n}', na: 'N/A', mentions: 'Brand mentioned in {m} of {v} valid answers', providersDone: '{m} of {r} providers measured',
    insight: 'What the evidence shows', insMentions: 'The brand was mentioned in {m} of {v} valid answers in this sample.', insNone: 'The brand was not mentioned in any of the {v} valid answers in this sample.', insInsufficient: 'There were not enough valid answers to draw a conclusion.',
    sample: 'Model scores describe this sample only and are not a ranking of the models.', byProvider: 'By provider', models: 'Recorded models', unavailableAns: '{n} unavailable', modelUnknown: 'model not recorded',
    unsupported: 'Recommendations, rankings and competitor comparisons are not available in the free check.', fullReport: 'Full report', prompts: 'Questions and observed answers', mentioned: 'Brand mentioned', notMentioned: 'Not mentioned', unavailableObs: 'Answer unavailable', noResponse: 'No response recorded.', citations: 'Citations', owned: 'your domain',
    method: 'Methodology', started: 'Started', finished: 'Finished', statusQueued: 'Queued', statusRunning: 'Checking…', statusCompleted: 'Completed', statusPartial: 'Partial result', statusFailed: 'Failed', partialNote: 'Some answers were unavailable, so this result is partial. Unavailable answers are shown as N/A, not zero.',
    failedNote: 'The check could not be completed. No score was produced.', newCheck: 'Start a new check', copyLink: 'Report link',
    emailTitle: 'Email me this report', emailLead: 'No account is needed to receive the report.', email: 'Email address', marketing: 'Also send me occasional AI Rank product news and tips (optional, separate from the report).', marketingOff: 'Marketing emails are currently unavailable.', send: 'Send report', sending: 'Sending…', resend: 'Send again', retry: 'Try again',
    dSending: 'Sending the report…', dSent: 'Report sent. Check your inbox.', dDelivered: 'Report delivered.', dBounced: 'The email bounced. Check the address and try again.', dFailed: 'Sending failed. Your result above is kept. You can try again.', dUncertain: 'We could not confirm whether the email was sent. It was not retried automatically. Check your inbox, or choose to send again.',
    mkPending: 'Marketing subscription pending.', mkSubscribed: 'Subscribed to news.', mkFailed: 'Marketing subscription failed; the report is unaffected.', mkUnavailable: 'Marketing subscription unavailable.',
    ctaTitle: 'Track this over time', ctaBody: 'Create an AI Rank account to monitor your visibility. Optional: the report above works without one.', signup: 'Create account',
    loading: 'Loading…', capsError: 'The checker is unavailable right now.', retryBtn: 'Retry', disabled: 'The free check is currently switched off. Please try again later.',
    eBusy: 'The service is busy. Please try again in a moment.', eLimit: 'Daily or weekly check limit reached. Try again later.', eUnavail: 'The checker is unavailable right now. Please try again later.', eInvalid: 'Check the website, brand and category, then try again.', eNotFound: 'This check or report was not found or has expired.', eGeneric: 'Something went wrong. Please try again.',
    eExpired: 'This session expired. Start a new check.', invalidLink: 'This report link is invalid or has expired.', reportTitle: 'AI visibility report', reportBy: 'Evidence-based report from AI Rank', reportLead: 'An immutable snapshot. No login needed.',
    required: 'Required', domainBad: 'Enter a valid website, such as example.fi.', retryStart: 'Starting failed. Retrying uses the same request, so no duplicate check is created.',
  },
  fi: {
    eAi: 'Tekoälyavusteiset ehdotukset eivät ole käytettävissä. Täytä profiili käsin.', ePreview: 'Esikatselu vanheni. Esikatsele kysymykset uudelleen ennen käynnistystä.', eEmail: 'Sähköpostin lähetys ei ole nyt käytettävissä. Tulos säilyy; yritä myöhemmin uudelleen.', checkBtn: 'Tarkista tekoälynäkyvyyteni', formNote: 'Ilmainen esikatselu · Tiliä ei tarvita · Tulokset ovat sivustokohtaisia', noFinland: 'Markkinaluettelossa ei ole Suomea, joten tarkistusta ei voi nyt suorittaa.', visByModel: 'Näkyvyys tekoälymalleittain',
    title: 'Ilmainen tekoälynäkyvyyden tarkistus', lead: 'Kysymme tekoälyavustajilta aitoja, neutraaleja kysymyksiä kategoriastasi ja kirjaamme, mainitaanko brändisi. Tiliä ei tarvita.',
    website: 'Verkkosivusto', websiteHint: 'Esimerkiksi example.fi', market: 'Markkina', language: 'Mittauskieli', continue: 'Tarkista profiili', back: 'Takaisin',
    reviewTitle: 'Tarkista brändiprofiili', brand: 'Brändin nimi', brandHint: 'Kirjoita täsmälleen niin kuin asiakkaat sen näkevät.', aliases: 'Aliakset', aliasesHint: 'Muut nimet, yksi per rivi tai pilkulla erotettuna.', category: 'Neutraali kategoria', categoryHint: 'Kuvaa kategoria ilman brändin nimeä.', domain: 'Verkkotunnus',
    autofill: 'Ehdota tekoälyllä', autofilling: 'Luetaan sivustoa…', suggestions: 'Tekoälyn ehdotukset', apply: 'Käytä ehdotuksia', dismiss: 'Sulje', autofillNote: 'Ehdotukset otetaan käyttöön vain valinnastasi. Tarkista ne ennen jatkamista.',
    preview: 'Esikatsele kysymykset', previewing: 'Valmistellaan esikatselua…', previewTitle: 'Kysymykset ja tekoälypalvelut', previewLead: 'Nämä ovat täsmälleen ne neutraalit kysymykset, jotka esitämme. Brändisi nimeä ei ole mukana niissä.', providers: 'Tekoälypalvelut',
    confirm: 'Olen tarkistanut profiilin ja kysymykset ja haluan käynnistää tarkistuksen.', start: 'Käynnistä tarkistus', starting: 'Käynnistetään…', paidCalls: 'Esikatseluun käytetyt tekoälykutsut: {n}',
    progress: 'Eteneminen', answers: '{c} / {e} vastausta kirjattu', score: 'Tekoälynäkyvyyspisteet', outOf: '/ {n}', na: 'Ei saatavilla', mentions: 'Brändi mainittiin {m} / {v} kelvollisessa vastauksessa', providersDone: '{m} / {r} palvelua mitattu',
    insight: 'Mitä todisteet kertovat', insMentions: 'Brändi mainittiin {m} / {v} kelvollisessa vastauksessa tässä otoksessa.', insNone: 'Brändiä ei mainittu yhdessäkään {v} kelvollisesta vastauksesta tässä otoksessa.', insInsufficient: 'Kelvollisia vastauksia ei ollut riittävästi johtopäätöksiin.',
    sample: 'Mallikohtaiset pisteet kuvaavat vain tätä otosta, eivätkä ole mallien paremmuusjärjestys.', byProvider: 'Palveluittain', models: 'Kirjatut mallit', unavailableAns: '{n} ei saatavilla', modelUnknown: 'mallia ei kirjattu',
    unsupported: 'Suosituksia, sijoituksia ja kilpailijavertailuja ei ole saatavilla ilmaisessa tarkistuksessa.', fullReport: 'Koko raportti', prompts: 'Kysymykset ja havaitut vastaukset', mentioned: 'Brändi mainittu', notMentioned: 'Ei mainittu', unavailableObs: 'Vastaus ei saatavilla', noResponse: 'Vastausta ei kirjattu.', citations: 'Lähteet', owned: 'oma verkkotunnus',
    method: 'Menetelmä', started: 'Alkoi', finished: 'Päättyi', statusQueued: 'Jonossa', statusRunning: 'Tarkistetaan…', statusCompleted: 'Valmis', statusPartial: 'Osittainen tulos', statusFailed: 'Epäonnistui', partialNote: 'Osa vastauksista ei ollut saatavilla, joten tulos on osittainen. Puuttuvat vastaukset näytetään arvona ei saatavilla, ei nollana.',
    failedNote: 'Tarkistusta ei voitu suorittaa loppuun. Pisteitä ei muodostunut.', newCheck: 'Aloita uusi tarkistus', copyLink: 'Raportin linkki',
    emailTitle: 'Lähetä raportti sähköpostiin', emailLead: 'Raportin vastaanottamiseen ei tarvita tiliä.', email: 'Sähköpostiosoite', marketing: 'Lähettäkää minulle myös satunnaisesti AI Rankin uutisia ja vinkkejä (valinnainen, erillinen raportista).', marketingOff: 'Markkinointiviestit eivät ole tällä hetkellä käytettävissä.', send: 'Lähetä raportti', sending: 'Lähetetään…', resend: 'Lähetä uudelleen', retry: 'Yritä uudelleen',
    dSending: 'Raporttia lähetetään…', dSent: 'Raportti lähetetty. Tarkista postilaatikkosi.', dDelivered: 'Raportti toimitettu.', dBounced: 'Viesti palautui. Tarkista osoite ja yritä uudelleen.', dFailed: 'Lähetys epäonnistui. Tulos säilyy yllä. Voit yrittää uudelleen.', dUncertain: 'Emme voineet vahvistaa, lähtikö viesti. Sitä ei yritetty automaattisesti uudelleen. Tarkista postilaatikko tai valitse lähetä uudelleen.',
    mkPending: 'Markkinointitilaus odottaa.', mkSubscribed: 'Uutiskirje tilattu.', mkFailed: 'Markkinointitilaus epäonnistui; raportti ei vaikuta.', mkUnavailable: 'Markkinointitilaus ei ole käytettävissä.',
    ctaTitle: 'Seuraa kehitystä ajan yli', ctaBody: 'Luo AI Rank -tili seurataksesi näkyvyyttäsi. Valinnainen: yllä oleva raportti toimii ilman tiliä.', signup: 'Luo tili',
    loading: 'Ladataan…', capsError: 'Tarkistus ei ole nyt käytettävissä.', retryBtn: 'Yritä uudelleen', disabled: 'Ilmainen tarkistus on tällä hetkellä pois käytöstä. Yritä myöhemmin uudelleen.',
    eBusy: 'Palvelu on varattu. Yritä hetken kuluttua uudelleen.', eLimit: 'Päivä- tai viikkokohtainen tarkistusraja on täynnä. Yritä myöhemmin.', eUnavail: 'Tarkistus ei ole nyt käytettävissä. Yritä myöhemmin uudelleen.', eInvalid: 'Tarkista verkkosivusto, brändi ja kategoria ja yritä uudelleen.', eNotFound: 'Tarkistusta tai raporttia ei löytynyt tai se on vanhentunut.', eGeneric: 'Jokin meni pieleen. Yritä uudelleen.',
    eExpired: 'Istunto vanhentui. Aloita uusi tarkistus.', invalidLink: 'Raportin linkki on virheellinen tai vanhentunut.', reportTitle: 'Tekoälynäkyvyysraportti', reportBy: 'AI Rankin todisteisiin perustuva raportti', reportLead: 'Muuttumaton tilannekuva. Kirjautumista ei tarvita.',
    required: 'Pakollinen', domainBad: 'Anna kelvollinen verkkosivusto, esimerkiksi example.fi.', retryStart: 'Käynnistys epäonnistui. Uusinta käyttää samaa pyyntöä, joten päällekkäistä tarkistusta ei synny.',
  },
};
export type Copy = typeof C.en;
export function fmt(t: string, v: Record<string, string | number>) { return t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? '')); }
export function errText(e: unknown, c: Copy): string {
  if (!(e instanceof PublicCheckError)) return c.eGeneric;
  switch (e.code) {
    case 'INVALID_WEBSITE': return c.domainBad;
    case 'RATE_LIMIT': case 'DOMAIN_RATE_LIMIT': return c.eLimit;
    case 'AI_UNAVAILABLE': return c.eAi;
    case 'PREVIEW_EXPIRED': return c.ePreview;
    case 'EMAIL_UNAVAILABLE': return c.eEmail;
    case 'REPORT_EXPIRED': case 'REPORT_NOT_FOUND': return c.eNotFound;
    case 'APP_NOT_CONFIGURED': case 'PUBLIC_CHECK_UNAVAILABLE': return c.eUnavail;
  }
  if (e.status === 429) return c.eLimit;
  if (e.status === 404 || e.status === 401 || e.status === 403) return c.eNotFound;
  if (e.status === 409) return c.eBusy;
  if (e.status === 400 || e.status === 422) return c.eInvalid;
  if (e.status >= 500) return c.eUnavail;
  return c.eGeneric;
}
const NAMES: Record<string, string> = { openai: 'OpenAI / ChatGPT', chatgpt: 'ChatGPT', claude: 'Claude', anthropic: 'Claude', gemini: 'Gemini', grok: 'Grok', perplexity: 'Perplexity', google_aio: 'Google AI Overviews' };
export const providerName = (p: string) => NAMES[p.toLowerCase()] ?? p.replace(/[_-]/g, ' ').replace(/^./, m => m.toUpperCase());
/** Timestamps are epoch milliseconds. */
export function fmtTime(n: number | null, loc: Loc) {
  if (!n) return '—';
  return new Date(n).toLocaleString(loc === 'fi' ? 'fi-FI' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
export function normalizeDomain(raw: string): string {
  let v = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '');
  v = v.split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  if (v && !v.includes('.') && /^[a-z0-9-]+$/.test(v)) v += '.fi';
  return v;
}
export const validDomain = (d: string) => /^(?=.{4,253}$)([a-z0-9äöå](?:[a-z0-9äöå-]{0,61}[a-z0-9äöå])?\.)+[a-z]{2,}$/i.test(d);
export function safeUrl(u: string): string | null {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null; } catch { return null; }
}
