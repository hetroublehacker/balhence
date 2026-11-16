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
const HOST = ".type-field-host";
const WRAPPER = ".type-field-host > .type-field";
const VORTEX = `${WRAPPER} .typography-vortex-component`;
const FIELD = `${VORTEX} > canvas`;
const MOTION_CONTROLS = "[data-motion-toggle], [data-motion-preference], [data-type-field-toggle]";

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
    let ink = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3]) painted++;
      if (Math.max(data[offset], data[offset + 1], data[offset + 2]) > 40) ink++;
      // The passive renderer fills an opaque background on every frame.
      // An alpha-only checksum cannot detect whether its rings are moving.
      hash = Math.imul(hash ^ data[offset], 16777619);
      hash = Math.imul(hash ^ data[offset + 1], 16777619);
      hash = Math.imul(hash ^ data[offset + 2], 16777619);
    }
    return { hash: hash >>> 0, painted, ink, width: canvas.width, height: canvas.height };
  });
}

async function expectStill(page) {
  await page.waitForTimeout(150);
  const first = await pixels(page);
  assert.ok(first.ink > 100, "The suspended field should retain its rendered rings");
  await page.waitForTimeout(350);
  assert.deepEqual(await pixels(page), first, "An offscreen field must not change its rendered pixels");
}

async function expectFallback(page, state = "static") {
  await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.dataset.typeFieldState === expected, { selector: HOST, expected: state });
  assert.equal(await page.locator(WRAPPER).count(), 0, "The preference fallback must not run the background animation");
  assert.equal(await page.locator(FIELD).count(), 0);
  assert.equal(await page.locator("h1").isVisible(), true);
  assert.equal(await page.locator(MOTION_CONTROLS).count(), 0);
}

