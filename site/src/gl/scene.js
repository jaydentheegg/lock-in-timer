import * as THREE from "three";
import { ParticleField } from "./particles.js";
import { Backdrop } from "./backdrop.js";
import { ClockParticles } from "./clock-particles.js";
import { RippleField } from "./ripple.js";

const FOV = 32;
const CAMERA_Z = 6.2;
const DPR_CAP = 2;

// globals.css drops --scene-opacity to 0 from DEEP onward and the clock is
// designed to carry itself on black from there. These match it rather than
// reinterpreting it; the depth field is what gives that emptiness a distance.
const VIDEO_GAIN_BY_PHASE = { link: 1, trace: 1, deep: 0, null: 0, lock: 0 };
const FOG_BY_PHASE = { link: 0.012, trace: 0.015, deep: 0.022, null: 0.027, lock: 0.032 };
const PARTICLE_OPACITY_BY_PHASE = { link: 0.26, trace: 0.3, deep: 0.4, null: 0.44, lock: 0.5 };

export class Scene {
  constructor(canvas, page, video) {
    this.page = page;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
    this.camera.position.z = CAMERA_Z;

    this.backdrop = new Backdrop(video, page.querySelector("video")?.getAttribute("poster"));
    this.scene.add(this.backdrop.mesh);

    this.ripple = new RippleField();
    this.backdrop.setRipple(this.ripple.texture, new THREE.Vector2(1, 1));

    this.particles = new ParticleField();
    this.scene.add(this.particles.points);

    // The clock is drawn as particles, so it hangs off the camera rather than
    // the scene — later phases move the world past it, never the number.
    this.clock = new ClockParticles(page.querySelector(".focus-clock"));
    this.camera.add(this.clock.points);
    this.scene.add(this.camera);

    this.clockElement = page.querySelector(".focus-clock");
    this.mouse = new THREE.Vector2(2, 2);
    this.frameClock = new THREE.Clock();
    this.running = false;
    this.phase = "";

    // A frame-time sample, so the field can shed points on a slow GPU without
    // ever saying so.
    this.frameSamples = [];
    this.degraded = false;

    this.onPointerMove = (event) => {
      this.mouse.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      );
      this.clock.setPointer(event.clientX, event.clientY);
    };
    this.onPointerLeave = () => {
      this.mouse.set(2, 2);
      this.clock.clearPointer();
    };
    this.onResize = () => this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerleave", this.onPointerLeave);
    this.ripple.attach();
    this.resize();
    this.frameClock.start();
    this.tick();

    // Sampling has to wait for the display face, or the first form is drawn in
    // the fallback font and every glyph shifts when Tektur arrives.
    void document.fonts.ready.then(() => {
      this.clock.measure(this.camera);
      this.clock.set(this.readClockText(), { full: true });
    });
  }

  readClockText() {
    return this.clockElement.dataset.clock || this.clockElement.textContent.trim() || "00:00";
  }

  // State is read off the page rather than pushed in, so the engine needs no
  // knowledge that a renderer exists.
  syncPhase() {
    const phase = this.page.dataset.phase || "link";
    if (phase === this.phase) return;
    this.phase = phase;
    this.backdrop.setGain(VIDEO_GAIN_BY_PHASE[phase] ?? 1);
    this.fogTarget = FOG_BY_PHASE[phase] ?? 0.012;
    this.particleTarget = PARTICLE_OPACITY_BY_PHASE[phase] ?? 0.26;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.degraded ? 1 : DPR_CAP);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.ripple.resize(width, height, this.pixelRatio);
    this.backdrop.setRipple(this.ripple.texture, this.ripple.texel);
    this.backdrop.resize(this.camera);
    if (this.clock.unit) {
      this.clock.measure(this.camera);
      this.clock.set(this.readClockText(), { full: true });
    }
  }

  measure(dt) {
    if (this.degraded || this.frameSamples.length >= 120) return;
    this.frameSamples.push(dt * 1000);
    if (this.frameSamples.length < 120) return;
    const sorted = [...this.frameSamples].sort((a, b) => a - b);
    if (sorted[60] > 20) {
      this.degraded = true;
      this.particles.setDensity(0.5);
      this.resize();
    }
  }

  approach(uniform, target, dt, rate = 0.45) {
    uniform.value += (target - uniform.value) * (1 - Math.exp(-dt * rate));
  }

  tick = () => {
    if (!this.running) return;
    requestAnimationFrame(this.tick);

    // No document.hidden guard: browsers already stop firing rAF for a hidden
    // tab, and embedded contexts that report hidden while still compositing
    // would otherwise render nothing at all.
    const dt = Math.min(this.frameClock.getDelta(), 0.05);
    this.measure(dt);
    this.syncPhase();

    const uniforms = this.particles.material.uniforms;
    if (this.fogTarget !== undefined) this.approach(uniforms.uFogDensity, this.fogTarget, dt);
    if (this.particleTarget !== undefined) this.approach(uniforms.uOpacity, this.particleTarget, dt);

    // A reset winds the clock back to 00:00; that deserves the full reform.
    const text = this.readClockText();
    this.clock.set(text, { full: text === "00:00" && this.clock.text !== "" });

    this.backdrop.update(dt);
    this.particles.update(dt, { mouse: this.mouse, pixelRatio: this.pixelRatio });
    this.clock.update(dt, this.pixelRatio);

    // The displacement field first, into its own target; the backdrop samples
    // it. The pass skips itself entirely once every ripple has died.
    this.ripple.update(dt);
    this.ripple.render(this.renderer);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.running = false;
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerleave", this.onPointerLeave);
    this.particles.dispose();
    this.clock.dispose();
    this.ripple.dispose();
    this.backdrop.dispose();
    this.renderer.dispose();
  }
}
