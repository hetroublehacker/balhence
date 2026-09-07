# Balhence

A minimal, animated website for AI-native cybersecurity, research, and security engineering. Static HTML, CSS, and JavaScript; no application framework or runtime package installation.

## Preview

```bash
python3 serve.py --port 8000
```

Open http://127.0.0.1:8000/. The preview serves only public assets, blocks internal folders and symlinks, and sends real 404 responses. It uses plain HTTP.

This directory is the main website. The existing nested `website/`, `website-tools/`, and `website-backups/` copies are preserved and excluded from publishing. The working collateral toolkit is the sibling `../website-tools/`.

## Experience

- Minimal homepage with staged typography, an animated SVG trust boundary, three interactive evidence states, tool previews, scroll reveals, and a sticky engagement story.
- Twelve security capability areas, with cross-disciplinary and specialist enquiries routed to a tailored scope review. AI-native positioning retains human ownership, agreed data use, and explicit project boundaries.
- A dedicated Blog at `/blogs.html` with five anonymized research case studies, local search/topic filters, and 25 illustrative defensive regression cases. Existing preparation and procurement guides remain at `/blog.html`.
- Animation pauses while the demo is offscreen or the tab is hidden. Visitors can pause it, and reduced-motion preferences are honored. Keyboard and touch controls work independently of animation.
- Security project routing plus a six-step web/API scope planner with local draft resume, PDF export, and a reviewed handoff to the contact form. The estimator does not price or estimate specialist work.
- Interactive synthetic report with executive, technical, remediation, and re-test views.
- Accessible mobile navigation, editable analytics preferences, and enquiry timeout/retry handling.
- Search-focused web, API, and SaaS service pages with direct proposal requests, contextual research links, and a lower-friction enquiry form. The broader AI-native capability map remains available.

The homepage uses CSS and the Web Animations API; it does not fetch animation libraries, fonts, analytics, or other third-party resources on initial load. Supporting pages retain the existing progressive motion layer.

## Main files

| Files | Purpose |
| --- | --- |
| `index.html`, `home.css`, `home.js` | Homepage and animation |
| `styles.css`, `app.js`, `config.js` | Shared design, navigation, forms, preferences |
| `scope-builder.*`, `scope-pdf.js` | Local planning and PDF export |
| `report-viewer.html`, `report-explorer.*` | Sample report explorer |
| `contact.html`, `contact-brief.*` | Enquiries and scope handoff |
| `services.html`, service pages, `insights/` | Service coverage and buyer guides |
| `blogs.html`, `case-studies.*`, case-study articles in `insights/` | Redacted stories, progressive filtering, and defensive test ideas |
| `build_public.py`, `serve.py`, `verify_site.py` | Publication boundary and validation |
| `../website-tools/toolkit.py` | Local PDF and editable client-kit generation |

## Data and configuration

Public company information, the Formspree endpoint, and analytics ID live in `config.js`. Never place secrets in the browser bundle.

Planner answers are stored under `balhence_scope_builder_v1`. A completed brief uses `balhence_scope_brief_v1` in session storage, expires after two hours, and is submitted only with the contact form. Failed storage or handoff is reported with copy/PDF recovery; resetting the planner clears saved drafts.

Explicit service links preselect the matching enquiry category. Selecting a different service skips a saved web/API brief without deleting it, so the brief cannot silently override a specialist enquiry.

Enquiry links can carry a fixed `source` label. Only allowlisted labels become the submitted `enquiry_source`; unknown values become `unlabelled`. This creates no tracking cookie or stored browsing history. On eligible pages, consented `contact_intent` events count tracked enquiry-link clicks, not submitted forms. Contact remains analytics-free; measure received and qualified leads in Formspree, the inbox, and your lead log.

Analytics stays off until acceptance and never loads on the planner, contact, or privacy pages. Visitors can change the choice through the footer. Homepage animation preference is stored as `balhence_motion_paused`.

Form submissions require Formspree connectivity. Live form delivery has not been exercised during this upgrade; automated tests intercept submissions.

## Verify and build

```bash
python3 verify_site.py --preview
python3 -m unittest discover -s tests -v
python3 build_public.py --output _site
python3 verify_site.py --root _site --artifact --preview
python3 serve.py --directory _site --port 8000
```

The builder requires a new output path and refuses overwrites. It publishes an exact allowlist; source files, tests, collateral, backups, and repository metadata stay outside the artifact.

Keep first-party text ASCII-only, including text written as HTML entities. Use CSS or SVG for decorative icons and plain punctuation for copy. The verifier checks this before publishing; vendor libraries, licenses, and binary assets are excluded.

Case studies are generalized adaptations, not public vulnerability disclosures. Do not copy source reports, target identities, exact routes, payloads, credentials, personal data, or private evidence into the repository or public artifact. Synthetic implementation sketches and regression cases describe proposed defensive controls; they do not establish that a source issue has been fixed or independently reproduced. Source reports stay outside this project and outside the publication allowlist.

The bug-bounty-style HTTP notebooks are display-only reconstructions, not original captures. Use only reserved example hosts, invented `/redacted/` read-only paths, and explicit `[REDACTED]` credential placeholders. Label whether a response illustrates an observation, a baseline, or a proposed control. Tests check header redaction, HTTP framing, JSON bodies, and contained mobile scrolling.

Optional browser regression suites require Playwright with Chromium installed:

```bash
node tests/interaction-regression.cjs
node tests/experience-regression.cjs
node tests/capability-regression.cjs
node tests/blog-regression.cjs
node tests/seo-conversion-regression.cjs
```

They exercise local previews and block external traffic. GitHub Actions validates static pages, JavaScript syntax, build safeguards, and the release artifact before deployment; pull requests validate without deployment.

The Python suite also checks search metadata uniqueness, ordinary-link reachability, commercial page schema and enquiry routes, and sitemap/article date consistency. See [SEO-GROWTH.md](SEO-GROWTH.md) for the search-intent map, Search Console setup, real inbox checks, and lead measurement. It is operational documentation, not a public asset. No rankings or enquiry volume are guaranteed.

## Publishing

Set GitHub Pages source to **GitHub Actions** before pushing. Publish the generated artifact, never the repository root. No push or deployment was performed for this upgrade.

Use HTTPS and appropriate response headers in production. The preview demonstrates defensive headers; the production host must provide them. Confirm the configured origin, form delivery, and externally shared business claims before publishing.

GitHub Pages alone cannot configure the full response-header policy. Use a suitable host or reverse proxy for a response-header CSP, `frame-ancestors 'none'`, and `X-Frame-Options: DENY` on HTML. Allow same-origin framing for `sample-vapt-report.pdf`, which the report viewer embeds. Add HSTS only after HTTPS is stable, plus `X-Content-Type-Options: nosniff`, a restrictive `Permissions-Policy`, and an appropriate `Referrer-Policy`.

The original tracked website is recoverable from `/home/dollar/tools/balhence-upgrade-backup-TlLnHb/original-website.tar`. The pre-existing nested worktree, including its modified PDF, was left intact. The migrated sample PDF uses that worktree's committed version.
