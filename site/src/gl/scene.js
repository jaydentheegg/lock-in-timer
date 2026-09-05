import * as THREE from "three";
import { ParticleField } from "./particles.js";
import { Gates } from "./gates.js";
import { EnterParticles } from "./enter.js";
import { VirtualScroll, SECTIONS, CAMERA_Z, inverseLerp } from "../scroll.js";
import { TargetCursor } from "../target-cursor.js";
import { Spiral } from "../spiral.js";
import { ClockParticles } from "./clock-particles.js";

const FOV = 32;
const DPR_CAP = 2;

// How long the scene takes to fold away when the timer starts, and to come
// back when it stops. Asymmetric on purpose: committing should feel decisive,
// returning should feel like being let out.
const LOCK_IN_MS = 900;
const LOCK_OUT_MS = 600;

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// The deeper the session, the less there is to look at. The depth field is what
// gives that emptiness a distance.
const FOG_BY_PHASE = { link: 0.012, trace: 0.015, deep: 0.022, null: 0.027, lock: 0.032 };
// globals.css used to drop --scene-opacity to nothing from DEEP onward. The
// spiral takes that over: the deeper the session, the less of the city is left.
const SPIRAL_DIM_BY_PHASE = { link: 0, trace: 0.15, deep: 0.7, null: 0.85, lock: 1 };
const PARTICLE_OPACITY_BY_PHASE = { link: 0.26, trace: 0.3, deep: 0.4, null: 0.44, lock: 0.5 };

export class Scene {
  constructor(canvas, page, video) {
    this.page = page;
    // Transparent: the spiral is a DOM layer behind the canvas now, so the
    // scene has to let it through.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
    this.camera.position.z = CAMERA_Z.start;

    this.spiral = new Spiral(page, import.meta.env.BASE_URL);

    this.gates = new Gates();
    this.scene.add(this.gates.group);

    this.enter = new EnterParticles();
    this.scene.add(this.enter.group);

    this.scroll = new VirtualScroll();
    this.cursor = new TargetCursor();
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();

    // 0 while exploring, 1 once the timer is running.
    this.lock = 0;
    this.lockTarget = 0;

    this.particles = new ParticleField();
    this.scene.add(this.particles.points);

    // Split-flap mechanism, particle glyphs, no cards. It hangs off the camera
    // so the descent moves the world past the number rather than the number
    // through the world.
    this.clockElement = page.querySelector(".focus-clock");
    this.clock = new ClockParticles(this.clockElement);
    this.camera.add(this.clock.points);
    this.scene.add(this.camera);

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
    this.onClick = (event) => {
      if (this.lockTarget === 1 || !this.enter.group.visible) return;
      this.pointerNdc.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      );
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      if (this.raycaster.intersectObject(this.enter.hit, false).length === 0) return;
      this.page.querySelector(".play-button")?.click();
    };
    this.onResize = () => this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("click", this.onClick);
    this.scroll.attach();
    this.cursor.attach();
    this.resize();
    this.frameClock.start();
    this.tick();

