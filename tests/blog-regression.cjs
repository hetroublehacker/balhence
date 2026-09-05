#!/usr/bin/env node
"use strict";

// Local publication and interaction checks. Requires Playwright with Chromium.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { chromium } = require("playwright");

const ARTICLES = [
  ["/insights/draft-write-authorization.html", "The draft you could change but could not read"],
  ["/insights/session-authority-boundary.html", "When two browsers inherited one cart"],
  ["/insights/private-response-cache-boundary.html", "When the cache forgot who a response belonged to"],
  ["/insights/server-owned-validation-rules.html", "When a validation helper became a data query"],
  ["/insights/evidence-gated-workflows.html", "Submitted is not the same as verified"],
];
const TOPICS = ["authorization", "sessions", "caching", "validation", "workflows"];
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

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      reducedMotion: "reduce", viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/*", blockExternal);
    const page = await context.newPage();
    observe(page);
    await page.goto(`${origin}/blogs.html`);
    await page.locator("[data-case-controls]").waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-case-card]").count(), 5);
    assert.equal(await page.locator("[data-case-card]:visible").count(), 5);
    const destinations = await page.locator("[data-case-card] a[href]").evaluateAll(links => links.map(link => link.getAttribute("href")));
    assert.equal(destinations.length, 5, "Each case card should link once to its article");
    assert.equal(new Set(destinations).size, 5, "Featured and regular cards must not duplicate articles");
    assert.deepEqual([...destinations].sort(), ARTICLES.map(([route]) => route).sort());
    assert.equal(await page.locator("[data-case-card].case-card-featured").count(), 1);
    pass("The hub contains exactly five unique case studies, including one featured case");

    for (const [route, title] of ARTICLES) {
      await page.goto(`${origin}/blogs.html`);
      await page.locator(`[data-case-card] a[href="${route}"]`).click();
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
      assert.ok(await page.locator('a[href="/blogs.html"]').count() > 0, `${route} should link back to the collection`);
    }
    pass("Every case card opens its article with five regression rows and a collection link");

    await page.goto(`${origin}/blog.html`);
    assert.equal(await page.locator(".insight-card").count(), 5);
    assert.ok(await page.locator('a[href="/blogs.html"]').count() > 0);
    await page.goto(`${origin}/blogs.html`);
    assert.ok(await page.locator('a[href="/blog.html"]').count() > 0);
    pass("The five existing guides remain available and both collections link to each other");

    for (const topic of TOPICS) {
      const button = page.locator(`[data-case-filter="${topic}"]`);
      await button.focus();
      await page.keyboard.press("Enter");
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-case-filter][aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator("[data-case-card]:visible").count(), 1);
      assert.equal(await page.locator("[data-case-card]:visible").getAttribute("data-topic"), topic);
      assert.equal(await page.locator("[data-case-count]").innerText(), "Showing 1 case study");
    }
    pass("Every topic filter works with Enter and announces the selected result count");

    const search = page.locator("[data-case-search]");
    const reset = page.locator("[data-case-reset]");
    await page.locator('[data-case-filter="sessions"]').press("Space");
    await search.fill("server");
    assert.equal(await page.locator("[data-case-card]:visible").count(), 1);
    assert.equal(await page.locator("[data-case-card]:visible").getAttribute("data-topic"), "sessions");
    await search.fill("nothing-matches-this-query");
    assert.equal(await page.locator("[data-case-card]:visible").count(), 0);
    assert.equal(await page.locator("[data-case-empty]").isVisible(), true);
    assert.equal(await page.locator("[data-case-count]").innerText(), "Showing 0 case studies");
    await reset.focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator("[data-case-card]:visible").count(), 5);
    assert.equal(await search.inputValue(), "");
    assert.equal(await search.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.locator('[data-case-filter="all"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("[data-case-empty]").isVisible(), false);
    assert.equal(await page.locator("[data-case-count]").innerText(), "Showing 5 case studies");
    await search.fill(" PRIVATE   ORIGIN ");
    assert.equal(await page.locator("[data-case-card]:visible").count(), 1);
    assert.equal(await page.locator("[data-case-card]:visible").getAttribute("data-topic"), "caching");
    await reset.click();
    pass("Search combines with topics, handles multiple words and empty results, and resets by keyboard");

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of PAGES) {
        await page.goto(`${origin}${route}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflows at ${width}px`);
        assert.equal(await page.locator("h1").count(), 1);
        assert.doesNotMatch(await page.locator("body").innerText(), /[^\x00-\x7F]/, `${route} contains non-ASCII body text at ${width}px`);
        for (const block of await page.locator(".case-code, .scope-table-wrap").all()) {
          assert.ok(await block.evaluate(element => element.getBoundingClientRect().width <= innerWidth), `${route} has an overflowing reading block at ${width}px`);
        }
      }
      pass(`The hub and five articles fit ${width}px with ASCII body text and contained reading blocks`);
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
    assert.equal(await nojs.locator("[data-case-card]:visible").count(), 5);
    assert.equal(await nojs.locator("[data-case-controls]").isVisible(), false);
    assert.equal(await nojs.locator("[data-case-empty]").isVisible(), false);
    assert.equal(await nojs.locator(".nav-menu").isVisible(), true);
    assert.ok(await nojs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const [firstRoute, firstTitle] = ARTICLES[0];
    await nojs.locator(`[data-case-card] a[href="${firstRoute}"]`).click();
    await nojs.waitForURL(`${origin}${firstRoute}`);
    assert.equal((await nojs.locator("h1").innerText()).trim(), firstTitle);
    assert.equal(await nojs.locator(".scope-table tbody tr").count(), 5);
    pass("Without JavaScript all five cases and navigation remain visible, filters stay hidden, and links work");

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
