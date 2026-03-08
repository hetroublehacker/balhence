/* ============================================================
   BALHENCE — app.js
   Apple-inspired minimalist render engine.
   All content from config.js, scroll-reveal animations.
   ============================================================ */

// Easter egg
console.log("%c\u{1F575}\uFE0F Found the console? You already think like a pentester.\n%c\u2192 balhence.com/ctf.html", "color:#0071e3; font-size:14px; font-weight:bold;", "color:#34c759; font-size:12px;");

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadAnalytics();
  applyCompanyMeta();
  renderNav();
  renderFooter();
  initNavScroll();

  const page = document.body.dataset.page;

  switch (page) {
    case "home":
      renderHero();
      renderStats();
      renderProcess();
      renderServicesPreview();
      renderRiskCalculator();
      renderTestimonials();
      renderFAQ();
      renderWhyUs();
      renderHomeContactCTA();
      break;
    case "services":
      renderPageHeader("Services", "VAPT Services", "End-to-end security testing across your entire attack surface.");
      renderServices();
      renderProcess();
      renderFAQ();
      renderWhyUs();
      renderPageCTA();
      break;
    case "about":
      renderPageHeader("About", "About Balhence", "Built for India. Built for security.");
      renderAbout();
      renderAchievements();
      renderTeam();
      renderPageCTA();
      break;
    case "blog":
      renderPageHeader("Blog", "Security Insights", "Practical cybersecurity content for Indian businesses.");
      renderBlog();
      break;
    case "contact":
      renderContactForm();
      break;
  }

  // Init scroll reveals after everything renders
  setTimeout(initScrollReveal, 100);
});

/* ── Helpers ──────────────────────────────────────────────── */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function sectionLabel(text) {
  return `<span class="section-label">${text}</span>`;
}

function getCurrentPage() {
  return document.body.dataset.page;
}

const CHEVRON_SVG = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ── Theme Toggle ─────────────────────────────────────────── */
const SUN_ICON = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
const MOON_ICON = '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function initTheme() {
  const saved = localStorage.getItem("balhence_theme");
  const prefer = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = saved || prefer;
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("balhence_theme", next);
}

/* ── Google Analytics ─────────────────────────────────────── */
function loadAnalytics() {
  const id = CONFIG.analytics && CONFIG.analytics.googleAnalyticsId;
  if (!id) return;
  const s1 = document.createElement("script");
  s1.async = true;
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s1);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", id);
}

/* ── Meta / Title ─────────────────────────────────────────── */
function applyCompanyMeta() {
  const page = getCurrentPage();
  const titles = {
    home:     `${CONFIG.company.name} \u2014 VAPT as a Service`,
    services: `Services \u2014 ${CONFIG.company.name}`,
    about:    `About \u2014 ${CONFIG.company.name}`,
    blog:     `Blog \u2014 ${CONFIG.company.name}`,
    contact:  `Contact \u2014 ${CONFIG.company.name}`,
  };
  document.title = titles[page] || CONFIG.company.name;
}

/* ── Nav ──────────────────────────────────────────────────── */
function renderNav() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  const page = getCurrentPage();
  const links = [
    { label: "Services", href: "services.html" },
    { label: "About",    href: "about.html" },
    { label: "Blog",     href: "blog.html" },
  ];
  const linkHtml = links.map(l =>
    `<li><a href="${l.href}" ${l.href.includes(page) ? 'class="active"' : ""}>${l.label}</a></li>`
  ).join("");

  nav.innerHTML = `
    <div class="nav-inner">
      <a class="nav-logo" href="index.html">Bal<span>hence</span></a>
      <ul class="nav-links" id="nav-links">
        ${linkHtml}
        <li><a href="contact.html" class="btn btn-primary nav-cta">Get Audit</a></li>
      </ul>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">${SUN_ICON}${MOON_ICON}</button>
        <button class="hamburger" id="hamburger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>`;

  const btn = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  if (btn && navLinks) {
    btn.addEventListener("click", () => navLinks.classList.toggle("open"));
    navLinks.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => navLinks.classList.remove("open"))
    );
  }
}

function initNavScroll() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });
}

