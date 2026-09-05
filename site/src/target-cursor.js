/**
 * Target cursor.
 *
 * Four corner brackets and a dot that snap around whatever is hoverable, after
 * the React Bits TargetCursor. Two departures from that component:
 *
 * - No GSAP. Everything it tweens is a lerp toward a target, which is a few
 *   lines here and saves ~25KB on a build with a hard budget.
 * - The thing being targeted is not a DOM element. LOCK-IN is a particle cloud
 *   in WebGL, so the scene hands this its projected screen rectangle instead of
 *   a selector match.
 */
const CORNER = 12;
const BORDER = 3;
const GAP = 6; // how far the brackets sit outside the target
const SPIN_SECONDS = 4;

export class TargetCursor {
  constructor() {
    this.root = document.createElement("div");
    this.root.className = "target-cursor";
    this.root.setAttribute("aria-hidden", "true");

    this.dot = document.createElement("i");
    this.dot.className = "target-cursor__dot";
    this.root.append(this.dot);

    this.corners = ["tl", "tr", "br", "bl"].map((name) => {
      const corner = document.createElement("i");
      corner.className = `target-cursor__corner target-cursor__corner--${name}`;
      this.root.append(corner);
      return { name, element: corner, x: 0, y: 0 };
    });

    document.body.append(this.root);

    this.pointer = { x: -9999, y: -9999 };
    this.position = { x: -9999, y: -9999 };
    this.rect = null;
    this.spin = 0;
    this.active = 0;
    this.visible = false;

    this.onPointerMove = (event) => {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      if (!this.visible) {
        this.position.x = event.clientX;
        this.position.y = event.clientY;
        this.visible = true;
        this.root.classList.add("is-visible");
      }
    };
    this.onPointerLeave = () => {
      this.visible = false;
      this.root.classList.remove("is-visible");
    };
  }

  attach() {
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    document.addEventListener("pointerleave", this.onPointerLeave);
  }

  detach() {
    window.removeEventListener("pointermove", this.onPointerMove);
    document.removeEventListener("pointerleave", this.onPointerLeave);
  }

  /** `rect` is {left, top, right, bottom} in CSS pixels, or null when nothing is hovered. */
  setTarget(rect) {
    this.rect = rect;
    this.root.classList.toggle("is-locked", Boolean(rect));
  }

  update(dt) {
    const follow = 1 - Math.exp(-dt * 16);
    this.position.x += (this.pointer.x - this.position.x) * follow;
    this.position.y += (this.pointer.y - this.position.y) * follow;

    // Idle, the brackets orbit the pointer; locked on, they square up and stop.
    this.active += ((this.rect ? 1 : 0) - this.active) * (1 - Math.exp(-dt * 12));
    this.spin = this.rect ? this.spin * (1 - follow) : this.spin + (dt / SPIN_SECONDS) * 360;

    const centre = this.rect
      ? {
          x: (this.rect.left + this.rect.right) / 2,
          y: (this.rect.top + this.rect.bottom) / 2,
        }
      : this.position;

    const x = centre.x * this.active + this.position.x * (1 - this.active);
    const y = centre.y * this.active + this.position.y * (1 - this.active);

    this.root.style.transform = `translate(${x}px, ${y}px) rotate(${this.spin}deg)`;
    this.dot.style.opacity = String(1 - this.active);

    const idle = CORNER * 0.75 + GAP;
    const halfWidth = this.rect ? (this.rect.right - this.rect.left) / 2 + GAP : idle;
    const halfHeight = this.rect ? (this.rect.bottom - this.rect.top) / 2 + GAP : idle;

    for (const corner of this.corners) {
      const targetX = corner.name.includes("l") ? -halfWidth : halfWidth - CORNER;
      const targetY = corner.name.startsWith("t") ? -halfHeight : halfHeight - CORNER;
      const rate = 1 - Math.exp(-dt * (this.rect ? 14 : 9));
      corner.x += (targetX - corner.x) * rate;
      corner.y += (targetY - corner.y) * rate;
      corner.element.style.transform = `translate(${corner.x}px, ${corner.y}px)`;
    }
  }

  dispose() {
    this.detach();
    this.root.remove();
  }
}

export const TARGET_CURSOR_METRICS = { CORNER, BORDER };
