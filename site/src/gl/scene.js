import * as THREE from "three";
import { Clock } from "./clock.js";
import { ParticleField } from "./particles.js";
import { Backdrop } from "./backdrop.js";

const FOV = 32;
const CAMERA_Z = 6.2;
const DPR_CAP = 2;

// Phase 1 has no scroll yet, so the camera is parked. The per-phase values are
// already split out because Phase 2 animates between them.
const VIDEO_GAIN_BY_PHASE = { link: 1, trace: 0.7, deep: 0.34, null: 0.18, lock: 0.1 };
const FOG_BY_PHASE = { link: 0.012, trace: 0.015, deep: 0.02, null: 0.026, lock: 0.03 };

export class Scene {
  constructor(canvas, video, posterUrl) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x06080a, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
    this.camera.position.z = CAMERA_Z;
    this.scene.add(this.camera);

    this.backdrop = new Backdrop(video, posterUrl);
    this.scene.add(this.backdrop.mesh);

    this.particles = new ParticleField();
    this.scene.add(this.particles.points);

    this.mouse = new THREE.Vector2(2, 2);
    this.clock = null;
    this.frameClock = new THREE.Clock();
    this.running = false;
    this.instrumentMode = false;

    // A frame-time sample so the field can shed points on a slow GPU without
    // ever telling the user about it.
    this.frameSamples = [];
    this.degraded = false;

    this.onPointerMove = (event) => {
      this.mouse.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      );
    };
    this.onPointerLeave = () => this.mouse.set(2, 2);
    this.onResize = () => this.resize();
  }

  async load() {
    this.clock = await Clock.load();
    this.camera.add(this.clock.group);
    this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerleave", this.onPointerLeave);
    this.frameClock.start();
    this.tick();
  }

  setClock(text) {
    this.clock?.set(text);
  }

  setPhase(phase) {
    this.clock?.setPhase(phase);
    this.backdrop.setGain(VIDEO_GAIN_BY_PHASE[phase] ?? 1);
    this.fogTarget = FOG_BY_PHASE[phase] ?? 0.012;
  }

  // Instrument mode is the whole point of the two-mode split: once the timer is
  // running the scene has to get out of the way and stop costing GPU.
  setInstrumentMode(on) {
    if (this.instrumentMode === on) return;
    this.instrumentMode = on;
    this.particles.setDensity(on ? (this.degraded ? 0.08 : 0.17) : this.degraded ? 0.5 : 1);
    this.particles.material.uniforms.uOpacity.value = on ? 0.18 : 0.3;
    this.particles.material.uniforms.uRepelForce.value = on ? 0.02 : 0.06;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.degraded ? 1 : DPR_CAP);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.backdrop.resize(this.camera);
    this.clock?.resize(this.camera);
  }

  measure(dt) {
    if (this.degraded || this.frameSamples.length >= 120) return;
    this.frameSamples.push(dt * 1000);
    if (this.frameSamples.length < 120) return;
    const sorted = [...this.frameSamples].sort((a, b) => a - b);
    if (sorted[60] > 20) {
      this.degraded = true;
      this.particles.setDensity(this.instrumentMode ? 0.08 : 0.5);
      this.resize();
    }
  }

  tick = () => {
    if (!this.running) return;
    requestAnimationFrame(this.tick);

    // No document.hidden guard here on purpose: browsers already stop firing
    // rAF for a hidden tab, and embedded contexts that report hidden while
    // still compositing would otherwise render nothing at all. Timing is
    // wall-clock, so a throttled tab just costs a stale frame.
    const dt = Math.min(this.frameClock.getDelta(), 0.05);
    this.onFrame?.(dt);
    this.measure(dt);

    this.backdrop.update(dt);
    this.particles.update(dt, { mouse: this.mouse, pixelRatio: this.pixelRatio });
    if (this.fogTarget !== undefined) {
      const uniform = this.particles.material.uniforms.uFogDensity;
      uniform.value += (this.fogTarget - uniform.value) * (1 - Math.exp(-dt * 0.45));
    }
    this.clock?.update(dt);

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.running = false;
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerleave", this.onPointerLeave);
    this.clock?.dispose();
    this.particles.dispose();
    this.backdrop.dispose();
    this.renderer.dispose();
  }
}
