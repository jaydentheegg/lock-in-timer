/**
 * The background: a helix of stills you descend through.
 *
 * Ported from the React Bits InfiniteSpiral. The placement maths is the
 * component's; what changes is what drives it and what it is made of.
 *
 * - It is driven by this build's virtual scroll rather than window.scrollY,
 *   because the page is position:fixed and has no document scroll.
 * - The cards are twelve crops of the same clip the timer used as footage, so
 *   the background is still the city — taken apart and stacked into the descent
 *   rather than played behind it.
 *
 * This replaces the WebGL video plane. The pointer ripple went with it: it
 * distorted that plane's texture, and there is no longer a texture to distort.
 */
const COUNT = 18;
const IMAGES = 12;
const CARDS_PER_TURN = 7;
const RADIUS = 230;
const VERTICAL_SPACING = 96;
const PERSPECTIVE = 1000;
const CARD = 124;
const CENTRE_SCALE = 1.1;
const EDGE_FADE = 0.42;
const EDGE_BLUR = 5;
const DRIFT = 0.055; // turns per second while nothing else is happening

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const smoothstep = (min, max, value) => {
  const x = clamp((value - min) / (max - min || 1), 0, 1);
  return x * x * (3 - 2 * x);
};

export class Spiral {
  constructor(page, base = "") {
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    this.progress = 0;
    this.target = 0;
    this.drift = 0;

    this.root = document.createElement("div");
    this.root.className = "spiral";
    this.root.setAttribute("aria-hidden", "true");
    this.root.style.perspective = `${PERSPECTIVE}px`;

    this.cards = Array.from({ length: COUNT }, (_, index) => {
      const card = document.createElement("i");
      card.className = "spiral__card";
      // Eighteen rungs off twelve stills: the repeat lands three quarters of a
      // turn apart, where it reads as rhythm rather than as a loop.
      const image = String(index % IMAGES).padStart(2, "0");
      card.style.backgroundImage = `url("${base}spiral/${image}.jpg")`;
      this.root.append(card);
      return card;
    });

    // Behind everything the interface draws, including the canvas.
    page.prepend(this.root);
  }

  /** `descent` is the scroll's 0..1; `fold` is how far the session has taken over. */
  update(dt, descent, fold) {
    const still = this.reduceMotion.matches;
    // The descent turns the helix, and it keeps turning slowly on its own so a
    // page nobody has touched yet is not a photograph.
    this.drift += (still ? 0 : DRIFT) * dt;
    this.target = descent * (COUNT * 0.8) + this.drift;
    this.progress += (this.target - this.progress) * (still ? 1 : 1 - Math.exp(-dt * 9));

    const width = window.innerWidth;
    const height = window.innerHeight;
    const half = COUNT / 2;
    const fit = Math.min(1, width / (CARD * 2.4), height / (CARD * 2.1));
    const responsiveRadius = Math.min(RADIUS, Math.max(120, width * 0.4)) * fit;
    const fadeStart = clamp(1 - EDGE_FADE, 0, 0.98);

    for (let index = 0; index < COUNT; index += 1) {
      const card = this.cards[index];
      let offset = index - this.progress;
      offset = modulo(offset + half, COUNT) - half;

      const edge = Math.min(Math.abs(offset) / Math.max(half, 1), 1);
      const opacity = 1 - smoothstep(fadeStart, 1, edge);
      const focus = 1 - Math.min(Math.abs(offset) / Math.max(CARDS_PER_TURN * 0.65, 1), 1);
      const scale = (1 + (CENTRE_SCALE - 1) * focus) * fit;
      const angle = (offset * (360 / CARDS_PER_TURN) * Math.PI) / 180;
      const x = Math.sin(angle) * responsiveRadius;
      const z = Math.cos(angle) * responsiveRadius;
      const depthScale = clamp(PERSPECTIVE / Math.max(PERSPECTIVE - z, 1), 0.72, 1.2);
      const depth = (z / Math.max(responsiveRadius, 1) + 1) / 2;
      const blur = EDGE_BLUR * smoothstep(0.35, 1, edge);

      card.style.transform =
        `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ` +
        `${(offset * VERTICAL_SPACING * fit).toFixed(1)}px, 0) scale(${(scale * depthScale).toFixed(3)})`;
      // Folded away once the session starts: the instrument does not need a view.
      card.style.opacity = (opacity * (1 - fold * 0.82)).toFixed(3);
      card.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none";
      card.style.zIndex = String(Math.round(depth * 1000));
    }
  }

  dispose() {
    this.root.remove();
  }
}
