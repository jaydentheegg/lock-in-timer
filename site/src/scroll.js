/**
 * Virtual scroll.
 *
 * The page is position:fixed with overflow:hidden, so there is no document
 * scroll to smooth — which is why this is hand-rolled rather than Lenis. All
 * that is needed is one 0..1 value with inertia, plus the velocity that drives
 * the tearing on the clock.
 */
const TOTAL_VH = 3.8; // 380vh of travel: 100 + 180 + 100
const EASE_RATE = 7.5;
const WHEEL_SCALE = 1;
const TOUCH_SCALE = 1.6;

/** Section boundaries, as a share of the whole travel. */
export const SECTIONS = {
  clock: [0, 1 / TOTAL_VH],
  phases: [1 / TOTAL_VH, 2.8 / TOTAL_VH],
  enter: [2.8 / TOTAL_VH, 1],
};

/** Camera depth at each boundary. The gates sit inside the phases leg. */
export const CAMERA_Z = { start: 6.2, phasesIn: 4, phasesOut: -8.5, end: -11.5 };

export const GATE_Z = [-0.5, -3, -5.5, -8];

export const GATES = [
  { z: GATE_Z[0], code: "TRACE", at: "10:00" },
  { z: GATE_Z[1], code: "DEEP", at: "25:00" },
  { z: GATE_Z[2], code: "NULL", at: "45:00" },
  { z: GATE_Z[3], code: "LOCK", at: "75:00" },
];

export const inverseLerp = (from, to, value) =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

export class VirtualScroll {
  constructor() {
    this.target = 0;
    this.value = 0;
    this.velocity = 0;
    this.enabled = true;
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    this.touchY = null;

    // Swallowed while the timer runs: a session is not something you should be
    // able to scroll out of by accident. Pausing gives the scene back.
    this.onWheel = (event) => {
      if (!this.enabled) return;
      this.push((event.deltaY * WHEEL_SCALE) / this.span);
    };

    this.onTouchStart = (event) => {
      this.touchY = event.touches[0]?.clientY ?? null;
    };

    this.onTouchMove = (event) => {
      const y = event.touches[0]?.clientY;
      if (y == null || this.touchY == null) return;
      const delta = this.touchY - y;
      this.touchY = y;
      if (!this.enabled) return;
      this.push((delta * TOUCH_SCALE) / this.span);
    };

    this.onTouchEnd = () => {
      this.touchY = null;
    };
  }

  get span() {
    return Math.max(1, window.innerHeight * TOTAL_VH);
  }

  attach() {
    window.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("touchstart", this.onTouchStart, { passive: true });
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("touchend", this.onTouchEnd, { passive: true });
  }

  detach() {
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("touchstart", this.onTouchStart);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("touchend", this.onTouchEnd);
  }

  push(delta) {
    this.target = Math.min(1, Math.max(0, this.target + delta));
    if (this.reduceMotion.matches) this.value = this.target;
  }

  /** Pulls the whole field of view back to the top, for the lock sequence. */
  rewind() {
    this.target = 0;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  update(dt) {
    const previous = this.value;
    this.value += (this.target - this.value) * (1 - Math.exp(-dt * EASE_RATE));
    if (Math.abs(this.target - this.value) < 0.0002) this.value = this.target;

    const instant = dt > 0 ? (this.value - previous) / dt : 0;
    this.velocity += (instant - this.velocity) * (1 - Math.exp(-dt * 9));
    return this.value;
  }
}