/* ── Scroll Reveal ────────────────────────────────────────── */
function initScrollReveal() {
  const selectors = [
    ".hero-badge", ".hero-heading", ".hero-description", ".hero-actions", ".hero-trust",
    ".stat-card", ".service-card", ".process-card", ".why-card",
    ".testimonial-card", ".faq-item", ".highlight-card",
    ".brand-story", ".cta-banner",
    ".contact-info", ".contact-form-box",
    ".about-text", ".about-highlights",
    ".calc-question", ".calc-submit",
    ".blog-card", ".blog-coming-soon",
    ".achievement-card", ".team-card",
  ];

  const elements = document.querySelectorAll(selectors.join(", "));

  elements.forEach(el => {
    el.classList.add("reveal");
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      // Stagger children within grids
      const parent = entry.target.parentElement;
      if (parent) {
        const siblings = Array.from(parent.querySelectorAll(".reveal"));
        const index = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = `${(index % 6) * 0.08}s`;
      }
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

  elements.forEach(el => observer.observe(el));
}

/* ── Page Header ──────────────────────────────────────────── */
function renderPageHeader(label, heading, sub) {
  const section = document.getElementById("page-header");
  if (!section) return;
  section.innerHTML = `
    <div class="container">
      ${sectionLabel(label)}
      <h1>${heading}</h1>
      <p class="page-header-sub">${sub}</p>
    </div>`;
}

/* ── Hero ─────────────────────────────────────────────────── */
function renderHero() {
  const h = CONFIG.hero;
  const section = document.getElementById("hero");
  if (!section) return;
  section.innerHTML = `
    <div class="container">
      <div class="hero-badge">
        <span class="dot"></span> ${h.urgency}
      </div>
      <h1 class="hero-heading">
        ${h.heading}<span class="hero-heading-accent">${h.subheading}</span>
      </h1>
      <p class="hero-description">${h.description}</p>
      <div class="hero-actions">
        <a href="contact.html" class="btn btn-primary">${h.ctaText} \u2192</a>
        <a href="services.html" class="btn btn-outline">${h.ctaSecondaryText} \u2192</a>
      </div>
      <div class="hero-trust">
        <span class="hero-trust-text">Trusted certifications:</span>
        <div class="trust-badges">
          <span class="trust-badge">CEH</span>
          <span class="trust-badge">OSCP</span>
          <span class="trust-badge">CRTP</span>
          <span class="trust-badge">ISO 27001</span>
          <span class="trust-badge">DPDP Act</span>
        </div>
      </div>
    </div>`;
}

/* ── Stats (animated counters) ────────────────────────────── */
function renderStats() {
  const section = document.getElementById("stats");
  if (!section) return;
  const grid = el("div", "stats-grid");

  CONFIG.stats.forEach(s => {
    const parsed = parseStatNumber(s.value);
    const valueHtml = parsed
      ? `<div class="stat-value" data-target="${parsed.number}" data-prefix="${parsed.prefix}" data-suffix="${parsed.suffix}" data-decimals="${parsed.decimals}" data-comma="${parsed.comma}">${parsed.prefix}0${parsed.suffix}</div>`
      : `<div class="stat-value">${s.value}</div>`;
    grid.appendChild(el("div", "stat-card", `
      ${valueHtml}
      <div class="stat-label">${s.label}</div>
      <div class="stat-source">${s.source}</div>
    `));
  });

  section.querySelector(".container").appendChild(grid);
  initStatCounters();
}

function parseStatNumber(str) {
  const m = str.match(/^([^0-9]*)([0-9,]+\.?[0-9]*)(.*)$/);
  if (!m) return null;
  const raw = m[2].replace(/,/g, "");
  const num = parseFloat(raw);
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  return { prefix: m[1], number: num, suffix: m[3], decimals, comma: m[2].includes(",") };
}

function initStatCounters() {
  const values = document.querySelectorAll(".stat-value[data-target]");
  if (!values.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      animateCounter(entry.target);
    });
  }, { threshold: 0.5 });
  values.forEach(v => observer.observe(v));
}

