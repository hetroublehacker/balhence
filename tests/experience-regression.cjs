#!/usr/bin/env node
"use strict";
// Optional local browser checks. Requires Playwright + Chromium; no external traffic.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const net = require("node:net");
const { chromium } = require("playwright");

const MOTION_KEY = "balhence_motion_paused";
const SECURITY_MAP = "[data-security-map]";
const CANVAS = "[data-security-canvas]";
const TOGGLE = "[data-motion-toggle]";
const SYSTEM_LABELS = ["Applications", "Cloud", "AI systems", "Data", "Identity", "Code"];

async function headerStyleTokens(page) {
  return page.evaluate(() => {
    const properties = ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "color", "backgroundColor", "backgroundImage", "borderColor", "borderStyle", "borderWidth", "borderRadius"];
    const tokens = selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return Object.fromEntries(properties.map(property => [property, style[property]]));
    };
    return {
      brand: tokens("header .brand"),
      mark: tokens("header .brand-mark"),
      primary: tokens("header .nav-menu > .btn-primary"),
    };
  });
}

async function assertSystemLabels(locator) {
  const labels = locator.locator("[data-system-label]");
  assert.deepEqual((await labels.evaluateAll(nodes => nodes.map(node => node.dataset.systemLabel))).sort(), [...SYSTEM_LABELS].sort());
  for (const label of SYSTEM_LABELS) {
    const element = locator.locator(`[data-system-label="${label}"]`);
    assert.equal((await element.textContent()).trim(), label);
    assert.equal(await element.isVisible(), true, `${label} should remain visible`);
  }
}

// Compare the actual rendered pixels, not merely a running-state attribute.
async function canvasFingerprint(page) {
  return page.locator(CANVAS).evaluate(canvas => {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    let painted = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      painted += Number(alpha > 0);
      hash = Math.imul(hash ^ pixels[index], 16777619) >>> 0;
      hash = Math.imul(hash ^ pixels[index + 1], 16777619) >>> 0;
      hash = Math.imul(hash ^ pixels[index + 2], 16777619) >>> 0;
      hash = Math.imul(hash ^ alpha, 16777619) >>> 0;
    }
    return { width: canvas.width, height: canvas.height, painted, hash };
  });
}

