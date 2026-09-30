#!/usr/bin/env node
"use strict";

// Run with: node tests/flow-regression.cjs
// Requires Playwright + Chromium. Only the local preview receives requests;
// form delivery is intercepted and no test submits an enquiry.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const net = require("node:net");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const MOTION_KEY = "balhence_motion_paused";
const GUIDE = "/insights/ptaas-vs-annual-penetration-test.html";

async function availablePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function expectCurrent(page, navigation, href) {
  await page.waitForFunction(({ navigation, href }) => {
    const current = document.querySelector(`${navigation} a[aria-current="location"]`);
    return current?.getAttribute("href") === href;
  }, { navigation, href }, { timeout: 4000 });
  assert.equal(await page.locator(`${navigation} a[aria-current="location"]`).count(), 1);
}

async function expectCurrentInView(page, navigation) {
  await page.waitForFunction(selector => {
    const nav = document.querySelector(selector);
    const current = nav?.querySelector('a[aria-current="location"]');
    if (!current) return false;
    const bounds = nav.getBoundingClientRect();
    const pill = current.getBoundingClientRect();
    return pill.left >= bounds.left - 1 && pill.right <= bounds.right + 1;
  }, navigation, { timeout: 4000 });
}

async function expectJumpBelowHeader(page, target, obstruction) {
  await page.waitForFunction(({ target, obstruction }) => {
    const destination = document.querySelector(target)?.getBoundingClientRect();
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const extra = obstruction && document.querySelector(obstruction)?.getBoundingClientRect();
    const edge = Math.max(0, header.bottom, extra?.bottom || 0);
    return destination && destination.top >= edge - 1 && destination.top < innerHeight - 80;
  }, { target, obstruction }, { timeout: 4000 });
}

