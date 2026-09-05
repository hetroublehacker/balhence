(() => {
  "use strict";
  const root = document.documentElement;
  const demo = document.querySelector("[data-signal-demo]");
  if (!demo) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const slow = matchMedia("(update: slow)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const toggle = document.querySelector("[data-motion-toggle]");
  const steps = [...document.querySelectorAll("[data-signal-step]")];
  const finding = document.getElementById("signal-finding");
  const status = document.querySelector("[data-signal-status]");
  const methodSteps = [...document.querySelectorAll("[data-method-step]")];
  const animations = new Set();
  const scenes = [
    { badge: "01 / DISCOVER", code: "AUTHZ-01", title: "An invoice the user should not see.", description: "In this example, a test account can read another tenant's invoice. We check why the app allowed it.", request: "GET /api/invoices/inv_test_b", response: "200 OK" },
    { badge: "02 / PROVE", code: "CONTROLLED VALIDATION", title: "We confirm the issue.", description: "We use two test accounts to confirm who can access the invoice, then record the request and response.", request: "User A -> controlled tenant B", response: "Access confirmed" },
    { badge: "03 / RESOLVE", code: "RE-TEST OF THE FIX", title: "We check the fix works.", description: "After the ownership check is added, we repeat the test. The wrong tenant is blocked, and the right user can still access their invoice.", request: "GET /api/invoices/inv_test_b", response: "403 Forbidden" },
  ];
  let paused = false;
  try { paused = localStorage.getItem("balhence_motion_paused") === "true"; } catch { /* Motion works without storage. */ }
  let current = 0;
  let visible = true;
  let timer = 0;
  let scrollFrame = 0;
  let pointerFrame = 0;
  let activeCard = null;
  let pointer = null;
  let userSelected = false;
  const canMove = () => !paused && !reduced.matches && !slow.matches;
  const progress = document.createElement("div");
  progress.className = "home-scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.append(progress);

  function animate(node, frames, options) {
    if (!canMove() || !node.animate) return;
    const animation = node.animate(frames, options);
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  }
  function activate(index, manual = false) {
    current = index;
    const scene = scenes[index];
    steps.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    Object.entries(scene).forEach(([key, value]) => {
      document.querySelector(`[data-signal-${key}]`).textContent = value;
    });
    demo.dataset.scene = String(index);
    animate(finding, [{ opacity: .25, transform: "translateY(7px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 400, easing: "cubic-bezier(.22,1,.36,1)" });
    if (manual) {
      userSelected = true;
      status.textContent = `${scene.badge}. ${scene.title} ${scene.description}`;
    }
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!canMove() || !visible || document.hidden || userSelected || demo.matches(":focus-within, :hover")) return;
    timer = setTimeout(() => activate((current + 1) % scenes.length), 5600);
  }
  function updateMotion() {
    const enabled = canMove();
    root.classList.toggle("home-motion", enabled);
    root.classList.toggle("is-motion-paused", !enabled || document.hidden);
    toggle.hidden = false;
    toggle.disabled = reduced.matches || slow.matches;
    toggle.setAttribute("aria-pressed", String(!enabled));
    toggle.setAttribute("aria-label", toggle.disabled ? "Animation disabled by device preference" : paused ? "Play animation" : "Pause animation");
    toggle.title = toggle.getAttribute("aria-label");
    toggle.querySelector("[data-motion-icon]").classList.toggle("is-play", !enabled);
    progress.hidden = !enabled;
    if (!enabled) {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
      resetPointer();
    }
    schedule();
  }
  toggle.addEventListener("click", () => {
    paused = !paused;
    if (!paused) userSelected = false;
    try { localStorage.setItem("balhence_motion_paused", String(paused)); } catch { /* Respect this page's choice. */ }
    updateMotion();
  });
  steps.forEach((button, index) => {
    button.addEventListener("click", () => activate(index, true));
    button.addEventListener("keydown", (event) => {
      const direction = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!direction && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? steps.length - 1 : (index + direction + steps.length) % steps.length;
      steps[next].focus();
      activate(next, true);
    });
  });
  demo.addEventListener("pointerenter", () => clearTimeout(timer));
  demo.addEventListener("pointerleave", schedule);
  demo.addEventListener("focusin", () => clearTimeout(timer));
  demo.addEventListener("focusout", () => setTimeout(schedule, 0));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animate(entry.target, [{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 850, easing: "cubic-bezier(.22,1,.36,1)" });
        observer.unobserve(entry.target);
      }
    }, { threshold: .1 });
    document.querySelectorAll("[data-home-reveal]").forEach((node) => observer.observe(node));
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      demo.classList.toggle("is-outside-view", !visible);
      schedule();
    }, { threshold: .1 }).observe(demo);
  }
  function updateScroll() {
    scrollFrame = 0;
    if (document.hidden) return;
    const range = document.documentElement.scrollHeight - innerHeight;
    if (canMove()) progress.style.transform = `scaleX(${range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0})`;
    let active = 0;
    methodSteps.forEach((step, index) => { if (step.getBoundingClientRect().top < innerHeight * .58) active = index; });
    methodSteps.forEach((step, index) => step.classList.toggle("is-method-active", index === active));
    document.querySelector("[data-method-count]").textContent = String(active + 1).padStart(2, "0");
    document.querySelector("[data-method-meter]").style.transform = `scaleX(${(active + 1) / methodSteps.length})`;
  }
  const requestScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); };
  addEventListener("scroll", requestScroll, { passive: true });
  addEventListener("resize", requestScroll, { passive: true });
  function resetPointer() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    if (activeCard) {
      activeCard.style.removeProperty("--card-x");
      activeCard.style.removeProperty("--card-y");
    }
    activeCard = null;
    pointer = null;
  }
  document.querySelectorAll("[data-home-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (!canMove() || !fine.matches || document.hidden) return;
      activeCard = card;
      pointer = { x: event.clientX, y: event.clientY };
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!activeCard || !pointer) return;
        const box = activeCard.getBoundingClientRect();
        activeCard.style.setProperty("--card-y", `${((pointer.x - box.left) / box.width - .5) * 6}deg`);
        activeCard.style.setProperty("--card-x", `${-((pointer.y - box.top) / box.height - .5) * 4}deg`);
      });
    });
    card.addEventListener("pointerleave", resetPointer);
  });
  reduced.addEventListener("change", updateMotion);
  slow.addEventListener("change", updateMotion);
  fine.addEventListener("change", resetPointer);
  document.addEventListener("visibilitychange", () => {
    root.classList.toggle("is-motion-paused", !canMove() || document.hidden);
    animations.forEach((animation) => document.hidden ? animation.pause() : animation.play());
    schedule();
  });
  addEventListener("pagehide", () => { clearTimeout(timer); resetPointer(); });
  addEventListener("pageshow", () => { updateMotion(); requestScroll(); });
  updateMotion();
  updateScroll();
})();
