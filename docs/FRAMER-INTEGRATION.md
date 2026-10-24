# FI/EN Framer handover

The app-side widget and secure report pages are implemented in this repository. Editing and publishing the separate `airank.me` Framer website is an operator step; it has not been performed here.

## Installation

1. Finish the reviewed release described in `PUBLIC-CHECK-RELEASE.md` before connecting the production page.
2. In the existing Framer page, add the native sections below using the approved Figma layouts. Use Figtree, navy `#181F6B`, cyan `#00B8E4`, light background `#F7F9FC`, and tint `#E9F8FD`, with the approved original AI Rank logo.
3. Add a Framer Embed element in HTML mode, full width, with its outer section able to grow vertically. Paste `docs/framer-embed-en.html` on the English page or `docs/framer-embed-fi.html` on the Finnish page. Paste each snippet only once per page.
4. Keep page navigation, footer, H1, benefits, methodology and FAQ as native Framer content, not text inside the iframe.
5. Test at 390px, 768px and 1440px after publishing to an approved parent origin. The only approved parent origins are `https://airank.me` and `https://www.airank.me`; a random Framer preview origin is intentionally not allowed.

The parent checks both the exact message origin and iframe window before accepting a height between 300 and 10000 pixels. The widget sends only resize/scroll messages to the approved parent, not tokens, email, or report contents. Secure emailed-report pages cannot be framed.

## Native English copy

**SEO title:** Free AI Visibility Check | AI Rank.me

**Meta description:** Check whether AI services mention your business. Choose your market and question language, review the questions, and see a free evidence-based snapshot.

**H1:** Does AI mention your business?

**Hero:** See how your brand appears in a small sample of AI answers. Choose a market and question language, review your business details and questions, and run a free check. No account or email is needed to see your results.

**Button:** Check my visibility

### Understand your first results

- See which tested answers mentioned your brand, with the actual response evidence.
- Review coverage by the AI services configured for this check.
- Keep your target market and question language separate from the interface language.
- Optionally request a secure report link by email after seeing your results.

### How the check works

We send the reviewed questions to the configured AI provider APIs and check successful responses for your brand. Visibility is the share of eligible successful responses that mention it; the score is shown out of 10. Unavailable providers and failed responses are excluded rather than counted as zero. This is a sample of API responses at the recorded time, not a search ranking, a whole-market estimate, or a guarantee of future answers.

### Frequently asked questions

**Is an account required?** No. The free preview is visible before any email request. Existing abuse-prevention limits still apply.

**Can I choose another market or language?** Yes. Choose a supported market and question language independently, and review the resulting details and questions before starting.

**Why is a result unavailable?** A provider may fail or return no eligible answer. We show missing coverage instead of inventing a score.

**Does an email report subscribe me to marketing?** No. Report delivery is transactional; optional marketing consent is separate and unchecked.

**Will repeated checks always match?** No. Answers can change with the question, provider, model, market, language and time. Compare equivalent measurements.

## Native Finnish copy

**SEO-otsikko:** Maksuton tekoälynäkyvyyden tarkistus | AI Rank.me

**Metakuvaus:** Tarkista, mainitsevatko tekoälypalvelut yrityksesi. Valitse markkina ja kysymyskieli, tarkista kysymykset ja näe maksuton, vastauksiin perustuva tilannekuva.

**H1:** Mainitseeko tekoäly yrityksesi?

**Hero:** Näe, miten brändisi esiintyy pienessä otoksessa tekoälyn vastauksia. Valitse markkina ja kysymyskieli, tarkista yrityksesi tiedot ja kysymykset ja käynnistä maksuton tarkistus. Tulosten katsominen ei vaadi tiliä tai sähköpostiosoitetta.

**Painike:** Tarkista näkyvyyteni

### Ymmärrä ensimmäiset tuloksesi

- Näe, missä testatuissa vastauksissa brändisi mainittiin, ja tarkista alkuperäinen vastaus.
- Tarkastele kattavuutta tarkistukseen määritetyissä tekoälypalveluissa.
- Valitse kohdemarkkina ja kysymyskieli erillään käyttöliittymän kielestä.
- Pyydä halutessasi suojattu raporttilinkki sähköpostitse vasta tulosten näkemisen jälkeen.

### Miten tarkistus toimii

Lähetämme tarkistamasi kysymykset määritettyjen tekoälypalvelujen rajapintoihin ja etsimme onnistuneista vastauksista brändisi maininnat. Näkyvyys on brändin mainitsevien vastausten osuus kelvollisista onnistuneista vastauksista; pisteet esitetään asteikolla 0–10. Epäonnistuneita tai puuttuvia vastauksia ei lasketa nolliksi. Tulos on ajankohtaan sidottu otos rajapintavastauksista, ei hakusijoitus, koko markkinan arvio tai lupaus tulevista vastauksista.

### Usein kysytyt kysymykset

**Tarvitaanko tili?** Ei. Maksuton esikatselu näkyy ennen sähköpostin pyytämistä. Nykyiset väärinkäytön estämiseen tarkoitetut rajat ovat voimassa.

**Voinko valita muun markkinan tai kielen?** Kyllä. Voit valita tuetun markkinan ja kysymyskielen erikseen. Tarkista tiedot ja kysymykset ennen aloitusta.

**Miksi tulos ei ole saatavilla?** Palvelu voi epäonnistua tai vastaus ei täytä mittauksen ehtoja. Näytämme puuttuvan kattavuuden keksittyjen pisteiden sijaan.

**Tilaanko markkinointia pyytämällä raportin?** Et. Raportin lähetys on erillinen palveluviesti. Vapaaehtoinen markkinointisuostumus on erillinen eikä ole valmiiksi valittuna.

**Ovatko toistetut tulokset aina samoja?** Eivät. Kysymykset, palvelut, mallit, markkina, kieli ja ajankohta voivat muuttaa vastauksia. Vertaa keskenään vastaavia mittauksia.

## Operator acceptance checks

Verify the published parent resizes without nested scrolling at all three widths and in both locales. Complete one controlled real-provider check, one partial/failure case, and a secure email-report request to test Gmail/Outlook delivery and token expiry. Confirm marketing is independent and unchecked; review the eight funnel events without personal data. These external production checks require the reviewed release and configured mail service, and are not claimed as completed by the source tests.
