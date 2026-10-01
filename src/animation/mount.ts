import {
  createTypographyVortexRenderer,
  type TypographyVortexOptions,
} from "../../vendor/threeui/src/shaders/typography-vortex/typographyVortexRenderer";

// Native site adapter: no React, remote code, or font-loading prerequisite.
const options: TypographyVortexOptions = {
  mode: "dark",
  phrase: "BALHENCE / PENETRATION TESTING / WEB & API SECURITY / SAAS / CLOUD / IDENTITY / AI & LLM SECURITY / ",
  speed: 1,
  ringGrowth: 1.21,
  opacity: 1,
  dissolveRadius: 1,
  particleAmount: 1,
  suctionDuration: 920,
};
const selector = ".home-hero, .page-hero, .article-hero, .report-hero, .sb-hero, .not-found, .ctf-page";

function initialize(hero: HTMLElement) {
  hero.classList.add("type-field-host");
  const preferences = [
    matchMedia("(prefers-reduced-motion: reduce)"),
    matchMedia("(update: slow)"),
    matchMedia("(forced-colors: active)"),
    matchMedia("print"),
  ];
  const connection = (navigator as Navigator & {
    connection?: EventTarget & { saveData?: boolean };
  }).connection;
  let field: HTMLDivElement | null = null;
  let scene: HTMLDivElement | null = null;
  let dispose: (() => void) | null = null;
  const supported = Boolean(document.createElement("canvas").getContext("2d"));

  function synchronize() {
    const staticMode = preferences.some(query => query.matches) || connection?.saveData;
    if (staticMode || !supported) {
      dispose?.();
      dispose = null;
      field?.remove();
      field = null;
      scene = null;
      hero.dataset.typeFieldState = supported ? "static" : "unavailable";
      return;
    }
    if (field) return;
    field = document.createElement("div");
    field.className = "type-field";
    field.setAttribute("aria-hidden", "true");
    const frame = document.createElement("div");
    frame.className = "shader-frame";
    scene = document.createElement("div");
    scene.className = "typography-vortex-component typography-vortex-component--dark";
    scene.dataset.mode = options.mode;
    scene.dataset.dissolveState = "ambient";
    scene.dataset.suctionState = "idle";
    scene.dataset.particles = "0";
    scene.dataset.dissolveStrength = "0.00";
    const canvas = document.createElement("canvas");
    scene.append(canvas);
    frame.append(scene);
    field.append(frame);
    hero.prepend(field);
    dispose = createTypographyVortexRenderer(scene, canvas, () => options);
    hero.dataset.typeFieldState = "running";
  }

  function forwardPointer(event: PointerEvent) {
    if (!field || field.contains(event.target as Node)) return;
    scene?.dispatchEvent(new PointerEvent(event.type, {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      button: event.button,
      buttons: event.buttons,
    }));
  }

  for (const type of ["pointerenter", "pointermove", "pointerleave", "pointerdown"] as const) {
    hero.addEventListener(type, forwardPointer, { passive: true });
  }
  for (const query of preferences) query.addEventListener("change", synchronize);
  connection?.addEventListener("change", synchronize);
  synchronize();
}

function start() {
  const hero = document.querySelector<HTMLElement>(selector);
  if (!hero?.querySelector("h1")) return false;
  initialize(hero);
  return true;
}

// The small async script is requested in <head>. Start when the hero arrives,
// without waiting for footer scripts, images, fonts or DOMContentLoaded.
if (!start() && document.readyState === "loading") {
  const observer = new MutationObserver(() => {
    if (start()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => observer.disconnect(), { once: true });
}
