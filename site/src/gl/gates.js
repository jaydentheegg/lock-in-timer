import * as THREE from "three";
import { GATES } from "../scroll.js";

/**
 * The four phase thresholds, as things you fly through.
 *
 * LINK / TRACE / DEEP / NULL / LOCK are otherwise just numbers in a table at
 * the bottom of the screen. Here each boundary is a ring at a fixed depth with
 * its time cut into it, so scrolling down the session is travelling through it.
 */
// Sized against the frustum, not picked for looks: at four units out a ring
// this wide sits exactly on the frame edge, so it reads as something the
// camera passes through rather than a decal floating in the middle.
const RADIUS = 1.15;
const LABEL_Y = 1.5;
const SEGMENTS = 96;
const TICKS = 24;
const IDLE = 0x4a3722;
const HIT = 0xf4b65c;
const HIT_DECAY = 4.5; // ~200ms to fall away

function ring(radius, segments) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function ticks(radius, count, length) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push(cos * radius, sin * radius, 0);
    points.push(cos * (radius + length), sin * (radius + length), 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

/** One canvas per label; they never change, so this happens once. */
function label(text, sub) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = 512 * scale;
  canvas.height = 128 * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.font = "600 34px Tektur, monospace";
  context.fillStyle = "rgba(244, 182, 92, 0.92)";
  context.letterSpacing = "10px";
  context.fillText(text, 256, 40);

  context.font = "400 20px Tektur, monospace";
  context.fillStyle = "rgba(172, 146, 118, 0.85)";
  context.letterSpacing = "6px";
  context.fillText(sub, 256, 84);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class Gates {
  constructor() {
    this.group = new THREE.Group();
    this.gates = GATES.map((gate) => {
      const holder = new THREE.Group();
      holder.position.z = gate.z;

      const outline = new THREE.Line(ring(RADIUS, SEGMENTS), lineMaterial());
      // A ring geometry drawn as segments comes out dashed, which is the note
      // the rest of the interface's rules are written in.
      const marks = new THREE.LineSegments(ring(RADIUS + 0.12, SEGMENTS), lineMaterial(0.45));
      const spokes = new THREE.LineSegments(ticks(RADIUS, TICKS, 0.08), lineMaterial(0.7));

      const texture = label(gate.code, gate.at);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.42),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          opacity: 0.9,
        }),
      );
      plate.position.y = LABEL_Y;

      holder.add(outline, marks, spokes, plate);
      this.group.add(holder);
      return { ...gate, holder, outline, marks, spokes, plate, texture, flash: 0, passed: false };
    });
  }

  /**
   * A gate flares as the camera crosses its plane. `passed` is latched per
   * crossing so scrubbing back and forth does not machine-gun the flash.
   */
  update(dt, cameraZ) {
    for (const gate of this.gates) {
      const distance = Math.abs(cameraZ - gate.z);
      if (distance < 0.35) {
        if (!gate.passed) {
          gate.flash = 1;
          gate.passed = true;
        }
      } else if (distance > 0.8) {
        gate.passed = false;
      }

      gate.flash *= Math.exp(-dt * HIT_DECAY);

      const colour = gate.outline.material.color;
      colour.setHex(IDLE).lerp(new THREE.Color(HIT), gate.flash);
      gate.marks.material.color.copy(colour);
      gate.spokes.material.color.copy(colour);
      // Only the gate you are actually approaching announces itself. The window
      // used to reach far enough that three labels stacked up the middle of the
      // frame and read as a menu.
      const readable =
        smoothstep(1.6, 3.0, distance) * (1 - smoothstep(4.2, 7.0, distance));
      gate.plate.material.opacity = (0.35 + gate.flash * 0.55) * readable * this.opacity;

      for (const part of [gate.outline, gate.marks, gate.spokes]) {
        part.material.opacity = (0.85 + gate.flash * 0.15) * this.opacity;
      }
    }
  }

  set opacity(value) {
    this._opacity = value;
    this.group.visible = value > 0.01;
  }

  get opacity() {
    return this._opacity ?? 1;
  }

  dispose() {
    for (const gate of this.gates) {
      gate.texture.dispose();
      for (const part of [gate.outline, gate.marks, gate.spokes, gate.plate]) {
        part.geometry.dispose();
        part.material.dispose();
      }
    }
  }
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lineMaterial(opacity = 1) {
  return new THREE.LineBasicMaterial({
    color: IDLE,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}
