#!/usr/bin/env node
"use strict";

// Run with: node tests/seo-conversion-regression.cjs
// Requires Playwright with Chromium. Every third-party request is intercepted;
// Formspree delivery and the optional analytics script are local mocks only.
const assert = require("node:assert/strict");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const CONSENT = "balhence_analytics_consent";
const BUYER_ROUTES = [
  ["/", "home-hero"],
  ["/web-application-penetration-testing.html", "web-pentest"],
  ["/api-penetration-testing.html", "api-pentest"],
  ["/saas-penetration-testing.html", "saas-pentest"],
];
const SOURCES = [
  "home-nav", "home-hero", "home-faq", "home-closing",
  "web-pentest", "api-pentest", "saas-pentest", "services",
  "pentest-guides", "field-notes", "scope-planner", "sample-report",
  "draft-write-authorization", "session-authority-boundary",
  "private-response-cache-boundary", "server-owned-validation-rules",
  "evidence-gated-workflows", "how-to-scope-web-api-pentest",
  "what-good-pentest-report-includes", "saas-vapt-readiness-checklist",
  "web-api-pentest-cost-scope-guide", "ai-native-penetration-testing-human-validated",
];

async function availablePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function fillEnquiry(page) {
  await page.locator("#name").fill("Local conversion test");
  await page.locator("#email").fill("conversion@example.invalid");
  await page.locator("#company").fill("Synthetic test company");
  await page.locator("#website").fill("https://product.example");
  await page.locator("#service").selectOption("web-api");
  await page.locator("#deadline").selectOption("planning");
  await page.locator("#trigger").selectOption("baseline");
  await page.locator("#context").fill("Synthetic application with two roles. Local form test only.");
  await page.locator("#privacy-consent").check();
}

async function queuedCalls(page) {
  return page.evaluate(() => Array.from(window.dataLayer || [], entry => Array.from(entry)));
}

