#!/usr/bin/env node
"use strict";
// Optional local browser checks. Requires Playwright + Chromium; no external traffic.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const net = require("node:net");
const { chromium } = require("playwright");

(async () => {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: path.resolve(__dirname, ".."), stdio: "ignore" });
  let browser;
  let passed = 0;
  const pass = name => { console.log(`PASS ${name}`); passed++; };
  try {
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(origin)).ok) break; } catch { /* Preview is starting. */ }
      if (i === 39) throw new Error("Preview did not start");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const external = [];
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install();
    await page.goto(origin);
    await page.clock.runFor(1300);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("html").evaluate(el => el.classList.contains("home-motion")), true);
    assert.equal(await page.evaluate(() => document.getAnimations().some(a => a.animationName === "orbit-travel")), true);
    assert.deepEqual(external, []);
    pass("Hero motion runs without third-party requests");

    await page.clock.runFor(6000);
    assert.equal(await page.locator('[data-signal-step="1"]').getAttribute("aria-pressed"), "true");
    await page.locator('[data-signal-step="2"]').click();
    assert.match(await page.locator("[data-signal-response]").textContent(), /403 Forbidden/);
    await page.clock.runFor(6500);
    assert.equal(await page.locator('[data-signal-step="2"]').getAttribute("aria-pressed"), "true");
    await page.locator('[data-signal-step="2"]').press("Home");
    assert.equal(await page.locator('[data-signal-step="0"]').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator("[data-signal-status]").evaluate(el => el.getBoundingClientRect().width), 1);
    pass("Evidence sequence advances, supports keyboard control, and respects manual selection");

    await page.locator("[data-motion-toggle]").click();
    assert.equal(await page.evaluate(() => localStorage.getItem("balhence_motion_paused")), "true");
    assert.equal(await page.locator("html").evaluate(el => el.classList.contains("home-motion")), false);
    await page.reload();
    assert.equal(await page.locator("[data-motion-toggle]").getAttribute("aria-label"), "Play animation");
    await page.locator("[data-motion-toggle]").click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector("[data-motion-toggle]").disabled);
    assert.equal(await page.locator("html").evaluate(el => el.classList.contains("home-motion")), false);
    pass("Motion pause persists and device reduced-motion preference takes priority");

    await page.clock.resume();
    await page.goto(`${origin}/report-viewer.html`);
    await page.locator('[data-report-tab="executive"]').focus();
    await page.keyboard.press("End");
    assert.equal(await page.locator('[data-report-panel="retest"]').isVisible(), true);
    assert.equal(new URL(page.url()).hash, "#retest");
    const sample = await page.request.get(`${origin}/sample-vapt-report.pdf`);
    assert.equal((await sample.body()).subarray(0, 5).toString(), "%PDF-");
    pass("Report explorer supports keyboard navigation and serves a valid PDF");

    await page.goto(`${origin}/scope-builder.html`);
    await page.locator("[data-step]:visible [data-next]").click();
    assert.equal(await page.locator("[data-form-error]").isVisible(), true);
    await page.evaluate(() => {
      const form = document.getElementById("scope-planner-form");
      for (const radio of form.querySelectorAll("input[type=radio][required]")) radio.checked = true;
      for (const select of form.querySelectorAll("select[required]")) select.selectedIndex = 1;
      form.elements.web_app_count.value = "1";
      form.elements.api_group_count.value = "0";
      for (const group of form.querySelectorAll("[data-required-group]")) group.querySelector("input").checked = true;
      form.querySelector("input").dispatchEvent(new Event("change", { bubbles: true }));
    });
    for (let i = 0; i < 5; i++) await page.locator("[data-step]:visible [data-next]").click();
    await page.locator("[data-build-brief]").click();
    const downloadEvent = page.waitForEvent("download");
    await page.locator("[data-download]").click();
    const download = await downloadEvent;
    assert.match(download.suggestedFilename(), /\.pdf$/);
    assert.equal(await download.failure(), null);
    let bytes = Buffer.alloc(0);
    for await (const chunk of await download.createReadStream()) bytes = Buffer.concat([bytes, chunk]);
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    assert.ok(bytes.length > 5000);
    pass("Planner validates incomplete answers and exports an actual PDF");

    const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await plain.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const nojs = await plain.newPage();
    await nojs.goto(origin);
    assert.equal(await nojs.locator("h1").isVisible(), true);
    assert.equal(await nojs.locator(".nav-menu").isVisible(), true);
    assert.equal(await nojs.locator(".signal-controls").isVisible(), false);
    assert.ok(await nojs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    pass("Mobile content and navigation remain usable without JavaScript");
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(`${passed} experience checks passed; no uncaught errors or external requests.`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
