# Search visibility and pentest enquiries

Implementation and owner checklist, 6 September 2026. This file is operational documentation and is excluded from the public site artifact.

## What this release changes

The homepage now explains the application pentest offer immediately, with a direct enquiry and a sample report as the first two actions. Broader AI-native security capabilities remain available. There are distinct web, API, and SaaS service pages, and the guides and research stories link to the relevant service and enquiry path.

The contact form asks for name, email, service, and permission to respond. Company, URL, timing, reason, and project detail are optional. It retains the scope-planner handoff, email fallback, native no-JavaScript submission, and recovery after failed delivery. No new response-time promise, testimonial, certification, price, or customer claim has been invented.

Search engines need useful, clearly described content and discoverable links; neither an SEO checklist nor structured data guarantees indexing or rankings. This implementation follows those priorities in [Google's SEO guidance](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

## Match each search intent to one useful page

| Visitor's task | Main page | Supporting evidence |
| --- | --- | --- |
| Find an application pentest provider | `/` and `/services.html` | Scope, deliverables, broader capabilities |
| Arrange a web application penetration test | `/web-application-penetration-testing.html` | Scoping guide, authorization stories, sample report |
| Test an API or its integrations | `/api-penetration-testing.html` | API coverage, controlled access, session and cache stories |
| Assess a multi-tenant SaaS product | `/saas-penetration-testing.html` | Tenant/role coverage, SSO, readiness checklist |
| Understand cost and compare proposals | `/insights/web-api-pentest-cost-scope-guide.html` | Effort drivers and scope, not an invented price |
| Evaluate reporting quality | `/report-viewer.html` | Explicitly synthetic report and downloadable PDF |
| Request a proposal | `/contact.html` | Short enquiry, clear next steps, direct email |

These are intent choices, not measured keyword volumes. Search Console data should guide later changes. Avoid cloned city/service pages, keyword repetition, fake ratings, and speculative claims about certifications or client outcomes.

## Owner actions after publishing

1. Publish through the existing GitHub Actions workflow and confirm its deployment succeeds. This editing session does not push or deploy changes.
2. Verify the `balhence.com` property in Google Search Console if it is not already verified. Use the verification method and value supplied by your own account; do not publish a guessed verification token.
3. Submit `https://balhence.com/sitemap.xml` in the property's Sitemaps report. Inspect the homepage and the web, API, and SaaS pages, then request indexing where appropriate. A submitted sitemap is a discovery signal, not confirmation of indexing. See [Google's sitemap instructions](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
4. Send one clearly labelled, non-sensitive test enquiry yourself. Confirm the Formspree submission appears and reaches the intended inbox, then check the email reply path and spam folder. Automated tests use a mock and do not establish real inbox delivery.
5. If you use Bing Webmaster Tools, verify the same domain and submit the same canonical sitemap through your account.
6. Add only permissioned, verifiable proof: a real public professional profile, current credentials, approved testimonials, or a client reference. Link the website from profiles you control. Review identity and permission before adding `sameAs`, review, or credential markup.

The live checks during this work confirmed HTTPS 200 on the homepage, permanent redirects from HTTP, www, and the GitHub Pages project URL, an accessible robots.txt, and a real missing-page 404. They did not establish Search Console ownership, index coverage, rankings, Core Web Vitals, or live form delivery.

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
