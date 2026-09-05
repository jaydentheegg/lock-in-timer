import * as THREE from "three";

/**
 * The opening: an access card swinging on a lanyard, which you can grab.
 *
 * After the React Bits Lanyard, but not a port of it. That component is built
 * on React Three Fiber, drei, a Rapier WASM physics world, meshline and a
 * baked .glb — around a megabyte of dependencies and a React runtime, into a
 * build that has none of those and a 210KB budget. The behaviour is what
 * matters, and a rope is one of the few things in physics simple enough to
 * write out: this is a verlet chain with distance constraints, which gives the
 * same swing, the same droop, and the same feeling of weight when you drag it.
 *
 * The card face is drawn to a canvas rather than modelled — a lock whose shackle
 * is a clock hand, which is the whole product in one mark.
 */
// The card hangs 4.2 units out, where the frame is 2.4 units tall: the rope has
// to be short enough that the card lands inside it rather than below the fold.
const SEGMENTS = 14;
const SEGMENT_LENGTH = 0.085;
const ANCHOR = new THREE.Vector3(0, 1.52, 0);
const GRAVITY = new THREE.Vector3(0, -9.4, 0);
const DAMPING = 0.972;
const RELAX = 7;
const CARD_WIDTH = 0.66;
const CARD_HEIGHT = 1.04;
const CARD_DEPTH = -4.2; // in front of everything, close enough to fill the eye

/** A lock whose shackle doubles as the sweep of a clock hand. */
function face() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(size * (CARD_HEIGHT / CARD_WIDTH));
  const context = canvas.getContext("2d");
  const height = canvas.height;

  const plate = context.createLinearGradient(0, 0, size, height);
  plate.addColorStop(0, "#2a1d0e");
  plate.addColorStop(1, "#150d06");
  context.fillStyle = plate;
  context.fillRect(0, 0, size, height);

  context.strokeStyle = "rgba(244, 182, 92, .34)";
  context.lineWidth = 3;
  context.strokeRect(18, 18, size - 36, height - 36);

  // The punch hole the lanyard threads through.
  context.fillStyle = "#050302";
  context.beginPath();
  context.ellipse(size / 2, 64, 54, 17, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(244, 182, 92, .28)";
  context.lineWidth = 2;
  context.stroke();

  const centreX = size / 2;
  const centreY = height * 0.47;
  const bodyWidth = 210;
  const bodyHeight = 168;
  const bodyTop = centreY - 6;
  const radius = 104;

  // Shackle: three quarters of a dial, left open at the top right where a hand
  // would be sweeping out of it.
  context.strokeStyle = "#f4b65c";
  context.lineCap = "round";
  context.lineWidth = 22;
  context.beginPath();
  context.arc(centreX, bodyTop - 8, radius, Math.PI * 0.86, Math.PI * 1.92);
  context.stroke();

  // The hand, running from the dial's centre out through the gap.
  context.lineWidth = 15;
  context.strokeStyle = "#ea4d32";
  context.beginPath();
  context.moveTo(centreX, bodyTop - 8);
  context.lineTo(centreX + radius * 0.92, bodyTop - 8 - radius * 0.42);
  context.stroke();

  context.fillStyle = "#f4b65c";
  context.beginPath();
  context.arc(centreX, bodyTop - 8, 13, 0, Math.PI * 2);
  context.fill();

  // Lock body.
  context.fillStyle = "#f4b65c";
  roundRect(context, centreX - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight, 16);
  context.fill();

  context.fillStyle = "#120c06";
  context.beginPath();
  context.arc(centreX, bodyTop + bodyHeight * 0.42, 22, 0, Math.PI * 2);
  context.fill();
  context.fillRect(centreX - 8, bodyTop + bodyHeight * 0.42, 16, 48);

  context.fillStyle = "rgba(244, 182, 92, .95)";
  context.font = "600 40px Tektur, monospace";
  context.textAlign = "center";
  context.letterSpacing = "12px";
  context.fillText("LOCK-IN", centreX, height - 96);

  context.fillStyle = "rgba(172, 146, 118, .8)";
  context.font = "400 20px Tektur, monospace";
  context.letterSpacing = "7px";
  context.fillText("ACCESS / 01", centreX, height - 56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export class Lanyard {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.z = CARD_DEPTH;

    this.points = Array.from({ length: SEGMENTS }, (_, index) => {
      const position = new THREE.Vector3(0, ANCHOR.y - index * SEGMENT_LENGTH, 0);
      return { position, previous: position.clone() };
    });

    const cordGeometry = new THREE.BufferGeometry();
    cordGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.cord = new THREE.Line(
      cordGeometry,
      new THREE.LineBasicMaterial({ color: 0xc4a984, transparent: true, opacity: 0.95 }),
    );
    this.cord.frustumCulled = false;

    this.texture = face();
    this.card = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, side: THREE.DoubleSide }),
    );
    this.card.frustumCulled = false;

    this.group.add(this.cord, this.card);
    this.opacity = 1;
    this.dragging = false;
    this.pointer = new THREE.Vector3();
  }

  get tail() {
    return this.points[this.points.length - 1];
  }

  /**
   * Verlet: position carries its own velocity as the gap to where it was last
   * frame, so a constraint pass is all that holds the rope together.
   */
  step(dt) {
    const clamped = Math.min(dt, 1 / 45);
    for (let index = 1; index < this.points.length; index += 1) {
      const point = this.points[index];
      const velocity = point.position.clone().sub(point.previous).multiplyScalar(DAMPING);
      point.previous.copy(point.position);
      point.position.add(velocity).addScaledVector(GRAVITY, clamped * clamped);
    }

    this.points[0].position.copy(ANCHOR);
    if (this.dragging) this.tail.position.copy(this.pointer);

    for (let pass = 0; pass < RELAX; pass += 1) {
      for (let index = 0; index < this.points.length - 1; index += 1) {
        const a = this.points[index];
        const b = this.points[index + 1];
        const delta = b.position.clone().sub(a.position);
        const distance = delta.length() || 1e-6;
        const correction = delta.multiplyScalar((distance - SEGMENT_LENGTH) / distance / 2);
        if (index > 0) a.position.add(correction);
        else a.position.copy(ANCHOR);
        if (!(this.dragging && index + 1 === this.points.length - 1)) {
          b.position.sub(correction);
        }
      }
      this.points[0].position.copy(ANCHOR);
      if (this.dragging) this.tail.position.copy(this.pointer);
    }

    const positions = this.cord.geometry.attributes.position;
    for (let index = 0; index < this.points.length; index += 1) {
      const { x, y, z } = this.points[index].position;
      positions.setXYZ(index, x, y, z);
    }
    positions.needsUpdate = true;

    // The card hangs off the last link and leans into whichever way it swings.
    const tail = this.tail.position;
    const lean = tail.clone().sub(this.points[this.points.length - 2].position);
    this.card.position.set(tail.x, tail.y - CARD_HEIGHT / 2, tail.z);
    this.card.rotation.z = Math.atan2(-lean.x, -lean.y) * 0.9;
    this.card.rotation.y = THREE.MathUtils.clamp(-lean.x * 1.2, -0.7, 0.7);
  }

  setOpacity(value) {
    this.opacity = value;
    this.card.material.opacity = value;
    this.cord.material.opacity = value * 0.85;
    this.group.visible = value > 0.01;
  }

  dispose() {
    this.texture.dispose();
    this.card.geometry.dispose();
    this.card.material.dispose();
    this.cord.geometry.dispose();
    this.cord.material.dispose();
  }
}

export const LANYARD_DEPTH = CARD_DEPTH;