async function main() {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: ROOT, stdio: "ignore" });
  let serverError;
  server.on("error", error => { serverError = error; });
  let browser;
  let passed = 0;
  const failures = [];
  const errors = [];
  const missing = [];
  const external = [];
  const deliveries = [];

  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (serverError) throw serverError;
      try { if ((await fetch(origin)).ok) break; } catch { /* Preview is starting. */ }
      if (attempt === 39) throw new Error("Preview did not start");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    browser = await chromium.launch({ headless: true });

    async function createContext(options = {}) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", ...options,
      });
      await context.route("**/*", route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname === "formspree.io") {
          deliveries.push(request.url());
          return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
        }
        if (url.origin !== origin) {
          external.push(request.url());
          return route.abort();
        }
        if (!["GET", "HEAD"].includes(request.method())) {
          deliveries.push(`${request.method()} ${request.url()}`);
          return route.abort();
        }
        return route.continue();
      });
      context.on("page", page => {
        page.on("pageerror", error => errors.push(`${new URL(page.url()).pathname}: ${error.message}`));
        page.on("response", response => {
          if (response.status() >= 400 && new URL(response.url()).origin === origin) missing.push(response.url());
        });
      });
      await context.addInitScript(() => {
        try { localStorage.setItem("balhence_analytics_consent", "declined"); } catch { /* No storage in about:blank. */ }
      });
      return context;
    }

    async function check(name, options, run) {
      const context = await createContext(options);
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        await run(page, context);
        passed++;
        console.log(`PASS ${name}`);
      } catch (error) {
        failures.push({ name, error });
        console.error(`FAIL ${name}: ${error.message}`);
      } finally {
        await context.close();
      }
    }

    await check("Service selection appears before coverage and opens the chosen service", {}, async page => {
      await page.goto(`${origin}/services.html`);
      await page.evaluate(() => document.fonts.ready);
      const chooser = page.getByRole("heading", { name: "Which penetration testing service fits your project?" });
      const positions = await chooser.evaluate(element => ({
        chooser: element.getBoundingClientRect().top,
        coverage: document.querySelector("#capabilities").getBoundingClientRect().top,
      }));
      assert.ok(positions.chooser < positions.coverage, "Visitors should choose a starting point before the full coverage list");
      await page.getByRole("region", { name: "Penetration testing service selection" })
        .getByRole("link", { name: "Web application penetration testing", exact: true }).click();
      await page.waitForURL("**/web-application-penetration-testing.html");
      assert.match(await page.locator("h1").textContent(), /Web application\s*penetration testing/i);
    });

    await check("The section dock follows scrolling and keeps its active link visible after a mobile resize", {}, async page => {
      await page.goto(`${origin}/services.html`);
      await page.evaluate(() => document.fonts.ready);
      const nav = ".page-flow nav";
      await page.locator(`${nav} a[href="#packages-title"]`).click();
      await expectCurrent(page, nav, "#packages-title");
      await expectJumpBelowHeader(page, "#packages-title", ".page-flow");
      // Wheel input advances the page independently of dock clicks.
      await page.mouse.move(1250, 700);
      const distance = await page.locator("#included-title").evaluate(element => element.getBoundingClientRect().top - 100);
      await page.mouse.wheel(0, Math.max(200, distance));
      await expectCurrent(page, nav, "#included-title");
      await page.locator(`${nav} a[href="#included-title"]`).click();
      await expectCurrent(page, nav, "#included-title");
      await page.locator(".site-header .brand").evaluate(element => element.focus({ preventScroll: true }));
      await page.setViewportSize({ width: 320, height: 900 });
      await expectCurrentInView(page, nav);
      assert.equal(await page.locator(".site-header .brand").evaluate(element => document.activeElement === element), true,
        "Exposing the active dock link must preserve page focus");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "The dock must not widen the page");
      // At mobile size native navigation still places the selected heading below the dock.
      await page.locator(`${nav} a[href="#included-title"]`).click();
      await expectCurrent(page, nav, "#included-title");
      await expectJumpBelowHeader(page, "#included-title", ".page-flow");
    });

    await check("The mobile guide contents are keyboard usable and follow the section being read", { viewport: { width: 320, height: 900 } }, async page => {
      await page.goto(`${origin}${GUIDE}`);
      await page.evaluate(() => document.fonts.ready);
      const toc = page.getByRole("navigation", { name: "On this page", exact: true });
      await toc.getByRole("link").first().focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      assert.equal(await toc.locator('a[href="#compare"]').evaluate(element => document.activeElement === element), true);
      await page.keyboard.press("Enter");
      await page.waitForURL("**#compare");
      await expectCurrent(page, ".article-toc", "#compare");
      await expectJumpBelowHeader(page, "#compare", ".article-toc");
      const tocBounds = await toc.boundingBox();
      assert.ok(tocBounds.height >= 44 && tocBounds.width <= 320, "Contents links need a usable mobile target without page overflow");
      // Reading the next section updates the current link without moving focus there.
      await page.locator(".site-header .brand").evaluate(element => element.focus({ preventScroll: true }));
      await page.locator("#audit").evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await expectCurrent(page, ".article-toc", "#audit");
      await expectCurrentInView(page, ".article-toc");
      assert.equal(await page.locator(".site-header .brand").evaluate(element => document.activeElement === element), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    });

    for (const width of [320, 1440]) {
      await check(`Start your enquiry jumps to a visible form below the header at ${width}px`, { viewport: { width, height: 900 } }, async page => {
        await page.goto(`${origin}/contact.html`);
        await page.getByRole("link", { name: "Start your enquiry" }).click();
        await page.waitForURL("**#enquiry-form");
        await expectJumpBelowHeader(page, "#enquiry-form");
        const field = await page.getByRole("textbox", { name: "Your name", exact: false }).boundingBox();
        assert.ok(field.y >= 0 && field.y + field.height <= 900, "The first enquiry field should be available without another jump");
        assert.equal(await page.locator("form[data-lead-form]").count(), 1);
      });
    }

    await check("A comparison table explains mobile overflow and scrolls with native arrow keys", {}, async page => {
      await page.goto(`${origin}/services.html`);
      const region = page.getByRole("region", { name: "Penetration testing service selection" });
      const hint = page.getByText("Scroll to see every column. Keyboard: focus the table and use the arrow keys.", { exact: true }).first();
      assert.equal(await hint.isVisible(), false, "A table that fits should not ask visitors to scroll");
      await page.setViewportSize({ width: 320, height: 900 });
      await hint.waitFor({ state: "visible" });
      const hintId = await hint.getAttribute("id");
      assert.ok((await region.getAttribute("aria-describedby")).split(/\s+/).includes(hintId), "The visible scrolling instruction must also describe the keyboard region");
      await region.focus();
      const before = await region.evaluate(element => ({ left: element.scrollLeft, pageX: scrollX }));
      for (let index = 0; index < 6; index++) await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector('[aria-label="Penetration testing service selection"]').scrollLeft > 40);
      const after = await region.evaluate(element => ({ left: element.scrollLeft, pageX: scrollX }));
      assert.ok(after.left > before.left, "Arrow keys should expose the remaining columns");
      assert.equal(after.pageX, before.pageX, "The table should scroll without moving the whole page sideways");
      assert.equal(await region.evaluate(element => document.activeElement === element), true);
      await page.setViewportSize({ width: 1440, height: 900 });
      await hint.waitFor({ state: "hidden" });
      assert.equal((await region.getAttribute("aria-describedby") || "").includes(hintId), false, "Desktop visitors should not receive an obsolete overflow instruction");
    });

    await check("Homepage pause follows visitors to Services and a footer can resume it", { reducedMotion: "no-preference" }, async page => {
      await page.goto(origin);
      const heroToggle = page.locator("[data-motion-toggle]");
      await heroToggle.waitFor({ state: "visible" });
      await heroToggle.click();
      assert.match(await heroToggle.textContent(), /Play motion/);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), MOTION_KEY), "true");
      await page.locator('.section-intro a[href="/services.html#capabilities"]').click();
      await page.waitForURL("**/services.html#capabilities");
      const footerToggle = page.getByRole("button", { name: "Play motion", exact: true });
      assert.equal(await footerToggle.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("html").evaluate(element => getComputedStyle(element).scrollBehavior), "auto");
      await footerToggle.click();
      assert.equal(await page.evaluate(key => localStorage.getItem(key), MOTION_KEY), "false");
      assert.equal(await page.getByRole("button", { name: "Pause motion", exact: true }).getAttribute("aria-pressed"), "false");
      await page.reload();
      assert.equal(await page.getByRole("button", { name: "Pause motion", exact: true }).isEnabled(), true);
      await page.goto(origin);
      assert.match(await heroToggle.textContent(), /Pause motion/);
      assert.equal(await heroToggle.getAttribute("aria-pressed"), "false");
    });

    await check("Device reduced-motion preference overrides the saved play setting on both controls", { reducedMotion: "no-preference" }, async page => {
      await page.goto(origin);
      const heroToggle = page.locator("[data-motion-toggle]");
      await heroToggle.waitFor({ state: "visible" });
      assert.equal(await heroToggle.isEnabled(), true);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => document.querySelector("[data-motion-toggle]").disabled);
      assert.equal(await heroToggle.getAttribute("aria-pressed"), "true");
      assert.match(await heroToggle.textContent(), /preference/i);
      assert.match(await heroToggle.getAttribute("aria-label"), /preference/i);
      await page.goto(`${origin}/services.html`);
      const footerToggle = page.locator("button[data-motion-preference]");
      assert.equal(await footerToggle.isDisabled(), true);
      assert.equal(await footerToggle.getAttribute("aria-pressed"), "true");
      assert.match(await footerToggle.textContent(), /preference/i);
      assert.match(await footerToggle.getAttribute("aria-label"), /reduced-motion preference/i);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForFunction(() => !document.querySelector("button[data-motion-preference]").disabled);
      assert.match(await footerToggle.textContent(), /Pause motion/);
      assert.equal(await footerToggle.getAttribute("aria-pressed"), "false");
    });

    await check("Focusing an unrevealed enquiry action exposes its content immediately", { reducedMotion: "no-preference" }, async page => {
      await page.goto(`${origin}/services.html`);
      const panel = page.locator(".cta-panel[data-reveal]").last();
      await page.waitForFunction(() => {
        const panel = document.querySelector(".cta-panel[data-reveal]");
        return panel && getComputedStyle(panel).opacity === "0";
      });
      const result = await panel.getByRole("link", { name: "Request a pentest", exact: true }).evaluate(element => {
        element.focus({ preventScroll: true });
        const panel = element.closest("[data-reveal]");
        const style = getComputedStyle(panel);
        return { focused: document.activeElement === element, opacity: style.opacity, transform: style.transform, animation: style.animationName };
      });
      assert.equal(result.focused, true);
      assert.equal(result.opacity, "1", "Focus must expose text immediately, without waiting for a reveal transition");
      assert.equal(result.transform, "none");
      assert.equal(result.animation, "none");
    });

    await check("Without JavaScript the mobile dock and enquiry jump remain native links", { javaScriptEnabled: false, viewport: { width: 320, height: 900 } }, async page => {
      await page.goto(`${origin}/services.html`);
      const dock = page.getByRole("navigation", { name: "On this page", exact: true });
      await dock.getByRole("link", { name: "Deliverables", exact: true }).click();
      await page.waitForURL("**#included-title");
      await expectJumpBelowHeader(page, "#included-title");
      assert.equal(await page.getByRole("heading", { name: "What every security engagement includes" }).isVisible(), true);
      assert.equal(await page.locator("button[data-motion-preference]").isVisible(), false);
      await page.goto(`${origin}/contact.html`);
      await page.getByRole("link", { name: "Start your enquiry" }).click();
      await page.waitForURL("**#enquiry-form");
      await expectJumpBelowHeader(page, "#enquiry-form");
      await page.getByRole("textbox", { name: "Your name", exact: false }).fill("Local preview only");
      assert.equal(await page.locator("#name").inputValue(), "Local preview only");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    });

    for (const [name, observed] of [["Uncaught browser errors", errors], ["Missing local resources", missing], ["External requests", external], ["Form submissions", deliveries]]) {
      if (observed.length) failures.push({ name, error: new Error(JSON.stringify(observed)) });
    }
    for (const failure of failures) console.error(`${failure.name}\n${failure.error.stack}`);
    console.log(`${passed} flow checks passed; ${failures.length} failed. No enquiry was sent.`);
    if (failures.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