async function expectMoving(page) {
  await page.waitForFunction(selector => {
    const canvas = document.querySelector(selector);
    return canvas && canvas.width > 1 && canvas.height > 1;
  }, FIELD);
  await page.waitForTimeout(100);
  const first = await pixels(page);
  assert.ok(first.ink > 100, "The field should contain visible typography");
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
  const server = spawn(process.platform === "win32" ? "python" : "python3", ["serve.py", "--port", String(port)], { cwd: ROOT, stdio: "ignore" });
  let serverError;
  server.on("error", error => { serverError = error; });
  let browser;
  let passed = 0;
  const failures = [];
  const errors = [];
  const missing = [];
  const external = [];
  const deliveries = [];
  const retiredAnimationAssets = [];
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
    browser = await chromium.launch({ headless: true });

    async function check(name, options, run, initialize) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference", ...options });
      try {
        await context.route("**/*", route => {
          const request = route.request();
          const url = new URL(request.url());
          if (/(?:fragment-mono|threeui\.css)/i.test(url.pathname)) retiredAnimationAssets.push(request.url());
          if (url.origin !== origin) {
            // The preserved first-party research imports include lazy Embedly
            // frames from the original articles. Block those known frames in
            // local tests; they are unrelated to the shared animation asset.
            if (url.hostname === "cdn.embedly.com" && request.resourceType() === "document") {
              return route.abort();
            }
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

    async function open(page, pathname, state = "running") {
      await page.goto(`${origin}${pathname}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.dataset.typeFieldState === expected, { selector: HOST, expected: state });
      if (state === "running") {
        await page.locator(FIELD).waitFor();
      }
    }

    await check("Homepage field keeps moving without a motion button or saved playback state", {}, async page => {
      await open(page, "/");
      assert.equal(await page.locator(MOTION_CONTROLS).count(), 0);
      await expectMoving(page);
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      await expectMoving(page);
      assert.equal(await page.evaluate(() => localStorage.getItem("balhence_motion_paused")), null);
    });

    await check("Local typography renders and moves without waiting for font APIs", {}, async page => {
      // Deliberately do not use open(): it waits for document.fonts.ready to
      // stabilize foreground layout in the other checks.
      await page.goto(`${origin}/services.html`, { waitUntil: "domcontentloaded" });
      await expectMoving(page);
      const glyphRuns = await page.evaluate(() => Array.from(window.__typeFieldGlyphRuns.values()));
      const brandedPhrase = "BALHENCE/PENETRATIONTESTING/WEB&APISECURITY/SAAS/CLOUD/IDENTITY/AI&LLMSECURITY/";
      assert.ok(glyphRuns.some(run => run.includes(brandedPhrase)), "The cached ring drawings should contain Balhence's service wording");
      assert.equal(await page.locator("h1").isVisible(), true);
      assert.equal(await page.locator(MOTION_CONTROLS).count(), 0);
    }, context => context.addInitScript(() => {
      // Mock only the JavaScript font API; normal CSS font requests and text
      // rendering continue. A renderer that waits for either promise will fail.
      const pending = new Promise(() => {});
      Object.defineProperty(document.fonts, "ready", { configurable: true, get: () => pending });
      Object.defineProperty(document.fonts, "load", { configurable: true, value: () => pending });
      const runs = new Map();
      window.__typeFieldGlyphRuns = runs;
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        // Observe rendered glyphs on cached ring canvases rather than checking
        // a configuration attribute that could differ from the visible scene.
        if (!this.canvas.isConnected && String(text).length === 1) {
          const current = runs.get(this.canvas) || "";
          if (current.length < 512) runs.set(this.canvas, current + text);
        }
        return fillText.call(this, text, ...args);
      };
    }));

    await check("An obsolete saved pause value cannot disable the field after controls are removed", {}, async page => {
      await open(page, "/services.html");
      assert.equal(await page.locator(MOTION_CONTROLS).count(), 0);
      await expectMoving(page);
      assert.equal(await page.evaluate(() => localStorage.getItem("balhence_motion_paused")), "true", "The removed preference should be ignored without overwriting storage");
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      await expectMoving(page);
      await open(page, "/");
      await expectMoving(page);
      await page.waitForFunction(() => document.querySelector("[data-security-map]").dataset.motionState === "running");
    }, context => context.addInitScript(() => {
      if (location.protocol === "http:") localStorage.setItem("balhence_motion_paused", "true");
    }));

    await check("Reduced motion uses a CSS fallback and runtime changes mount or remove the renderer", { reducedMotion: "reduce" }, async page => {
      await open(page, "/services.html", "static");
      await expectFallback(page);
      assert.notEqual(await page.locator(HOST).evaluate(host => getComputedStyle(host).backgroundImage), "none", "The existing CSS surface should remain visible without a canvas");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expectMoving(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expectFallback(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expectMoving(page);
      assert.equal(await page.locator(FIELD).count(), 1, "Repeated preference changes must not duplicate the renderer");
    });

    for (const preference of ["slow", "saveData"]) {
      await check(`${preference} device preference uses the CSS fallback`, {}, async page => {
        await open(page, "/services.html", "static");
        await expectFallback(page);
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

    await check("Small viewports use the stable CSS fallback and remount when widened", { viewport: { width: 390, height: 844 } }, async page => {
      await open(page, "/", "static");
      await expectFallback(page);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.setViewportSize({ width: 720, height: 844 });
      await expectMoving(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await expectFallback(page);
    });

    await check("Forced colors keeps the content usable without a decorative canvas", { forcedColors: "active" }, async page => {
      await open(page, "/services.html", "static");
      await expectFallback(page);
      await page.locator(".page-hero .btn-primary").click();
      await page.waitForURL("**/contact.html?service=web-api&source=services");
      assert.equal(await page.locator("h1").isVisible(), true);
    });

    await check("A field outside the viewport stops drawing and resumes on return", {}, async page => {
      await open(page, "/services.html");
      await expectMoving(page);
      await page.locator(".site-footer").evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.waitForFunction(() => document.querySelector(".type-field-host").getBoundingClientRect().bottom < 0);
      await expectStill(page);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await expectMoving(page);
    });

    await check("Pointer movement cannot dissolve, displace, or add particles to the passive field", {}, async page => {
      await open(page, "/services.html");
      await expectMoving(page);
      const bounds = await page.locator(HOST).boundingBox();
      const heading = await page.locator("h1").boundingBox();
      const point = { x: bounds.x + bounds.width * .8, y: bounds.y + bounds.height * .55 };
      const bundle = readFileSync(path.join(ROOT, "type-field.js"), "utf8");
      assert.doesNotMatch(bundle, /pointer(?:enter|move|down)|dissolv|suction|particle/i, "The production bundle must not contain retired interaction paths");
      assert.equal(await page.locator(VORTEX).getAttribute("data-interaction-state"), "none");
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(250);
      assert.equal(await page.locator(VORTEX).getAttribute("data-interaction-state"), "none");
      assert.equal(await page.locator(VORTEX).getAttribute("data-dissolve-state"), null);
      assert.equal(await page.locator(VORTEX).getAttribute("data-suction-state"), null);
      assert.equal(await page.locator(VORTEX).getAttribute("data-particles"), null);
      assert.deepEqual(await page.locator("h1").boundingBox(), heading, "Pointer movement must not shift foreground content");
      assert.equal(await page.locator(WRAPPER).evaluate(element => getComputedStyle(element).pointerEvents), "none");
      await page.mouse.move(heading.x + heading.width / 2, heading.y + heading.height / 2);
      assert.equal(await page.locator(VORTEX).getAttribute("data-interaction-state"), "none");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expectFallback(page);
      await page.mouse.move(point.x, point.y);
      assert.equal(await page.locator(FIELD).count(), 0, "Pointer input must not restart animation under reduced motion");
    });

    await check("A background click never starts suction or changes navigation", {}, async page => {
      await open(page, "/services.html");
      await expectMoving(page);
      const point = await page.locator(HOST).evaluate(host => {
        const bounds = host.getBoundingClientRect();
        for (const [x, y] of [[.95, .75], [.95, .5], [.9, .85]]) {
          const point = { x: bounds.x + bounds.width * x, y: bounds.y + bounds.height * y };
          const target = document.elementFromPoint(point.x, point.y);
          if (target && host.contains(target) && !target.closest("a, button, input, select, textarea")) return point;
        }
        throw new Error("No non-interactive hero surface is available for the click check");
      });
      await page.mouse.click(point.x, point.y);
      assert.equal(new URL(page.url()).pathname, "/services.html", "A decorative click should not navigate the page");
      assert.equal(await page.locator(VORTEX).getAttribute("data-interaction-state"), "none");
      assert.equal(await page.locator(VORTEX).getAttribute("data-suction-state"), null);
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
      await open(page, "/services.html", "unavailable");
      await expectFallback(page, "unavailable");
      await page.locator(".page-hero .btn-primary").click();
      await page.waitForURL("**/contact.html?service=web-api&source=services");
      assert.equal(await page.locator("h1").isVisible(), true);
    }, context => context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === "2d" ? null : original.call(this, kind, ...args);
      };
    }));

    for (const width of [1440]) {
      await check(`The local field remains decorative and contained across hero families at ${width}px`, { viewport: { width, height: 1000 } }, async page => {
        for (const pathname of ["/", "/services.html", "/insights/ptaas-vs-annual-penetration-test.html", "/report-viewer.html", "/scope-builder.html", "/privacy.html", "/404.html", "/ctf.html"]) {
          await open(page, pathname);
          assert.equal(await page.locator(FIELD).count(), 1, `${pathname}: one decorative field`);
          assert.equal(await page.locator(WRAPPER).getAttribute("aria-hidden"), "true", `${pathname}: the decorative scene is hidden from assistive technology`);
          assert.equal(await page.locator(`${WRAPPER} > .shader-frame > .typography-vortex-component`).count(), 1, `${pathname}: one native scene wrapper contains the renderer`);
          assert.equal(await page.locator(VORTEX).getAttribute("data-interaction-state"), "none", `${pathname}: no pointer or click interaction path`);
          const layout = await page.locator(FIELD).evaluate(canvas => {
            const host = canvas.closest(".type-field-host");
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
              cssWidth: bounds.width,
              cssHeight: bounds.height,
              pixelWidth: canvas.width,
              pixelHeight: canvas.height,
              pixelRatio: Math.min(devicePixelRatio || 1, 2),
            };
          });
          assert.equal(layout.overflow, false, `${pathname}: field must not widen page`);
          assert.equal(layout.pointerEvents, "none");
          assert.equal(layout.canvasTabIndex, -1);
          assert.equal(layout.fitsHero, true);
          assert.equal(layout.h1Opacity, "1");
          assert.equal(layout.fieldOnTop, false);
          assert.ok(layout.cssWidth > 0 && layout.cssHeight > 0, `${pathname}: the responsive scene has a visible area`);
          assert.ok(Math.abs(layout.pixelWidth - Math.round(layout.cssWidth * layout.pixelRatio)) <= 1, `${pathname}: authored canvas width follows its host`);
          assert.ok(Math.abs(layout.pixelHeight - Math.round(layout.cssHeight * layout.pixelRatio)) <= 1, `${pathname}: authored canvas height follows its host`);
          const link = pathname === "/ctf.html" ? page.locator(".back-link") : page.locator(".type-field-host a[href]").first();
          if (await link.count()) await link.click({ trial: true });
          assert.equal(await page.locator("h1").isVisible(), true);
        }
        await page.goto(`${origin}/services.html`);
        await page.locator(".page-hero .btn-primary").click();
        await page.waitForURL("**/contact.html?service=web-api&source=services");
      });
    }

    await check("Every published page loads one shared local field with no motion controls", {}, async page => {
      const pages = JSON.parse(execFileSync(process.platform === "win32" ? "python" : "python3", ["-c", "import json; from build_public import PUBLIC_FILES; print(json.dumps([p for p in PUBLIC_FILES if p.endswith('.html')]))"], { cwd: ROOT, encoding: "utf8" }));
      assert.ok(pages.length >= 36, "The coverage list should include every public HTML page");
      for (const file of pages) {
        const source = readFileSync(path.join(ROOT, file), "utf8");
        assert.equal((source.match(/<script\b[^>]*src="\/type-field\.js(?:\?[^"]*)?"/g) || []).length, 1, `${file}: shared script included once`);
        assert.equal((source.match(/<link\b[^>]*href="\/type-field\.css(?:\?[^"]*)?"/g) || []).length, 1, `${file}: shared stylesheet included once`);
        await open(page, `/${file}`);
        assert.equal(await page.locator(FIELD).count(), 1, `${file}: one initialized canvas`);
        assert.equal(await page.locator(FIELD).evaluate(canvas => getComputedStyle(canvas).position), "absolute", `${file}: field stylesheet applied`);
        assert.equal(await page.locator(WRAPPER).getAttribute("aria-hidden"), "true");
        assert.equal(await page.locator(VORTEX).getAttribute("data-mode"), "dark", `${file}: the configured dark variant is retained`);
        assert.equal(await page.locator(MOTION_CONTROLS).count(), 0, `${file}: no obsolete motion controls in the DOM`);
        assert.equal(await page.getByRole("button", { name: /(?:pause|play|resume)\s+(?:motion|animation)/i }).count(), 0, `${file}: no replacement playback button`);
        assert.equal(await page.locator("h1").isVisible(), true, `${file}: main heading retained`);
      }
    });

    await check("The CTF native back link works by keyboard without submitting a challenge answer", {}, async page => {
      await open(page, "/ctf.html");
      const input = page.locator("#term-input");
      await input.waitFor({ state: "visible", timeout: 10000 });
      await input.fill("local keyboard check");
      const output = await page.locator("#output").textContent();
      assert.equal(await page.locator(MOTION_CONTROLS).count(), 0);
      await page.locator(".back-link").focus();
      assert.equal(await input.inputValue(), "local keyboard check", "Focusing a native link must not submit or clear the challenge input");
      assert.equal(await page.locator("#output").textContent(), output);
      const response = page.waitForURL("**/index.html");
      await page.keyboard.press("Enter");
      await response;
    });

    for (const [name, observed] of [["Uncaught browser errors", errors], ["Missing local resources", missing], ["External requests", external], ["Form submissions", deliveries], ["Retired animation font or vendor stylesheet requests", retiredAnimationAssets]]) {
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
