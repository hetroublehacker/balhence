/* ============================================================
   BALHENCE — app.js
   Reads CONFIG from config.js and renders based on current page.
   Each page uses data-page attribute on <body> to determine
   which sections to render.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  applyCompanyMeta();
  renderNav();
  renderFooter();

  const page = document.body.dataset.page;

  switch (page) {
    case "home":
      renderHero();
      renderStats();
      renderServicesPreview();
      renderWhyUs();
      renderHomeContactCTA();
      break;
    case "services":
      renderPageHeader("Services", "VAPT Services", "End-to-end security testing across your entire attack surface — from web apps to cloud infrastructure.");
      renderServices();
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
      renderPageHeader("Blog", "Security Insights", "Practical cybersecurity content for Indian businesses — no fluff, just signal.");
      renderBlog();
      break;
    case "contact":
      renderContactForm();
      break;
  }
});

/* ── Helpers ──────────────────────────────────────────────── */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function mount(id, node) {
  const t = document.getElementById(id);
  if (t) t.appendChild(node);
}

function sectionLabel(text) {
  return `<span class="section-label">${text}</span>`;
}

function getCurrentPage() {
  return document.body.dataset.page;
}

/* ── Meta / Title ─────────────────────────────────────────── */
function applyCompanyMeta() {
  const page = getCurrentPage();
  const titles = {
    home:     `${CONFIG.company.name} — VAPT as a Service`,
    services: `Services — ${CONFIG.company.name}`,
    about:    `About — ${CONFIG.company.name}`,
    blog:     `Blog — ${CONFIG.company.name}`,
    contact:  `Contact — ${CONFIG.company.name}`,
  };
  document.title = titles[page] || CONFIG.company.name;
}

/* ── Nav ──────────────────────────────────────────────────── */
function renderNav() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  const page = getCurrentPage();
  const links = [
    { label: "Services",  href: "services.html" },
    { label: "About",     href: "about.html" },
    { label: "Blog",      href: "blog.html" },
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
      <button class="hamburger" id="hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
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

/* ── Page Header (inner pages) ────────────────────────────── */
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
    <div class="hero-glow"></div>
    <div class="container">
      <div class="hero-badge">
        <span class="dot"></span> Now accepting new clients — limited spots this month
      </div>
      <h1 class="hero-heading">
        ${h.heading}<span class="hero-heading-accent">${h.subheading}</span>
      </h1>
      <p class="hero-description">${h.description}</p>
      <div class="hero-actions">
        <a href="contact.html" class="btn btn-primary">${h.ctaText} →</a>
        <a href="services.html" class="btn btn-outline">${h.ctaSecondaryText}</a>
      </div>
      <div class="hero-trust">
        <span class="hero-trust-text">Trusted certifications:</span>
        <div class="trust-badges">
          <span class="trust-badge">CEH</span>
          <span class="trust-badge">OSCP</span>
          <span class="trust-badge">CRTP</span>
          <span class="trust-badge">ISO 27001 Aligned</span>
          <span class="trust-badge">DPDP Act Ready</span>
        </div>
      </div>
    </div>`;
}

/* ── Stats ────────────────────────────────────────────────── */
function renderStats() {
  const section = document.getElementById("stats");
  if (!section) return;
  const grid = el("div", "stats-grid");
  CONFIG.stats.forEach(s => {
    grid.appendChild(el("div", "stat-card", `
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-source">${s.source}</div>
    `));
  });
  section.querySelector(".container").appendChild(grid);
}

/* ── Services (full) ──────────────────────────────────────── */
function renderServices() {
  const section = document.getElementById("services");
  if (!section) return;
  const grid = el("div", "services-grid");
  CONFIG.services.forEach(s => {
    grid.appendChild(el("div", "service-card", `
      <div class="service-icon">${s.icon}</div>
      <div class="service-title">${s.title}</div>
      <div class="service-desc">${s.description}</div>
    `));
  });
  section.querySelector(".container").appendChild(grid);
}

/* ── Services Preview (home — 3 cards + link) ─────────────── */
function renderServicesPreview() {
  const section = document.getElementById("services-preview");
  if (!section) return;
  const preview = CONFIG.services.slice(0, 3);
  const grid = el("div", "services-grid");
  preview.forEach(s => {
    grid.appendChild(el("div", "service-card", `
      <div class="service-icon">${s.icon}</div>
      <div class="service-title">${s.title}</div>
      <div class="service-desc">${s.description}</div>
    `));
  });
  const container = section.querySelector(".container");
  container.appendChild(grid);
  container.insertAdjacentHTML("beforeend",
    `<div class="preview-more">
       <a href="services.html" class="btn btn-outline">View All Services →</a>
     </div>`
  );
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

  section.querySelector(".container").innerHTML = `
    <div class="about-grid">
      <div class="about-text">
        ${sectionLabel("Our Story")}
        <h2 class="section-heading">${a.heading}</h2>
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
      <div class="why-icon">${w.icon}</div>
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
      <div class="achievement-icon">🏆</div>
      <div>
        <div class="achievement-title">${a.title}</div>
        <div class="achievement-meta">${a.issuer} · ${a.year}</div>
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
    const avatarContent = m.photo
      ? `<img src="${m.photo}" alt="${m.name}">`
      : m.avatar;
    grid.appendChild(el("div", "team-card", `
      <div class="team-avatar">${avatarContent}</div>
      <div class="team-name">${m.name}</div>
      <div class="team-role">${m.role}</div>
      ${m.certifications ? `<div class="team-certs">${m.certifications}</div>` : ""}
      <div class="team-bio">${m.bio}</div>
      ${m.linkedIn ? `<a class="team-linkedin" href="${m.linkedIn}" target="_blank">LinkedIn →</a>` : ""}
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
        <div class="cs-icon">✍️</div>
        <h3>Insights Coming Soon</h3>
        <p>We're working on practical cybersecurity articles tailored for Indian businesses. Check back soon.</p>
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
        <a class="blog-read-more" href="${b.link}">Read →</a>
      </div>
    `));
  });
  container.appendChild(grid);
}

