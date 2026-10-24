import type { ReportDetail } from '@workspace/api-client-react';
import { toMs } from './use-analytics';

type Lang = 'fi' | 'en';
const t = (l: Lang, fi: string, en: string) => (l === 'fi' ? fi : en);
const iso = (n: number) => new Date(toMs(n)).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

/** Quote every cell; neutralise spreadsheet formulas even after leading whitespace. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(r: ReportDetail): string {
  const head = ['evidence_id', 'run_id', 'observed_at_utc', 'provider', 'model', 'route', 'prompt_id', 'prompt_version', 'prompt_text_fi', 'status', 'in_metrics', 'exclusion', 'mentioned', 'position', 'recommendation', 'owned_citation', 'citations', 'answer_fi'];
  const rows = r.snapshot.analytics.evidence.map((e) => [e.id, e.runId, iso(e.observedAt), e.provider, e.model, e.route ?? '', e.promptId, e.promptVersion, e.text, e.status, e.exclusion === null ? 'yes' : 'no', e.exclusion ?? '', e.mentioned ? 'yes' : 'no', e.position ?? '', e.recommendation, e.ownedCitation ? 'yes' : 'no', e.citations.join(' | '), e.answer]);
  const fi=r.snapshot.locale==='fi';
  const localizedHead=fi?['todiste_id','ajo_id','havaittu_utc','palvelu','malli','reitti','kysymys_id','kysymysversio','kysymys_suomeksi','tila','mukana_mittareissa','poissulkeminen','mainittu','sijoitus','suositus','oma_lähdeviittaus','lähteet','alkuperäinen_vastaus']:head;
  const metaHead=fi?['raportin_nimi','kaikki_vastaavat_rivit_osioista_riippumatta','menetelmä','poimintaversio','raportin_kieli','markkina','mittauskieli','aikavyöhyke','kelvolliset','odotetut','näkyvyys_prosenttia']:['report_title','all_matching_rows_regardless_of_sections','methodology','extraction_version','report_locale','market','measurement_language','timezone','eligible','expected','visibility_percent'];
  const s=r.snapshot,m=s.analytics.metrics;
  const meta=[s.title??'',fi?'kyllä':'yes',s.analytics.methodology,s.analytics.extractionVersion,s.locale,s.market,s.measurementLanguage,s.timezone,m.eligible,m.expected,m.visibility];
  return '\uFEFF' + [[...localizedHead,...metaHead], ...rows.map(row=>[...row,...meta])].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadBlob(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const slug = (x: string) => x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export const reportFileName = (r: ReportDetail, ext: string) => `${slug(r.title ?? '') || 'airank-report'}-${new Date(toMs(r.createdAt)).toISOString().slice(0, 10)}-${r.id.slice(0, 8)}.${ext}`;

/** PDF built in the browser from the fetched snapshot. Helvetica (WinAnsi) covers Finnish å ä ö. */
export async function buildPdf(r: ReportDetail): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const l: Lang = r.snapshot.locale === 'en' ? 'en' : 'fi';
  const pct=(v:number|null|undefined)=>v==null?'–':`${v.toLocaleString(l==='fi'?'fi-FI':'en-GB',{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
  const recommendation=(v:string)=>v==='recommended'?t(l,'Suositeltu','Recommended'):v==='not_recommended'?t(l,'Ei suositeltu','Not recommended'):t(l,'Ei luokiteltu','Unknown');
  const s = r.snapshot, a = s.analytics, m = a.metrics;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), M = 40;
  const navy: [number, number, number] = [16, 37, 66];
  let y = M;
  const brand = String((s.identity as Record<string, unknown>).brandName ?? '');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...navy);
  const sec = new Set(s.sections ?? ['overview', 'cohort', 'questions']);
  const title = doc.splitTextToSize(s.title || 'AI Rank', W - 2 * M);
  doc.text(title, M, y + 8); y += 22 * title.length;
  doc.setFontSize(11); doc.text(`${brand}${(s.identity as Record<string, unknown>).ownedDomains ? ` · ${((s.identity as Record<string, unknown>).ownedDomains as string[]).join(', ')}` : ''}`, M, y + 4); y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
  const f = s.filters;
  const meta = [
    `${t(l, 'Luotu', 'Created')}: ${iso(r.createdAt)} · ${t(l, 'Vanhenee', 'Expires')}: ${iso(r.expiresAt)}`,
    `${t(l, 'Markkina', 'Market')}: ${s.market} · ${t(l, 'Mittauskieli', 'Measurement language')}: ${s.measurementLanguage} · ${t(l, 'Aikavyöhyke', 'Time zone')}: ${s.timezone}`,
    `${t(l, 'Suodattimet', 'Filters')}: ${f.from ?? '–'} – ${f.to ?? '–'} · ${t(l, 'Palvelu', 'Provider')}: ${f.provider ?? t(l, 'kaikki', 'all')} · ${t(l, 'Aihe', 'Topic')}: ${f.topic ?? t(l, 'kaikki', 'all')}${f.group ? ` · ${t(l, 'Ryhmä', 'Group')}: ${f.group}` : ''}${f.runId ? ` · Run: ${f.runId}` : ''}`,
    `${t(l, 'Menetelmä', 'Methodology')}: ${a.methodology} · ${t(l, 'Poiminta', 'Extraction')}: ${a.extractionVersion} · ${s.schemaVersion}`,
  ];
  meta.forEach((x) => { const lines=doc.splitTextToSize(x,W-2*M);doc.text(lines,M,y);y+=13*lines.length; });
  y += 6;
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: navy },
    head: [[t(l, 'Mittari', 'Metric'), t(l, 'Arvo', 'Value'), t(l, 'Määritelmä', 'Definition')]],
    body: [
      [t(l,'Näkyvyyspisteet','Visibility score'),m.score==null?'–':`${m.score.toLocaleString(l==='fi'?'fi-FI':'en-GB')} / 10`,t(l,'Näkyvyysprosentti jaettuna kymmenellä','Visibility percentage divided by ten')],
      [t(l, 'Näkyvyys', 'Visibility'), pct(m.visibility), t(l, 'Brändin maininnat / kelvolliset vastaukset', 'Brand mentions / valid answers')],
      [t(l, 'Suositusosuus', 'Recommendation rate'), pct(m.recommendationRate), t(l, 'Suositellut / luokitellut vastaukset', 'Recommended / classified answers')],
      [t(l, 'Omat lähdeviittaukset', 'Owned citations'), pct(m.citationRate), t(l, 'Vastaukset, jotka viittaavat omaan verkkotunnukseen / kelvolliset', 'Answers citing an owned domain / valid')],
      [t(l, 'Osuus kilpailijaryhmästä', 'Cohort share'), pct(m.cohortShare), t(l, 'Brändin maininnat / kohortin maininnat', 'Brand mentions / cohort mentions')],
      [t(l, 'Kattavuus', 'Coverage'), `${m.eligible} / ${m.expected}`, t(l, 'Kelvolliset / odotetut vastaukset', 'Valid / expected answers')],
      [t(l, 'Ajot', 'Runs'), String(a.runs.filter(r=>r.group===a.selectedGroup&&(!f.runId||r.id===f.runId)).length), t(l, 'Valitun ryhmän seuranta-ajot; eri koostumuksia ei yhdistetä', 'Monitoring runs in the selected group; compositions are never combined')],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  if (sec.has('overview')) {
  // Trend: only real runs with a non-null visibility; no interpolated points.
  const pts = a.runs.filter((x) => x.group===a.selectedGroup&&x.kind==='neutral'&&(!f.runId||x.id===f.runId)&&x.metrics.visibility !== null).map((x) => ({ t: toMs(x.createdAt), v: x.metrics.visibility as number })).sort((p, q) => p.t - q.t);
  if(y+165>doc.internal.pageSize.getHeight()-40){doc.addPage();y=M;}
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy);
  doc.text(t(l, 'Näkyvyys ajoittain', 'Visibility by run'), M, y); y += 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90);
  if (pts.length < 2) { doc.text(t(l, 'Trendiä ei piirretä: alle kaksi mitattua ajoa.', 'No trend drawn: fewer than two measured runs.'), M, y + 12); y += 30; }
  else {
    const h = 110, w = W - 2 * M - 30, x0 = M + 30, y0 = y + 6;
    const scale = 100; // metrics are percentages 0–100
    doc.setDrawColor(210); [0, 0.5, 1].forEach((k) => { const yy = y0 + h - k * h; doc.line(x0, yy, x0 + w, yy); doc.text(`${Math.round(k * 100)} %`, M, yy + 3); });
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const xy = (p: { t: number; v: number }) => [x0 + ((p.t - t0) / Math.max(1, t1 - t0)) * w, y0 + h - (p.v / scale) * h] as const;
    doc.setDrawColor(...navy); doc.setLineWidth(1.4);
    for (let i = 1; i < pts.length; i++) { if(Math.floor(pts[i].t/86400000)-Math.floor(pts[i-1].t/86400000)>1)continue;const [ax, ay] = xy(pts[i - 1]); const [bx, by] = xy(pts[i]); doc.line(ax, ay, bx, by); }
    doc.setFillColor(...navy); pts.forEach((p) => { const [px, py] = xy(p); doc.circle(px, py, 2, 'F'); });
    doc.setLineWidth(0.5);
    doc.text(iso(t0).slice(0, 10), x0, y0 + h + 12); doc.text(iso(t1).slice(0, 10), x0 + w, y0 + h + 12, { align: 'right' });
    y = y0 + h + 28;
  }

  if (a.providers.length) {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: 'striped', styles: { font: 'helvetica', fontSize: 9 }, headStyles: { fillColor: navy },
      head: [[t(l, 'Palvelu', 'Provider'), t(l, 'Näkyvyys', 'Visibility'), t(l, 'Kattavuus', 'Coverage')]],
      body: a.providers.map((p) => [p.provider, pct(p.metrics.visibility), `${p.metrics.eligible} / ${p.metrics.expected}`]),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }
  }

  // Cohort: authoritative identities frozen in run snapshots; no invented historical competitor metrics.
  if (sec.has('cohort')) {
    const brands = new Map<string, { name: string; aliases: string[]; domains: string[] }>();
    for (const rs of s.runSnapshots ?? []) {
      const list = ((rs.snapshot as { cohort?: { brands?: unknown } })?.cohort?.brands ?? []) as Array<Record<string, unknown>>;
      if (!Array.isArray(list)) continue;
      for (const b of list) { const name = String(b.name ?? b.brandName ?? ''); if (!name) continue; brands.set(String(b.id ?? name), { name, aliases: Array.isArray(b.aliases) ? b.aliases.map(String) : [], domains: Array.isArray(b.domains) ? b.domains.map(String) : Array.isArray(b.ownedDomains) ? b.ownedDomains.map(String) : [] }); }
    }
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: 'striped', styles: { font: 'helvetica', fontSize: 9, overflow: 'linebreak' }, headStyles: { fillColor: navy },
      head: [[t(l, 'Vertailukohortti (ajojen tilannekuvista)', 'Comparison cohort (from run snapshots)'), t(l, 'Aliakset', 'Aliases'), t(l, 'Verkkotunnukset', 'Domains')]],
      body: brands.size ? [...brands.values()].map((b) => [b.name, b.aliases.join(', ') || '–', b.domains.join(', ') || '–']) : [[t(l, 'Ajoissa ei ollut tallennettua kilpailijakohorttia.', 'No competitor cohort was stored with these runs.'), '', '']],
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFontSize(8); doc.setTextColor(90); doc.text(t(l, `Kohortin osuus: ${pct(m.cohortShare)} (${m.cohortMentions} kohortin mainintaa).`, `Cohort share: ${pct(m.cohortShare)} (${m.cohortMentions} cohort mentions).`), M, y + 8); y += 22;
  }

  if (sec.has('questions')) {
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', valign: 'top' }, headStyles: { fillColor: navy },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 70 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 70 } },
    head: [[t(l, 'Havaittu (UTC)', 'Observed (UTC)'), t(l, 'Palvelu / malli', 'Provider / model'), t(l, 'Kysymys', 'Prompt'), t(l, 'Tulos', 'Result')]],
    body: a.evidence.map((e) => [iso(e.observedAt), `${e.provider}\n${e.model}`, `${e.text} (v${e.promptVersion})`,
      e.exclusion !== null ? `${t(l, 'Poissuljettu', 'Excluded')}: ${e.exclusion}` : `${e.mentioned ? t(l, 'Mainittu', 'Mentioned') : t(l, 'Ei mainintaa', 'Not mentioned')}${e.position !== null ? ` #${e.position}` : ''}\n${recommendation(e.recommendation)}${e.ownedCitation ? `\n${t(l, 'Oma lähde', 'Owned source')}` : ''}`]),
  });
  }
  if (sec.has('questions') && !a.evidence.length) { doc.setFontSize(9); doc.text(t(l, 'Ei vastauksia valituilla suodattimilla.', 'No answers for the selected filters.'), M, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14); }
  const pages=doc.getNumberOfPages();
  for(let n=1;n<=pages;n++){doc.setPage(n);doc.setFontSize(8);doc.setTextColor(120);doc.text(`${t(l,'API-pohjaisia havaintoja, ei kuluttajasovellusten sijoituksia.','API-based observations, not consumer-app rankings.')} · ${t(l,'Sivu','Page')} ${n} / ${pages}`,M,doc.internal.pageSize.getHeight()-20);}
  return doc.output('blob');
}
