#!/usr/bin/env node
"use strict";

// Local-only browser checks for the decorative typography field.
// Run with: node tests/type-field-regression.cjs
// Requires Playwright + Chromium. No external requests or form deliveries.
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const FIELD = "canvas[data-type-field]";
const MOTION_KEY = "balhence_motion_paused";

async function availablePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

// Read the rendered buffer rather than trusting a state attribute or frame counter.
async function pixels(page) {
  return page.locator(FIELD).evaluate(canvas => {
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let hash = 2166136261;
    let painted = 0;
    for (let offset = 3; offset < data.length; offset += 4) {
      if (data[offset]) painted++;
      hash = Math.imul(hash ^ data[offset], 16777619);
    }
    return { hash: hash >>> 0, painted, width: canvas.width, height: canvas.height };
  });
}

async function expectStill(page) {
  await page.waitForTimeout(100);
  const first = await pixels(page);
  assert.ok(first.painted > 100, "The static fallback should retain a drawn decorative field");
  await page.waitForTimeout(350);
  assert.deepEqual(await pixels(page), first, "A paused field must not change its rendered pixels");
}

async function expectMoving(page) {
  const first = await pixels(page);
  assert.ok(first.painted > 100, "The field should contain visible drawing");
  let changed = false;
  for (let attempt = 0; attempt < 6 && !changed; attempt++) {
    await page.waitForTimeout(150);
    changed = (await pixels(page)).hash !== first.hash;
  }
  assert.ok(changed, "The rendered field should advance while motion is allowed");
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

    async function check(name, options, run, initialize) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference", ...options });
      try {
        await context.route("**/*", route => {
          const request = route.request();
          const url = new URL(request.url());
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
        await context.addInitScript(() => {
          try { localStorage.setItem("balhence_analytics_consent", "declined"); } catch { /* Storage is optional. */ }
        });
        if (initialize) await initialize(context);
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
        page.on("response", response => {
          if (response.status() >= 400 && new URL(response.url()).origin === origin) missing.push(response.url());
        });
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

    async function open(page, pathname) {
      await page.goto(`${origin}${pathname}`);
      await page.evaluate(() => document.fonts.ready);
      await page.locator(FIELD).waitFor();
    }

    await check("Homepage field moves and its existing control freezes and resumes the pixels", {}, async page => {
      await open(page, "/");
      assert.equal(await page.locator("[data-type-field-toggle]").count(), 0, "Homepage should use its existing motion control");
      await expectMoving(page);
      const toggle = page.locator("[data-motion-toggle]");
      await toggle.click();
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
      await expectStill(page);
      await toggle.click();
      assert.equal(await toggle.getAttribute("aria-pressed"), "false");
      await expectMoving(page);
    });

    await check("Saved service motion preference synchronizes the hero and footer controls", {}, async page => {
      await open(page, "/services.html");
      const local = page.locator("[data-type-field-toggle]");
      const footer = page.locator("[data-motion-preference]");
      assert.equal(await local.getAttribute("aria-pressed"), "true");
      assert.equal(await footer.getAttribute("aria-pressed"), "true");
      await expectStill(page);
      await local.click();
      assert.equal(await footer.getAttribute("aria-pressed"), "false");
      assert.equal(await page.evaluate(key => localStorage.getItem(key), MOTION_KEY), "false");
      await expectMoving(page);
      await footer.click();
      assert.equal(await local.getAttribute("aria-pressed"), "true");
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await expectStill(page);
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await local.getAttribute("aria-pressed"), "true");
      await expectStill(page);
    }, context => context.addInitScript(() => {
      if (localStorage.getItem("balhence_motion_paused") === null) localStorage.setItem("balhence_motion_paused", "true");
    }));

    await check("Reduced-motion preference keeps a drawn still frame and runtime changes resume or freeze it", { reducedMotion: "reduce" }, async page => {
      await open(page, "/services.html");
      const toggle = page.locator("[data-type-field-toggle]");
      assert.equal(await toggle.isDisabled(), true);
      assert.match(await toggle.textContent(), /preference/i);
      await expectStill(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expectMoving(page);
      assert.equal(await toggle.isDisabled(), false);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expectStill(page);
    });

    for (const preference of ["slow", "saveData"]) {
      await check(`${preference} device preference keeps the typography static`, {}, async page => {
        await open(page, "/services.html");
        assert.equal(await page.locator("[data-type-field-toggle]").isDisabled(), true);
        await expectStill(page);
      }, context => context.addInitScript(preference => {
        if (preference === "slow") {
          const original = window.matchMedia.bind(window);
          window.matchMedia = query => {
            const media = original(query);
            if (query === "(update: slow)") Object.defineProperty(media, "matches", { value: true });
            return media;
          };
        } else {
          Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, addEventListener() {} } });
        }
      }, preference));
    }

    await check("A field outside the viewport stops drawing and resumes on return", {}, async page => {
      await open(page, "/services.html");
      await expectMoving(page);
      await page.locator(".site-footer").evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.waitForFunction(() => document.querySelector(".type-field-host").getBoundingClientRect().bottom < 0);
      await expectStill(page);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await expectMoving(page);
    });

    await check("Without JavaScript the heading and native enquiry link remain usable", { javaScriptEnabled: false, viewport: { width: 390, height: 844 } }, async page => {
      await page.goto(`${origin}/services.html`);
      assert.equal(await page.locator(FIELD).count(), 0);
      assert.equal(await page.locator("h1").isVisible(), true);
      await page.locator(".page-hero .btn-primary").click();
      await page.waitForURL("**/contact.html?service=web-api&source=services");
      assert.equal(await page.locator("h1").isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    });

    await check("Unavailable Canvas 2D leaves headings and enquiry navigation working", {}, async page => {
      await page.goto(`${origin}/services.html`);
      assert.equal(await page.locator(FIELD).count(), 0);
      assert.equal(await page.locator("[data-type-field-toggle]").count(), 0);
      assert.equal(await page.locator("h1").isVisible(), true);
      await page.locator(".page-hero .btn-primary").click();
      await page.waitForURL("**/contact.html?service=web-api&source=services");
      assert.equal(await page.locator("h1").isVisible(), true);
    }, context => context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === "2d" ? null : original.call(this, kind, ...args);
      };
    }));

    for (const width of [390, 1440]) {
      await check(`The field remains decorative and contained across hero families at ${width}px`, { viewport: { width, height: 1000 }, reducedMotion: "reduce" }, async page => {
        for (const pathname of ["/", "/services.html", "/insights/ptaas-vs-annual-penetration-test.html", "/report-viewer.html", "/scope-builder.html", "/privacy.html", "/404.html", "/ctf.html"]) {
          await open(page, pathname);
          assert.equal(await page.locator(FIELD).count(), 1, `${pathname}: one decorative field`);
          assert.equal(await page.locator(FIELD).getAttribute("aria-hidden"), "true", `${pathname}: decorative canvas is hidden from assistive technology`);
          const layout = await page.locator(FIELD).evaluate(canvas => {
            const host = canvas.parentElement;
            const bounds = canvas.getBoundingClientRect();
            const hero = host.getBoundingClientRect();
            const heading = host.querySelector("h1");
            const h = heading.getBoundingClientRect();
            const point = document.elementFromPoint(Math.min(innerWidth - 1, h.x + h.width / 2), Math.max(0, Math.min(innerHeight - 1, h.y + h.height / 2)));
            return {
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              pointerEvents: getComputedStyle(canvas).pointerEvents,
              canvasTabIndex: canvas.tabIndex,
              fitsHero: bounds.width <= hero.width + 1 && bounds.height <= hero.height + 1,
              h1Opacity: getComputedStyle(heading).opacity,
              fieldOnTop: point === canvas,
              pixels: canvas.width * canvas.height,
            };
          });
          assert.equal(layout.overflow, false, `${pathname}: field must not widen page`);
          assert.equal(layout.pointerEvents, "none");
          assert.equal(layout.canvasTabIndex, -1);
          assert.equal(layout.fitsHero, true);
          assert.equal(layout.h1Opacity, "1");
          assert.equal(layout.fieldOnTop, false);
          assert.ok(layout.pixels <= 2404000, `${pathname}: canvas resolution should remain bounded`);
          assert.ok((await pixels(page)).painted > 100, `${pathname}: a still frame remains visible`);
          const link = pathname === "/ctf.html" ? page.locator(".back-link") : page.locator(".type-field-host a[href]").first();
          if (await link.count()) await link.click({ trial: true });
          assert.equal(await page.locator("h1").isVisible(), true);
        }
        await page.goto(`${origin}/services.html`);
        await page.locator(".page-hero .btn-primary").click();
        await page.waitForURL("**/contact.html?service=web-api&source=services");
      });
    }

    await check("Every published page loads one shared field and its stylesheet", { reducedMotion: "reduce" }, async page => {
      const pages = JSON.parse(execFileSync("python3", ["-c", "import json; from build_public import PUBLIC_FILES; print(json.dumps([p for p in PUBLIC_FILES if p.endswith('.html')]))"], { cwd: ROOT, encoding: "utf8" }));
      assert.ok(pages.length >= 36, "The coverage list should include every public HTML page");
      for (const file of pages) {
        const source = readFileSync(path.join(ROOT, file), "utf8");
        assert.equal((source.match(/<script\b[^>]*src="\/type-field\.js(?:\?[^"]*)?"/g) || []).length, 1, `${file}: shared script included once`);
        assert.equal((source.match(/<link\b[^>]*href="\/type-field\.css(?:\?[^"]*)?"/g) || []).length, 1, `${file}: shared stylesheet included once`);
        await open(page, `/${file}`);
        assert.equal(await page.locator(FIELD).count(), 1, `${file}: one initialized canvas`);
        assert.equal(await page.locator(FIELD).evaluate(canvas => getComputedStyle(canvas).position), "absolute", `${file}: field stylesheet applied`);
        assert.equal(await page.locator(FIELD).getAttribute("aria-hidden"), "true");
        assert.equal(await page.locator("h1").isVisible(), true, `${file}: main heading retained`);
      }
    });

    await check("The CTF pause button supports Enter without submitting a challenge answer", {}, async page => {
      await open(page, "/ctf.html");
      const input = page.locator("#term-input");
      await input.waitFor({ state: "visible", timeout: 10000 });
      await input.fill("local keyboard check");
      const output = await page.locator("#output").textContent();
      const toggle = page.locator("[data-type-field-toggle]");
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
      assert.equal(await input.inputValue(), "local keyboard check", "Pausing must not submit or clear the challenge input");
      assert.equal(await page.locator("#output").textContent(), output, "Pausing must not append challenge feedback");
      await expectStill(page);
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-pressed"), "false");
      await expectMoving(page);
      await page.locator(".back-link").click();
      await page.waitForURL("**/index.html");
    });

    for (const [name, observed] of [["Uncaught browser errors", errors], ["Missing local resources", missing], ["External requests", external], ["Form submissions", deliveries]]) {
      if (observed.length) failures.push({ name, error: new Error(JSON.stringify(observed)) });
    }
    for (const failure of failures) console.error(`${failure.name}\n${failure.error.stack}`);
    console.log(`${passed} typography field checks passed; ${failures.length} failed. No enquiry was sent.`);
    if (failures.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
