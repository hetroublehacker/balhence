#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");

async function freePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function main() {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.platform === "win32" ? "python" : "python3", [
    "serve.py", "--port", String(port),
  ], { cwd: ROOT, stdio: "ignore" });
  let browser;
  let checks = 0;
  const pass = message => { checks += 1; console.log(`PASS ${message}`); };
  const errors = [];
  const external = [];
  const giscusRequests = [];
  const formSubmissions = [];

  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        await new Promise((resolve, reject) => {
          const socket = net.connect(port, "127.0.0.1", () => { socket.end(); resolve(); });
          socket.once("error", reject);
        });
        break;
      } catch {
        if (attempt === 39) throw new Error("Preview did not start");
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.origin === "https://formspree.io") {
        formSubmissions.push(route.request().postData() || "");
        return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      }
      if (url.href === "https://giscus.app/client.js") {
        giscusRequests.push(url.href);
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "document.querySelector('.giscus').dataset.testLoaded = 'true';" });
      }
      external.push(url.href);
      return route.abort();
    });

    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/book-a-call?service=ai&source=pricing`);
    assert.equal((await page.locator("h1").innerText()).trim(), "Request a security scoping call");
    assert.equal(await page.locator("body").getAttribute("data-analytics"), "off");
    assert.equal(await page.locator("[data-live-calendar]").isHidden(), true);
    assert.ok((await page.locator("[data-timezone]").inputValue()).trim().length > 0);
    assert.match(await page.locator('[data-preferred-time]').first().getAttribute("min"), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(await page.locator("#call-service").inputValue(), "ai");
    assert.match(await page.locator("#call-guidance").innerText(), /does not reserve/i);
    pass("The call page is explicit about email confirmation, prefills only an allowed service, and detects an editable time zone");

    await page.locator("#call-name").fill("Local call test");
    await page.locator("#call-email").fill("call-test@example.invalid");
    await page.locator("#call-length").selectOption("30-minutes");
    await page.locator("#call-first-time").fill("2099-11-20T10:30");
    await page.locator("#call-privacy-consent").check();
    assert.equal(await page.locator("form[data-lead-form='call_request']").evaluate(form => form.checkValidity()), true);
    await page.locator("form[data-lead-form='call_request'] button[type='submit']").click();
    await page.waitForFunction(() => document.querySelector("[data-form-status]").classList.contains("is-success"));
    const success = await page.locator("[data-form-status]").innerText();
    assert.match(success, /reply by email to confirm/i);
    assert.match(success, /no call is booked until then/i);
    assert.equal(formSubmissions.length, 1);
    assert.match(formSubmissions[0], /name="request_kind"\r?\n\r?\ncall_request/);
    assert.match(formSubmissions[0], /name="timezone"/);
    assert.equal(await page.locator("#call-name").inputValue(), "");
    pass("The call request reuses the hardened lead form and returns a call-specific, non-booking confirmation");

    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/book-a-call`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Call page overflows at ${width}px`);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("#call-first-time").isVisible(), true);
    }
    pass("The call request remains usable without horizontal overflow from mobile through desktop widths");

    const incomplete = await context.newPage();
    incomplete.on("pageerror", error => errors.push(error.message));
    await incomplete.setContent('<!doctype html><head><meta property="og:type" content="article"><link rel="canonical" href="https://balhence.com/research/example"></head><body><main class="article-content"></main></body>');
    await incomplete.evaluate(() => { window.BALHENCE_CONFIG = { engagement: { provider: "giscus", repo: "hetroublehacker/balhence", repoId: "R_kgDORgQN5Q", category: "", categoryId: "" } }; });
    await incomplete.addScriptTag({ path: path.join(ROOT, "article-engagement.js") });
    assert.equal(await incomplete.locator("[data-article-engagement]").count(), 0);
    assert.equal(giscusRequests.length, 0);
    pass("Incomplete Giscus configuration renders nothing and performs no third-party request");

    const configured = await context.newPage();
    configured.on("pageerror", error => errors.push(error.message));
    await configured.setContent('<!doctype html><head><meta property="og:type" content="article"><link rel="canonical" href="https://balhence.com/research/example"></head><body><main class="article-content"></main></body>');
    await configured.evaluate(() => { window.BALHENCE_CONFIG = { engagement: { provider: "giscus", repo: "hetroublehacker/balhence", repoId: "R_kgDORgQN5Q", category: "Research", categoryId: "DIC_test_category" } }; });
    await configured.addScriptTag({ path: path.join(ROOT, "article-engagement.js") });
    assert.equal(await configured.locator("[data-article-engagement]").count(), 1);
    assert.equal(giscusRequests.length, 0);
    await configured.locator("[data-article-engagement] button").click();
    await configured.waitForFunction(() => document.querySelector(".giscus").dataset.testLoaded === "true");
    assert.equal(giscusRequests.length, 1);
    const scriptData = await configured.locator('script[src="https://giscus.app/client.js"]').evaluate(script => ({
      mapping: script.dataset.mapping,
      term: script.dataset.term,
      reactions: script.dataset.reactionsEnabled,
      strict: script.dataset.strict,
    }));
    assert.deepEqual(scriptData, { mapping: "specific", term: "/research/example", reactions: "1", strict: "1" });
    pass("Configured discussions make exactly one opt-in request and bind reactions to the clean canonical pathname");

    const validCalendar = await context.newPage();
    await validCalendar.setContent('<a data-live-calendar hidden>Calendar</a>');
    await validCalendar.evaluate(() => { window.BALHENCE_CONFIG = { calendar: { bookingUrl: "https://calendar.example/balhence" } }; });
    await validCalendar.addScriptTag({ path: path.join(ROOT, "book-a-call.js") });
    assert.equal(await validCalendar.locator("[data-live-calendar]").isVisible(), true);
    assert.equal(await validCalendar.locator("[data-live-calendar]").getAttribute("href"), "https://calendar.example/balhence");
    pass("A reviewed HTTPS calendar can be enabled later without changing the page, while the empty production value remains dormant");

    const articleFiles = ["insights", "research"]
      .flatMap(directory => fs.readdirSync(path.join(ROOT, directory))
        .filter(name => name.endsWith(".html"))
        .map(name => path.join(ROOT, directory, name)))
      .filter(filename => {
        const source = fs.readFileSync(filename, "utf8");
        return /<meta\b(?=[^>]*\bproperty=["']og:type["'])(?=[^>]*\bcontent=["']article["'])[^>]*>/i.test(source)
          || /<meta\b(?=[^>]*\bcontent=["']article["'])(?=[^>]*\bproperty=["']og:type["'])[^>]*>/i.test(source);
      });
    assert.equal(articleFiles.length, 29);
    for (const filename of articleFiles) {
      const source = fs.readFileSync(filename, "utf8");
      assert.match(source, /script-src [^;]*https:\/\/giscus\.app;/);
      assert.match(source, /frame-src [^;]*https:\/\/giscus\.app;/);
      assert.equal((source.match(/article-engagement\.js/g) || []).length, 1);
      assert.ok(source.indexOf("config.js") < source.indexOf("article-engagement.js"));
    }
    pass("Every published article permits and loads the same dormant, consent-gated engagement adapter");

    const publicHtmlFiles = [
      ...fs.readdirSync(ROOT)
        .filter(name => name.endsWith(".html"))
        .map(name => path.join(ROOT, name)),
      ...["insights", "research", "collateral"].flatMap(directory =>
        fs.readdirSync(path.join(ROOT, directory))
          .filter(name => name.endsWith(".html"))
          .map(name => path.join(ROOT, directory, name))),
    ];
    const pagesWithHeader = publicHtmlFiles.filter(filename =>
      fs.readFileSync(filename, "utf8").includes('<header class="site-header"'));
    assert.equal(pagesWithHeader.length, 56);
    for (const filename of pagesWithHeader) {
      const source = fs.readFileSync(filename, "utf8");
      assert.equal((source.match(/href="\/book-a-call\?source=nav-call"/g) || []).length, 1, filename);
      assert.equal((source.match(/data-track="nav_book_call"/g) || []).length, 1, filename);
    }
    const appSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
    const importerSource = fs.readFileSync(path.join(ROOT, "scripts", "import_medium_archive.py"), "utf8");
    assert.match(appSource, /["']nav-call["']/);
    assert.match(importerSource, /href="\/book-a-call\?source=nav-call"/);
    pass("Every public header exposes one tracked clean-URL call CTA, and future archive imports preserve it");

    assert.deepEqual(errors, [], "The booking and engagement scripts should not throw");
    assert.deepEqual(external, [], "No unexpected third-party requests should occur");
    assert.equal(fs.existsSync(path.join(ROOT, "book-a-call.html")), true);
    console.log(`${checks} engagement and booking checks passed.`);
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