function animateCounter(elem) {
  const target   = parseFloat(elem.dataset.target);
  const prefix   = elem.dataset.prefix;
  const suffix   = elem.dataset.suffix;
  const decimals = parseInt(elem.dataset.decimals) || 0;
  const useComma = elem.dataset.comma === "true";
  const duration = 2400;
  const start    = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current  = target * easeOut(progress);
    let display = current.toFixed(decimals);
    if (useComma) display = parseFloat(display).toLocaleString("en-IN");
    elem.textContent = prefix + display + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/* ── Process ──────────────────────────────────────────────── */
function renderProcess() {
  const section = document.getElementById("process");
  if (!section) return;
  const cards = CONFIG.process.map(s => `
    <div class="process-card">
      <div class="process-step">${s.step}</div>
      <div class="process-title">${s.title}</div>
      <div class="process-desc">${s.description}</div>
    </div>`).join("");
  section.querySelector(".container").insertAdjacentHTML("beforeend",
    `<div class="process-grid">${cards}</div>`);
}

/* ── Testimonials ─────────────────────────────────────────── */
function renderTestimonials() {
  const section = document.getElementById("testimonials");
  if (!section) return;
  if (!CONFIG.testimonials || CONFIG.testimonials.length === 0) {
    section.style.display = "none";
    return;
  }
  const cards = CONFIG.testimonials.map(t => `
    <div class="testimonial-card">
      <div class="testimonial-quote">\u201C${t.quote}\u201D</div>
      <div class="testimonial-author">
        <div class="testimonial-avatar">${t.initials}</div>
        <div>
          <div class="testimonial-name">${t.name}</div>
          <div class="testimonial-company">${t.company}</div>
        </div>
      </div>
    </div>`).join("");
  section.querySelector(".container").insertAdjacentHTML("beforeend",
    `<div class="testimonials-grid">${cards}</div>`);
}

/* ── Services ─────────────────────────────────────────────── */
function renderServices() {
  const section = document.getElementById("services");
  if (!section) return;
  const grid = el("div", "services-grid");
  CONFIG.services.forEach(s => {
    grid.appendChild(el("div", "service-card", `
      <div class="service-title">${s.title}</div>
      <div class="service-desc">${s.description}</div>
    `));
  });
  section.querySelector(".container").appendChild(grid);
}

function renderServicesPreview() {
  const section = document.getElementById("services-preview");
  if (!section) return;
  const preview = CONFIG.services.slice(0, 3);
  const grid = el("div", "services-grid");
  preview.forEach(s => {
    grid.appendChild(el("div", "service-card", `
      <div class="service-title">${s.title}</div>
      <div class="service-desc">${s.description}</div>
    `));
  });
  const container = section.querySelector(".container");
  container.appendChild(grid);
  container.insertAdjacentHTML("beforeend",
    `<div class="preview-more"><a href="services.html" class="btn btn-outline">View All Services \u2192</a></div>`);
}

/* ── About ────────────────────────────────────────────────── */
function renderAbout() {
  const section = document.getElementById("about");
  if (!section) return;
  const a = CONFIG.about;
  const paragraphs = a.paragraphs.map(p => `<p>${p}</p>`).join("");
  const highlights = a.highlights.map(h => `
    <div class="highlight-card">
      <div class="highlight-value">${h.value}</div>
      <div class="highlight-label">${h.label}</div>
    </div>`).join("");

  const brand = a.brandStory;
  const brandHtml = brand ? `
    <div class="brand-story">
      <div class="brand-story-word">
        <span class="brand-name">Bal<em>hence</em></span>
        <span class="brand-equals">\u2261</span>
        <span class="brand-meaning">
          <span class="brand-hindi">${brand.meaningScript}</span>
          <span class="brand-meaning-text">${brand.meaning}</span>
        </span>
      </div>
      <p class="brand-story-desc">${brand.explanation}</p>
    </div>` : "";

  section.querySelector(".container").innerHTML = `
    <div class="about-grid">
      <div class="about-text">
        ${sectionLabel("Our Story")}
        <h2 class="section-heading" style="text-align:left;">${a.heading}</h2>
        ${brandHtml}
        ${paragraphs}
      </div>
      <div class="about-highlights">${highlights}</div>
    </div>`;
}

/* ── Why Us ───────────────────────────────────────────────── */
function renderWhyUs() {
  const section = document.getElementById("why-us");
  if (!section) return;
  const grid = el("div", "why-grid");
  CONFIG.whyUs.forEach(w => {
    grid.appendChild(el("div", "why-card", `
      <div class="why-title">${w.title}</div>
      <div class="why-desc">${w.description}</div>
    `));
  });
  section.querySelector(".container").appendChild(grid);
}

/* ── Achievements ─────────────────────────────────────────── */
function renderAchievements() {
  const section = document.getElementById("achievements");
  if (!section) return;
  if (!CONFIG.achievements || CONFIG.achievements.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  const grid = el("div", "achievements-grid");
  CONFIG.achievements.forEach(a => {
    grid.appendChild(el("div", "achievement-card", `
      <div class="achievement-icon">\u{1F3C6}</div>
      <div>
        <div class="achievement-title">${a.title}</div>
        <div class="achievement-meta">${a.issuer} \u00B7 ${a.year}</div>
      </div>
    `));
  });
  section.querySelector(".container").appendChild(grid);
}

/* ── Team ─────────────────────────────────────────────────── */
function renderTeam() {
  const section = document.getElementById("team");
  if (!section) return;
  if (!CONFIG.team || CONFIG.team.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  const grid = el("div", "team-grid");
  CONFIG.team.forEach(m => {
    const avatarContent = m.photo ? `<img src="${m.photo}" alt="${m.name}">` : m.avatar;
    grid.appendChild(el("div", "team-card", `
      <div class="team-avatar">${avatarContent}</div>
      <div class="team-name">${m.name}</div>
      <div class="team-role">${m.role}</div>
      ${m.certifications ? `<div class="team-certs">${m.certifications}</div>` : ""}
      <div class="team-bio">${m.bio}</div>
      ${m.linkedIn ? `<a class="team-linkedin" href="${m.linkedIn}" target="_blank">LinkedIn \u2192</a>` : ""}
    `));
  });
  section.querySelector(".container").appendChild(grid);
}

/* ── Blog ─────────────────────────────────────────────────── */
function renderBlog() {
  const section = document.getElementById("blog");
  if (!section) return;
  const container = section.querySelector(".container");
  if (!CONFIG.blogs || CONFIG.blogs.length === 0) {
    container.insertAdjacentHTML("beforeend", `
      <div class="blog-coming-soon">
        <div class="cs-icon">\u270D\uFE0F</div>
        <h3>Insights Coming Soon</h3>
        <p>We're working on practical cybersecurity articles tailored for Indian businesses.</p>
      </div>`);
    return;
  }
  const grid = el("div", "blog-grid");
  CONFIG.blogs.forEach(b => {
    grid.appendChild(el("div", "blog-card", `
      <div class="blog-tag">${b.tag}</div>
      <div class="blog-title">${b.title}</div>
      <div class="blog-summary">${b.summary}</div>
      <div class="blog-footer">
        <span>${b.date}</span>
        <a class="blog-read-more" href="${b.link}">Read \u2192</a>
      </div>
    `));
  });
  container.appendChild(grid);
}

/* ── CTA Banners ──────────────────────────────────────────── */
function renderHomeContactCTA() {
  const section = document.getElementById("home-cta");
  if (!section) return;
  section.innerHTML = `
    <div class="container">
      <div class="cta-banner">
        <div class="cta-banner-text">
          <h2>Ready to find out what attackers can see?</h2>
          <p>Get an initial security consultation \u2014 no strings attached.</p>
        </div>
        <a href="contact.html" class="btn btn-primary">Request Audit \u2192</a>
      </div>
    </div>`;
}

function renderPageCTA() {
  const section = document.getElementById("page-cta");
  if (!section) return;
  section.innerHTML = `
    <div class="container">
      <div class="cta-banner">
        <div class="cta-banner-text">
          <h2>Ready to secure your business?</h2>
          <p>Request an audit and we'll get back within 24 hours.</p>
        </div>
        <a href="contact.html" class="btn btn-primary">Get Audit \u2192</a>
      </div>
    </div>`;
}

/* ── Risk Calculator ──────────────────────────────────────── */
function renderRiskCalculator() {
  const section = document.getElementById("risk-calculator");
  if (!section) return;
  const rc = CONFIG.riskCalculator;

  const questionsHtml = rc.questions.map((q, qi) => {
    const opts = q.options.map(o => `
      <label class="calc-option">
        <input type="radio" name="q${qi}" value="${o.score}" />
        <span>${o.label}</span>
      </label>`).join("");
    return `
      <div class="calc-question">
        <div class="calc-q-number">Q${qi + 1}</div>
        <div class="calc-q-text">${q.question}</div>
        <div class="calc-options">${opts}</div>
      </div>`;
  }).join("");

  section.querySelector(".container").insertAdjacentHTML("beforeend", `
    <div class="calc-wrapper">
      <div class="calc-form" id="calc-form">
        ${questionsHtml}
        <button class="btn btn-primary calc-submit" onclick="calculateRisk()">
          Calculate My Risk Score \u2192
        </button>
        <p class="calc-note">Instant result. No email required.</p>
      </div>
      <div class="calc-result" id="calc-result" style="display:none;"></div>
    </div>`);
}

function calculateRisk() {
  const rc = CONFIG.riskCalculator;
  let score = 0;
  let answered = 0;

  rc.questions.forEach((q, qi) => {
    const selected = document.querySelector(`input[name="q${qi}"]:checked`);
    if (selected) { score += parseInt(selected.value); answered++; }
  });

  if (answered < rc.questions.length) {
    rc.questions.forEach((q, i) => {
      const group = document.querySelectorAll(`input[name="q${i}"]`);
      const parent = group[0]?.closest(".calc-question");
      const checked = document.querySelector(`input[name="q${i}"]:checked`);
      if (parent) parent.classList.toggle("calc-unanswered", !checked);
    });
    return;
  }

  const result = rc.results.find(r => score >= r.min && score <= r.max);
  if (!result) return;

  const colorMap = { green: "#34c759", amber: "#ff9f0a", red: "#ff3b30" };
  const color = colorMap[result.color] || "#0071e3";

  document.getElementById("calc-form").style.display = "none";
  const resultEl = document.getElementById("calc-result");
  resultEl.style.display = "block";
  resultEl.innerHTML = `
    <div class="calc-result-inner">
      <div class="calc-score-bar">
        <div class="calc-score-fill" style="width:${Math.min((score / 15) * 100, 100)}%; background:${color};"></div>
      </div>
      <div class="calc-result-level" style="color:${color};">${result.level}</div>
      <p class="calc-result-message">${result.message}</p>
      <div class="calc-result-actions">
        <a href="contact.html" class="btn btn-primary">${result.cta} \u2192</a>
        <button class="btn btn-outline" onclick="resetCalculator()">Retake</button>
      </div>
    </div>`;
}

function resetCalculator() {
  document.getElementById("calc-form").style.display = "block";
  document.getElementById("calc-result").style.display = "none";
  document.querySelectorAll(".calc-option input").forEach(i => i.checked = false);
  document.querySelectorAll(".calc-question").forEach(q => q.classList.remove("calc-unanswered"));
}

/* ── FAQ Accordion ────────────────────────────────────────── */
function renderFAQ() {
  const section = document.getElementById("faq");
  if (!section) return;
  if (!CONFIG.faq || CONFIG.faq.length === 0) { section.style.display = "none"; return; }

  const items = CONFIG.faq.map((f, i) => `
    <div class="faq-item" id="faq-${i}">
      <button class="faq-question" onclick="toggleFAQ(${i})">
        <span>${f.question}</span>
        <span class="faq-icon">${CHEVRON_SVG}</span>
      </button>
      <div class="faq-answer" id="faq-answer-${i}">
        <div class="faq-answer-inner">${f.answer}</div>
      </div>
    </div>`).join("");

  section.querySelector(".container").insertAdjacentHTML("beforeend",
    `<div class="faq-list">${items}</div>`);
}

function toggleFAQ(index) {
  const answer = document.getElementById(`faq-answer-${index}`);
  const isOpen = answer.classList.contains("open");

  document.querySelectorAll(".faq-answer").forEach(a => a.classList.remove("open"));
  document.querySelectorAll(".faq-item").forEach(i => i.classList.remove("active"));

  if (!isOpen) {
    answer.classList.add("open");
    document.getElementById(`faq-${index}`).classList.add("active");
  }
}

/* ── Contact Form ─────────────────────────────────────────── */
function renderContactForm() {
  const section = document.getElementById("contact");
  if (!section) return;
  const cf = CONFIG.contactForm;
  const c  = CONFIG.company;

  const sizeOptions = cf.fields.companySizeOptions.map(o =>
    `<option value="${o}">${o}</option>`).join("");
  const serviceOptions = cf.fields.serviceOptions.map(o =>
    `<option value="${o}">${o}</option>`).join("");

  section.querySelector(".container").innerHTML = `
    <div class="contact-grid">
      <div class="contact-info">
        ${sectionLabel("Get In Touch")}
        <h2>${cf.heading}</h2>
        <p>${cf.subheading}</p>
        <div class="contact-details">
          <div class="contact-item">
            <div class="contact-item-icon">\u{1F4E7}</div>
            <a href="mailto:${c.email}">${c.email}</a>
          </div>
          <div class="contact-item">
            <div class="contact-item-icon">\u{1F4DE}</div>
            <a href="tel:${c.phone}">${c.phone}</a>
          </div>
          <div class="contact-item">
            <div class="contact-item-icon">\u{1F4CD}</div>
            <span>${c.location}</span>
          </div>
        </div>
      </div>
      <div class="contact-form-box" id="contact-form-wrapper">
        <form id="contact-form" ${cf.formAction ? `action="${cf.formAction}" method="POST"` : ""}>
          <div class="form-row">
            <div class="form-group">
              <label for="company">Company Name *</label>
              <input type="text" id="company" name="company" placeholder="Acme Pvt. Ltd." required>
            </div>
            <div class="form-group">
              <label for="contact-name">Contact Person *</label>
              <input type="text" id="contact-name" name="name" placeholder="Your name" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="email">Work Email *</label>
              <input type="email" id="email" name="email" placeholder="you@company.com" required>
            </div>
            <div class="form-group">
              <label for="phone">Phone Number</label>
              <input type="tel" id="phone" name="phone" placeholder="+91 98765 43210">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="company-size">Company Size</label>
              <select id="company-size" name="company_size">
                <option value="">Select size</option>
                ${sizeOptions}
              </select>
            </div>
            <div class="form-group">
              <label for="service">Service Needed</label>
              <select id="service" name="service">
                <option value="">Select service</option>
                ${serviceOptions}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="message">Tell us about your setup / concerns</label>
            <textarea id="message" name="message" placeholder="e.g. We run a fintech app on AWS and need a compliance audit before our next funding round..."></textarea>
          </div>
          <div class="trust-indicators">
            ${(cf.trustIndicators || []).map(t => `<span class="trust-indicator">\u2713 ${t}</span>`).join("")}
          </div>
          <button type="submit" class="btn btn-primary form-submit">Request Audit \u2192</button>
          <p class="form-note">\u{1F512} Your details are kept strictly confidential. No spam, ever.</p>
        </form>
        <div class="form-success" id="form-success">
          <div class="form-success-icon">\u2705</div>
          <h3>Request Received!</h3>
          <p>We'll reach out within 24 hours to schedule your security consultation.</p>
        </div>
      </div>
    </div>`;

  initForm();
}

function initForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    const cf = CONFIG.contactForm;
    if (cf.formAction) {
      e.preventDefault();
      try {
        const res = await fetch(cf.formAction, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });
        if (res.ok) showSuccess();
        else alert("Something went wrong. Please email us directly.");
      } catch {
        alert("Network error. Please email us directly.");
      }
    } else {
      e.preventDefault();
      const data = new FormData(form);
      const body = encodeURIComponent(
        `Company: ${data.get("company")}\nName: ${data.get("name")}\nPhone: ${data.get("phone")}\nSize: ${data.get("company_size")}\nService: ${data.get("service")}\n\n${data.get("message")}`
      );
      window.location.href = `mailto:${CONFIG.company.email}?subject=VAPT Enquiry \u2014 ${data.get("company")}&body=${body}`;
      showSuccess();
    }
  });
}

function showSuccess() {
  const form = document.getElementById("contact-form");
  const success = document.getElementById("form-success");
  if (form) form.style.display = "none";
  if (success) success.classList.add("visible");
}

/* ── Footer ───────────────────────────────────────────────── */
function renderFooter() {
  const footer = document.querySelector("footer");
  if (!footer) return;
  const f = CONFIG.footer;
  const c = CONFIG.company;
  const links = [
    { label: "Services", href: "services.html" },
    { label: "About",    href: "about.html" },
    { label: "Blog",     href: "blog.html" },
    { label: "Contact",  href: "contact.html" },
  ];
  const linkHtml = links.map(l => `<a href="${l.href}">${l.label}</a>`).join("");
  const year = new Date().getFullYear();

  footer.innerHTML = `
    <div class="container">
      <div class="footer-inner">
        <div class="footer-brand">
          <a class="footer-logo" href="index.html">Bal<span>hence</span></a>
          <p class="footer-tagline">${f.tagline}</p>
        </div>
        <div class="footer-links">${linkHtml}</div>
      </div>
      <div class="footer-bottom">
        <span>\u00A9 ${year} ${c.name}. All rights reserved.</span>
        <span>VAPT as a Service \u00B7 India</span>
      </div>
    </div>`;
}
