(function () {
  "use strict";

  const config = window.BALHENCE_CONFIG || {};
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("js");

  document.addEventListener("DOMContentLoaded", () => {
    setCurrentYear();
    setActiveNavigation();
    initNavigation();
    initHeader();
    initReveals();
    initLeadForms();
    initQueryPrefill();
    initAnalyticsConsent();
    initTrackedLinks();
  });

  function setCurrentYear() {
    document.querySelectorAll("[data-current-year]").forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });
  }

  function setActiveNavigation() {
    const page = document.body.dataset.page;
    if (!page) return;
    document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => {
      link.setAttribute("aria-current", "page");
    });
  }

  function initNavigation() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const menu = document.querySelector("[data-menu]");
    if (!toggle || !menu) return;

    const isMobile = () => window.innerWidth <= 860;

    const setOpen = (open, restoreFocus) => {
      const mobileOpen = Boolean(open && isMobile());
      menu.classList.toggle("is-open", mobileOpen);
      toggle.classList.toggle("is-open", mobileOpen);
      toggle.setAttribute("aria-expanded", String(mobileOpen));
      toggle.setAttribute("aria-label", mobileOpen ? "Close menu" : "Open menu");
      menu.inert = isMobile() && !mobileOpen;
      document.body.classList.toggle("menu-open", mobileOpen);
      if (mobileOpen) {
        const firstLink = menu.querySelector("a");
        if (firstLink) firstLink.focus();
      } else if (restoreFocus) {
        toggle.focus();
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false, true);
      }
    });

    window.addEventListener("resize", () => {
      setOpen(false);
    }, { passive: true });

    setOpen(false);
  }

  function initHeader() {
    const header = document.querySelector("[data-site-header]");
    if (!header) return;
    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function initReveals() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    const revealAll = () => items.forEach((item) => item.classList.add("is-visible"));

    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    try {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -32px" });

      document.documentElement.classList.add("reveal-ready");
      items.forEach((item) => observer.observe(item));
    } catch (error) {
      document.documentElement.classList.remove("reveal-ready");
      revealAll();
    }
  }

  function initQueryPrefill() {
    const service = new URLSearchParams(window.location.search).get("service");
    const select = document.querySelector("select[name='service']");
    if (!service || !select) return;
    const matchingOption = Array.from(select.options).find((option) => option.value === service);
    if (matchingOption) select.value = service;
  }

  function addAttribution(form) {
    const params = new URLSearchParams(window.location.search);
    const values = {
      source_page: boundedText(window.location.pathname, 512),
      referrer: boundedText(safeReferrer(), 512),
      utm_source: boundedText(params.get("utm_source") || "", 200),
      utm_medium: boundedText(params.get("utm_medium") || "", 200),
      utm_campaign: boundedText(params.get("utm_campaign") || "", 200),
    };

    Object.entries(values).forEach(([name, value]) => {
      let input = form.querySelector(`input[name="${name}"]`);
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        form.appendChild(input);
      }
      input.value = value;
    });
  }

  function boundedText(value, limit) {
    return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit);
  }

  function safeReferrer() {
    if (!document.referrer) return "direct";
    try {
      const referrer = new URL(document.referrer);
      return referrer.origin === window.location.origin
        ? referrer.pathname
        : referrer.origin;
    } catch (error) {
      return "direct";
    }
  }

  function supportEmail() {
    const configured = config.company && config.company.email;
    return typeof configured === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)
      ? configured
      : "contact@balhence.com";
  }

  function showSendFailure(status) {
    if (!status) return;
    const email = supportEmail();
    const link = document.createElement("a");
    link.href = `mailto:${email}`;
    link.textContent = email;
    status.replaceChildren(document.createTextNode("The form could not send. Please email "), link, document.createTextNode("."));
    status.classList.add("is-error");
    status.focus();
  }

  function initLeadForms() {
    document.querySelectorAll("form[data-lead-form]").forEach((form) => {
      addAttribution(form);
      const configuredEndpoint = config.forms && config.forms.endpoint;
      if (!form.getAttribute("action") && configuredEndpoint) {
        form.setAttribute("action", configuredEndpoint);
      }

      form.addEventListener("submit", async (event) => {
        const endpoint = form.getAttribute("action");
        if (!endpoint || !window.fetch) return;

        event.preventDefault();
        const button = form.querySelector("button[type='submit']");
        const status = form.parentElement.querySelector("[data-form-status]");
        const defaultContents = button
          ? Array.from(button.childNodes, (node) => node.cloneNode(true))
          : [];

        if (button) {
          button.disabled = true;
          button.textContent = "Sending…";
        }
        if (status) {
          status.className = "form-status";
          status.textContent = "";
        }

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new FormData(form),
          });

          if (!response.ok) throw new Error("Submission failed");
          form.reset();
          if (status) {
            status.classList.add("is-success");
            status.textContent = "Thank you. Your request is in. Expect a reply within one business day.";
            status.focus();
          }
          trackEvent("generate_lead", { form_name: form.dataset.leadForm });
          document.dispatchEvent(new CustomEvent("balhence:form-success", {
            detail: { formName: form.dataset.leadForm || "" },
          }));
        } catch (error) {
          showSendFailure(status);
        } finally {
          if (button) {
            button.disabled = false;
            button.replaceChildren(...defaultContents.map((node) => node.cloneNode(true)));
          }
        }
      });
    });
  }

  function initAnalyticsConsent() {
    if (document.body.dataset.analytics === "off") return;
    const gaId = config.analytics && config.analytics.googleAnalyticsId;
    if (!gaId) return;

    let choice = null;
    try {
      choice = localStorage.getItem("balhence_analytics_consent");
    } catch (error) {
      /* Consent can still be honored for this page when storage is unavailable. */
    }
    if (choice === "accepted") {
      loadAnalytics(gaId);
      return;
    }
    if (choice === "declined") return;

    const banner = document.createElement("aside");
    banner.className = "consent-banner";
    banner.setAttribute("aria-label", "Analytics choice");

    const message = document.createElement("p");
    message.append(
      document.createTextNode("We use optional analytics to learn which pages help buyers. No analytics loads unless you accept. "),
    );
    const privacyLink = document.createElement("a");
    privacyLink.href = "/privacy.html";
    privacyLink.textContent = "Privacy details";
    message.append(privacyLink, document.createTextNode("."));

    const actions = document.createElement("div");
    actions.className = "consent-actions";
    const accept = document.createElement("button");
    accept.className = "btn btn-small btn-primary";
    accept.type = "button";
    accept.dataset.consentAccept = "";
    accept.textContent = "Accept";
    const decline = document.createElement("button");
    decline.className = "btn btn-small btn-quiet";
    decline.type = "button";
    decline.dataset.consentDecline = "";
    decline.textContent = "Decline";
    actions.append(accept, decline);
    banner.append(message, actions);
    document.body.appendChild(banner);

    accept.addEventListener("click", () => {
      try { localStorage.setItem("balhence_analytics_consent", "accepted"); } catch (error) { /* Continue without persistence. */ }
      loadAnalytics(gaId);
      banner.remove();
    });
    decline.addEventListener("click", () => {
      try { localStorage.setItem("balhence_analytics_consent", "declined"); } catch (error) { /* Continue without persistence. */ }
      banner.remove();
    });
  }

  function loadAnalytics(gaId) {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", gaId, { anonymize_ip: true });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);
  }

  function initTrackedLinks() {
    document.querySelectorAll("[data-track]").forEach((element) => {
      element.addEventListener("click", () => {
        trackEvent("select_content", {
          content_type: "cta",
          content_id: element.dataset.track,
        });
      });
    });
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }
})();
