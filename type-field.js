/*
 * Original Balhence Canvas 2D background. Open, tilted word paths suggest
 * trust boundaries; no ThreeUI renderer, source, fonts or assets are copied.
 * Decorative only: text, navigation and forms never depend on this canvas.
 */
(() => {
  "use strict";
  const host = document.querySelector(".home-hero, .page-hero, .article-hero, .report-hero, .sb-hero, .not-found, .ctf-page");
  if (!host) return;
  const canvas = document.createElement("canvas");
  let ctx;
  try { ctx = canvas.getContext("2d"); } catch { return; }
  if (!ctx) return;
  canvas.className = "type-field";
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.typeField = "";
  host.classList.add("type-field-host");
  host.prepend(canvas);

  const key = "balhence_motion_paused";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const slow = matchMedia("(update: slow)");
  const forcedColors = matchMedia("(forced-colors: active)");
  const connection = navigator.connection;
  const readPause = () => { try { return localStorage.getItem(key) === "true"; } catch { return false; } };
  let paused = readPause();
  let deviceLimited = reduced.matches || slow.matches || forcedColors.matches || Boolean(connection?.saveData);
  let visible = false;
  let suspended = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let width = 1;
  let height = 1;
  let ratio = 1;
  let paths = [];
  let sprites = [];
  const words = ["BALHENCE", "SCOPE", "IDENTITY", "ACCESS", "EVIDENCE", "VERIFY"];
  const tau = Math.PI * 2;
  const home = host.classList.contains("home-hero");
  let button = null;

  function updateButton() {
    if (!button) return;
    button.disabled = deviceLimited;
    button.textContent = deviceLimited ? "Still by preference" : paused ? "Play motion" : "Pause motion";
    button.setAttribute("aria-pressed", String(paused || deviceLimited));
    button.setAttribute("aria-label", deviceLimited ? "Motion disabled by device preference" : button.textContent);
  }

  // The homepage already has a visible shared control beside its illustration.
  // Other heroes get a nearby control so pausing never requires a footer trip.
  if (!home || !document.querySelector("[data-motion-toggle]:not([hidden])")) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "type-field-toggle";
    button.dataset.typeFieldToggle = "";
    button.addEventListener("click", () => {
      if (deviceLimited) return;
      paused = !paused;
      try { localStorage.setItem(key, String(paused)); } catch { /* In-memory choice still works. */ }
      sync();
      dispatchEvent(new CustomEvent("balhence:motion-preference", { detail: { paused } }));
    });
    host.append(button);
  }

  function point(path, t) {
    const x = Math.cos(t) * path.rx;
    const y = Math.sin(t) * path.ry;
    const c = Math.cos(path.tilt), s = Math.sin(path.tilt);
    return { x: path.cx + x * c - y * s, y: path.cy + x * s + y * c };
  }

  function position(path, distance) {
    const fraction = ((distance % path.length) + path.length) % path.length;
    let lo = 0, hi = path.samples.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (path.samples[mid].length < fraction) lo = mid;
      else hi = mid;
    }
    const a = path.samples[lo], b = path.samples[hi];
    const mix = (fraction - a.length) / Math.max(.001, b.length - a.length);
    return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function buildPaths() {
    const mobile = width < 861;
    const radius = Math.max(width * .61, mobile ? 420 : 650);
    const centerX = width * (mobile ? 1.10 : .82);
    const centerY = Math.min(height * .49, mobile ? 430 : 550);
    paths = [0, 1, 2, 3].map(index => {
      const path = {
        cx: centerX + index * 16, cy: centerY - index * 10,
        rx: radius * (.56 + index * .22),
        ry: Math.min(height * .42, 380) * (.58 + index * .24),
        tilt: -.27 + index * .075,
        color: index === 1 ? "#70c9c1" : "#b6a1ed",
        speed: (index % 2 ? -1 : 1) * (9 + index * 3),
        samples: [], length: 0,
      };
      let previous = null;
      for (let n = 0; n <= 480; n++) {
        const p = point(path, n / 480 * tau);
        if (previous) path.length += Math.hypot(p.x - previous.x, p.y - previous.y);
        path.samples.push({ ...p, length: path.length });
        previous = p;
      }
      path.count = Math.max(8, Math.floor(path.length / (mobile ? 112 : 150)));
      return path;
    });
    const fontSize = mobile ? 12 : Math.min(20, Math.max(14, width / 95));
    sprites = paths.map(path => words.map(word => {
      const sprite = document.createElement("canvas");
      const paint = sprite.getContext("2d");
      if (!paint) return null;
      const font = `500 ${fontSize}px "Bricolage Grotesque", sans-serif`;
      paint.font = font;
      const w = Math.ceil(paint.measureText(word).width + 8), h = Math.ceil(fontSize * 1.8);
      sprite.width = Math.ceil(w * ratio); sprite.height = Math.ceil(h * ratio);
      paint.scale(ratio, ratio);
      paint.font = font; paint.textAlign = "center"; paint.textBaseline = "middle";
      paint.fillStyle = path.color;
      paint.fillText(word, w / 2, h / 2);
      return { image: sprite, width: w, height: h };
    }));
  }

  function draw() {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paths.forEach((path, index) => {
      ctx.strokeStyle = path.color;
      ctx.lineWidth = .65;
      ctx.globalAlpha = .10;
      // Broken parallel arcs give the composition room to breathe.
      for (let arc = 0; arc < 3; arc++) {
        ctx.beginPath();
        for (let n = 0; n <= 64; n++) {
          const p = point(path, arc * tau / 3 + n / 64 * 1.55 + .2);
          if (n) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        }
        ctx.stroke();
      }
      const spacing = path.length / path.count;
      for (let n = 0; n < path.count; n++) {
        // Intentional gaps avoid forming the reference's continuous tunnel.
        if ((n + index) % 7 === 0 || (n + index) % 7 === 1) continue;
        const p = position(path, n * spacing + elapsed * path.speed + index * 71);
        if (p.x < -140 || p.x > width + 140 || p.y < -50 || p.y > height + 50) continue;
        const sprite = sprites[index][(n + index) % words.length];
        if (!sprite) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = .30 + .08 * Math.sin(n * 1.7 + index);
        ctx.drawImage(sprite.image, -sprite.width / 2, -sprite.height - 5, sprite.width, sprite.height);
        ctx.restore();
      }
      // A few quiet markers follow the paths without flashing or pulsing.
      for (let n = 0; n < 4; n++) {
        const p = position(path, n * path.length / 4 + elapsed * path.speed * .7 + 90);
        ctx.beginPath(); ctx.arc(p.x, p.y, n === 0 ? 2 : 1.2, 0, tau);
        ctx.fillStyle = path.color; ctx.globalAlpha = .42; ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  const allowed = () => !paused && !deviceLimited && !document.hidden && !suspended && visible;
  function tick(time) {
    frame = 0;
    if (!allowed()) return;
    if (!last || time - last >= 1000 / 24 - 1) {
      elapsed += last ? Math.min(time - last, 100) / 1000 : 0;
      last = time;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    canvas.dataset.state = allowed() ? "running" : "static";
    updateButton();
    if (allowed()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const bounds = host.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));
    const nextRatio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2400000 / nextWidth / nextHeight));
    if (nextWidth === width && nextHeight === height && nextRatio === ratio && paths.length) return;
    width = nextWidth; height = nextHeight; ratio = nextRatio;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    buildPaths(); draw();
  }
  const preferenceChanged = () => {
    deviceLimited = reduced.matches || slow.matches || forcedColors.matches || Boolean(connection?.saveData);
    sync();
  };
  [reduced, slow, forcedColors].forEach(query => {
    if (query.addEventListener) query.addEventListener("change", preferenceChanged);
    else query.addListener(preferenceChanged);
  });
  connection?.addEventListener?.("change", preferenceChanged);
  addEventListener("balhence:motion-preference", event => {
    if (typeof event.detail?.paused !== "boolean") return;
    paused = event.detail.paused; sync();
  });
  addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    paused = readPause(); sync();
  });
  document.addEventListener("visibilitychange", sync);
  addEventListener("pagehide", () => { suspended = true; sync(); });
  addEventListener("pageshow", () => { suspended = false; sync(); });
  addEventListener("resize", resize, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(host);
  resize();
  document.fonts?.ready.then(() => { buildPaths(); draw(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0 }).observe(host);
  } else {
    const checkVisible = () => { const b = host.getBoundingClientRect(); visible = b.bottom > 0 && b.top < innerHeight; sync(); };
    addEventListener("scroll", checkVisible, { passive: true });
    checkVisible();
  }
  sync();
})();
