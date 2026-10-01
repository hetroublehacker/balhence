import { createRoot, type Root } from "react-dom/client";
import { Scene } from "./Scene";

// The original ThreeUI files stay untouched. This adapter embeds the scene as
// decoration, passing pointer input through without intercepting site links.
const hero = document.querySelector<HTMLElement>(
  ".home-hero, .page-hero, .article-hero, .report-hero, .sb-hero, .not-found, .ctf-page",
);

if (hero) {
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
  let root: Root | null = null;
  let ready = false;
  const supported = Boolean(document.createElement("canvas").getContext("2d"));

  function synchronize() {
    const staticMode = preferences.some(query => query.matches) || connection?.saveData;
    if (staticMode || !supported) {
      root?.unmount();
      root = null;
      field?.remove();
      field = null;
      hero!.dataset.typeFieldState = supported ? "static" : "unavailable";
      return;
    }
    if (!ready || root) return;
    field = document.createElement("div");
    field.className = "type-field";
    field.setAttribute("aria-hidden", "true");
    hero!.prepend(field);
    root = createRoot(field);
    root.render(<Scene />);
    hero!.dataset.typeFieldState = "running";
  }

  function forwardPointer(event: PointerEvent) {
    if (!field || field.contains(event.target as Node)) return;
    const scene = field.querySelector(".typography-vortex-component");
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

  // Ring bitmaps are cached by the source renderer. Load the exact font before
  // its first paint so the cached glyphs never use a fallback font.
  document.fonts.load('14px "ThreeUI Fragment Mono"').then(fonts => {
    if (!fonts.length) throw new Error("ThreeUI Fragment Mono was not loaded");
    ready = true;
    synchronize();
  }).catch(() => {
    hero.dataset.typeFieldState = "unavailable";
  });
}