async function waitForMotionState(page, expected) {
  await page.waitForFunction(
    state => document.querySelector("[data-security-map]").dataset.motionState === state,
    expected, { polling: 50, timeout: 3000 },
  );
}

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
    const external = [];
    const errors = [];
    async function createContext(options = {}) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, ...options });
      await context.route("**/*", route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
      return context;
    }
    const context = await createContext();
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(() => document.fonts.ready);
    await page.locator("[data-consent-decline]").click();
    await page.waitForTimeout(1300);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("main > section").count(), 4);
    const fonts = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      accent: getComputedStyle(document.querySelector(".hero-line-serif")).fontFamily,
      loaded: [...document.fonts].filter(font => font.status === "loaded").map(font => font.family.replace(/["']/g, "")),
    }));
    assert.match(fonts.body, /Bricolage Grotesque/);
    assert.match(fonts.accent, /Newsreader/);
    assert.ok(fonts.loaded.includes("Bricolage Grotesque"));
    assert.ok(fonts.loaded.includes("Newsreader"));
    pass("The four-section homepage loads its local sans and editorial serif fonts");

    await assertSystemLabels(page.locator(SECURITY_MAP));
    const homeHeader = await headerStyleTokens(page);
    const styleContext = await createContext({ reducedMotion: "reduce" });
    const stylePage = await styleContext.newPage();
    await stylePage.goto(`${origin}/services.html`);
    await stylePage.evaluate(() => document.fonts.ready);
    assert.deepEqual(homeHeader, await headerStyleTokens(stylePage), "Homepage branding and primary header CTA must match the service-page design");
    await styleContext.close();
    pass("Six security systems are labeled and the homepage header matches the rest of the site");

    assert.equal(await page.locator("html").evaluate(el => el.classList.contains("home-motion")), true);
    assert.equal(await page.locator(SECURITY_MAP).getAttribute("data-motion-state"), "running");
    assert.equal(await page.locator(CANVAS).isVisible(), true);
    assert.equal(await page.locator(".security-fallback").isVisible(), false);
    const firstFrame = await canvasFingerprint(page);
    assert.ok(firstFrame.painted > 1000, "The canvas should contain visible security-system routes");
    await page.waitForTimeout(800);
    assert.notDeepEqual(await canvasFingerprint(page), firstFrame, "Running animation must change rendered pixels");
    assert.deepEqual(external, []);
    pass("The security-system map renders and changes over time without third-party requests");

    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await waitForMotionState(page, "static");
    assert.equal(await page.locator(SECURITY_MAP).getAttribute("data-motion-state"), "static");
    const offscreenFrame = await canvasFingerprint(page);
    await page.waitForTimeout(900);
    assert.deepEqual(await canvasFingerprint(page), offscreenFrame, "Offscreen canvas must stop drawing");
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await waitForMotionState(page, "running");
    await page.waitForTimeout(500);
    assert.equal(await page.locator(SECURITY_MAP).getAttribute("data-motion-state"), "running");
    assert.notDeepEqual(await canvasFingerprint(page), offscreenFrame);
    pass("The security-system map stops offscreen and resumes when it returns to view");

    await page.locator(TOGGLE).click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), MOTION_KEY), "true");
    assert.equal(await page.locator("html").evaluate(el => el.classList.contains("home-motion")), false);
    assert.equal(await page.locator(TOGGLE).getAttribute("aria-pressed"), "true");
    const pausedFrame = await canvasFingerprint(page);
    await page.waitForTimeout(1000);
    assert.deepEqual(await canvasFingerprint(page), pausedFrame);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    assert.equal(await page.locator(TOGGLE).getAttribute("aria-label"), "Play animation");
    assert.equal(await page.locator(SECURITY_MAP).getAttribute("data-motion-state"), "static");
    const reloadedFrame = await canvasFingerprint(page);
    await page.waitForTimeout(800);
    assert.deepEqual(await canvasFingerprint(page), reloadedFrame);
    await page.locator(TOGGLE).click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), MOTION_KEY), "false");
    await page.waitForTimeout(500);
    assert.notDeepEqual(await canvasFingerprint(page), reloadedFrame);
    pass("Pause freezes the canvas, persists across reload, and resumes on request");

    // Verify native media-query changes separately with saved playback enabled.
    const mediaContext = await createContext({ reducedMotion: "no-preference" });
    await mediaContext.addInitScript(key => {
      if (location.protocol !== "http:") return; // Initial about:blank has no storage origin.
      localStorage.setItem(key, "false");
      localStorage.setItem("balhence_analytics_consent", "declined");
    }, MOTION_KEY);
    const mediaPage = await mediaContext.newPage();
    await mediaPage.goto(origin);
    await mediaPage.evaluate(() => document.fonts.ready);
    await mediaPage.emulateMedia({ reducedMotion: "reduce" });
    await mediaPage.waitForFunction(() => document.querySelector("[data-motion-toggle]").disabled, null, { timeout: 5000 });
    assert.equal(await mediaPage.locator(TOGGLE).getAttribute("aria-pressed"), "true");
    assert.equal(await mediaPage.locator("html").evaluate(el => el.classList.contains("home-motion")), false);
    assert.equal(await mediaPage.locator(SECURITY_MAP).getAttribute("data-motion-state"), "static");
    const reducedFrame = await canvasFingerprint(mediaPage);
    await mediaPage.waitForTimeout(350);
    assert.deepEqual(await canvasFingerprint(mediaPage), reducedFrame);
    await mediaPage.reload();
    await mediaPage.evaluate(() => document.fonts.ready);
    assert.equal(await mediaPage.locator(TOGGLE).isDisabled(), true);
    assert.equal(await mediaPage.locator(SECURITY_MAP).getAttribute("data-motion-state"), "static");
    assert.equal(await mediaPage.locator(".hero-line > span").first().evaluate(el => getComputedStyle(el).transform), "none");
    await mediaPage.emulateMedia({ reducedMotion: "no-preference" });
    await mediaPage.waitForFunction(() => document.querySelector("[data-security-map]").dataset.motionState === "running", null, { timeout: 5000 });
    assert.equal(await mediaPage.locator(TOGGLE).isDisabled(), false);
    await mediaContext.close();
    pass("Reduced-motion preference overrides saved playback on load and during a visit");

    const pointerContext = await createContext();
    const pointerPage = await pointerContext.newPage();
    await pointerPage.clock.install();
    // A constant frame timestamp freezes autonomous route pulses without replacing
    // pointer listeners or drawing. Pixel changes now require pointer input.
    await pointerPage.addInitScript(() => {
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => request(() => callback(0));
      if (location.protocol === "http:") localStorage.setItem("balhence_analytics_consent", "declined");
    });
    await pointerPage.goto(origin);
    await pointerPage.evaluate(() => document.fonts.ready);
    await pointerPage.clock.runFor(1400);
    assert.equal(await pointerPage.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches), true);
    const beforePointer = await canvasFingerprint(pointerPage);
    await pointerPage.clock.runFor(200);
    assert.deepEqual(await canvasFingerprint(pointerPage), beforePointer, "Autonomous route pulses must be frozen for this pointer check");
    const bounds = await pointerPage.locator(SECURITY_MAP).boundingBox();
    await pointerPage.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .25);
    await pointerPage.clock.runFor(450);
    assert.notDeepEqual(await canvasFingerprint(pointerPage), beforePointer, "Pointer movement should highlight a security route");
    await pointerPage.locator(TOGGLE).click();
    const pointerPaused = await canvasFingerprint(pointerPage);
    await pointerPage.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height * .5);
    await pointerPage.clock.runFor(500);
    assert.deepEqual(await canvasFingerprint(pointerPage), pointerPaused, "Pointer input must not bypass the pause control");
    await pointerContext.close();
    pass("Pointer movement highlights a security route, but cannot move a paused canvas");

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(200);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Homepage overflows at ${width}px`);
      assert.equal(await page.locator("h1").isVisible(), true);
      assert.equal(await page.locator('main a.btn-primary[href*="source=home-hero"]').isVisible(), true);
      const art = await page.locator(CANVAS).boundingBox();
      assert.ok(art.width > 0 && art.height > 0, `Security map has no size at ${width}px`);
      const pixelRatio = await page.locator(CANVAS).evaluate(canvas => canvas.width / canvas.getBoundingClientRect().width);
      assert.ok(pixelRatio <= 1.76, "Canvas pixel ratio should remain bounded");
    }
    pass("The homepage, enquiry link, and bounded canvas fit mobile, tablet, and desktop widths");

    await page.emulateMedia({ reducedMotion: "reduce" });
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

    const plain = await createContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const nojs = await plain.newPage();
    await nojs.goto(origin);
    assert.equal(await nojs.locator("h1").isVisible(), true);
    assert.equal(await nojs.locator(".nav-menu").isVisible(), true);
    assert.equal(await nojs.locator("main > section").count(), 4);
    assert.equal(await nojs.locator(".security-fallback").isVisible(), true);
    await assertSystemLabels(nojs.locator(SECURITY_MAP));
    assert.equal(await nojs.locator(CANVAS).isVisible(), false);
    assert.equal(await nojs.locator(TOGGLE).isVisible(), false);
    assert.equal(await nojs.locator('.service-row[href="/web-application-penetration-testing.html"]').isVisible(), true);
    assert.equal(await nojs.locator('.service-row[href="/api-penetration-testing.html"]').isVisible(), true);
    assert.equal(await nojs.locator('.service-row[href="/saas-penetration-testing.html"]').isVisible(), true);
    assert.ok(await nojs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await nojs.locator('main a.btn-primary[href*="source=home-hero"]').click();
    await nojs.waitForURL("**/contact.html?**");
    assert.equal(await nojs.locator("form[data-lead-form]").isVisible(), true);
    pass("Without JavaScript the SVG, mobile navigation, four sections, and enquiry route remain usable");
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(`${passed} experience checks passed; no uncaught errors or external requests.`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
