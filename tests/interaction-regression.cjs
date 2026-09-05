#!/usr/bin/env node
"use strict";

// Run with: node tests/interaction-regression.cjs
// Requires Playwright with Chromium installed. Every external request is intercepted.
const assert = require("node:assert/strict");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DRAFT = "balhence_scope_builder_v1";
const BRIEF = "balhence_scope_brief_v1";
const CONSENT = "balhence_analytics_consent";

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function main() {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: ROOT, stdio: "ignore" });
  let browser;
  let checks = 0;
  const pass = (message) => { checks += 1; console.log(`PASS ${message}`); };
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { if ((await fetch(origin)).ok) break; } catch { /* Wait for the preview. */ }
      if (attempt === 39) throw new Error("Preview did not start");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.route("**/*", (route) => new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${origin}/scope-builder.html`);
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage) throw new DOMException("Blocked", "SecurityError");
        return setItem.call(this, key, value);
      };
    });
    await page.locator('[name="business_trigger"][value="enterprise"]').check();
    await page.waitForFunction(() => document.querySelector("[data-save-status]").textContent === "Local save unavailable");
    await page.waitForTimeout(300);
    assert.equal(await page.locator("[data-save-status]").textContent(), "Local save unavailable");
    pass("Storage failures remain visible instead of reporting a successful save");

    await page.reload();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.locator('[name="business_trigger"][value="release"]').check();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("[data-reset]").click();
    await page.clock.runFor(300);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT), null);
    await page.goto(`${origin}/privacy.html`);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT), null);
    await page.clock.resume();
    pass("Reset cancels pending autosave and remains cleared after page exit");

    await page.goto(`${origin}/scope-builder.html`);
    await page.evaluate(() => {
      const form = document.querySelector("#scope-planner-form");
      for (const radio of form.querySelectorAll("input[type=radio][required]")) radio.checked = true;
      for (const select of form.querySelectorAll("select[required]")) select.selectedIndex = 1;
      form.elements.web_app_count.value = "1";
      form.elements.api_group_count.value = "0";
      for (const group of form.querySelectorAll("[data-required-group]")) group.querySelector("input").checked = true;
      form.querySelector("input").dispatchEvent(new Event("change", { bubbles: true }));
    });
    for (let step = 0; step < 5; step += 1) await page.locator("[data-step]:visible [data-next]").click();
    await page.locator("[data-build-brief]").click();
    assert.ok(await page.evaluate((key) => sessionStorage.getItem(key), BRIEF));
    await page.locator("[data-contact-cta]").click();
    await page.waitForURL("**/contact.html?**");
    assert.equal(await page.locator("[data-scope-brief-handoff]").isVisible(), true);
    assert.match(await page.locator('input[name="generated_scope_brief"]').inputValue(), /DRAFT/i);
    pass("Completed scope transfers to the contact form with the brief attached");

    await page.goto(`${origin}/scope-builder.html`);
    await page.locator('[data-step-jump="0"]').click();
    await page.locator('[name="business_trigger"][value="release"]').check();
    assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), BRIEF), null);
    pass("Editing resumed answers removes the previous transferred brief");
    await page.locator('[data-step-jump="5"]').click();
    await page.locator("[data-build-brief]").click();
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage) throw new DOMException("Blocked", "SecurityError");
        return setItem.call(this, key, value);
      };
    });
    await page.locator("[data-contact-cta]").click();
    assert.equal(new URL(page.url()).pathname, "/scope-builder.html");
    assert.match(await page.locator("[data-live-message]").textContent(), /could not transfer/);
    assert.equal(await page.locator("[data-download]").isEnabled(), true);
    pass("Failed session transfer preserves the planner and download recovery");

    await page.goto(`${origin}/services.html`);
    assert.equal(await page.locator("script[data-balhence-analytics]").count(), 0);
    await page.locator("[data-consent-accept]").click();
    assert.equal(await page.locator("script[data-balhence-analytics]").count(), 1);
    await page.evaluate((key) => localStorage.setItem(key, "preserve-planner"), DRAFT);
    await context.addCookies([{ name: "_ga", value: "test-cookie", url: origin }]);
    await page.locator(".footer-bottom [data-analytics-preferences]").click();
    await page.locator("[data-consent-decline]").click();
    const consent = await page.evaluate(({ draft, consentKey }) => {
      const before = window.dataLayer.length;
      window.gtag("event", "should_not_send");
      return { choice: localStorage.getItem(consentKey), draft: localStorage.getItem(draft), queued: window.dataLayer.length - before, cookie: document.cookie };
    }, { draft: DRAFT, consentKey: CONSENT });
    assert.equal(consent.choice, "declined");
    assert.equal(consent.draft, "preserve-planner");
    assert.equal(consent.queued, 0);
    assert.doesNotMatch(consent.cookie, /_ga=/);
    assert.equal(await page.locator("script[data-balhence-analytics]").count(), 0);
    pass("Analytics revocation stops event queueing, clears analytics cookies, and keeps planner data");
    await page.locator(".footer-bottom [data-analytics-preferences]").click();
    await page.locator("[data-consent-accept]").click();
    assert.equal(await page.locator("script[data-balhence-analytics]").count(), 1);
    pass("Analytics can be accepted again after revocation");

    const second = await context.newPage();
    await second.goto(`${origin}/privacy.html`);
    await second.locator("article [data-analytics-preferences]").click();
    await second.locator("[data-consent-decline]").click();
    await page.waitForFunction(() => document.querySelectorAll("script[data-balhence-analytics]").length === 0);
    assert.equal(await second.locator("script[data-balhence-analytics]").count(), 0);
    pass("Privacy controls synchronize revocation across tabs without loading analytics");
    await second.close();
    for (const route of ["scope-builder.html", "contact.html", "privacy.html"]) {
      await page.evaluate((key) => localStorage.setItem(key, "accepted"), CONSENT);
      await page.goto(`${origin}/${route}`);
      assert.equal(await page.locator("script[data-balhence-analytics]").count(), 0);
    }
    pass("Planner, contact, and privacy pages remain analytics-free after acceptance");

    await page.setViewportSize({ width: 812, height: 375 });
    await page.goto(`${origin}/services.html`);
    await page.locator("[data-menu-toggle]").click();
    assert.equal(await page.locator("main").evaluate((node) => node.inert), true);
    await page.waitForFunction(() => document.querySelector("[data-menu] a") === document.activeElement);
    assert.equal(await page.locator("[data-menu] a").first().evaluate((node) => node === document.activeElement), true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.locator("[data-menu-toggle]").evaluate((node) => node === document.activeElement), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator("[data-menu] a").first().evaluate((node) => node === document.activeElement), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("main").evaluate((node) => node.inert), false);
    assert.equal(await page.locator("[data-menu-toggle]").getAttribute("aria-expanded"), "false");
    pass("Mobile menu contains keyboard focus and restores the background on Escape");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate((key) => sessionStorage.removeItem(key), BRIEF);
    await page.goto(`${origin}/contact.html`);
    await page.route("https://formspree.io/**", () => { /* Hold locally; never send a request. */ });
    await page.locator("#name").fill("Local regression test");
    await page.locator("#email").fill("test@example.invalid");
    await page.locator("#company").fill("Local test");
    await page.locator("#service").selectOption("web-api");
    await page.locator("#deadline").selectOption("planning");
    await page.locator("#trigger").selectOption("baseline");
    await page.locator("#privacy-consent").check();
    await page.clock.install();
    await page.locator("button[type=submit]").click();
    await page.clock.fastForward(21000);
    await page.waitForFunction(() => !document.querySelector("button[type=submit]").disabled);
    assert.match(await page.locator("[data-form-status]").textContent(), /could not be confirmed in time/);
    assert.equal(await page.locator("#name").inputValue(), "Local regression test");
    assert.equal(await page.locator("form[data-lead-form]").getAttribute("aria-busy"), null);
    pass("Form timeout restores submission controls and preserves entered details");
    assert.deepEqual(errors, [], "Pages should not throw uncaught JavaScript errors");
    console.log(`${checks} browser interaction checks passed. No external requests were sent.`);
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
