const en = {
  tab: 'Connections', title: 'Google connections', intro: 'Connect Google Analytics 4 and Search Console for this project. Each connection is independent.',
  ga4: 'Google Analytics 4', gsc: 'Google Search Console',
  ga4Body: 'Imports sessions from identified AI referral sources. This is not all AI traffic and not prompt-level attribution.',
  gscBody: 'Imports Google Search performance for the selected property.',
  setupNeeded: 'Setup needed', setupBody: 'Google connections are not configured on this server yet. Ask the administrator to finish setup.',
  disconnected: 'Not connected', connected: 'Connected', reconnect: 'Reconnect required',
  authorizedNoImport: 'Authorized · import not complete', authorizedImportFailed: 'Authorized · import failed',
  authorizedNoProperty: 'Authorized, no property', propertyNoImport: 'Property set, not imported', importedReady: 'Imported and ready',
  reconnectBody: 'Google access expired or was removed. Reconnect to continue importing.',
  connect: 'Connect Google', reconnectBtn: 'Reconnect', connecting: 'Redirecting', disconnect: 'Disconnect', sync: 'Sync now', syncing: 'Syncing',
  account: 'Google account', property: 'Property', timeZone: 'Time zone', currency: 'Currency', connectedAt: 'Connected',
  chooseProperty: 'Choose a property', save: 'Save and import', saving: 'Saving', noProperties: 'This Google account has no properties available for this service.',
  replaceProperty: 'Selecting a different property deletes the previously imported report data for this connection and starts a new import.',
  propsFailed: 'Properties could not be loaded.', retry: 'Retry', changeProp: 'Change property',
  syncStatus: 'Import', progress: '{done} of {total} days', completedAt: 'Completed', lastError: 'The last import attempt failed.',
  s_queued: 'Queued', s_running: 'Running', s_retrying: 'Retrying', s_completed: 'Completed', s_failed: 'Failed', s_idle: 'Idle',
  loadFailed: 'Connection status could not be loaded.', actionFailed: 'The action failed. Please try again.',
  archived: 'This project is archived. Connection changes are disabled.',
  cancelled: 'Google authorisation was cancelled. Connection status below is the current state.',
  mismatch: 'The Google return did not match the project you started from. The connector may already have changed the original project. Switch back to the original project and check its connections.',
  discTitle: 'Disconnect {service}?', discBody: 'This deletes the imported data and the stored credentials for this project. It does not revoke the grant in your Google account; remove it in your Google account security settings if you want that.',
  discConfirm: 'Disconnect and delete data', disconnectedOk: 'Disconnected. Imported data and stored credentials were deleted.',
  reports: 'Cached report', showReports: 'Show cached report', hideReports: 'Hide report',
  reportNote: 'Shows data already imported. Opening it does not fetch from Google.',
  ga4Note: 'Identified AI referrals only. Not all AI traffic and not prompt attribution.',
  gscNote: 'Google Search only (AI Overviews are not separated). Totals come from the totals view, not summed queries; rates are as reported.',
  from: 'From', to: 'To', view: 'View', rangeBad: 'Choose a valid range of at most 366 days.',
  v_sources: 'Sources', v_pages: 'Pages', v_countries: 'Countries', v_devices: 'Devices', v_totals: 'Totals', v_queries: 'Queries',
  prev: 'Previous', next: 'Next', rows: '{from}-{to} of {total}', noRows: 'No cached rows for this range.', reportFailed: 'The report could not be loaded.',
  meta: 'Data quality', metaTz: 'Report time zone', metaCur: 'Currency', available: 'Available dates', missing: 'Missing dates', partial: 'Partial data', none: 'none',
  notes: 'Notes', details: 'Details',
  flagPartial: 'Partial data: some dates in this range have not been imported.', flagTruncated: 'Truncated: Google returned only part of the rows for at least one day.', flagSampling: 'Sampled: Google estimated some values from a data sample.', flagThreshold: 'Thresholded: Google withheld some rows to protect user privacy.',
  setupGuide: 'The Google connector is not available yet. Setup must be completed by the administrator; try again later.',
  s_complete: 'Complete', rawDetails: 'Raw metadata',
  c_date: 'Date', c_source: 'Source', c_sourceMedium: 'Source / medium', c_medium: 'Medium', c_page: 'Page', c_landingPage: 'Landing page', c_country: 'Country', c_device: 'Device', c_deviceCategory: 'Device', c_query: 'Search query',
  c_aiAssistant: 'AI assistant', c_sessionSource: 'Session source', c_sessionMedium: 'Session medium', c_landingPagePlusQueryString: 'Landing page + query string', c_engagementRate: 'Engagement rate', c_sessionKeyEventRate: 'Session key event rate', c_totalRevenue: 'Total revenue',
  c_sessions: 'Sessions', c_users: 'Users', c_activeUsers: 'Active users', c_engagedSessions: 'Engaged sessions', c_conversions: 'Conversions', c_keyEvents: 'Key events', c_revenue: 'Revenue', c_clicks: 'Clicks', c_impressions: 'Impressions', c_ctr: 'Click-through rate', c_position: 'Average position',
  gscScope: 'Google Search performance only. Google does not separate AI Overviews in this data.',
};
const fi: typeof en = {
  tab: 'Yhteydet', title: 'Google-yhteydet', intro: 'Yhdistä Google Analytics 4 ja Search Console tähän projektiin. Yhteydet ovat toisistaan riippumattomia.',
  ga4: 'Google Analytics 4', gsc: 'Google Search Console',
  ga4Body: 'Tuo istunnot tunnistetuista tekoälyviittauksista. Tämä ei ole kaikki tekoälyliikenne eikä kehotekohtaista attribuutiota.',
  gscBody: 'Tuo Google-haun suorituskyvyn valitulle ominaisuudelle.',
  setupNeeded: 'Asetus tarvitaan', setupBody: 'Google-yhteyksiä ei ole vielä määritetty tällä palvelimella. Pyydä ylläpitäjää viimeistelemään asetukset.',
  disconnected: 'Ei yhdistetty', connected: 'Yhdistetty', reconnect: 'Yhdistä uudelleen',
  authorizedNoImport: 'Valtuutettu · tuonti kesken', authorizedImportFailed: 'Valtuutettu · tuonti epäonnistui',
  authorizedNoProperty: 'Valtuutettu, ei ominaisuutta', propertyNoImport: 'Ominaisuus valittu, ei tuontia', importedReady: 'Tuotu ja valmis',
  reconnectBody: 'Google-käyttöoikeus vanheni tai poistettiin. Yhdistä uudelleen jatkaaksesi tuontia.',
  connect: 'Yhdistä Google', reconnectBtn: 'Yhdistä uudelleen', connecting: 'Ohjataan', disconnect: 'Katkaise yhteys', sync: 'Synkronoi nyt', syncing: 'Synkronoidaan',
  account: 'Google-tili', property: 'Ominaisuus', timeZone: 'Aikavyöhyke', currency: 'Valuutta', connectedAt: 'Yhdistetty',
  chooseProperty: 'Valitse ominaisuus', save: 'Tallenna ja tuo', saving: 'Tallennetaan', noProperties: 'Tällä Google-tilillä ei ole tähän palveluun käytettävissä olevia ominaisuuksia.',
  replaceProperty: 'Eri ominaisuuden valinta poistaa yhteyden aiemmin tuodut raporttitiedot ja aloittaa uuden tuonnin.',
  propsFailed: 'Ominaisuuksia ei voitu ladata.', retry: 'Yritä uudelleen', changeProp: 'Vaihda ominaisuutta',
  syncStatus: 'Tuonti', progress: '{done} / {total} päivää', completedAt: 'Valmistui', lastError: 'Viimeisin tuontiyritys epäonnistui.',
  s_queued: 'Jonossa', s_running: 'Käynnissä', s_retrying: 'Yritetään uudelleen', s_completed: 'Valmis', s_failed: 'Epäonnistui', s_idle: 'Odottaa',
  loadFailed: 'Yhteyden tilaa ei voitu ladata.', actionFailed: 'Toiminto epäonnistui. Yritä uudelleen.',
  archived: 'Projekti on arkistoitu. Yhteyksien muutokset on poistettu käytöstä.',
  cancelled: 'Google-valtuutus peruttiin. Alla oleva yhteyden tila on nykyinen tila.',
  mismatch: 'Google-paluu ei vastannut projektia, josta aloitit. Yhteyspalvelu on voinut jo muuttaa alkuperäistä projektia. Vaihda takaisin alkuperäiseen projektiin ja tarkista sen yhteydet.',
  discTitle: 'Katkaistaanko yhteys: {service}?', discBody: 'Tämä poistaa tuodut tiedot ja tallennetut tunnistetiedot tästä projektista. Se ei peruuta käyttöoikeutta Google-tililläsi; poista se Google-tilin suojausasetuksista, jos haluat.',
  discConfirm: 'Katkaise ja poista tiedot', disconnectedOk: 'Yhteys katkaistu. Tuodut tiedot ja tunnistetiedot poistettiin.',
  reports: 'Välimuistissa oleva raportti', showReports: 'Näytä raportti', hideReports: 'Piilota raportti',
  reportNote: 'Näyttää jo tuodut tiedot. Avaaminen ei hae tietoja Googlesta.',
  ga4Note: 'Vain tunnistetut tekoälyviittaukset. Ei kaikki tekoälyliikenne eikä kehotekohtaista attribuutiota.',
  gscNote: 'Vain Google-haku (tekoälytiivistelmiä ei erotella). Summat tulevat totals-näkymästä, ei laskettuina kyselyistä; suhdeluvut sellaisenaan.',
  from: 'Alkaen', to: 'Asti', view: 'Näkymä', rangeBad: 'Valitse kelvollinen enintään 366 päivän jakso.',
  v_sources: 'Lähteet', v_pages: 'Sivut', v_countries: 'Maat', v_devices: 'Laitteet', v_totals: 'Yhteensä', v_queries: 'Kyselyt',
  prev: 'Edellinen', next: 'Seuraava', rows: '{from}-{to} / {total}', noRows: 'Valitulla jaksolla ei ole tallennettuja rivejä.', reportFailed: 'Raporttia ei voitu ladata.',
  meta: 'Tietojen laatu', metaTz: 'Raportin aikavyöhyke', metaCur: 'Valuutta', available: 'Saatavilla olevat päivät', missing: 'Puuttuvat päivät', partial: 'Osittaiset tiedot', none: 'ei mitään',
  notes: 'Huomiot', details: 'Tiedot',
  flagPartial: 'Osittaiset tiedot: osaa jakson päivistä ei ole vielä tuotu.', flagTruncated: 'Katkaistu: Google palautti vain osan riveistä vähintään yhdeltä päivältä.', flagSampling: 'Otanta: Google arvioi osan arvoista datanäytteestä.', flagThreshold: 'Kynnysrajaus: Google jätti osan riveistä pois käyttäjien yksityisyyden suojaamiseksi.',
  setupGuide: 'Google-yhteyspalvelu ei ole vielä käytettävissä. Ylläpitäjän on viimeisteltävä asetukset; yritä myöhemmin uudelleen.',
  s_complete: 'Valmis', rawDetails: 'Raakametatiedot',
  c_date: 'Päivä', c_source: 'Lähde', c_sourceMedium: 'Lähde / väline', c_medium: 'Väline', c_page: 'Sivu', c_landingPage: 'Laskeutumissivu', c_country: 'Maa', c_device: 'Laite', c_deviceCategory: 'Laite', c_query: 'Hakulause',
  c_aiAssistant: 'Tekoälyavustaja', c_sessionSource: 'Istunnon lähde', c_sessionMedium: 'Istunnon väline', c_landingPagePlusQueryString: 'Laskeutumissivu + kyselymerkkijono', c_engagementRate: 'Sitoutumisaste', c_sessionKeyEventRate: 'Istuntojen avaintapahtuma-aste', c_totalRevenue: 'Kokonaistulot',
  c_sessions: 'Istunnot', c_users: 'Käyttäjät', c_activeUsers: 'Aktiiviset käyttäjät', c_engagedSessions: 'Sitoutuneet istunnot', c_conversions: 'Konversiot', c_keyEvents: 'Avaintapahtumat', c_revenue: 'Tulot', c_clicks: 'Klikkaukset', c_impressions: 'Näyttökerrat', c_ctr: 'Klikkausprosentti', c_position: 'Keskimääräinen sijainti',
  gscScope: 'Vain Google-haun suorituskyky. Google ei erottele tekoälytiivistelmiä (AI Overviews) tässä datassa.',
};
export const connectionsCopy = { en, fi };
const importErrors: Record<string, { en: string; fi: string }> = {
  GOOGLE_RECONNECT_REQUIRED: { en: 'Google authorization expired or was revoked. Reconnect this account.', fi: 'Google-valtuutus vanheni tai peruttiin. Yhdistä tili uudelleen.' },
  GOOGLE_API_DISABLED: { en: 'Google reports that the required API is disabled. Ask the connector administrator to enable it in its Google Cloud project.', fi: 'Googlen mukaan tarvittava API ei ole käytössä. Pyydä yhteyspalvelun ylläpitäjää ottamaan se käyttöön Google Cloud -projektissa.' },
  GOOGLE_SCOPE_REQUIRED: { en: 'Google reports a missing permission scope. Reconnect and grant the requested read-only access.', fi: 'Googlen mukaan tarvittava käyttöoikeus puuttuu. Yhdistä uudelleen ja myönnä pyydetty lukuoikeus.' },
  GOOGLE_QUOTA_LIMIT: { en: 'Google limited the requests. Wait for the quota to recover before retrying the import.', fi: 'Google rajoitti pyyntöjä. Odota kiintiön palautumista ennen tuonnin uutta yritystä.' },
  GOOGLE_ACCESS_DENIED: { en: 'Google denied access. Check the selected property permissions and the connector configuration; the precise cause is not yet confirmed.', fi: 'Google esti pääsyn. Tarkista valitun ominaisuuden käyttöoikeudet ja yhteyspalvelun asetukset. Tarkka syy ei ole vielä varmistunut.' },
  GOOGLE_REPORT_INVALID: { en: 'Google rejected the report request. The connector administrator should check the report dimensions, metrics and property configuration.', fi: 'Google hylkäsi raporttipyynnön. Yhteyspalvelun ylläpitäjän tulee tarkistaa raportin dimensiot, mittarit ja ominaisuuden asetukset.' },
  GOOGLE_PROPERTY_NOT_FOUND: { en: 'Google could not find the requested resource. Check that the selected property is still accessible.', fi: 'Google ei löytänyt pyydettyä resurssia. Tarkista, että valittu ominaisuus on edelleen käytettävissä.' },
  GOOGLE_TEMPORARILY_UNAVAILABLE: { en: 'Google is temporarily unavailable. Retry after the service recovers.', fi: 'Google ei ole tilapäisesti käytettävissä. Yritä uudelleen palvelun palauduttua.' },
  GOOGLE_IMPORT_FAILED: { en: 'The import failed without a specific diagnostic. Ask the connector administrator to install diagnostic support before retrying. This does not prove a permissions or quota problem.', fi: 'Tuonti epäonnistui ilman tarkempaa virhetietoa. Pyydä yhteyspalvelun ylläpitäjää asentamaan diagnostiikkatuki ennen uutta yritystä. Tämä ei osoita käyttöoikeus- tai kiintiöongelmaa.' },
};
const diagnosticCategories: Record<string, string> = {
  authentication: 'GOOGLE_RECONNECT_REQUIRED', permission: 'GOOGLE_ACCESS_DENIED', api_disabled: 'GOOGLE_API_DISABLED',
  quota: 'GOOGLE_QUOTA_LIMIT', invalid_request: 'GOOGLE_REPORT_INVALID', report_incompatible: 'GOOGLE_REPORT_INVALID',
  unavailable: 'GOOGLE_TEMPORARILY_UNAVAILABLE', transport: 'GOOGLE_TRANSPORT_FAILED', invalid_response: 'GOOGLE_RESPONSE_INVALID', unknown: 'GOOGLE_IMPORT_FAILED',
};
const diagnosticStatuses = new Set(['UNAUTHENTICATED', 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED', 'INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'NOT_FOUND', 'UNAVAILABLE', 'INTERNAL', 'DEADLINE_EXCEEDED', 'UNKNOWN']);
const diagnosticReasons = new Set(['invalid_grant', 'SERVICE_DISABLED', 'API_DISABLED', 'ACCESS_TOKEN_EXPIRED', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'INSUFFICIENT_PERMISSIONS', 'RATE_LIMIT_EXCEEDED', 'QUOTA_EXCEEDED', 'DAILY_LIMIT_EXCEEDED', 'METRIC_DIMENSION_INCOMPATIBLE', 'badRequest', 'forbidden', 'insufficientPermissions', 'accessNotConfigured', 'rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded']);
export function googleImportDiagnostic(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 256) return null;
  if (Object.hasOwn(importErrors, value)) return value;
  const match = value.match(/^GOOGLE_IMPORT_FAILED category=([a-z_]+)(?: http=([45]\d{2}))?(?: status=([A-Z_]+))?(?: reason=([A-Za-z_]+))?$/);
  if (!match || match[0] !== value || !Object.hasOwn(diagnosticCategories, match[1]) || (match[3] && !diagnosticStatuses.has(match[3])) || (match[4] && !diagnosticReasons.has(match[4]))) return null;
  return value;
}
export function googleImportError(value: string, locale: 'en' | 'fi') {
  const diagnostic = googleImportDiagnostic(value);
  const category = diagnostic?.match(/^GOOGLE_IMPORT_FAILED category=([a-z_]+)/)?.[1];
  const code = category ? diagnosticCategories[category] : diagnostic;
  if (code === 'GOOGLE_TRANSPORT_FAILED') return locale === 'fi' ? 'Yhteys Googleen epäonnistui. Yritä tuontia myöhemmin uudelleen.' : 'The connection to Google failed. Retry the import later.';
  if (code === 'GOOGLE_RESPONSE_INVALID') return locale === 'fi' ? 'Google palautti virheellisen vastauksen. Pyydä yhteyspalvelun ylläpitäjää tarkistamaan tuonti.' : 'Google returned an invalid response. Ask the connector administrator to check the import.';
  return (code && Object.hasOwn(importErrors, code) ? importErrors[code] : importErrors.GOOGLE_IMPORT_FAILED)[locale];
}
export type ConnectionsCopy = typeof en;
