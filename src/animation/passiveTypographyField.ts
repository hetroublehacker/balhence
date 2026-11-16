export type PassiveTypographyOptions = {
  mode: "dark" | "light";
  phrase: string;
  speed: number;
  ringGrowth: number;
  opacity: number;
};

type Ring = {
  bitmap: HTMLCanvasElement;
  offset: number;
  radius: number;
  size: number;
  speed: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

/**
 * First-party, passive canvas field. It intentionally has no pointer, click,
 * particle, dissolve, or suction paths. Rings are prerendered after resize so
 * each animation frame only composites cached bitmaps.
 */
export function createPassiveTypographyField(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  getOptions: () => PassiveTypographyOptions,
) {
  const context = canvas.getContext("2d");
  if (!context) return () => undefined;

  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let rings: Ring[] = [];
  let animationFrame = 0;
  let visible = true;
  let previousTime = 0;
  let elapsed = 0;

  container.dataset.interactionState = "none";

  function buildRings() {
    const options = getOptions();
    const random = seeded(122);
    const phrase = options.phrase || "BALHENCE / SECURITY VALIDATION / ";
    const maximumRadius = Math.hypot(width * 0.55, height * 0.68) + 44;
    const next: Ring[] = [];
    let radius = 30;
    let index = 0;

    while (radius < maximumRadius) {
      const fontSize = clamp(7 + radius * 0.014, 7, 15);
      const spacing = index % 3 === 2 ? 2.5 : 1.08;
      const step = (fontSize * 0.62 * spacing) / radius;
      const glyphCount = Math.max(5, Math.floor((Math.PI * 2) / step));
      const angleStep = (Math.PI * 2) / glyphCount;
      const size = Math.ceil((radius + fontSize * 2) * 2);
      const bitmap = document.createElement("canvas");
      bitmap.width = bitmap.height = size;
      const ringContext = bitmap.getContext("2d");
      if (!ringContext) break;

      ringContext.translate(size / 2, size / 2);
      ringContext.font = `${fontSize}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
      ringContext.textAlign = "center";
      ringContext.textBaseline = "middle";
      const tone = options.mode === "light" ? "42,44,52" : "211,211,206";
      const alpha = clamp(0.3 + radius / maximumRadius, 0.34, 0.86) * options.opacity;
      ringContext.fillStyle = `rgba(${tone},${alpha})`;

      for (let glyph = 0; glyph < glyphCount; glyph += 1) {
        const angle = glyph * angleStep;
        const character = phrase[glyph % phrase.length];
        if (character === " ") continue;
        ringContext.save();
        ringContext.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
        ringContext.rotate(angle + Math.PI / 2);
        ringContext.fillText(character, 0, 0);
        ringContext.restore();
      }

      next.push({
        bitmap,
        offset: random() * Math.PI * 2,
        radius,
        size,
        speed: (index % 2 ? -1 : 1) * (0.026 + 24 / (radius + 80)),
      });
      radius *= Math.max(1.1, options.ringGrowth);
      index += 1;
    }
    rings = next;
  }

  function resize() {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    buildRings();
  }

  function draw(time: number) {
    const delta = Math.min(50, Math.max(0, time - (previousTime || time)));
    previousTime = time;
    elapsed += delta;
    const options = getOptions();
    const light = options.mode === "light";
    context.clearRect(0, 0, width, height);
    context.fillStyle = light ? "#eef1f6" : "#151515";
    context.fillRect(0, 0, width, height);

    const centerX = width * 0.69;
    const centerY = height * 0.5;
    context.save();
    context.translate(centerX, centerY);
    context.strokeStyle = light
      ? `rgba(42,44,52,${0.07 * options.opacity})`
      : `rgba(198,198,193,${0.06 * options.opacity})`;
    context.lineWidth = 1;
    context.setLineDash([1, 6]);
    for (const ring of rings) {
      context.beginPath();
      context.arc(0, 0, ring.radius * 1.11, 0, Math.PI * 2);
      context.stroke();
    }
    context.setLineDash([]);
    const rotationTime = (elapsed / 1000) * options.speed;
    for (const ring of rings) {
      context.save();
      context.rotate(ring.offset + rotationTime * ring.speed);
      context.drawImage(ring.bitmap, -ring.size / 2, -ring.size / 2, ring.size, ring.size);
      context.restore();
    }
    context.restore();

    if (visible && !document.hidden) animationFrame = requestAnimationFrame(draw);
  }

  function resume() {
    if (!visible || document.hidden || animationFrame) return;
    previousTime = 0;
    animationFrame = requestAnimationFrame(draw);
  }

  function pause() {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function visibilityChanged() {
    if (document.hidden) pause();
    else resume();
  }

  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) resume();
    else pause();
  });

  resizeObserver.observe(container);
  intersectionObserver.observe(container);
  document.addEventListener("visibilitychange", visibilityChanged);
  resize();
  resume();

  return () => {
    pause();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", visibilityChanged);
  };
}
