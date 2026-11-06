#!/usr/bin/env node
"use strict";

// Local publication and interaction checks. Requires Playwright with Chromium.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { chromium } = require("playwright");

const FIELD_NOTES = [
  ["/insights/draft-write-authorization.html", "The draft you could change but could not read"],
  ["/insights/session-authority-boundary.html", "When two browsers inherited one cart"],
  ["/insights/private-response-cache-boundary.html", "When the cache forgot who a response belonged to"],
  ["/insights/server-owned-validation-rules.html", "When a validation helper became a data query"],
  ["/insights/evidence-gated-workflows.html", "Submitted is not the same as verified"],
];
const RESEARCH_ARTICLES = [
  ["/research/dependency-confusion.html", "How I approached Dependency Confusion!"],
  ["/research/cve-2020-28726.html", "Assigned my First CVE-2020–28726!!"],
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
    "/insights/draft-write-authorization.html",
    "/research/first-bounty-target.html",
    "/research/automating-burp-idor.html",
  ],
  "web-attacks": [
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
  const server = spawn("python3", ["serve.py", "--port", String(port)], {
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
      try { if ((await fetch(origin)).ok) break; } catch { /* Preview is starting. */ }
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
    assert.equal(await page.locator("[data-archive-card]").count(), 15);
    assert.equal(await page.locator("[data-archive-card]:visible").count(), 15);
    assert.equal(await page.locator("[data-field-note-card]").count(), 5);
    assert.equal(await page.locator('#bug-bounty-archive[aria-labelledby]').count(), 1);
    const cardLabels = await page.locator("[data-archive-card] a[aria-labelledby]").evaluateAll(links => links.map(link => link.getAttribute("aria-labelledby")));
    assert.equal(cardLabels.length, 15, "Every archive card link should name its title");
    assert.equal(new Set(cardLabels).size, 15, "Every archive card title ID should be unique");
    for (const label of cardLabels) assert.equal(await page.locator(`#${label}`).count(), 1);
    const destinations = await page.locator("[data-archive-card] a[href]").evaluateAll(links => links.map(link => link.getAttribute("href")));
    assert.equal(destinations.length, 15, "Each archive card should link once to its article");
    assert.equal(new Set(destinations).size, 15, "Archive cards must not duplicate articles");
    assert.deepEqual([...destinations].sort(), ARTICLES.map(([route]) => route).sort());
    pass("The hub contains exactly fifteen unique articles in one archive");

    for (const [route, title] of FIELD_NOTES) {
      await page.goto(`${origin}/blogs.html`);
      await page.locator(`[data-archive-card] a[href="${route}"]`).click();
      await page.waitForURL(`${origin}${route}`);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal((await page.locator("h1").innerText()).trim(), title);
      assert.equal(await page.locator(".scope-table").count(), 1, `${route} should have one regression table`);
      assert.equal(await page.locator(".scope-table tbody tr").count(), 5, `${route} should have five regression cases`);
      assert.equal(await page.locator(".http-notebook").count(), 1);
      assert.equal(await page.locator(".http-code").count(), 2);
      assert.match(await page.locator(".http-code").first().innerText(), /^GET \/redacted\/[a-z-]+ HTTP\/1\.1/);
      assert.match(await page.locator(".http-notebook-caption").innerText(), /SYNTHETIC \+ REDACTED/);
      assert.equal(await page.locator('a[href="#http-notebook"]').count(), 1);
      assert.ok(await page.locator('a[href="/blogs.html#bug-bounty-archive"]').count() > 0, `${route} should link back to the collection`);
    }
    pass("Every field note opens with five regression rows and a collection link");

    await page.goto(`${origin}/insights/draft-write-authorization.html`);
    const repair = page.locator('.case-remediation[aria-labelledby="policy"]');
    assert.equal(await repair.locator("#policy").innerText(), "Closing the authorization gap");
    assert.equal(await repair.locator("pre").count(), 0, "The repair section should read as prose, not pseudocode");
    assert.equal(await repair.locator(".case-editorial").isVisible(), true);
    assert.match(await repair.innerText(), /proposed repair/);
    assert.match(await repair.innerText(), /Check the saved draft, not just the response/);
    pass("The draft repair section uses story-led prose and a compact retest note");

    await page.goto(`${origin}/blog.html`);
    assert.equal(await page.locator(".insight-card").count(), 5);
    assert.ok(await page.locator('a[href="/blogs.html#bug-bounty-archive"]').count() > 0);
    await page.goto(`${origin}/blogs.html`);
    assert.ok(await page.locator('a[href="/blog.html"]').count() > 0);
    pass("The five existing guides remain available and both collections link to each other");

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
    assert.equal(await page.locator("[data-archive-card]:visible").count(), 15);
    assert.equal(await search.inputValue(), "");
    assert.equal(await search.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.locator('[data-archive-filter="all"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("[data-archive-empty]").isVisible(), false);
    assert.equal(await page.locator("[data-archive-count]").innerText(), "Showing 15 articles");
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
        if (!RESEARCH_ROUTES.has(route)) {
          assert.doesNotMatch(await page.locator("body").innerText(), /[^\x00-\x7F]/, `${route} contains non-ASCII body text at ${width}px`);
        }
        for (const block of await page.locator(".case-code, .scope-table-wrap").all()) {
          assert.ok(await block.evaluate(element => element.getBoundingClientRect().width <= innerWidth), `${route} has an overflowing reading block at ${width}px`);
        }
      }
      pass(`The hub and fifteen articles fit ${width}px with contained reading blocks`);
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
    assert.equal(await nojs.locator("[data-archive-card]:visible").count(), 15);
    assert.equal(await nojs.locator("[data-archive-controls]").isVisible(), false);
    assert.equal(await nojs.locator("[data-archive-empty]").isVisible(), false);
    assert.equal(await nojs.locator(".nav-menu").isVisible(), true);
    assert.ok(await nojs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const [firstRoute, firstTitle] = FIELD_NOTES[0];
    await nojs.locator(`[data-archive-card] a[href="${firstRoute}"]`).click();
    await nojs.waitForURL(`${origin}${firstRoute}`);
    assert.equal((await nojs.locator("h1").innerText()).trim(), firstTitle);
    assert.equal(await nojs.locator(".scope-table tbody tr").count(), 5);
    pass("Without JavaScript all fifteen articles and navigation remain visible, filters stay hidden, and links work");

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