async function main() {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("python3", ["serve.py", "--port", String(port)], { cwd: ROOT, stdio: "ignore" });
  let serverError;
  server.on("error", error => { serverError = error; });
  let browser;
  let checks = 0;
  let formMode = "unexpected";
  const errors = [];
  const missing = [];
  const unexpectedExternal = [];
  const analyticsScripts = [];
  const submissions = [];
  const pass = message => { checks++; console.log(`PASS ${message}`); };

  async function newContext(options = {}) {
    const context = await browser.newContext({ reducedMotion: "reduce", ...options });
    await context.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin) return route.continue();
      if (url.origin === "https://www.googletagmanager.com" && url.pathname === "/gtag/js") {
        analyticsScripts.push(request.url());
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "// Local regression stub: never sends analytics." });
      }
      if (url.origin === "https://formspree.io" && /^\/f\/[a-z0-9]+$/.test(url.pathname) && formMode !== "unexpected") {
        submissions.push({
          method: request.method(), body: request.postData() || "",
          contentType: request.headers()["content-type"] || "",
          navigation: request.isNavigationRequest(),
        });
        const native = formMode === "native";
        return route.fulfill({
          status: formMode === "failure" ? 503 : 200,
          contentType: native ? "text/html" : "application/json",
          headers: { "access-control-allow-origin": origin },
          body: native ? "<!doctype html><title>Local form mock</title><h1>Native form reached the local mock</h1>" : JSON.stringify({ ok: formMode !== "failure" }),
        });
      }
      unexpectedExternal.push(request.url());
      return route.abort();
    });
    context.on("page", page => {
      page.on("pageerror", error => errors.push(`${page.url()}: ${error.message}`));
      page.on("response", response => {
        if (new URL(response.url()).origin === origin && response.status() >= 400) missing.push(`${response.status()} ${response.url()}`);
      });
    });
    return context;
  }

  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (serverError) throw serverError;
      try { if ((await fetch(origin)).ok) break; } catch { /* Preview is starting. */ }
      if (attempt === 39) throw new Error("Preview did not start");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    browser = await chromium.launch({ headless: true });
    const context = await newContext();
    const page = await context.newPage();
    await page.goto(origin);
    await page.locator("[data-consent-decline]").click();

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [pathname, source] of BUYER_ROUTES) {
        const response = await page.goto(`${origin}${pathname}`);
        assert.equal(response.status(), 200);
        assert.equal(await page.locator("h1").count(), 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${pathname} should fit ${width}px`);
        const cta = page.locator('main a.btn-primary[href^="/contact.html?"]').first();
        assert.equal(await cta.isVisible(), true);
        assert.match((await cta.textContent()).trim(), /request.*pentest/i);
        const destination = new URL(await cta.getAttribute("href"), origin);
        assert.equal(destination.searchParams.get("service"), "web-api");
        assert.equal(destination.searchParams.get("source"), source);
        await cta.click();
        await page.waitForURL(url => url.pathname === "/contact.html");
        assert.equal(await page.locator("#service").inputValue(), "web-api");
        assert.equal(await page.locator('input[name="enquiry_source"]').inputValue(), source);
        assert.equal(await page.locator("script[data-balhence-analytics]").count(), 0);
      }
      pass(`Homepage and three pentest pages fit ${width}px and link directly to preselected, attributed enquiries`);
    }

    for (const source of SOURCES) {
      await page.goto(`${origin}/contact.html?service=web-api&source=${source}`);
      assert.equal(await page.locator('input[name="enquiry_source"]').count(), 1);
      assert.equal(await page.locator('input[name="enquiry_source"]').inputValue(), source);
    }
    pass("Every fixed editorial source label reaches the enquiry form exactly once");

    for (const query of ["", "?source=arbitrary-visitor-value", "?source=%3Cscript%3E", "?source=HOME-HERO", "?utm_source=untrusted-campaign"]) {
      await page.goto(`${origin}/contact.html${query}`);
      assert.equal(await page.locator('input[name="enquiry_source"]').inputValue(), "unlabelled");
    }
    for (const query of ["?utm_source=scope-builder", "?source=unknown&utm_source=scope-builder"]) {
      await page.goto(`${origin}/contact.html${query}`);
      assert.equal(await page.locator('input[name="enquiry_source"]').inputValue(), "scope-planner");
    }
    await page.goto(`${origin}/contact.html?source=api-pentest&utm_source=scope-builder`);
    assert.equal(await page.locator('input[name="enquiry_source"]').inputValue(), "api-pentest");
    pass("Missing or unknown sources stay unlabelled; legacy planner attribution works without overriding a known source");

    await page.evaluate(key => localStorage.setItem(key, "accepted"), CONSENT);
    const analyticsBeforeContact = analyticsScripts.length;
    for (const pathname of ["/contact.html", "/scope-builder.html", "/privacy.html"]) {
      await page.goto(`${origin}${pathname}?source=home-hero&private_marker=synthetic#private-fragment`);
      assert.equal(await page.locator("script[data-balhence-analytics]").count(), 0);
      assert.deepEqual(await queuedCalls(page), []);
    }
    assert.equal(analyticsScripts.length, analyticsBeforeContact);
    pass("Contact, scope planner, and privacy pages remain analytics-free even with stored acceptance");

    await page.goto(`${origin}/contact.html?service=web-api&source=home-hero`);
    await page.locator("#name").fill("Local minimal enquiry");
    await page.locator("#email").fill("minimal@example.invalid");
    await page.locator("#privacy-consent").check();
    assert.equal(await page.locator("form[data-lead-form]").evaluate(form => form.checkValidity()), true);
    for (const selector of ["#company", "#website", "#deadline", "#trigger", "#context"]) {
      assert.equal(await page.locator(selector).evaluate(field => field.required), false);
    }
    pass("An initial enquiry does not require company details, a finished scope, or a known deadline");
    await fillEnquiry(page);
    await page.evaluate(() => {
      window.localFormSuccesses = [];
      document.addEventListener("balhence:form-success", event => window.localFormSuccesses.push(event.detail));
    });
    formMode = "failure";
    await page.locator('form[data-lead-form] button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("[data-form-status]").classList.contains("is-error"));
    assert.match(await page.locator("[data-form-status]").textContent(), /could not send.*details are still here/i);
    assert.equal(await page.locator('[data-form-status] a').getAttribute("href"), "mailto:contact@balhence.com");
    assert.equal(await page.locator("#name").inputValue(), "Local conversion test");
    assert.equal(await page.locator("#email").inputValue(), "conversion@example.invalid");
    assert.equal(await page.locator("#context").inputValue(), "Synthetic application with two roles. Local form test only.");
    assert.equal(await page.locator("#privacy-consent").isChecked(), true);
    assert.equal(await page.locator('form[data-lead-form] button[type="submit"]').isEnabled(), true);
    assert.equal(await page.locator("form[data-lead-form]").getAttribute("aria-busy"), null);
    assert.deepEqual(await page.evaluate(() => window.localFormSuccesses), []);
    assert.deepEqual(await queuedCalls(page), []);
    pass("A mocked delivery failure preserves the enquiry and consent, restores controls, and offers an email fallback");

    formMode = "success";
    await page.locator('form[data-lead-form] button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("[data-form-status]").classList.contains("is-success"));
    const status = await page.locator("[data-form-status]").textContent();
    assert.match(status, /request has been sent/i);
    assert.doesNotMatch(status, /24.hour|one business day|within|guarantee/i);
    assert.equal(await page.locator("#name").inputValue(), "");
    assert.equal(await page.locator("#email").inputValue(), "");
    assert.equal(await page.locator("#context").inputValue(), "");
    assert.equal(await page.locator('form[data-lead-form] button[type="submit"]').isEnabled(), true);
    assert.deepEqual(await page.evaluate(() => window.localFormSuccesses), [{ formName: "scope_request" }]);
    assert.deepEqual(await queuedCalls(page), []);
    assert.equal(analyticsScripts.length, analyticsBeforeContact);
    assert.equal(submissions.length, 2);
    for (const submission of submissions) {
      assert.equal(submission.method, "POST");
      assert.equal(submission.navigation, false);
      assert.match(submission.body, /name="enquiry_source"\r?\n\r?\nhome-hero/);
      assert.match(submission.body, /conversion@example\.invalid/);
    }
    pass("A mocked successful enquiry clears fields and emits local success only, with no analytics or response-time promise");
    formMode = "unexpected";

    const analyticsContext = await newContext();
    const analyticsPage = await analyticsContext.newPage();
    await analyticsPage.goto(`${origin}/?private_marker=synthetic#private-fragment`);
    // Preserve the real link handler while preventing navigation during event assertions.
    await analyticsPage.evaluate(() => document.addEventListener("click", event => {
      if (event.target.closest("a")) event.preventDefault();
    }, { capture: true }));
    await analyticsPage.locator('[data-track="hero_pentest"]').click();
    assert.deepEqual(await queuedCalls(analyticsPage), []);
    assert.equal(await analyticsPage.locator("script[data-balhence-analytics]").count(), 0);
    pass("A pentest CTA click before analytics consent does not queue intent or lead events");

    await analyticsPage.locator("[data-consent-accept]").click();
    await analyticsPage.waitForFunction(() => (window.dataLayer || []).some(entry => entry[0] === "config"));
    let calls = await queuedCalls(analyticsPage);
    const configuration = calls.find(entry => entry[0] === "config")[2];
    assert.equal(configuration.page_location, `${origin}/`);
    assert.equal(configuration.page_referrer, "");
    assert.equal(configuration.allow_google_signals, false);
    assert.equal(configuration.allow_ad_personalization_signals, false);
    assert.doesNotMatch(JSON.stringify(calls), /private_marker|private-fragment/);
    await analyticsPage.locator('[data-track="hero_pentest"]').click();
    calls = await queuedCalls(analyticsPage);
    const intents = calls.filter(entry => entry[0] === "event" && entry[1] === "contact_intent");
    assert.equal(intents.length, 1);
    assert.deepEqual(intents[0][2], { content_type: "cta", content_id: "hero_pentest" });
    assert.equal(calls.some(entry => entry[1] === "generate_lead"), false);
    pass("Consent enables a contact_intent event, not a generated lead, and analytics configuration excludes query strings and fragments");

    await analyticsPage.locator('[data-track="hero_sample_report"]').click();
    await analyticsPage.evaluate(() => {
      const link = document.querySelector('[data-track="hero_pentest"]');
      link.href = "https://external.example/contact.html?private_marker=synthetic";
      link.click();
    });
    calls = await queuedCalls(analyticsPage);
    assert.equal(calls.filter(entry => entry[0] === "event" && entry[1] === "contact_intent").length, 1);
    assert.equal(calls.filter(entry => entry[0] === "event" && entry[1] === "select_content").length, 2);
    assert.doesNotMatch(JSON.stringify(calls), /external\.example|private_marker/);
    pass("Report links and external contact-shaped links are content selections, never same-origin enquiry intent");

    await analyticsPage.goto(`${origin}/services.html?private_marker=second#private-fragment`, {
      referer: `${origin}/blogs.html?private_marker=referrer#private-fragment`,
    });
    calls = await queuedCalls(analyticsPage);
    const nextConfiguration = calls.find(entry => entry[0] === "config")[2];
    assert.equal(nextConfiguration.page_location, `${origin}/services.html`);
    assert.equal(nextConfiguration.page_referrer, `${origin}/blogs.html`);
    assert.doesNotMatch(JSON.stringify(calls), /private_marker|private-fragment/);
    await analyticsPage.locator(".footer-bottom [data-analytics-preferences]").click();
    await analyticsPage.locator("[data-consent-decline]").click();
    const beforeRevokedClick = (await queuedCalls(analyticsPage)).length;
    await analyticsPage.locator('[data-track="services_hero_contact"]').evaluate(link => {
      link.addEventListener("click", event => event.preventDefault(), { once: true });
      link.click();
    });
    assert.equal((await queuedCalls(analyticsPage)).length, beforeRevokedClick);
    assert.equal(await analyticsPage.locator("script[data-balhence-analytics]").count(), 0);
    pass("Analytics referrers omit private URL parts, and revoking consent stops subsequent CTA events");
    await analyticsContext.close();

    const nojsContext = await newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
    const nojs = await nojsContext.newPage();
    for (const [pathname] of BUYER_ROUTES) {
      await nojs.goto(`${origin}${pathname}`);
      const link = nojs.locator('main a.btn-primary[href^="/contact.html?"]').first();
      assert.equal(await link.isVisible(), true);
      await link.click();
      await nojs.waitForURL(url => url.pathname === "/contact.html");
      assert.equal(await nojs.locator("form[data-lead-form]").isVisible(), true);
      assert.equal(await nojs.locator('form[data-lead-form]').getAttribute("method"), "post");
      assert.match(await nojs.locator('form[data-lead-form]').getAttribute("action"), /^https:\/\/formspree\.io\/f\/[a-z0-9]+$/);
    }
    pass("All four buyer pages reach the contact form without JavaScript");

    await fillEnquiry(nojs);
    assert.equal(await nojs.locator("#privacy-consent").getAttribute("required"), "");
    formMode = "native";
    await nojs.locator('form[data-lead-form] button[type="submit"]').click();
    await nojs.waitForURL(url => url.origin === "https://formspree.io");
    assert.equal(await nojs.locator("h1").textContent(), "Native form reached the local mock");
    const native = submissions.at(-1);
    assert.equal(submissions.length, 3);
    assert.equal(native.navigation, true);
    assert.equal(native.method, "POST");
    assert.match(native.contentType, /application\/x-www-form-urlencoded/);
    const nativeFields = new URLSearchParams(native.body);
    assert.equal(nativeFields.get("email"), "conversion@example.invalid");
    assert.equal(nativeFields.get("service"), "web-api");
    assert.equal(nativeFields.get("privacy_consent"), "agreed");
    assert.equal(nativeFields.get("_gotcha"), "");
    pass("Without JavaScript, required fields and consent submit through the native POST fallback to a local mock");
    await nojsContext.close();

    assert.deepEqual(errors, [], "Pages must not throw uncaught JavaScript errors");
    assert.deepEqual(missing, [], "Published pages and assets must not return local errors");
    assert.deepEqual(unexpectedExternal, [], "No unexpected third-party requests should be attempted");
    console.log(`${checks} SEO and conversion checks passed. Formspree and analytics were mocked; no external traffic was sent.`);
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
