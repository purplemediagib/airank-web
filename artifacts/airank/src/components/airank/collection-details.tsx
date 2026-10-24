import type { ApiObservation, CollectionEvidence, EvidenceDiagnostics } from '@workspace/api-client-react';
import { useL, safeUrl } from './analytics';

export function CollectionDetails({ collection, meta, surface, observation, collectionMethod, metricVersion }: {
  collection?: CollectionEvidence; meta?: EvidenceDiagnostics; surface?: string;
  observation?: ApiObservation; collectionMethod?: string; metricVersion?: string;
}) {
  const L = useL();
  const type = collection?.surface || meta?.measurement_surface || surface || (observation ? 'model_api' : undefined);
  if (!type && !meta?.failure_code && !collectionMethod && !metricVersion) return null;
  const refs = collection?.sourceReferences ?? [];
  const group = (kind: string) => refs.filter(r => r.kind === kind);
  const errors: Record<string, string> = {
    CONSUMER_COLLECTION_DISABLED: L('Verkkovastausten keruu on poistettu käytöstä palvelimella.', 'Web-answer collection is disabled on the server.'),
    COLLECTOR_BUDGET_NOT_CONFIGURED: L('Keruun budjettia ei ole määritetty.', 'The collection budget has not been configured.'),
    COLLECTOR_BUDGET_EXHAUSTED: L('Keruun päiväbudjetti on käytetty.', 'The daily collection budget has been reserved.'),
    UNSUPPORTED_MARKET_OR_LANGUAGE: L('Kerääjä ei tue valittua markkinaa tai kieltä. Korvaavaa sijaintia ei käytetty.', 'The collector does not support this market or language. No replacement location was used.'),
    SUBMISSION_UNKNOWN: L('Pyynnön tila on epävarma. Uutta maksullista pyyntöä ei tehty.', 'The submission outcome is uncertain. No replacement paid request was made.'),
    COLLECTOR_EXECUTION_FAILED: L('Palvelun keruupyyntö epäonnistui. Tätä ei lasketa nollatulokseksi.', 'The collection provider failed. This is not counted as a zero result.'),
    COLLECTOR_RESULT_EXPIRED: L('Palvelun vastaus vanheni ennen tallennusta.', 'The supplier result expired before it could be saved.'),
    API_BUDGET_NOT_CONFIGURED: L('API-keruun budjettia ei ole määritetty.', 'The API collection budget has not been configured.'),
    API_BUDGET_EXHAUSTED: L('API-keruun päiväbudjetti on varattu. Pyyntöä ei aloitettu.', 'The daily API collection budget has been reserved. The request was not started.'),
    API_BUDGET_ALREADY_RESERVED: L('API-pyynnön budjetti on jo varattu. Uutta maksullista pyyntöä ei aloitettu.', 'The API request budget is already reserved. No replacement paid request was started.'),
    OUTPUT_TOKEN_LIMIT: L('Vastaus saavutti tulosteen pituusrajan. Osittainen vastaus ei kelpaa valmiiksi mittaustulokseksi.', 'The answer reached the output token limit. A partial answer is not a complete measurement.'),
  };
  const failureMessage = meta?.failure_code && (errors[meta.failure_code] || (meta.failure_code.startsWith('API_BUDGET_')
    ? L('API-keruuta ei voitu tehdä turvallisesti budjettiasetusten vuoksi.', 'API collection could not proceed safely because of its budget configuration.')
    : L('Vastausta ei voitu kerätä kelvollisesti.', 'A valid answer could not be collected.')));
  return <section className="space-y-2 rounded-lg border border-line bg-canvas p-3 text-[12px]" data-testid="collection-details">
    <h3 className="font-semibold text-ink">{L('Vastauksen keruu', 'Answer collection')}</h3>
    <p data-testid="collection-surface">{type === 'consumer_web' ? L('Verkkokäyttöliittymän vastaus', 'Consumer-web answer') : type === 'model_api' ? L('Mallin API-vastaus', 'Model API answer') : type || L('Ei tallennettu', 'Not recorded')}</p>
    {meta?.failure_code && <p role="status" className="text-amber-800" data-testid="collection-error">{failureMessage} {L('Tätä ei tulkita nollatulokseksi.', 'This is not interpreted as a zero result.')} <span className="break-all font-mono text-[10px]">({meta.failure_code})</span></p>}
    {collectionMethod && <p data-testid="collection-method">{L('Keruumenetelmä', 'Collection method')}: {collectionMethod === 'complete-answer-visibility-v2' ? L('Valmiin vastauksen näkyvyys', 'Complete-answer visibility') : L('Tallennettu menetelmä', 'Recorded method')} · <span className="break-all font-mono">{collectionMethod}</span></p>}
    {metricVersion && <p data-testid="collection-metric-version">{L('Mittariversio', 'Metric version')}: <span className="break-all font-mono">{metricVersion}</span></p>}
    {observation && <div className="space-y-2" data-testid="api-observation">
      <p>{L('Havaintoversio', 'Observation version')}: <span className="break-all font-mono">{observation.version}</span></p>
      <p>{observation.complete ? L('Vastaus on valmis.', 'The answer is complete.') : L('Vastauksen valmistumista ei ole vahvistettu. Tämä ei ole nollatulos.', 'Answer completion is not confirmed. This is not a zero result.')}</p>
      {observation.citationObservation === 'unavailable'
        ? <p>{L('Viitehavainto ei ole saatavilla, ei nolla.', 'Citation observation is unavailable, not zero.')}</p>
        : <p data-testid="api-citation-count">{L('Havaittuja viite-esiintymiä', 'Observed citation occurrences')}: {observation.citationOccurrences.length}</p>}
      <p className="text-muted-ink">{L('Toistuvat URL-osoitteet säilytetään erillisinä esiintyminä. Sijainnit ovat palvelun paikallisia tekstilohkosijainteja, eivät koko vastauksen korostuksia.', 'Repeated URLs are preserved as separate occurrences. Spans are provider-local text-block offsets, NOT global answer highlights.')}</p>
      {observation.citationOccurrences.length > 0 && <details>
        <summary className="cursor-pointer font-medium text-link">{L('Viite-esiintymät', 'Citation occurrences')} ({observation.citationOccurrences.length})</summary>
        <ol className="mt-2 max-h-64 space-y-3 overflow-y-auto" data-testid="api-citation-occurrences">{observation.citationOccurrences.map((s, i) => {
          const href = safeUrl(s.url);
          return <li key={i} className="break-words">
            {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-link underline">{s.title || s.url}</a> : <span>{L('Ei linkitettävä', 'Non-linkable')}</span>}
            <span className="block break-all text-muted-ink">{L('Alkuperä', 'Provenance')}: {s.provenance}</span>
            {(s.blockIndex !== undefined || s.start !== undefined || s.end !== undefined) && <span className="block text-muted-ink">{L('Palvelun paikallinen sijainti', 'Provider-local span')}: {s.blockIndex !== undefined && `${L('Lohko', 'Block')} ${s.blockIndex} · `}{s.start ?? '–'}–{s.end ?? '–'}</span>}
          </li>;
        })}</ol>
      </details>}
      <p data-testid="api-retrieval-observation">{observation.retrievalObservation === 'unavailable' ? L('Haetut sivut eivät ole saatavilla; määrää ei päätellä viitteistä.', 'Retrieved pages are unavailable; no retrieval count is inferred from citations.') : `${L('Haettujen sivujen havaintotila', 'Retrieval observation state')}: ${observation.retrievalObservation}`}</p>
      <p data-testid="api-fanout-observation">{observation.fanoutObservation === 'unavailable' ? L('Taustahakujen määrä ei ole saatavilla; sitä ei tulkita nollaksi.', 'Search fan-out is unavailable, not zero.') : `${L('Taustahakujen havaintotila', 'Search fan-out observation state')}: ${observation.fanoutObservation}`}</p>
    </div>}
    {collection && <>
      <p>{L('Pyydetty markkina ja kieli', 'Requested market and language')}: {collection.requestedMarket} · {collection.requestedLanguage}</p>
      <p className="text-muted-ink">{collection.locationVerification === 'vendor_reported'
        ? L('Palvelu ilmoitti sijaintikoodin. Sijaintia ei ole vahvistettu riippumattomasti.', 'The supplier reported a location code; location is not independently verified.')
        : L('Fyysistä keruusijaintia ei ole vahvistettu.', 'The physical collection location is not verified.')}</p>
      {!collection.modelVersionVerified && <p className="text-muted-ink">{L('Tarkkaa malliversiota ei ole vahvistettu.', 'The exact model version is not verified.')}</p>}
      <p data-testid="collection-source-summary">{group('citation').length} {L('viitelinkkiä', 'answer reference links')} · {group('source_reference').length} {L('palvelun lähdeviitettä', 'supplier source entries')} · {group('retrieval').length} {L('hakutulosta', 'retrieved results')}</p>
      {collection.citationObservation === 'unavailable' && <p className="text-muted-ink">{L('Lähdeviitteitä ei voi luotettavasti tulkita suoriksi lainauksiksi. Lainausmittaria ei merkitä nollaksi.', 'Source entries cannot be reliably classified as explicit citations. Citation coverage is unavailable, not zero.')}</p>}
      {(['citation', 'source_reference', 'retrieval'] as const).map(kind => group(kind).length > 0 && <details key={kind}>
        <summary className="cursor-pointer font-medium text-link">{kind === 'citation' ? L('Vastauksen viitteet', 'Answer references') : kind === 'source_reference' ? L('Palvelun lähdeviitteet', 'Supplier source entries') : L('Haetut sivut', 'Retrieved pages')} ({group(kind).length})</summary>
        <ol className="mt-2 max-h-64 space-y-3 overflow-y-auto">{group(kind).map((s, i) => {
          const href = safeUrl(s.url);
          return <li key={`${kind}-${i}`} className="break-words">
            {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-link underline">{s.title || s.url}</a> : <span>{L('Ei linkitettävä', 'Non-linkable')}</span>}
            {s.occurrences !== undefined && <span className="ml-1 text-muted-ink">· {s.occurrences} {L('viittausta', 'occurrences')}</span>}
            {s.passage && <blockquote className="mt-1 border-l-2 border-line pl-2 text-muted-ink">{s.passage}</blockquote>}
          </li>;
        })}</ol>
      </details>)}
      <p className="text-muted-ink">{L('Luvut sisältävät eri viitetyyppejä ja toistuvia esiintymiä; niitä ei summata yhdeksi mittariksi.', 'These counts describe different evidence types and repeated occurrences; they are not added into one metric.')}</p>
      {collection.searchQueries === null ? <p className="text-muted-ink">{L('Taustahakukyselyt eivät ole saatavilla.', 'Background search queries are unavailable.')}</p>
        : !!collection.searchQueries?.length && <details><summary className="cursor-pointer text-link">{L('Taustahakukyselyt', 'Background search queries')} ({collection.searchQueries.length})</summary><ul className="mt-2 space-y-1 break-words">{collection.searchQueries.map((q, i) => <li key={i}>{typeof q === 'string' ? q : JSON.stringify(q)}</li>)}</ul></details>}
    </>}
  </section>;
}
