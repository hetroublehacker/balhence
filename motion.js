(function () {
  "use strict";

  /*
   * Progressive motion for Balhence. No content or interaction depends on this
   * file. See motion.css for explicit data hooks and opt-out behavior.
   */

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const slowUpdate = window.matchMedia("(update: slow)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const cleanups = [];
  let progressNode = null;
  let revealObserver = null;
  let scrollFrame = 0;
  let pointerFrame = 0;
  let lastPointer = null;
  let activeCard = null;
  let activeDepth = null;
  let hero = null;

  const onReady = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  };

  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  const isMotionAllowed = () => !reducedMotion.matches && !slowUpdate.matches;

  const isOptedOut = (element) => Boolean(element.closest('[data-motion="none"]'));

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  function addAutomaticHooks() {
    const staggerGroups = document.querySelectorAll([
      "[data-motion-stagger]",
      ".hero-grid",
      ".trigger-grid",
      ".service-grid",
      ".package-grid",
      ".coverage-grid",
      ".principle-grid",
      ".process-grid",
      ".insight-grid",
      ".proof-grid",
      ".offer-lists",
      ".transparency-box",
    ].join(","));

    staggerGroups.forEach((group) => {
      if (isOptedOut(group)) return;
      Array.from(group.children).forEach((item, index) => {
        if (!item.matches("[data-reveal], [data-motion-reveal]")) return;
        item.classList.add("motion-stagger-item");
        item.style.setProperty("--motion-delay", `${Math.min(index, 7) * 72}ms`);
      });
    });

    const manualRevealSelectors = [
      ".proof-grid > .proof-item",
      ".deliverable-list > li",
      ".offer-facts > div",
      ".contact-expectations > li",
      ".article-content > .article-callout",
      ".article-content > .article-checklist",
      ".article-content > .article-cta",
    ].join(",");

    document.querySelectorAll(manualRevealSelectors).forEach((item, index) => {
      if (isOptedOut(item) || item.hasAttribute("data-reveal")) return;
      item.setAttribute("data-motion-reveal", "");
      item.style.setProperty("--motion-delay", `${(index % 4) * 64}ms`);
    });

    const cardSelectors = [
      "[data-motion-card]",
      ".trigger-card",
      ".service-card",
      ".package-card",
      ".coverage-card",
      ".principle-card",
      ".insight-card",
      ".offer-shell",
      ".cta-panel",
      ".transparency-box",
      ".lead-form-shell",
    ].join(",");

    document.querySelectorAll(cardSelectors).forEach((card) => {
      if (!isOptedOut(card)) card.classList.add("motion-card");
    });

    document.querySelectorAll(".finding-window, .report-stack, [data-motion-depth]").forEach((item) => {
      if (!isOptedOut(item)) item.classList.add("motion-depth");
    });

  }

  function initReveals() {
    const items = document.querySelectorAll("[data-motion-reveal]");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-motion-visible"));
      return;
    }

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-motion-visible");
        revealObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -24px",
    });

    items.forEach((item) => revealObserver.observe(item));
    cleanups.push(() => revealObserver && revealObserver.disconnect());
  }

  function initScrollProgress() {
    const main = document.querySelector("main");
    if (!main) return;

    progressNode = document.createElement("div");
    progressNode.className = "motion-progress";
    progressNode.setAttribute("aria-hidden", "true");
    document.body.appendChild(progressNode);

    const update = () => {
      scrollFrame = 0;
      if (document.hidden || !progressNode) return;

      const scrollRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const progress = scrollRange > 0 ? clamp(window.scrollY / scrollRange, 0, 1) : 0;
      progressNode.hidden = scrollRange < 48;
      progressNode.style.transform = `scaleX(${progress.toFixed(4)})`;
      root.style.setProperty("--motion-hero-shift", `${Math.min(window.scrollY * 0.035, 34).toFixed(2)}px`);
    };

    const requestUpdate = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(update);
    };

    update();
    listen(window, "scroll", requestUpdate, { passive: true });
    listen(window, "resize", requestUpdate, { passive: true });
    cleanups.push(() => {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      progressNode && progressNode.remove();
      progressNode = null;
    });
  }

  function clearElementMotion(element, properties) {
    if (!element) return;
    element.classList.remove("is-motion-active");
    properties.forEach((property) => element.style.removeProperty(property));
  }

  function resetPointerEffects() {
    clearElementMotion(activeCard, ["--motion-card-x", "--motion-card-y"]);
    clearElementMotion(activeDepth, [
      "--motion-depth-x",
      "--motion-depth-y",
      "--motion-depth-shift-x",
      "--motion-depth-shift-y",
    ]);
    activeCard = null;
    activeDepth = null;
    hero && hero.classList.remove("is-motion-hovered");
    root.classList.remove("motion-pointer-active");
  }

  function updateLocalPoint(element, clientX, clientY, xProperty, yProperty) {
    const rect = element.getBoundingClientRect();
    element.style.setProperty(xProperty, `${(clientX - rect.left).toFixed(1)}px`);
    element.style.setProperty(yProperty, `${(clientY - rect.top).toFixed(1)}px`);
    return rect;
  }

  function renderPointer() {
    pointerFrame = 0;
    if (!lastPointer || document.hidden) return;

    const { clientX, clientY, target } = lastPointer;
    const elementTarget = target instanceof Element ? target : null;
    if (!elementTarget || !elementTarget.isConnected) {
      resetPointerEffects();
      return;
    }

    const nextCard = elementTarget.closest(".motion-card");
    if (nextCard !== activeCard) {
      clearElementMotion(activeCard, ["--motion-card-x", "--motion-card-y"]);
      activeCard = nextCard;
    }
    if (activeCard) {
      updateLocalPoint(activeCard, clientX, clientY, "--motion-card-x", "--motion-card-y");
      activeCard.classList.add("is-motion-active");
    }

    const nextDepth = elementTarget.closest(".motion-depth");
    if (nextDepth !== activeDepth) {
      clearElementMotion(activeDepth, [
        "--motion-depth-x",
        "--motion-depth-y",
        "--motion-depth-shift-x",
        "--motion-depth-shift-y",
      ]);
      activeDepth = nextDepth;
    }
    if (activeDepth) {
      const rect = activeDepth.getBoundingClientRect();
      const normalizedX = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      const normalizedY = clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      activeDepth.style.setProperty("--motion-depth-x", `${(-normalizedY * 1.45).toFixed(2)}deg`);
      activeDepth.style.setProperty("--motion-depth-y", `${(normalizedX * 1.75).toFixed(2)}deg`);
      activeDepth.style.setProperty("--motion-depth-shift-x", `${(normalizedX * 2).toFixed(2)}px`);
      activeDepth.style.setProperty("--motion-depth-shift-y", `${(normalizedY * 2).toFixed(2)}px`);
      activeDepth.classList.add("is-motion-active");
    }

    const overHero = hero && elementTarget.closest(".hero") === hero;
    hero && hero.classList.toggle("is-motion-hovered", Boolean(overHero));
    if (overHero) {
      updateLocalPoint(hero, clientX, clientY, "--motion-hero-x", "--motion-hero-y");
      root.classList.add("motion-pointer-active");
    } else {
      root.classList.remove("motion-pointer-active");
    }
  }

  function initPointerEffects() {
    if (!finePointer.matches) return;
    hero = document.querySelector(".hero");

    const onPointerMove = (event) => {
      if (event.pointerType === "touch") return;
      lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.target,
      };
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(renderPointer);
    };

    const onPointerLeave = () => {
      lastPointer = null;
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      resetPointerEffects();
    };

    listen(document, "pointermove", onPointerMove, { passive: true });
    listen(document.documentElement, "pointerleave", onPointerLeave, { passive: true });
    listen(window, "blur", onPointerLeave);
    cleanups.push(onPointerLeave);
  }

  function initVisibilityHandling() {
    const onVisibilityChange = () => {
      root.classList.toggle("motion-paused", document.hidden);
      if (document.hidden) {
        resetPointerEffects();
        return;
      }
      window.dispatchEvent(new Event("resize"));
    };
    onVisibilityChange();
    listen(document, "visibilitychange", onVisibilityChange);
  }

  function destroy() {
    while (cleanups.length) {
      const cleanup = cleanups.pop();
      try { cleanup(); } catch (error) { /* Motion cleanup must never block the page. */ }
    }
    if (revealObserver) revealObserver.disconnect();
    revealObserver = null;
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    scrollFrame = 0;
    pointerFrame = 0;
    resetPointerEffects();
    document.querySelectorAll(".motion-card").forEach((card) => {
      card.classList.remove("is-motion-active");
      card.style.removeProperty("--motion-card-x");
      card.style.removeProperty("--motion-card-y");
    });
    document.querySelectorAll(".motion-depth").forEach((item) => {
      item.classList.remove("is-motion-active");
      item.style.removeProperty("--motion-depth-x");
      item.style.removeProperty("--motion-depth-y");
      item.style.removeProperty("--motion-depth-shift-x");
      item.style.removeProperty("--motion-depth-shift-y");
    });
    if (hero) {
      hero.style.removeProperty("--motion-hero-x");
      hero.style.removeProperty("--motion-hero-y");
    }
    hero = null;
    root.style.removeProperty("--motion-hero-shift");
    root.classList.remove("motion-capable", "motion-paused", "motion-pointer-active");
  }

  function start() {
    destroy();
    addAutomaticHooks();
    if (!isMotionAllowed()) {
      root.classList.add("motion-reduced");
      document.querySelectorAll("[data-motion-reveal]").forEach((item) => {
        item.classList.add("is-motion-visible");
      });
      return;
    }

    root.classList.remove("motion-reduced");
    root.classList.add("motion-capable");
    initReveals();
    initScrollProgress();
    initPointerEffects();
    initVisibilityHandling();
  }

  onReady(() => {
    start();
    const restart = () => start();
    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", restart);
      slowUpdate.addEventListener("change", restart);
    } else {
      reducedMotion.addListener(restart);
      slowUpdate.addListener(restart);
    }
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) destroy();
    });
  });
})();
