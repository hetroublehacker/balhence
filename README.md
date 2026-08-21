# Balhence website

Fast, static-first marketing site with a browser-based pentest scope planner, an interactive synthetic report explorer, a capability-gated 3D process story, consent-gated analytics, and a Formspree enquiry handoff. It has no framework, package install, build step, database, or server-side runtime.

## Run locally

From this directory:

```bash
python3 serve.py --port 8000
```

Open **http://127.0.0.1:8000/**.

The preview server speaks plain HTTP. Do not open `https://127.0.0.1:8000/`. Log lines beginning with binary bytes such as `\x16\x03\x01` and “Bad request version” mean a browser or proxy sent a TLS/HTTPS handshake to the HTTP-only server.

Use `serve.py` instead of raw `python3 -m http.server`. The raw server can expose `.git`, internal documents, build tools, dotfiles, symlinks, and directory listings when it is bound to a public interface. The repository-locked preview serves the exact public-file allowlist from `build_public.py`, sends the custom 404 with a real 404 status, adds defensive headers, and disables caching so an older stylesheet cannot mask a current fix.

For a trusted LAN only:

```bash
python3 serve.py --port 8000 --bind 0.0.0.0
```

Then open `http://<this-machine-ip>:8000/`. Binding to `0.0.0.0` exposes the server on every interface; do not use the development server as an internet-facing production server. Use the host's HTTPS/CDN configuration for production.

## Product flow

1. The homepage Scope Lab sends a categorical buying trigger to `scope-builder.html`.
2. The six-step planner creates a deterministic Draft Scope Brief locally and exports it as a branded, selectable-text PDF. It is planning guidance, not a scan, risk score, quote, or authorization.
3. Draft answers stay in this browser under `balhence_scope_builder_v1`.
4. “Continue to a scope review” passes the generated brief through `sessionStorage` as `balhence_scope_brief_v1`; it expires after two hours.
5. The contact page shows the brief for review and submits it only after the visitor completes and sends the form.
6. `report-viewer.html` demonstrates the evidence model with synthetic data and retains the downloadable PDF.

Never add credentials, tokens, customer records, production vulnerability evidence, or confidential architecture to either public form.

## Important files

- `index.html`, `scope-lab.js`, `scope-lab.css`: homepage and interactive entry point
- `services.html`, `web-application-penetration-testing.html`, `api-penetration-testing.html`: service hub and focused commercial coverage pages
- `blog.html`, `insights/`: buyer guides for scope, cost, readiness, report quality, and human-validated AI use in VAPT
- `scope-builder.html`, `scope-builder.js`, `scope-builder.css`: local scope-planning application
- `scope-pdf.js`, `vendor/jspdf-4.2.1.umd.min.js`: client-side PDF layout and pinned PDF engine
- `report-viewer.html`, `report-explorer.js`, `report-explorer.css`: synthetic evidence explorer
- `contact.html`, `contact-brief.js`, `contact-brief.css`: manual and planner-assisted enquiry flows
- `motion.js`, `motion.css`: progressive motion with reduced-motion and pointer safeguards
- `experience.js`, `experience.css`: lazy homepage Three.js scene and GSAP scroll-linked report/process stories
- `app.js`, `config.js`: navigation, forms, attribution, and consent-gated analytics
- `sitemap.xml`, `robots.txt`, `.well-known/security.txt`, `.nojekyll`, `site.webmanifest`: discovery and platform metadata
- `../website-tools/first-client-8-week-roadmap.md`: private first-client acquisition operating plan, kept outside the public repository

## Configuration

`config.js` contains the public form endpoint, analytics property ID, and public company contact details. These values are intentionally client-readable. Do not put secrets in this file or anywhere in the browser bundle.

The form's direct HTML action is a progressive fallback. Form submission needs network access to Formspree; all other primary content and planning interactions work from a local static server.

The planner uses the locally vendored jsPDF 4.2.1 browser build under the MIT license. The homepage experience uses locally vendored Three.js 0.185.1 and GSAP 3.15.0 with ScrollTrigger. Version, integrity, source, license, and update notes are recorded in `vendor/README.md`. The advanced animation files are requested only on eligible desktops that approach the story; static content remains complete when they are not loaded.

## Backups

Backups live outside the repository so they cannot be deployed accidentally:

- `/home/trouble/tools/website-backups/original-site-before-redesign`: exact archive of Git commit `d5178aae1392e92c3565225a553cf9911b9a276d`, before any redesign work
- `/home/trouble/tools/website-backups/2026-08-21-pre-motion-ui`: completed static-first redesign immediately before the richer motion/application layer

The original archive was verified file-for-file against the Git commit at capture time.

## Before deployment

- Before pushing this worktree, change **Pages > Build and deployment > Source** from branch publishing to **GitHub Actions**. A branch-root push can expose internal roadmaps and build tools before the allowlisted workflow runs.
- Build the public artifact with `python3 build_public.py --output _site`. The command refuses an existing output and copies only the exact runtime allowlist.
- The checked-in Pages workflow deploys `_site`; never publish the branch root, which also contains internal roadmaps and build tools.
- Serve every page over HTTPS in production, but test local development over the exact `http://` URL.
- Use a production host or reverse proxy that can set HTTP response headers. GitHub Pages cannot configure the full policy by itself. Mirror the page CSP as a response header; use `frame-ancestors 'none'` and `X-Frame-Options: DENY` for HTML, while allowing same-origin framing for `sample-vapt-report.pdf` because the report viewer embeds it. Add HSTS after HTTPS is stable, `X-Content-Type-Options: nosniff`, a restrictive `Permissions-Policy`, and an appropriate `Referrer-Policy`.
- Confirm repository metadata, dotfiles, directory listings, source maps, backup folders, and unreviewed collateral are not present in the published artifact.
- Verify `https://balhence.com/` is the real canonical origin before publishing.
- Confirm the Formspree endpoint receives a controlled test enquiry.
- Confirm analytics remains absent before consent and loads only after acceptance.
- Check the homepage, planner, report explorer, contact handoff, privacy page, and 404 page at mobile and desktop widths.
- Validate `sitemap.xml`, `site.webmanifest`, canonical links, structured data, and internal links.
- Confirm `/.well-known/security.txt` and `/sitemap.xml` return HTTP 200 after deployment, then submit the sitemap in Google Search Console and Bing Webmaster Tools.
- Publish and monitor a DMARC record for the sending domain, then move to an enforcement policy only after legitimate forwarding and outbound mail are verified. Review CAA and DNSSEC with the DNS provider as defense in depth.
- Do not publish an identity, credential, client, testimonial, certification, metric, or availability claim unless it is current, permissioned, and independently verifiable.
