#!/usr/bin/env node
"use strict";

// Local publication and interaction checks. Requires Playwright with Chromium.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { chromium } = require("playwright");

const FIELD_NOTES = [
  ["/insights/mixed-batch-authorization.html", "The One Good ID That Authorized the Whole Batch"],
  ["/insights/ai-agent-mcp-root-rce.html", "The AI Agent That Ran My MCP Tool as Root"],
  ["/insights/async-export-authorization.html", "The Export Job That Crossed a Tenant Boundary"],
  ["/insights/server-side-url-import.html", "The File Importer That Stored Whatever the URL Returned"],
  ["/insights/draft-write-authorization.html", "The draft you could change but could not read"],
  ["/insights/session-authority-boundary.html", "When two browsers inherited one cart"],
  ["/insights/private-response-cache-boundary.html", "When the cache forgot who a response belonged to"],
  ["/insights/server-owned-validation-rules.html", "When a validation helper became a data query"],
  ["/insights/evidence-gated-workflows.html", "Submitted is not the same as verified"],
];
const RESEARCH_ARTICLES = [
  ["/research/dependency-confusion.html", "How I approached Dependency Confusion!"],
  ["/research/cve-2020-28726.html", "Assigned my First CVE-2020-28726!!"],
  ["/research/first-bounty-target.html", "The First Bounty Target (Disclosing Multiple Reports)"],
  ["/research/tale-of-my-first-xss.html", "Tale of my First XSS"],
  ["/research/http-request-smuggling-plain-english.html", "HTTP Request Smuggling in Plain English."],
  ["/research/inspect-element-bounty.html", "How Inspect Element Got me a Bounty"],
  ["/research/crlf-injection-playbook.html", "CRLF Injection Playbook"],
  ["/research/bug-bounty-with-bash.html", "Bug Bounty with Bash"],
  ["/research/find-secret-api-keys.html", "Find Secret API-Keys"],
  ["/research/automating-burp-idor.html", "Automating BURP to find IDORs"],
];
const ARTICLES = [...FIELD_NOTES, ...RESEARCH_ARTICLES];
const RESEARCH_ROUTES = new Set(RESEARCH_ARTICLES.map(([route]) => route));
const TOPICS = {
  authorization: [
    "/insights/mixed-batch-authorization.html",
    "/insights/async-export-authorization.html",
    "/insights/draft-write-authorization.html",
    "/research/first-bounty-target.html",
    "/research/automating-burp-idor.html",
  ],
  "web-attacks": [
    "/insights/ai-agent-mcp-root-rce.html",
    "/insights/server-side-url-import.html",
    "/research/tale-of-my-first-xss.html",
    "/research/http-request-smuggling-plain-english.html",
    "/research/crlf-injection-playbook.html",
  ],
  "state-caching": [
    "/insights/session-authority-boundary.html",
    "/insights/private-response-cache-boundary.html",
  ],
  "validation-workflows": [
    "/insights/server-owned-validation-rules.html",
    "/insights/evidence-gated-workflows.html",
    "/research/inspect-element-bounty.html",
  ],
  "discovery-automation": [
    "/research/bug-bounty-with-bash.html",
    "/research/find-secret-api-keys.html",
  ],
  "vulnerability-research": [
    "/research/dependency-confusion.html",
    "/research/cve-2020-28726.html",
  ],
};
const PAGES = ["/blogs.html", ...ARTICLES.map(([route]) => route)];

