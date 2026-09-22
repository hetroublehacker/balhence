# Search visibility and pentest enquiries

Implementation and owner checklist, updated 22 September 2026. This file is operational documentation and is excluded from the public site artifact.

## What this release changes

The simplified homepage introduces the practice in plain language, with a direct enquiry and sample report as the first two actions. Its compact service section links to distinct web, API, and SaaS pages as well as broader security capabilities. The guides and research stories retain their relevant service and enquiry paths. The headline is editorial; the page title, description and service links retain the application-pentesting search intent.

The India page gives the geographic query its own answer: remote coverage, web/API/SaaS scope, authorization and data-handling steps, reporting, a practical quote-comparison checklist and an enquiry route. The homepage, US page, and relevant guides link to it in visible text. Its `Service.areaServed` markup describes India service coverage without asserting an Indian office or legal entity.

The contact form asks for name, email, service, and permission to respond. Company, URL, timing, reason, and project detail are optional. It retains the scope-planner handoff, email fallback, native no-JavaScript submission, and recovery after failed delivery. No new response-time promise, testimonial, certification, price, or customer claim has been invented.

Search engines need useful, clearly described content and discoverable links; neither an SEO checklist nor structured data guarantees indexing or rankings. This implementation follows those priorities in [Google's SEO guidance](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

## Match each search intent to one useful page

| Visitor's task | Main page | Supporting evidence |
| --- | --- | --- |
| Find an application pentest provider | `/` and `/services.html` | Scope, deliverables, broader capabilities |
| Find remote penetration testing for a team in India | `/penetration-testing-india.html` | Web, API and SaaS coverage, India engagement logistics, proposal comparison, sample report |
| Arrange a web application penetration test | `/web-application-penetration-testing.html` | Scoping guide, authorization stories, sample report |
| Test an API or its integrations | `/api-penetration-testing.html` | API coverage, controlled access, session and cache stories |
| Assess a multi-tenant SaaS product | `/saas-penetration-testing.html` | Tenant/role coverage, SSO, readiness checklist |
| Understand cost and compare proposals | `/insights/web-api-pentest-cost-scope-guide.html` | Effort drivers and scope, not an invented price |
| Evaluate reporting quality | `/report-viewer.html` | Explicitly synthetic report and downloadable PDF |
| Request a proposal | `/contact.html` | Short enquiry, clear next steps, direct email |

These are intent choices, not measured keyword volumes. Search Console data should guide later changes. Avoid cloned city/service pages, keyword repetition, fake ratings, and speculative claims about certifications or client outcomes.

## US launch implementation - 22 September 2026

Implemented from the supplied "Balhence - US Launch Page Content" and "Balhence - US Launch SEO Playbook" documents. The original DOCX files remain outside the public allowlist.

### Keyword and internal-link map

| Primary search intent | Destination | Contextual routes |
| --- | --- | --- |
| SOC 2 penetration testing | `/soc-2-penetration-testing.html` | Home, services, SaaS/web/API, compliance hub, SOC 2 guide, report |
| AI / LLM penetration testing | `/ai-llm-penetration-testing.html` | Home, services AI card, approach, AI guides, relevant field notes |
| Penetration testing services USA | `/penetration-testing-services-usa.html` | Home, services, compliance hub, India page, report |
| Compliance penetration testing | `/compliance-penetration-testing.html` | Home, services, framework pages, US hub, report guide |
| PCI DSS penetration testing | `/pci-dss-penetration-testing.html` | Home, services, compliance hub, SOC 2, US hub |
| HIPAA penetration testing | `/hipaa-penetration-testing.html` | Home, services, compliance hub, SOC 2, US hub |
| Penetration testing as a service / PTaaS | `/penetration-testing-as-a-service.html` | Home, Release Assurance, SaaS, SOC 2, pricing guide |

The three new articles explain SOC 2 pentest requirements, planning LLM application testing, and PTaaS versus annual testing. Each links to its relevant service, the guides hub, and related reading. All seven new service pages have at least three distinct contextual incoming page links, plus shared navigation/footer exposure, scope-builder links, and a sample-report link.

Core pages retain their existing features and substantive coverage. H1/H2/H3 headings now identify the service, coverage, methodology, scope, report, and common buyer questions. The home and services brand headlines remain as requested, with direct definitions and keyword headings below them. Titles, descriptions, social metadata, structured data, breadcrumbs, and significant modification dates are synchronized. New services preselect the correct contact option and carry a fixed attribution label.

These keywords are intent targets from the playbook, checked against current service-search results. Paid keyword volume, difficulty, and rank-tracking data were not available; no search-volume, low-competition, or top-ranking claims were published. Representative result pages include [Cobalt's LLM service](https://www.cobalt.io/services/application-security/llm-pentest) and [Raxis's AI service](https://raxis.com/pentest/ai/); their copy and claimed credentials were not reused.

### Factual corrections and boundaries

- SOC 2: removed promises that a pentest satisfies the audit or that every auditor requires the same annual test. The criteria mapping is explicitly illustrative and must be checked against the customer's controls and auditor expectations. Reference: [AICPA Trust Services Criteria](https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022).
- PCI DSS: use **v4.0.1**, distinguish internal/external testing from ASV scanning, and include the additional six-month segmentation requirement for service providers. References: [PCI SSC library](https://www.pcisecuritystandards.org/document_library/), [PCI SSC publication notice](https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1), and [PCI SSC SAQ D service-provider requirements](https://www.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-D-Service-Provider.pdf).
- HIPAA: describe testing as evidence for the broader risk analysis. Distinguish proposed annual testing from the current rule, and confirm requirements/effective dates during scoping. References: [HHS current Security Rule summary](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html) and [HHS proposal fact sheet](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html).
- OWASP: verified the [LLM Top 10 2026 release](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/) and [Agentic Applications 2026 reference](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/). The API page uses the [2023 API taxonomy](https://owasp.org/API-Security/editions/2023/en/0x11-t10/), including property-level authorization; injection is not labeled as a separate 2023 API Top 10 category.
- PTaaS means scheduled assessments and a maintained finding register. No always-on platform, continuous coverage, or automatic replacement of required full-scope testing is claimed.
- No invented office, US-based staff, certifications, testimonials, prices, named founder, or customer audit outcomes. No fabricated `sameAs`, review, or Person markup.
- The US and India pages keep their own canonicals with reciprocal `en-US`/`en-IN` links. The India page stays indexable. Unrelated core pages are not declared as language alternates.
- FAQ schema mirrors the visible questions and answers. Schema and definition paragraphs do not guarantee a rich result, featured snippet, Gemini recommendation, or ranking. Sitemap and robots discovery remain standard; no deprecated International Targeting control is assumed.

### Verification and release

- `python3 verify_site.py --preview`: 35 HTML pages, complete local URL/anchor and metadata checks.
- `python3 -m unittest discover -s tests -v`: 44 checks including publication boundaries, country alternates, FAQ consistency, article dates, enquiry routes, and contextual links.
- Browser suites cover the homepage motion, scope planner, synthetic report, 21 contact service choices, service-specific routes, form recovery, analytics consent, guides, and keyboard/native navigation. Form submissions and analytics are mocked; no live enquiry is sent.
- New layouts checked at 320, 390, 768, 900, and 1440 pixels as applicable. Cross-document transitions are limited to scripting-enabled browsers with no reduced-motion preference so native navigation does not leave a click-blocking transition layer.
- Build only the allowlisted artifact. After deployment, verify canonical URLs return 200, inspect the new pages in Search Console/Bing, and notify IndexNow once for substantive changes. Local tests do not establish deployment, indexing, rankings, or inbox delivery.

## Owner actions after publishing

1. Publish through the existing GitHub Actions workflow and confirm its deployment succeeds.
2. The `balhence.com` domain property is already verified in Google Search Console. Keep property access and performance data private.
3. The canonical sitemap is already submitted and accepted. After publishing, inspect the seven new US launch service URLs and the three supporting guides, then request indexing if they are available. A submitted sitemap is a discovery signal, not confirmation of indexing. See [Google's sitemap instructions](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
4. Send one clearly labelled, non-sensitive test enquiry yourself. Confirm the Formspree submission appears and reaches the intended inbox, then check the email reply path and spam folder. Automated tests use a mock and do not establish real inbox delivery.
5. Bing Webmaster Tools uses the `msvalidate.01` tag in `index.html` to verify `https://balhence.com/`. Keep that tag on the live homepage, verify the property, and submit `https://balhence.com/sitemap.xml` through the HTH account.
6. Add only permissioned, verifiable proof: a real public professional profile, current credentials, approved testimonials, or a client reference. Link the website from profiles you control. Review identity and permission before adding `sameAs`, review, or credential markup.

### Notify IndexNow participants after a release

`d4627c921ee756e5a1d004e47bed20a8.txt` is the public IndexNow ownership key. Once deployment has finished, confirm `https://balhence.com/d4627c921ee756e5a1d004e47bed20a8.txt` serves the same text as the local file. For each **new or substantively updated canonical page**, submit its exact URL once:

```bash
indexnow_key="$(tr -d '\n' < d4627c921ee756e5a1d004e47bed20a8.txt)"
curl --fail-with-body -G 'https://api.indexnow.org/indexnow' \
  --data-urlencode 'url=https://balhence.com/penetration-testing-india.html' \
  --data-urlencode "key=$indexnow_key"
```

Replace the example `url` with each changed canonical URL. The root key file follows IndexNow's preferred `{key}.txt` format, so no `keyLocation` parameter is needed. Do not resubmit unchanged URLs or submit before the key file is live. An accepted notification does not guarantee crawling, indexing, or ranking, and IndexNow does not submit URLs to Google. See the [IndexNow documentation](https://www.indexnow.org/documentation) and [FAQ](https://www.indexnow.org/faq).

Earlier live checks confirmed HTTPS 200 on the homepage, permanent redirects from HTTP, www, and the GitHub Pages project URL, an accessible robots.txt, and a real missing-page 404. Live form delivery and Core Web Vitals remain unverified.

## Generative AI search

Google says an AI Overview or AI Mode supporting link must come from an indexed page eligible for a normal snippet. It recommends original, useful content and clear technical structure, and says there is no special AI schema, AI text file or guaranteed placement. See [Google's AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) and [AI features guidance](https://developers.google.com/search/docs/appearance/ai-features). Track the new page's index status, India query impressions, India country results and Generative AI impressions in Search Console after publication. Record the actual performance numbers outside this public repository.

## Measure leads, not just clicks

| Signal | Where to look | Meaning and limit |
| --- | --- | --- |
| Search impressions and clicks | Search Console, by query and landing page | Search visibility; not an enquiry |
| `contact_intent` | Consented Google Analytics events on informational pages | A tracked contact-link click, not a submitted form |
| `select_content` | Consented Google Analytics events | Other tagged interactions, including report links |
| Received enquiry | Formspree and your inbox | Delivery must be checked independently |
| Qualified enquiry, proposal, won engagement | Your own lead log or CRM | The business outcome to optimize |

Enquiries submitted with JavaScript can include `enquiry_source`, a fixed label such as `web-pentest`, `saas-pentest`, or `sample-report`. Unknown values become `unlabelled`; older planner links map to `scope-planner`. This is a user-supplied routing hint, not trusted identity or proof of an organic visit. It creates no tracking cookie and does not persist browsing history. Native no-JavaScript submissions do not add this label.

Contact, planner, and privacy pages remain analytics-free. The browser's form-success event is local; it is not uploaded as a Google Analytics conversion from those pages. Do not report enquiry clicks as leads. Page URLs configured for analytics exclude query strings and fragments; audit any separately enabled Analytics enhanced-measurement settings before relying on additional automatic events.

## Build relevance and trust over time

Start by publishing the release and verifying delivery and indexing. Review query and landing-page performance weekly, then evaluate content changes over several weeks rather than reacting to daily ranking changes.

Use questions from real prospect conversations for the next articles: preparing representative test tenants, planning a retest around releases, what customer reviewers need from a report, or comparing a scanner output with a scoped assessment. Give each article one concrete buyer problem, honest limitations, and a relevant next step. Never publish confidential reports or manufacture findings for search traffic.

Share useful articles through your own professional profiles and relevant communities where promotion is permitted. Pursue genuine references and relationships, not purchased links or unsolicited bulk messaging. Track which conversations become qualified projects before expanding content volume.

Google's AI search features use the same SEO foundations; [special AI text files or dedicated schema are not required](https://developers.google.com/search/docs/appearance/ai-features). No AI-discovery or rich-result guarantee is implied here.

## Verify future edits

```bash
python3 verify_site.py --preview
python3 -m unittest discover -s tests -v
node tests/seo-conversion-regression.cjs
```

The SEO unit tests check unique titles and descriptions, ordinary-link reachability, commercial schema and contact routes, and sitemap/article dates. The browser suite checks responsive buyer journeys, attribution, consent, mocked form outcomes, and no-JavaScript fallback. Update sitemap `lastmod` only for a significant page change; preserve original article publication dates.
