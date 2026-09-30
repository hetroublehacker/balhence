/*
 * Balhence page flow. Section tracking adapted from ThreeUI Community's Kage
 * navigation, revision 68802d5428071ada5c20db8094b1649e6bb770ed.
 * Copyright (c) 2026 Meng To. MIT notice: vendor/threeui-community-LICENSE.txt.
 * Native anchors, tables, and form controls work independently of this file.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const slow = matchMedia("(update: slow)");
  let paused = false;
  try { paused = localStorage.getItem("balhence_motion_paused") === "true"; } catch { /* Optional preference. */ }
  const syncMotion = () => root.classList.toggle("flow-still", paused || reduced.matches || slow.matches);
  syncMotion();
  reduced.addEventListener("change", syncMotion);
  slow.addEventListener("change", syncMotion);
  addEventListener("storage", event => {
    if (event.key !== "balhence_motion_paused" && event.key !== null) return;
    paused = event.newValue === "true";
    syncMotion();
  });
  addEventListener("balhence:motion-preference", event => {
    if (typeof event.detail?.paused !== "boolean") return;
    paused = event.detail.paused;
    syncMotion();
  });

  function initPageFlow() {
    const nav = document.querySelector("[data-flow-nav], .article-toc");
    if (!nav) return;
    const dock = nav.closest(".page-flow");
    const pairs = [...nav.querySelectorAll('a[href^="#"]')].map(link => ({
      link,
      section: document.getElementById(decodeURIComponent(link.hash.slice(1))),
    })).filter(pair => pair.section);
    if (!pairs.length) return;
    let frame = 0;
    let current = null;

    function update() {
      frame = 0;
      if (document.hidden) return;
      const header = document.querySelector(".site-header");
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const mobileArticle = nav.classList.contains("article-toc") && getComputedStyle(nav).display === "flex";
      const height = dock ? dock.getBoundingClientRect().height : mobileArticle ? nav.getBoundingClientRect().height + 10 : 0;
      if (dock || nav.classList.contains("article-toc")) root.style.setProperty("--flow-offset", `${Math.ceil(height)}px`);
      const boundary = headerHeight + height + 32;
      // Section positions, rather than intersection ratios, keep long sections
      // and heading targets stable during native scrolling and back navigation.
      const positions = pairs.map(pair => ({ pair, top: pair.section.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top);
      const passed = positions.filter(item => item.top <= boundary);
      const next = (passed.at(-1) || positions[0]).pair;
      if (next !== current) {
        current = next;
        pairs.forEach(pair => {
          if (pair === current) pair.link.setAttribute("aria-current", "location");
          else pair.link.removeAttribute("aria-current");
        });
      }
      // Only move the dock's own horizontal viewport; never move page focus or
      // interrupt the visitor's scroll position to expose an active section.
      const bounds = nav.getBoundingClientRect();
      const active = next.link.getBoundingClientRect();
      if (!nav.contains(document.activeElement) && (active.left < bounds.left || active.right > bounds.right)) {
        nav.scrollTo({ left: nav.scrollLeft + active.left - bounds.left - (bounds.width - active.width) / 2,
          behavior: root.classList.contains("flow-still") ? "instant" : "smooth" });
      }
    }
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener("scroll", requestUpdate, { passive: true });
    addEventListener("resize", requestUpdate, { passive: true });
    addEventListener("pageshow", requestUpdate);
    document.addEventListener("visibilitychange", requestUpdate);
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(requestUpdate);
      observer.observe(document.querySelector("main"));
      observer.observe(dock || nav);
    }
    document.fonts?.ready.then(requestUpdate);
    update();
  }

  function initTableHints() {
    document.querySelectorAll(".scope-table-wrap").forEach((region, index) => {
      const table = region.querySelector("table");
      if (!table) return;
      const hint = document.createElement("p");
      hint.id = `table-scroll-hint-${index + 1}`;
      hint.className = "table-scroll-hint";
      hint.textContent = "Scroll to see every column. Keyboard: focus the table and use the arrow keys.";
      hint.hidden = true;
      region.before(hint);
      const originalDescription = region.getAttribute("aria-describedby") || "";
      const originalTabindex = region.getAttribute("tabindex");
      const update = () => {
        const overflow = region.scrollWidth > region.clientWidth + 2;
        hint.hidden = !overflow;
        region.classList.toggle("has-table-overflow", overflow);
        if (overflow) {
          region.setAttribute("tabindex", "0");
          region.setAttribute("aria-describedby", [originalDescription, hint.id].filter(Boolean).join(" "));
          if (!region.hasAttribute("role")) region.setAttribute("role", "region");
          if (!region.hasAttribute("aria-label") && !region.hasAttribute("aria-labelledby")) {
            region.setAttribute("aria-label", table.caption?.textContent.trim() || "Comparison table");
          }
        } else {
          if (originalDescription) region.setAttribute("aria-describedby", originalDescription);
          else region.removeAttribute("aria-describedby");
          if (originalTabindex === null) region.removeAttribute("tabindex");
          else region.setAttribute("tabindex", originalTabindex);
        }
      };
      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(update);
        observer.observe(region);
        observer.observe(table);
      } else addEventListener("resize", update, { passive: true });
      document.fonts?.ready.then(update);
      update();
    });
  }

  const start = () => { initPageFlow(); initTableHints(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
