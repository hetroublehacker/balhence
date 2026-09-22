#!/usr/bin/env node
"use strict";
// Local browser checks for the new shared disclosure and US launch content.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { chromium } = require("playwright");
const GUIDES = [
  "does-soc-2-require-penetration-testing",
  "how-to-plan-llm-security-testing",
  "ptaas-vs-annual-penetration-test",
];
(async () => {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: path.resolve(__dirname, ".."), stdio: "ignore" });
  let browser;
  const errors = [], external = [], missing = [];
  let checks = 0;
  const pass = message => { checks++; console.log(`PASS ${message}`); };
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      try { if ((await fetch(origin)).ok) break; } catch { /* Starting preview. */ }
      if (attempt === 39) throw new Error("Preview did not start");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    browser = await chromium.launch({ headless: true });
    async function contextFor(options = {}) {
      const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 }, ...options });
      await context.route("**/*", route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      context.on("page", page => {
        page.on("pageerror", error => errors.push(error.message));
        page.on("response", response => { if (response.status() >= 400) missing.push(response.url()); });
      });
      return context;
    }
    const context = await contextFor();
    const page = await context.newPage();
    await page.goto(origin);
    await page.locator("[data-consent-decline]").click();
    const menu = page.locator("[data-solutions-menu]");
    const summary = menu.locator("summary");
    const first = menu.locator("a").first();
    assert.equal(await first.isVisible(), false);
    await summary.focus();
    await page.keyboard.press("Enter");
    assert.equal(await first.isVisible(), true);
    await page.keyboard.press("Tab");
    assert.equal(await first.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Escape");
    assert.equal(await menu.evaluate(node => node.open), false);
    assert.equal(await summary.evaluate(node => node === document.activeElement), true);
    await summary.click();
    await page.locator("h1").click();
    assert.equal(await menu.evaluate(node => node.open), false);
    pass("Desktop Solutions disclosure works with keyboard, Escape, and outside clicks");

    for (const width of [320, 390, 768, 900, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const file of ["/", "/services.html", "/blog.html", ...GUIDES.map(slug => `/insights/${slug}.html`)]) {
        await page.goto(origin + file);
        assert.equal(await page.locator("h1").count(), 1);
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file} overflows at ${width}px`);
        assert.ok((await page.locator("main").innerText()).length > 300);
      }
      pass(`Launch guides and service hubs fit ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/soc-2-penetration-testing.html`);
    const toggle = page.locator("[data-menu-toggle]");
    await toggle.click();
    await summary.click();
    assert.equal(await first.isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await menu.evaluate(node => node.open), false);
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("main").evaluate(node => node.inert), false);
    await toggle.click();
    await summary.click();
    await menu.locator('a[href="/ai-llm-penetration-testing.html"]').click();
    await page.waitForURL("**/ai-llm-penetration-testing.html");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    const navCta = page.locator(".nav-menu > .btn-primary");
    assert.match(await navCta.getAttribute("href"), /service=ai&source=ai-pentest/);
    pass("Mobile nested Escape closes one menu at a time and service navigation retains correct intake");

    // An open mobile menu must never tab into collapsed submenu links or background content.
    await toggle.click();
    for (let index = 0; index < 16; index++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          inMenu: Boolean(active.closest("[data-menu], [data-menu-toggle]")),
          hiddenSubmenu: Boolean(active.closest(".solutions-links")),
          visible: active.getClientRects().length > 0,
        };
      });
      assert.equal(state.inMenu, true);
      assert.equal(state.hiddenSubmenu, false);
      assert.equal(state.visible, true);
    }
    pass("Mobile keyboard focus excludes collapsed submenu links and inert background content");
    await page.keyboard.press("Escape");

    for (const reducedMotion of ["reduce", "no-preference"]) {
    const nojs = await contextFor({ javaScriptEnabled: false, reducedMotion, viewport: { width: 390, height: 844 } });
    const nativePage = await nojs.newPage();
    await nativePage.goto(`${origin}/compliance-penetration-testing.html`);
    await nativePage.locator("[data-solutions-menu] summary").click();
    await nativePage.locator('[data-solutions-menu] a[href="/hipaa-penetration-testing.html"]').click();
    await nativePage.waitForURL("**/hipaa-penetration-testing.html");
    await nativePage.evaluate(() => document.fonts.ready);
    assert.equal(await nativePage.locator("h1").innerText(), "HIPAA penetration testing");
    await nativePage.locator(".faq-item summary").first().click();
    assert.equal(await nativePage.locator(".faq-item[open] p").isVisible(), true);
    pass(`Solutions navigation and FAQs work without JavaScript (${reducedMotion})`);
    await nojs.close();

    }

    // Retain a few representative renders for a manual visual review.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/soc-2-penetration-testing.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: "/tmp/balhence-us-soc2-desktop.png" });
    await page.goto(origin);
    await page.locator(".home-solutions").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/balhence-us-home-content.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/ai-llm-penetration-testing.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: "/tmp/balhence-us-ai-mobile.png" });
    await context.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    assert.deepEqual(external, []);
    console.log(`${checks} US launch browser checks passed; no page errors, missing assets, or external requests.`);
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