async function main() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.platform === "win32" ? "python" : "python3", ["serve.py", "--port", String(port)], {
    cwd: path.resolve(__dirname, ".."), stdio: "ignore",
  });
  let serverError;
  server.on("error", error => { serverError = error; });
  let browser;
  let checks = 0;
  const pass = message => { checks++; console.log(`PASS ${message}`); };
  const errors = [];
  const external = [];
  const missing = [];
  const blockExternal = route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    if (new URL(route.request().url()).hostname === "cdn.embedly.com") return route.abort();
    external.push(route.request().url());
    return route.abort();
  };

  function observe(page) {
    page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
    page.on("response", response => {
      if (new URL(response.url()).origin === origin && response.status() >= 400) {
        missing.push(`${response.status()} ${response.url()}`);
      }
    });
  }

  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (serverError) throw serverError;
      try {
        await new Promise((resolve, reject) => {
          const socket = net.connect(port, "127.0.0.1", () => { socket.end(); resolve(); });
          socket.once("error", reject);
        });
        break;
      } catch { /* Preview is starting. */ }
      if (attempt === 39) throw new Error("Preview did not start");
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    });
    const context = await browser.newContext({
      reducedMotion: "reduce", viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/*", blockExternal);
    const page = await context.newPage();
    observe(page);
    await page.goto(`${origin}/blogs.html`);
    await page.locator("[data-archive-controls]").waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-archive-card]").count(), ARTICLES.length);
    assert.equal(await page.locator("[data-archive-card]:visible").count(), ARTICLES.length);
    assert.equal(await page.locator("[data-field-note-card]").count(), FIELD_NOTES.length);
    assert.equal(await page.locator("[data-archive-card] .case-card-media img").count(), ARTICLES.length);
    for (const image of await page.locator("[data-archive-card] .case-card-media img").all()) {
      assert.equal(await image.getAttribute("loading"), "lazy");
      assert.equal(await image.getAttribute("decoding"), "async");
      assert.equal(await image.getAttribute("fetchpriority"), "low");
      assert.ok(Number(await image.getAttribute("width")) > 0);
      assert.ok(Number(await image.getAttribute("height")) > 0);
      assert.ok((await image.getAttribute("alt")).trim().length > 0);
    }
    assert.equal(await page.locator('#bug-bounty-archive[aria-labelledby]').count(), 1);
    const cardLabels = await page.locator("[data-archive-card] a[aria-labelledby]").evaluateAll(links => links.map(link => link.getAttribute("aria-labelledby")));
    assert.equal(cardLabels.length, ARTICLES.length, "Every archive card link should name its title");
    assert.equal(new Set(cardLabels).size, ARTICLES.length, "Every archive card title ID should be unique");
    for (const label of cardLabels) assert.equal(await page.locator(`#${label}`).count(), 1);
    const destinations = await page.locator("[data-archive-card] a[href]").evaluateAll(links => links.map(link => link.getAttribute("href")));
    assert.equal(destinations.length, ARTICLES.length, "Each archive card should link once to its article");
    assert.equal(new Set(destinations).size, ARTICLES.length, "Archive cards must not duplicate articles");
    assert.deepEqual([...destinations].sort(), ARTICLES.map(([route]) => route).sort());
    pass(`The hub contains exactly ${ARTICLES.length} unique articles in one archive`);

    for (const [route, title] of FIELD_NOTES) {
      await page.goto(`${origin}/blogs.html`);
      await page.locator(`[data-archive-card] a[href="${route}"]`).click();
      await page.waitForURL(`${origin}${route}`);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal((await page.locator("h1").innerText()).trim(), title);
      assert.equal(await page.locator("body.research-archive-post.archive-article").count(), 1);
      assert.equal(await page.locator(".research-article-body").count(), 1);
      assert.ok(await page.locator(".research-article-body h2, .research-article-body h3, .research-article-body h4").count() >= 4);
      assert.ok(await page.locator(".research-article-body pre").count() >= 1);
      assert.ok(await page.locator(".research-story-figure").count() >= 1);
      assert.ok(await page.locator(".research-story-figure figcaption").count() >= 1);
      assert.equal(await page.locator(".research-cover-figure").count(), 1);
      assert.equal(await page.locator(".research-cover-figure figcaption").count(), 1);
      const cover = page.locator(".research-cover-figure img");
      assert.equal(await cover.getAttribute("width"), "1200");
      assert.equal(await cover.getAttribute("height"), "630");
      assert.equal(await cover.getAttribute("loading"), "lazy");
      assert.equal(await cover.getAttribute("decoding"), "async");
      assert.ok((await cover.getAttribute("alt")).trim().length >= 30);
      assert.deepEqual(
        await cover.evaluate(image => ({
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        })),
        { complete: true, naturalWidth: 1200, naturalHeight: 630 },
      );
      assert.match(await page.locator(".research-article-body").innerText(), /Publication note:/);
      assert.ok(await page.locator('a[href="/about.html#researcher"]').count() > 0);
      assert.ok(await page.locator('a[href="/blogs.html#bug-bounty-archive"]').count() > 0, `${route} should link back to the collection`);
      assert.equal(await page.locator("[data-article-share]").count(), 1, `${route} should expose one share control`);
    }
    pass("Every field note uses the first-person research shell with synthetic evidence and archive links");

    const [shareRoute, shareTitle] = FIELD_NOTES[0];
    await page.goto(`${origin}${shareRoute}`);
    const shareMenu = page.locator("[data-article-share] details");
    const shareTrigger = shareMenu.locator("summary");
    await shareTrigger.focus();
    await page.keyboard.press("Enter");
    assert.equal(await shareMenu.getAttribute("open"), "");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    const shareLinks = await page.locator("[data-article-share] a[data-network]").evaluateAll(links => links.map(link => ({
      network: link.dataset.network,
      href: link.href,
      target: link.target,
      rel: link.rel,
      label: link.getAttribute("aria-label"),
    })));
    assert.deepEqual(shareLinks.map(link => link.network), ["linkedin", "x", "facebook", "whatsapp", "bluesky"]);
    for (const link of shareLinks) {
      assert.equal(link.target, "_blank");
      assert.match(link.rel, /\bnoopener\b/);
      assert.match(link.rel, /\bnoreferrer\b/);
      assert.match(link.label, /^Share on /);
      const destination = new URL(link.href);
      const sharedValue = destination.searchParams.get(link.network === "facebook" ? "u" : link.network === "linkedin" || link.network === "x" ? "url" : "text");
      assert.ok(sharedValue && sharedValue.includes(link.network === "whatsapp" || link.network === "bluesky" ? canonical : canonical));
    }
    assert.equal(await page.locator('[data-article-share] button[aria-label="Copy article link"]').count(), 1);
    assert.equal((await page.locator("#article-share-title").innerText()).trim(), "Share this article");
    assert.equal((await page.locator("h1").innerText()).trim(), shareTitle);
    pass("The article share control is keyboard-openable and uses the canonical URL for five safe network links");

    await page.goto(`${origin}/insights/vulnerability-assessment-vs-penetration-testing.html`);
    assert.equal(await page.locator("[data-article-share]").count(), 1);
    assert.equal(await page.locator("[data-article-share] a[data-network]").count(), 5);
    pass("The same share control appears on the practical guide article shell");

    await page.goto(`${origin}/blog.html`);
    assert.equal(await page.locator(".insight-card").count(), 5);
    const pciGuide = page.locator('main a[href="/insights/pci-dss-network-segmentation-testing.html"]');
    assert.equal(await pciGuide.count(), 1);
    await pciGuide.click();
    await page.waitForURL(`${origin}/insights/pci-dss-network-segmentation-testing.html`);
    assert.equal((await page.locator("h1").innerText()).trim(), "PCI DSS network segmentation testing: 11.4.5 and 11.4.6");
    assert.equal(await page.locator(".faq-item").count(), 6);
    assert.equal(await page.locator(".scope-table").count(), 2);
    await page.goto(`${origin}/blog.html`);
    assert.ok(await page.locator('a[href="/blogs.html#bug-bounty-archive"]').count() > 0);
    await page.goto(`${origin}/blogs.html`);
    assert.ok(await page.locator('a[href="/blog.html"]').count() > 0);
    pass("The guide hub links to the PCI segmentation guide and both collections link to each other");

    for (const [topic, expectedRoutes] of Object.entries(TOPICS)) {
      const button = page.locator(`[data-archive-filter="${topic}"]`);
      await button.focus();
      await page.keyboard.press("Enter");
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-archive-filter][aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator("[data-archive-card]:visible").count(), expectedRoutes.length);
      const visibleRoutes = await page.locator("[data-archive-card]:visible a[href]").evaluateAll(links => links.map(link => link.getAttribute("href")).sort());
      assert.deepEqual(visibleRoutes, [...expectedRoutes].sort());
      assert.equal(await page.locator("[data-archive-count]").innerText(), `Showing ${expectedRoutes.length} articles`);
    }
    pass("Every archive topic filter works with Enter and announces its result count");

    const search = page.locator("[data-archive-search]");
    const reset = page.locator("[data-archive-reset]");
    await page.locator('[data-archive-filter="state-caching"]').press("Space");
    await search.fill("cart");
    assert.equal(await page.locator("[data-archive-card]:visible").count(), 1);
    assert.equal(await page.locator("[data-archive-card]:visible").getAttribute("data-topic"), "state-caching");
    assert.equal(await page.locator("[data-archive-count]").innerText(), "Showing 1 article");
    await search.fill("nothing-matches-this-query");
    assert.equal(await page.locator("[data-archive-card]:visible").count(), 0);
    assert.equal(await page.locator("[data-archive-empty]").isVisible(), true);
    assert.equal(await page.locator("[data-archive-count]").innerText(), "Showing 0 articles");
    await reset.focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator("[data-archive-card]:visible").count(), ARTICLES.length);
    assert.equal(await search.inputValue(), "");
    assert.equal(await search.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.locator('[data-archive-filter="all"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("[data-archive-empty]").isVisible(), false);
    assert.equal(await page.locator("[data-archive-count]").innerText(), `Showing ${ARTICLES.length} articles`);
    await search.fill(" PRIVATE   ORIGIN ");
    assert.equal(await page.locator("[data-archive-card]:visible").count(), 1);
    assert.equal(await page.locator("[data-archive-card]:visible").getAttribute("data-topic"), "state-caching");
    await reset.click();
    pass("Search combines with topics, handles multiple words and empty results, and resets by keyboard");

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of PAGES) {
        await page.goto(`${origin}${route}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflows at ${width}px`);
        assert.equal(await page.locator("h1").count(), 1);
        if (route !== "/blogs.html") assert.equal(await page.locator("[data-article-share]").count(), 1, `${route} needs one share control at ${width}px`);
        if (!RESEARCH_ROUTES.has(route)) {
          assert.doesNotMatch(await page.locator("body").innerText(), /[^\x00-\x7F]/, `${route} contains non-ASCII body text at ${width}px`);
        }
        for (const block of await page.locator(".research-article-body pre, .research-story-figure, .research-cover-figure, .case-code, .scope-table-wrap").all()) {
          assert.ok(await block.evaluate(element => element.getBoundingClientRect().width <= innerWidth), `${route} has an overflowing reading block at ${width}px`);
        }
      }
      pass(`The hub and ${ARTICLES.length} articles fit ${width}px with contained reading blocks`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/blogs.html`);
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    assert.equal(await page.locator('.nav-links a[href="/blogs.html"]').isVisible(), true);
    await page.getByRole("button", { name: "Close menu", exact: true }).click();
    assert.equal(await page.locator("[data-menu-toggle]").getAttribute("aria-expanded"), "false");
    pass("The mobile menu exposes the Blog destination and closes correctly");

    const plain = await browser.newContext({
      javaScriptEnabled: false, viewport: { width: 390, height: 844 },
    });
    await plain.route("**/*", blockExternal);
    const nojs = await plain.newPage();
    observe(nojs);
    await nojs.goto(`${origin}/blogs.html`);
    assert.equal(await nojs.locator("[data-archive-card]:visible").count(), ARTICLES.length);
    assert.equal(await nojs.locator("[data-archive-controls]").isVisible(), false);
    assert.equal(await nojs.locator("[data-archive-empty]").isVisible(), false);
    assert.equal(await nojs.locator(".nav-menu").isVisible(), true);
    assert.ok(await nojs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const [firstRoute, firstTitle] = FIELD_NOTES[0];
    await nojs.locator(`[data-archive-card] a[href="${firstRoute}"]`).click();
    await nojs.waitForURL(`${origin}${firstRoute}`);
    assert.equal((await nojs.locator("h1").innerText()).trim(), firstTitle);
    assert.equal(await nojs.locator(".research-article-body").count(), 1);
    assert.ok(await nojs.locator(".research-story-figure").count() >= 1);
    assert.equal(await nojs.locator(".research-cover-figure img").count(), 1);
    pass(`Without JavaScript all ${ARTICLES.length} articles and navigation remain visible, filters stay hidden, and links work`);

    assert.deepEqual(errors, [], "The blog and articles should not throw JavaScript errors");
    assert.deepEqual(external, [], "The blog and articles should not request third-party resources");
    assert.deepEqual(missing, [], "All requested public pages and assets should be available");
    console.log(`${checks} blog checks passed; no uncaught errors, external requests, or missing assets.`);
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
