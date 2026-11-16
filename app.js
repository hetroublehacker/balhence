(function () {
  "use strict";

  const config = window.BALHENCE_CONFIG || {};
  let analyticsEnabled = false;
  // Fixed editorial labels, not arbitrary query text or visitor identifiers.
  const enquirySources = new Set([
    "home-nav", "home-hero", "home-faq", "home-closing", "pricing",
    "web-pentest", "api-pentest", "saas-pentest", "india-pentest", "services",
    "cloud-pentest", "network-pentest",
    "pentest-guides", "field-notes", "scope-planner", "sample-report",
    "draft-write-authorization", "session-authority-boundary",
    "private-response-cache-boundary", "server-owned-validation-rules",
    "evidence-gated-workflows", "how-to-scope-web-api-pentest",
    "what-good-pentest-report-includes", "saas-vapt-readiness-checklist",
    "web-api-pentest-cost-scope-guide", "ai-native-penetration-testing-human-validated",
    "soc2-pentest", "pci-pentest", "hipaa-pentest", "compliance-pentest",
    "ai-pentest", "ptaas-pentest", "usa-pentest",
    "does-soc-2-require-penetration-testing", "how-to-plan-llm-security-testing",
    "pci-segmentation-guide", "ptaas-vs-annual-penetration-test",
    "about-hero", "about-bottom", "attack-path-pilot", "trust-standards",
    "async-export-authorization", "server-side-url-import",
    "ai-agent-mcp-root-rce", "mixed-batch-authorization", "research-archive",
  ]);

  document.documentElement.classList.add("js");

  document.addEventListener("DOMContentLoaded", () => {
    setCurrentYear();
    setActiveNavigation();
    initSolutionsNavigation();
    initNavigation();
    initHeader();
    initReveals();
    initLeadForms();
    initQueryPrefill();
    initAnalyticsConsent();
    initArticleSharing();
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

  function initSolutionsNavigation() {
    const menus = [...document.querySelectorAll("[data-solutions-menu]")];
    document.addEventListener("click", (event) => {
      menus.forEach((menu) => {
        if (!menu.contains(event.target) || event.target.closest("a")) menu.open = false;
      });
    });
    document.addEventListener("focusin", (event) => {
      menus.forEach((menu) => {
        if (!menu.contains(event.target)) menu.open = false;
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const open = menus.find((menu) => menu.open);
      if (!open) return;
      event.preventDefault();
      open.open = false;
      open.querySelector("summary").focus();
    });
  }

  function initNavigation() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const menu = document.querySelector("[data-menu]");
    if (!toggle || !menu) return;

    const mobileQuery = window.matchMedia("(max-width: 960px)");
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
        menu.querySelectorAll("[data-solutions-menu]").forEach((details) => { details.open = false; });
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
      if (event.defaultPrevented) return;
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false, true);
      } else if (event.key === "Tab") {
        const controls = [...menu.querySelectorAll("a[href], summary, button:not([disabled])"), toggle]
          .filter((node) => node.getClientRects().length > 0);
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

    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const slowUpdate = window.matchMedia("(update: slow)");
    const pending = new Set([...items].filter((item) => !item.classList.contains("is-visible")));
    let observer = null;

    const revealAll = () => {
      if (observer) observer.disconnect();
      observer = null;
      pending.clear();
      root.classList.remove("reveal-ready");
      items.forEach((item) => item.classList.add("is-visible"));
    };

    const reveal = (item) => {
      item.classList.add("is-visible");
      pending.delete(item);
      if (!observer) return;
      observer.unobserve(item);
      if (!pending.size) {
        observer.disconnect();
        observer = null;
      }
    };

    const revealFocusedAncestors = (target) => {
      if (!(target instanceof Element)) return;
      let item = target.closest("[data-reveal]");
      while (item) {
        reveal(item);
        item = item.parentElement && item.parentElement.closest("[data-reveal]");
      }
    };

    const motionIsLimited = () => reducedMotion.matches || slowUpdate.matches;

    if (!pending.size || motionIsLimited() || !("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
        });
      }, { threshold: 0, rootMargin: "0px 0px 48px 0px" });

      root.classList.add("reveal-ready");
      pending.forEach((item) => observer.observe(item));
      revealFocusedAncestors(document.activeElement);
      document.addEventListener("focusin", (event) => revealFocusedAncestors(event.target));

      const onMotionChange = () => {
        if (motionIsLimited()) revealAll();
      };
      [reducedMotion, slowUpdate].forEach((query) => {
        if (typeof query.addEventListener === "function") {
          query.addEventListener("change", onMotionChange);
        } else if (typeof query.addListener === "function") {
          query.addListener(onMotionChange);
        }
      });
    } catch (error) {
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
    const source = params.get("source");
    const values = {
      source_page: boundedText(window.location.pathname, 512),
      enquiry_source: enquirySources.has(source) ? source
        : params.get("utm_source") === "scope-builder" ? "scope-planner" : "unlabelled",
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
            status.textContent = "Thank you. Your request has been sent. We'll get back to you by email to talk through the project.";
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

  function initArticleSharing() {
    const articleMeta = document.querySelector('meta[property="og:type"][content="article"]');
    const articleContent = document.querySelector(".article-content");
    if (!articleMeta || !articleContent || articleContent.querySelector("[data-article-share]")) return;

    const canonical = document.querySelector('link[rel="canonical"]');
    let articleUrl;
    try {
      articleUrl = new URL(canonical ? canonical.href : window.location.href);
    } catch (error) {
      return;
    }
    if (!/^https?:$/.test(articleUrl.protocol)) return;

    const title = document.querySelector('meta[property="og:title"]')?.content.trim()
      || document.querySelector("h1")?.textContent.trim()
      || document.title;
    const description = document.querySelector('meta[property="og:description"]')?.content.trim() || "";
    const canonicalUrl = articleUrl.href;
    const encodedUrl = encodeURIComponent(canonicalUrl);
    const encodedTitle = encodeURIComponent(title);
    const shareText = description ? `${title} - ${description}` : title;
    const networks = [
      ["linkedin", "LinkedIn", "in", `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`],
      ["x", "X", "X", `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`],
      ["facebook", "Facebook", "f", `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`],
      ["whatsapp", "WhatsApp", "WA", `https://wa.me/?text=${encodeURIComponent(`${title} ${canonicalUrl}`)}`],
      ["bluesky", "Bluesky", "BS", `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${canonicalUrl}`)}`],
    ];

    const section = document.createElement("section");
    section.className = "article-share";
    section.dataset.articleShare = "";
    section.setAttribute("aria-labelledby", "article-share-title");

    const intro = document.createElement("div");
    intro.className = "article-share-intro";
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Worth passing on?";
    const heading = document.createElement("h2");
    heading.id = "article-share-title";
    heading.textContent = "Share this article";
    const copy = document.createElement("p");
    copy.textContent = "Send the canonical link with its title, summary, and preview image.";
    intro.append(eyebrow, heading, copy);

    const menu = document.createElement("details");
    menu.className = "article-share-menu";
    const trigger = document.createElement("summary");
    trigger.className = "btn btn-primary article-share-trigger";
    const triggerLabel = document.createElement("span");
    triggerLabel.textContent = "Share article";
    const triggerMark = document.createElement("span");
    triggerMark.className = "article-share-trigger-mark";
    triggerMark.setAttribute("aria-hidden", "true");
    triggerMark.textContent = "+";
    trigger.append(triggerLabel, triggerMark);

    const panel = document.createElement("div");
    panel.className = "article-share-panel";
    const options = document.createElement("div");
    options.className = "article-share-options";
    options.setAttribute("role", "list");

    networks.forEach(([key, name, mark, href]) => {
      const link = document.createElement("a");
      link.className = "article-share-option";
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";
      link.dataset.network = key;
      link.dataset.track = `share_${key}`;
      link.setAttribute("role", "listitem");
      link.setAttribute("aria-label", `Share on ${name}`);
      const badge = document.createElement("span");
      badge.className = "article-share-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = mark;
      const label = document.createElement("span");
      label.textContent = name;
      link.append(badge, label);
      options.appendChild(link);
    });

    if (typeof navigator.share === "function") {
      const nativeShare = document.createElement("button");
      nativeShare.className = "article-share-option";
      nativeShare.type = "button";
      nativeShare.setAttribute("role", "listitem");
      nativeShare.setAttribute("aria-label", "Share with another app");
      const badge = document.createElement("span");
      badge.className = "article-share-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = "...";
      const label = document.createElement("span");
      label.textContent = "More apps";
      nativeShare.append(badge, label);
      nativeShare.addEventListener("click", async () => {
        try {
          await navigator.share({ title, text: shareText, url: canonicalUrl });
          trackEvent("share", { method: "native", content_type: "article" });
        } catch (error) {
          if (error && error.name !== "AbortError") setShareStatus("Sharing is unavailable here. Choose a network instead.");
        }
      });
      options.appendChild(nativeShare);
    }

    const copyButton = document.createElement("button");
    copyButton.className = "article-share-option";
    copyButton.type = "button";
    copyButton.setAttribute("role", "listitem");
    copyButton.setAttribute("aria-label", "Copy article link");
    const copyBadge = document.createElement("span");
    copyBadge.className = "article-share-badge";
    copyBadge.setAttribute("aria-hidden", "true");
    copyBadge.textContent = "<>";
    const copyLabel = document.createElement("span");
    copyLabel.textContent = "Copy link";
    copyButton.append(copyBadge, copyLabel);
    options.appendChild(copyButton);

    const status = document.createElement("p");
    status.className = "article-share-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    let statusTimer = null;
    const setShareStatus = (message) => {
      window.clearTimeout(statusTimer);
      status.textContent = message;
      statusTimer = window.setTimeout(() => { status.textContent = ""; }, 5000);
    };
    const fallbackCopy = () => {
      const field = document.createElement("textarea");
      field.value = canonicalUrl;
      field.readOnly = true;
      field.className = "article-share-copy-field";
      document.body.appendChild(field);
      field.select();
      field.setSelectionRange(0, field.value.length);
      let copied = false;
      try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
      field.remove();
      return copied;
    };
    copyButton.addEventListener("click", async () => {
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(canonicalUrl);
          copied = true;
        } catch (error) {
          copied = false;
        }
      }
      if (!copied) copied = fallbackCopy();
      if (copied) {
        copyLabel.textContent = "Copied";
        setShareStatus("Article link copied.");
        trackEvent("share", { method: "copy", content_type: "article" });
        window.setTimeout(() => { copyLabel.textContent = "Copy link"; }, 3000);
      } else {
        setShareStatus("Copy is unavailable. Use your browser address bar instead.");
      }
    });

    panel.append(options, status);
    menu.append(trigger, panel);
    section.append(intro, menu);

    const insertionPoint = Array.from(articleContent.children).find((child) => (
      child.classList.contains("research-author-note")
      || child.classList.contains("article-cta")
      || child.classList.contains("research-topic-line")
    ));
    articleContent.insertBefore(section, insertionPoint || null);
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
    const referrer = safeReferrer();
    window.gtag("config", gaId, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: window.location.origin + window.location.pathname,
      page_referrer: referrer === "direct" ? ""
        : referrer.startsWith("/") ? window.location.origin + referrer : referrer,
    });

    const script = document.createElement("script");
    script.dataset.balhenceAnalytics = "";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);
  }

  function initTrackedLinks() {
    document.querySelectorAll("[data-track]").forEach((element) => {
      element.addEventListener("click", () => {
        const destination = element.href ? new URL(element.href, window.location.href) : null;
        const requestsContact = destination && destination.origin === window.location.origin
          && destination.pathname === "/contact.html";
        trackEvent(requestsContact ? "contact_intent" : "select_content", {
          content_type: "cta",
          content_id: element.dataset.track,
        });
      });
    });
  }

  function trackEvent(name, params) {
    if (analyticsEnabled && document.body.dataset.analytics !== "off" && typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }
})();
