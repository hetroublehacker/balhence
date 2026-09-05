#!/usr/bin/env node
"use strict";

// Local-only intake checks. Requires Playwright with Chromium installed.
const assert = require("node:assert/strict");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const SERVICES = [
  "web-api", "release-check", "assurance", "mobile", "cloud", "external",
  "infrastructure", "identity", "ai", "code", "devsecops", "detection",
  "readiness", "specialist", "custom", "not-sure",
];
const ROUTES = [
  "web-api", "mobile", "external", "cloud", "infrastructure", "identity",
  "ai", "code", "devsecops", "detection", "readiness", "specialist",
  "custom", "not-sure",
];
const BRIEF_KEY = "balhence_scope_brief_v1";

async function main() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("python3", ["serve.py", "--port", String(port)], {
    cwd: path.resolve(__dirname, ".."), stdio: "ignore",
  });
  let browser;
  let checks = 0;
  const pass = message => { checks++; console.log(`PASS ${message}`); };
  const errors = [];
  const external = [];
  const blockExternal = route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    external.push(route.request().url());
    return route.abort();
  };

  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      try { if ((await fetch(origin)).ok) break; } catch { /* Preview is starting. */ }
      if (attempt === 39) throw new Error("Preview did not start");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
    await context.route("**/*", blockExternal);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));

    await page.goto(`${origin}/contact.html`);
    assert.deepEqual(await page.locator("#service option").evaluateAll(options => options.map(option => option.value).filter(Boolean)), SERVICES);
    for (const service of SERVICES) {
      await page.goto(`${origin}/contact.html?service=${service}`);
      assert.equal(await page.locator("#service").inputValue(), service);
      assert.equal(await page.locator("#service").isEnabled(), true);
      assert.equal(await page.locator("#service").isVisible(), true);
    }
    await page.goto(`${origin}/contact.html?service=unknown-area`);
    assert.equal(await page.locator("#service").inputValue(), "");
    pass("All 16 service categories preselect safely; unknown values do not become choices");

    await page.goto(`${origin}/scope-builder.html`);
    assert.match(await page.locator("#builder-title").textContent(), /web or API/i);
    assert.deepEqual((await page.locator("[data-capability-route]").evaluateAll(links => links.map(link => link.dataset.capabilityRoute))).sort(), [...ROUTES].sort());
    for (const service of ROUTES) {
      const link = page.locator(`[data-capability-route="${service}"]`);
      assert.ok((await link.textContent()).trim().length > 0);
      const destination = new URL(await link.getAttribute("href"), origin);
      if (service === "web-api") {
        assert.equal(destination.hash, "#scope-builder");
      } else {
        assert.equal(destination.pathname, "/contact.html");
        assert.equal(destination.searchParams.get("service"), service);
      }
    }
    for (const service of ["ai", "cloud", "specialist", "custom"]) {
      await page.goto(`${origin}/scope-builder.html`);
      await page.locator(`[data-capability-route="${service}"]`).click();
      await page.waitForURL(`**/contact.html?service=${service}`);
      assert.equal(await page.locator("#service").inputValue(), service);
    }
    pass("Broad project routes lead to specialist intake, while web and API work retains its planner");

    await page.evaluate(key => sessionStorage.setItem(key, JSON.stringify({
      version: 1,
      source: "scope-builder",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      recommendation: "Web & API Sprint",
      indicativeWindow: "Scope review required",
      brief: "DRAFT: a previous web and API test brief.",
    })), BRIEF_KEY);
    for (const service of SERVICES.filter(value => value !== "web-api")) {
      await page.goto(`${origin}/contact.html?service=${service}`);
      assert.equal(await page.locator("#service").inputValue(), service);
      assert.equal(await page.locator("#service").isVisible(), true);
      assert.equal(await page.locator("#service").isEnabled(), true);
      assert.equal(await page.locator("[data-scope-brief-handoff]").isVisible(), false);
      assert.equal(await page.locator('input[name="generated_scope_brief"]').count(), 0);
    }
    assert.ok(await page.evaluate(key => sessionStorage.getItem(key), BRIEF_KEY));
    await page.goto(`${origin}/contact.html?service=web-api`);
    assert.equal(await page.locator("[data-scope-brief-handoff]").isVisible(), true);
    assert.match(await page.locator('input[name="generated_scope_brief"]').inputValue(), /previous web and API/);
    await page.evaluate(key => sessionStorage.removeItem(key), BRIEF_KEY);
    pass("A saved web brief cannot override another discipline, and remains available for web intake");

    await page.goto(`${origin}/scope-builder.html`);
    await page.locator('[data-capability-route="web-api"]').click();
    assert.equal(new URL(page.url()).hash, "#scope-builder");
    await page.evaluate(() => {
      const form = document.getElementById("scope-planner-form");
      for (const radio of form.querySelectorAll("input[type=radio][required]")) radio.checked = true;
      for (const select of form.querySelectorAll("select[required]")) select.selectedIndex = 1;
      form.elements.web_app_count.value = "1";
      form.elements.api_group_count.value = "0";
      for (const group of form.querySelectorAll("[data-required-group]")) group.querySelector("input").checked = true;
      form.querySelector("input").dispatchEvent(new Event("change", { bubbles: true }));
    });
    for (let step = 0; step < 5; step++) await page.locator("[data-step]:visible [data-next]").click();
    await page.locator("[data-build-brief]").click();
    assert.ok(await page.evaluate(key => sessionStorage.getItem(key), BRIEF_KEY));
    await page.locator("[data-contact-cta]").click();
    await page.waitForURL("**/contact.html?**");
    assert.equal(new URL(page.url()).searchParams.get("service"), "web-api");
    assert.equal(await page.locator("[data-scope-brief-handoff]").isVisible(), true);
    pass("The six-step web and API estimator still builds and transfers its scoped brief");

    await page.evaluate(key => sessionStorage.removeItem(key), BRIEF_KEY);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["scope-builder.html", "contact.html?service=ai"]) {
        await page.goto(`${origin}/${route}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflows at ${width}px`);
        assert.equal(await page.locator("h1").count(), 1);
      }
    }
    pass("Broad intake and the planner fit mobile, tablet, and desktop widths");

    const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await plain.route("**/*", blockExternal);
    const nojs = await plain.newPage();
    await nojs.goto(`${origin}/scope-builder.html`);
    assert.equal(await nojs.locator("[data-capability-route]").count(), ROUTES.length);
    for (const service of ROUTES) assert.equal(await nojs.locator(`[data-capability-route="${service}"]`).isVisible(), true);
    await nojs.locator('[data-capability-route="ai"]').click();
    await nojs.waitForURL("**/contact.html?service=ai");
    assert.equal(await nojs.locator("#service").isVisible(), true);
    assert.equal(await nojs.locator('#service option[value="ai"]').count(), 1);
    assert.ok(await nojs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    pass("Every project route remains usable without JavaScript; the full form stays available");

    assert.deepEqual(errors, [], "Intake pages should not throw JavaScript errors");
    assert.deepEqual(external, [], "The flow should not request third-party resources");
    console.log(`${checks} capability checks passed; no external requests or form submissions.`);
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
