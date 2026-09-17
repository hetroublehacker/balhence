# Search visibility and pentest enquiries

Implementation and owner checklist, updated 17 September 2026. This file is operational documentation and is excluded from the public site artifact.

## What this release changes

The simplified homepage introduces the practice in plain language, with a direct enquiry and sample report as the first two actions. Its compact service section links to distinct web, API, and SaaS pages as well as broader security capabilities. The guides and research stories retain their relevant service and enquiry paths. The headline is editorial; the page title, description and service links retain the application-pentesting search intent.

The India page gives the geographic query its own answer: remote coverage, web/API/SaaS scope, authorization and data-handling steps, reporting, a practical quote-comparison checklist and an enquiry route. The homepage and services page link to it in visible text. Its `Service.areaServed` markup describes India service coverage without asserting an Indian office or legal entity.

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

## Owner actions after publishing

1. Publish through the existing GitHub Actions workflow and confirm its deployment succeeds.
2. The `balhence.com` domain property is already verified in Google Search Console. Keep property access and performance data private.
3. The canonical sitemap is already submitted and accepted. After publishing, inspect the new India URL and updated services URL, then request indexing if they are available. A submitted sitemap is a discovery signal, not confirmation of indexing. See [Google's sitemap instructions](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
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