/* ── Home Contact CTA banner ──────────────────────────────── */
function renderHomeContactCTA() {
  const section = document.getElementById("home-cta");
  if (!section) return;
  section.innerHTML = `
    <div class="container">
      <div class="cta-banner">
        <div class="cta-banner-text">
          <h2>Ready to find out what attackers can see?</h2>
          <p>Get a free initial security consultation — no strings attached.</p>
        </div>
        <a href="contact.html" class="btn btn-primary">Request Free Audit →</a>
      </div>
    </div>`;
}

/* ── Page CTA (inner pages bottom) ───────────────────────── */
function renderPageCTA() {
  const section = document.getElementById("page-cta");
  if (!section) return;
  section.innerHTML = `
    <div class="container">
      <div class="cta-banner">
        <div class="cta-banner-text">
          <h2>Ready to secure your business?</h2>
          <p>Request a free audit and we'll get back within 24 hours.</p>
        </div>
        <a href="contact.html" class="btn btn-primary">Get Free Audit →</a>
      </div>
    </div>`;
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
            <div class="contact-item-icon">📧</div>
            <a href="mailto:${c.email}">${c.email}</a>
          </div>
          <div class="contact-item">
            <div class="contact-item-icon">📞</div>
            <a href="tel:${c.phone}">${c.phone}</a>
          </div>
          <div class="contact-item">
            <div class="contact-item-icon">📍</div>
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
          <button type="submit" class="btn btn-primary form-submit">Request Free Audit →</button>
          <p class="form-note">🔒 Your details are kept strictly confidential. No spam, ever.</p>
        </form>
        <div class="form-success" id="form-success">
          <div class="form-success-icon">✅</div>
          <h3>Request Received!</h3>
          <p>We'll reach out within 24 hours to schedule your free security consultation.</p>
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
      window.location.href = `mailto:${CONFIG.company.email}?subject=VAPT Enquiry — ${data.get("company")}&body=${body}`;
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
    { label: "Services",  href: "services.html" },
    { label: "About",     href: "about.html" },
    { label: "Blog",      href: "blog.html" },
    { label: "Contact",   href: "contact.html" },
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
        <span>© ${year} ${c.name}. All rights reserved.</span>
        <span>VAPT as a Service · India</span>
      </div>
    </div>`;
}
