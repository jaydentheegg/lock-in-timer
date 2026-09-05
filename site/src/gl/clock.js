import * as THREE from "three";
import { MsdfText, loadMsdfFont } from "./msdf-text.js";

// The clock is a child of the camera, not of the scene. Everything else will
// eventually stream past it on scroll; the number never leaves the screen.
const CAMERA_DISTANCE = 2.4;
const WIDTH_RATIO = 0.62;
const HEIGHT_RATIO = 0.30;

const STROKE_BY_PHASE = {
  link: { color: 0xd8dfe7, alpha: 0.24 },
  trace: { color: 0xd8dfe7, alpha: 0.26 },
  deep: { color: 0xe4c98a, alpha: 0.3 },
  null: { color: 0xf2a21d, alpha: 0.36 },
  lock: { color: 0xf2a21d, alpha: 0.55 },
};

export class Clock {
  constructor(font, atlas) {
    this.text = new MsdfText(font, atlas);
    this.group = new THREE.Group();
    this.group.position.set(0, 0, -CAMERA_DISTANCE);
    this.group.add(this.text.mesh);

    this.strokeColor = new THREE.Color(0xd8dfe7);
    this.targetColor = new THREE.Color(0xd8dfe7);
    this.strokeAlpha = 0.24;
    this.targetAlpha = 0.24;

    this.set("00:00");
  }

  static async load() {
    const base = import.meta.env.BASE_URL;
    const { font, atlas } = await loadMsdfFont(`${base}atlas/clock.json`, `${base}atlas/clock.png`);
    return new Clock(font, atlas);
  }

  set(text) {
    this.text.set(text);
    this.layout();
  }

  setPhase(phase) {
    const target = STROKE_BY_PHASE[phase] ?? STROKE_BY_PHASE.link;
    this.targetColor.setHex(target.color);
    this.targetAlpha = target.alpha;
  }

  // Called on resize and whenever the string changes width. Sizing from the
  // frustum keeps the clock the same share of the screen at any aspect, the
  // way the CSS build's clamp(104px, 18vw, 300px) did.
  resize(camera) {
    this.viewHeight = 2 * CAMERA_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.viewWidth = this.viewHeight * camera.aspect;
    this.layout();
  }

  layout() {
    if (!this.viewWidth) return;
    const widthUnits = this.text.textWidth || 1;

    // Width rules in landscape, height in portrait — same intent as the CSS
    // build's clamp(104px, 18vw, 300px).
    const byWidth = (this.viewWidth * WIDTH_RATIO) / widthUnits;
    const byHeight = (this.viewHeight * HEIGHT_RATIO) / this.text.capHeight;
    const scale = Math.min(byWidth, byHeight);

    this.text.mesh.scale.setScalar(scale);
    this.text.mesh.position.y = -this.text.opticalCentre * scale;
  }

  update(dt) {
    // ~2.5s time constant, matching the CSS build's 3s stroke-colour transition.
    const ease = 1 - Math.exp(-dt * 0.45);
    this.strokeColor.lerp(this.targetColor, ease);
    this.strokeAlpha += (this.targetAlpha - this.strokeAlpha) * ease;

    const uniforms = this.text.material.uniforms;
    uniforms.uStrokeColor.value.copy(this.strokeColor);
    uniforms.uOpacity.value = this.strokeAlpha;
  }

  dispose() {
    this.text.dispose();
  }
}
