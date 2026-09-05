(function () {
  "use strict";

  const config = window.BALHENCE_CONFIG || {};
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let analyticsEnabled = false;

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

    const mobileQuery = window.matchMedia("(max-width: 860px)");
    const isMobile = () => mobileQuery.matches;
    const backgroundState = new Map();

    const setOpen = (open, restoreFocus) => {
      const mobileOpen = Boolean(open && isMobile());
      menu.classList.toggle("is-open", mobileOpen);
      toggle.classList.toggle("is-open", mobileOpen);
      toggle.setAttribute("aria-expanded", String(mobileOpen));
      toggle.setAttribute("aria-label", mobileOpen ? "Close menu" : "Open menu");
      menu.inert = isMobile() && !mobileOpen;
      document.body.classList.toggle("menu-open", mobileOpen);
      if (mobileOpen) {
        document.querySelectorAll("main, .site-footer, .consent-banner").forEach((node) => {
          if (!backgroundState.has(node)) backgroundState.set(node, node.inert);
          node.inert = true;
        });
        const firstLink = menu.querySelector("a");
        window.requestAnimationFrame(() => {
          if (firstLink && toggle.getAttribute("aria-expanded") === "true") firstLink.focus();
        });
      } else {
        backgroundState.forEach((inert, node) => { node.inert = inert; });
        backgroundState.clear();
        if (restoreFocus) toggle.focus();
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false, true);
      } else if (event.key === "Tab") {
        const controls = [...menu.querySelectorAll("a[href], button:not([disabled])"), toggle];
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !controls.includes(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !controls.includes(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    mobileQuery.addEventListener("change", () => setOpen(false));

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

  function showSendFailure(status, timedOut) {
    if (!status) return;
    const email = supportEmail();
    const link = document.createElement("a");
    link.href = `mailto:${email}`;
    link.textContent = email;
    const message = timedOut
      ? "Delivery could not be confirmed in time. Your details are still here. Retry, or email "
      : "The form could not send. Your details are still here. Retry, or email ";
    status.replaceChildren(document.createTextNode(message), link, document.createTextNode("."));
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
      let submitting = false;

      form.addEventListener("submit", async (event) => {
        const endpoint = form.getAttribute("action");
        if (!endpoint || !window.fetch) return;

        event.preventDefault();
        if (submitting) return;
        submitting = true;
        form.setAttribute("aria-busy", "true");
        const button = form.querySelector("button[type='submit']");
        const status = form.parentElement.querySelector("[data-form-status]");
        const defaultContents = button
          ? Array.from(button.childNodes, (node) => node.cloneNode(true))
          : [];

        if (button) {
          button.disabled = true;
          button.textContent = "Sending...";
        }
        if (status) {
          status.className = "form-status";
          status.textContent = "Sending your request...";
        }

        const controller = new AbortController();
        let timedOut = false;
        const timeout = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 20000);
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new FormData(form),
            signal: controller.signal,
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
          showSendFailure(status, timedOut);
        } finally {
          window.clearTimeout(timeout);
          submitting = false;
          form.removeAttribute("aria-busy");
          if (button) {
            button.disabled = false;
            button.replaceChildren(...defaultContents.map((node) => node.cloneNode(true)));
          }
        }
      });
    });
  }

  function initAnalyticsConsent() {
    const gaId = config.analytics && config.analytics.googleAnalyticsId;
    if (!gaId) return;
    const eligible = document.body.dataset.analytics !== "off";
    const storageKey = "balhence_analytics_consent";
    let choice = null;
    try {
      choice = localStorage.getItem(storageKey);
    } catch (error) {
      /* Consent can still be honored for this page when storage is unavailable. */
    }
    if (choice !== "accepted" && choice !== "declined") choice = null;

    const footer = document.querySelector(".footer-bottom");
    if (footer) {
      const preferences = document.createElement("button");
      preferences.type = "button";
      preferences.className = "analytics-preferences";
      preferences.dataset.analyticsPreferences = "";
      preferences.textContent = "Analytics preferences";
      footer.appendChild(preferences);
    }

    let banner = null;
    let opener = null;
    const closeBanner = () => {
      if (banner) banner.remove();
      banner = null;
      if (opener && opener.isConnected) opener.focus();
      opener = null;
    };
    const applyChoice = () => {
      if (choice === "accepted" && eligible) loadAnalytics(gaId);
      else disableAnalytics(gaId, choice !== "accepted");
    };
    const choose = (value) => {
      choice = value;
      try { localStorage.setItem(storageKey, value); } catch (error) { /* Honor the choice for this page. */ }
      applyChoice();
      closeBanner();
    };

    const showBanner = (source) => {
      if (banner) {
        banner.querySelector("button").focus();
        return;
      }
      opener = source || null;
      banner = document.createElement("aside");
      banner.className = "consent-banner";
      banner.setAttribute("aria-label", "Analytics preferences");

      const message = document.createElement("p");
      const current = choice === "accepted" ? "Currently accepted. " : choice === "declined" ? "Currently declined. " : "";
      message.append(document.createTextNode(`${current}Optional analytics helps us improve the site. Accept or decline at any time. `));
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
      if (source) {
        const close = document.createElement("button");
        close.className = "btn btn-small btn-quiet";
        close.type = "button";
        close.textContent = "Close";
        close.addEventListener("click", closeBanner);
        actions.appendChild(close);
      }
      banner.append(message, actions);
      document.body.appendChild(banner);
      accept.addEventListener("click", () => choose("accepted"));
      decline.addEventListener("click", () => choose("declined"));
      if (source) accept.focus();
    };

    document.querySelectorAll("[data-analytics-preferences]").forEach((control) => {
      control.addEventListener("click", () => showBanner(control));
    });
    window.addEventListener("storage", (event) => {
      if (event.key !== storageKey && event.key !== null) return;
      choice = event.newValue === "accepted" || event.newValue === "declined" ? event.newValue : null;
      applyChoice();
      closeBanner();
      if (!choice && eligible) showBanner();
    });
    applyChoice();
    if (!choice && eligible) showBanner();
  }

  function disableAnalytics(gaId, clearCookies) {
    analyticsEnabled = false;
    window[`ga-disable-${gaId}`] = true;
    document.querySelectorAll("script[data-balhence-analytics]").forEach((script) => script.remove());
    if (!clearCookies) return;
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (!/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name)) return;
      const expired = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = expired;
      const labels = window.location.hostname.split(".");
      while (labels.length > 1) {
        document.cookie = `${expired}; domain=${labels.join(".")}`;
        labels.shift();
      }
    });
  }

  function loadAnalytics(gaId) {
    analyticsEnabled = true;
    window[`ga-disable-${gaId}`] = false;
    if (document.querySelector("script[data-balhence-analytics]")) return;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) window.gtag = function () { if (analyticsEnabled) window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", gaId, { anonymize_ip: true });

    const script = document.createElement("script");
    script.dataset.balhenceAnalytics = "";
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
