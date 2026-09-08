(() => {
  "use strict";
  const diagram = document.querySelector("[data-security-map]");
  if (!diagram) return;
  const root = document.documentElement;
  const canvas = diagram.querySelector("[data-security-canvas]");
  const context = canvas.getContext("2d");
  const toggle = document.querySelector("[data-motion-toggle]");
  if (!context || !toggle || typeof Path2D !== "function") return; // The inline SVG remains visible.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const slow = matchMedia("(update: slow)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const animations = new Set();
  let paused = false;
  try { paused = localStorage.getItem("balhence_motion_paused") === "true"; } catch { /* Storage is optional. */ }
  let visible = true;
  let frame = 0;
  let lastTime = 0;
  let phase = .38;
  let size = 600;
  let pixelRatio = 1;
  const pointer = { x: 0, y: 0, open: 0, targetX: 0, targetY: 0, targetOpen: 0 };
  // Cache event values instead of polling MediaQueryList.matches inside RAF.
  // Reading it during rendering can consume a pending change in some engines,
  // leaving the control out of sync even though the frame loop has stopped.
  let deviceReduced = reduced.matches;
  let deviceSlow = slow.matches;
  const deviceStatic = () => deviceReduced || deviceSlow || saveData;
  const canMove = () => !paused && !deviceStatic();
  const canRun = () => canMove() && visible && !document.hidden;
  const TAU = Math.PI * 2;
  const nodes = [
    {
      "label": "Applications",
      "id": "apps",
      "x": 120,
      "y": 160,
      "icon": "M-13-11H13V11H-13ZM-13-5H13M-7-8H-6M-2-8H-1"
    },
    {
      "label": "Cloud",
      "id": "cloud",
      "x": 300,
      "y": 90,
      "icon": "M-10 9H12C24 6 19-9 8-6C3-17-13-12-12-3C-23-2-21 10-10 9Z"
    },
    {
      "label": "AI systems",
      "id": "ai",
      "x": 480,
      "y": 160,
      "icon": "M-10-10H10V10H-10ZM-4-4H4V4H-4ZM-5-15V-10M5-15V-10M-5 10V15M5 10V15M-15-5H-10M-15 5H-10M10-5H15M10 5H15"
    },
    {
      "label": "Data",
      "id": "data",
      "x": 480,
      "y": 390,
      "icon": "M-14-9C-14-16 14-16 14-9C14-2-14-2-14-9ZM-14-9V9C-14 16 14 16 14 9V-9M-14 0C-14 7 14 7 14 0"
    },
    {
      "label": "Identity",
      "id": "identity",
      "x": 300,
      "y": 460,
      "icon": "M7-7A7 7 0 1 1-7-7A7 7 0 1 1 7-7ZM-14 14C-14-1 14-1 14 14"
    },
    {
      "label": "Code",
      "id": "code",
      "x": 120,
      "y": 390,
      "icon": "M-6-10L-16 0L-6 10M6-10L16 0L6 10M3-12L-3 12"
    }
  ];
  const icons = nodes.map(node => new Path2D(node.icon));
  const shield = new Path2D("M0-26L21-18V1C21 16 8 26 0 30C-8 26-21 16-21 1V-18ZM-10 0L-3 7L11-8");

  // This is a static system model with illustrative review traces. No requests,
  // target discovery, measurements, or live security results are involved.
  function pointOnRoute(node, t) {
    const s = 1 - t;
    const middleX = (node.x + 300) / 2;
    return {
      x: s ** 3 * node.x + 3 * s * s * t * middleX + 3 * s * t * t * middleX + t ** 3 * 300,
      y: s ** 3 * node.y + 3 * s * s * t * node.y + 3 * s * t * t * 275 + t ** 3 * 275
    };
  }
  function box(x, y, width, radius) {
    context.beginPath();
    if (context.roundRect) context.roundRect(x, y, width, width, radius);
    else context.rect(x, y, width, width);
  }
  function draw() {
    const unit = size / 600;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size, size);
    context.scale(unit, unit);
    context.lineCap = "round";
    context.lineJoin = "round";
    const cursorX = (pointer.x + 1) * 300;
    const cursorY = (pointer.y + 1) * 300;
    const focus = nodes.map(node => Math.max(0, 1 - Math.hypot(node.x - cursorX, node.y - cursorY) / 175) * pointer.open);

    nodes.forEach((node, index) => {
      const middleX = (node.x + 300) / 2;
      context.beginPath();
      context.moveTo(node.x, node.y);
      context.bezierCurveTo(middleX, node.y, middleX, 275, 300, 275);
      context.strokeStyle = `rgba(155,140,255,${.22 + focus[index] * .55})`;
      context.lineWidth = 1.1 + focus[index];
      context.stroke();
      const progress = (phase * .7 + index / nodes.length) % 1;
      for (let step = 18; step >= 0; step--) {
        const t = progress - step * .009;
        if (t < 0) continue;
        const from = pointOnRoute(node, t);
        const to = pointOnRoute(node, Math.min(1, t + .009));
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.strokeStyle = `rgba(207,196,255,${(1 - step / 19) * .85})`;
        context.lineWidth = 2;
        context.stroke();
      }
    });

    context.beginPath();
    context.arc(300, 275, 87, 0, TAU);
    context.setLineDash([4, 7]);
    context.lineDashOffset = -phase * 12;
    context.strokeStyle = "rgba(155,140,255,.3)";
    context.lineWidth = 1;
    context.stroke();
    context.setLineDash([]);

    nodes.forEach((node, index) => {
      box(node.x - 26, node.y - 26, 52, 12);
      context.fillStyle = "#17131f";
      context.fill();
      context.strokeStyle = `rgba(155,140,255,${.5 + focus[index] * .5})`;
      context.lineWidth = 1.2 + focus[index];
      context.stroke();
      context.save();
      context.translate(node.x, node.y);
      context.strokeStyle = focus[index] > .25 ? "#ede7ff" : "#b9a9e9";
      context.lineWidth = 1.6;
      context.stroke(icons[index]);
      context.restore();
    });

    box(252, 227, 96, 22);
    context.fillStyle = "#17131f";
    context.fill();
    context.strokeStyle = "#9b8cff";
    context.lineWidth = 1.4;
    context.stroke();
    context.save();
    context.translate(300, 275);
    context.strokeStyle = "#c1b4ff";
    context.lineWidth = 1.8;
    context.stroke(shield);
    // A quiet pulse connects the incoming traces to the central review.
    context.beginPath();
    context.arc(0, 0, 41 + (phase % 1) * 5, 0, TAU);
    context.strokeStyle = `rgba(155,140,255,${(1 - phase % 1) * .15})`;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
    diagram.classList.add("is-rendered");
  }

  function tick(time) {
    frame = 0;
    if (!canRun()) return;
    // Cap drawing to 30fps, even on high-refresh displays.
    if (!lastTime || time - lastTime >= 1000 / 30 - 1) {
      const delta = lastTime ? Math.min(time - lastTime, 80) : 0;
      lastTime = time;
      phase += delta * .00036;
      pointer.x += (pointer.targetX - pointer.x) * .07;
      pointer.y += (pointer.targetY - pointer.y) * .07;
      pointer.open += (pointer.targetOpen - pointer.open) * .045;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    diagram.dataset.motionState = canRun() ? "running" : "static";
    if (canRun()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    size = Math.max(1, canvas.getBoundingClientRect().width);
    pixelRatio = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(size * pixelRatio);
    canvas.height = Math.round(size * pixelRatio);
    draw();
  }
  function resetPointer() {
    pointer.targetX = 0;
    pointer.targetY = 0;
    pointer.targetOpen = 0;
  }
  function updateMotion() {
    const enabled = canMove();
    root.classList.toggle("home-motion", enabled);
    root.classList.toggle("is-motion-paused", !enabled || document.hidden);
    toggle.hidden = false;
    toggle.disabled = deviceStatic();
    toggle.setAttribute("aria-pressed", String(!enabled));
    toggle.setAttribute("aria-label", deviceStatic() ? "Animation disabled by device preference" : paused ? "Play animation" : "Pause animation");
    toggle.querySelector("[data-motion-label]").textContent = deviceStatic() ? "Still by preference" : paused ? "Play motion" : "Pause motion";
    toggle.querySelector("[data-motion-icon]").classList.toggle("is-play", !enabled);
    if (!enabled) {
      animations.forEach(animation => animation.cancel());
      animations.clear();
      resetPointer();
    }
    schedule();
  }
  toggle.addEventListener("click", () => {
    paused = !paused;
    try { localStorage.setItem("balhence_motion_paused", String(paused)); } catch { /* Keep this page's preference. */ }
    updateMotion();
  });
  diagram.addEventListener("pointermove", event => {
    if (!canRun() || !fine.matches) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.targetX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    pointer.targetY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    pointer.targetOpen = 1;
  });
  diagram.addEventListener("pointerleave", resetPointer);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }, { threshold: .02 }).observe(diagram);
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal.unobserve(entry.target);
        if (!canMove() || !entry.target.animate) continue;
        const animation = entry.target.animate(
          [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 850, easing: "cubic-bezier(.22,1,.36,1)" }
        );
        animations.add(animation);
        animation.finished.catch(() => {}).finally(() => animations.delete(animation));
      }
    }, { threshold: .12 });
    document.querySelectorAll("[data-home-reveal]").forEach(node => reveal.observe(node));
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(diagram);
  else addEventListener("resize", resize, { passive: true });
  reduced.addEventListener("change", event => {
    deviceReduced = event.matches;
    updateMotion();
  });
  slow.addEventListener("change", event => {
    deviceSlow = event.matches;
    updateMotion();
  });
  fine.addEventListener("change", resetPointer);
  document.addEventListener("visibilitychange", () => {
    root.classList.toggle("is-motion-paused", !canMove() || document.hidden);
    animations.forEach(animation => document.hidden ? animation.pause() : animation.play());
    schedule();
  });
  addEventListener("pagehide", () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    resetPointer();
  });
  addEventListener("pageshow", updateMotion);
  resize();
  updateMotion();
})();