    // Sampling has to wait for the display face, or the word is rasterised in
    // the fallback font and every glyph shifts when Tektur arrives.
    void document.fonts.ready.then(() => {
      this.clock.measure(this.camera);
      this.clock.set(this.readClockText(), { full: true });
      this.enter.build();
      this.enter.layout(this.camera, this.page);
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
    this.fogTarget = FOG_BY_PHASE[phase] ?? 0.012;
    this.spiralDimTarget = SPIRAL_DIM_BY_PHASE[phase] ?? 0;
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
    this.enter.setPixelRatio(this.pixelRatio);
    this.enter.layout(this.camera, this.page);
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

  /** Camera depth for a point in the descent. */
  cameraZFor(progress) {
    const mix = (a, b, t) => a + (b - a) * t;
    if (progress < SECTIONS.phases[0]) {
      return mix(CAMERA_Z.start, CAMERA_Z.phasesIn, inverseLerp(...SECTIONS.clock, progress));
    }
    if (progress < SECTIONS.enter[0]) {
      return mix(CAMERA_Z.phasesIn, CAMERA_Z.phasesOut, inverseLerp(...SECTIONS.phases, progress));
    }
    return mix(CAMERA_Z.phasesOut, CAMERA_Z.end, inverseLerp(...SECTIONS.enter, progress));
  }

  /**
   * Site mode while the timer is stopped, instrument mode while it runs. The
   * engine already publishes that on the page; this only has to follow it, and
   * the two durations are what make the boundary feel like a decision.
   */
  syncMode(dt) {
    this.lockTarget = this.page.dataset.running === "true" ? 1 : 0;
    const duration = (this.lockTarget === 1 ? LOCK_IN_MS : LOCK_OUT_MS) / 1000;
    const step = dt / duration;
    this.lock =
      this.lockTarget > this.lock
        ? Math.min(1, this.lock + step)
        : Math.max(0, this.lock - step);

    // Locked means the wheel is swallowed. Coming back out is deliberate: a
    // paused session needs a real upward flick, which is also what R does.
    this.scroll.setEnabled(this.lock < 0.001);
    if (this.lockTarget === 1) this.scroll.rewind();
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
    const raw = this.frameClock.getDelta();
    const dt = Number.isFinite(raw) ? Math.min(raw, 0.05) : 0;
    this.measure(dt);
    this.syncPhase();
    this.syncMode(dt);

    const progress = this.scroll.update(dt);
    const folded = easeInOut(this.lock);
    const worldOpacity = 1 - folded;

    // The world slides past a camera that is pulled back to the top as the
    // session takes over. The clock sits in the interface's own layout, so none
    // of this moves it.
    this.camera.position.z =
      this.cameraZFor(progress) * worldOpacity + CAMERA_Z.start * folded;

    // The surface recedes as the descent goes on, so the gates are not
    this.gates.opacity = worldOpacity;
    this.gates.update(dt, this.camera.position.z);
    const arrival = inverseLerp(...SECTIONS.enter, progress) * worldOpacity;
    this.enter.update(dt, arrival, worldOpacity);

    // The console belongs to the bottom of the descent, where LOCK-IN is.
    const consoleIn = this.lock > 0.5 ? 1 : arrival;
    this.page.style.setProperty("--console-in", consoleIn.toFixed(3));
    this.page.style.setProperty("--console-events", consoleIn > 0.6 ? "auto" : "none");

    // Squares up around LOCK-IN when the pointer is over it; orbits otherwise.
    const rect = this.enter.screenRect(this.camera, window.innerWidth, window.innerHeight);
    const overEnter =
      rect &&
      this.cursor.pointer.x >= rect.left &&
      this.cursor.pointer.x <= rect.right &&
      this.cursor.pointer.y >= rect.top &&
      this.cursor.pointer.y <= rect.bottom;
    this.cursor.setTarget(overEnter ? rect : null);
    this.cursor.update(dt);

    // Lets globals.css stand the HUD down while the reader is inside the scene.
    this.page.style.setProperty("--explore", (progress * worldOpacity).toFixed(4));

    // Travel tears the clock, the way pointer speed does on the reference site.
    this.clock.setTear(Math.min(2, Math.abs(this.scroll.velocity) * 3) * worldOpacity);

    const uniforms = this.particles.material.uniforms;
    if (this.fogTarget !== undefined) this.approach(uniforms.uFogDensity, this.fogTarget, dt);
    if (this.particleTarget !== undefined) this.approach(uniforms.uOpacity, this.particleTarget, dt);

    // The clock arrives with the session. It re-forms from scatter the first
    // time the timer starts, and again after a reset.
    const started = this.page.dataset.started === "true";
    if (started !== this.started) {
      this.started = started;
      if (started) this.clock.set(this.readClockText(), { full: true });
    }
    this.clock.setPresence(started ? 1 : 0, dt);
    this.clock.set(this.readClockText());
    this.clock.update(dt, this.pixelRatio);

    this.particles.update(dt, {
      mouse: this.mouse,
      pixelRatio: this.pixelRatio,
      cameraZ: this.camera.position.z,
    });

    this.spiralDim = (this.spiralDim ?? 0) +
      ((this.spiralDimTarget ?? 0) - (this.spiralDim ?? 0)) * (1 - Math.exp(-dt * 0.6));
    this.spiral.update(dt, progress, Math.max(folded, this.spiralDim));
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.running = false;
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("click", this.onClick);
    this.scroll.detach();
    this.cursor.dispose();
    this.spiral.dispose();
    this.particles.dispose();
    this.clock.dispose();
    this.gates.dispose();
    this.enter.dispose();
    this.renderer.dispose();
  }
}
