import * as THREE from "three";

/**
 * The clock: split-flap mechanism, particle glyphs.
 *
 * Glyphs are rasterised to an offscreen canvas and sampled on a fixed grid, so
 * every digit is a cloud of points rather than type. What those points then do
 * is the split-flap board's job: on a change the outgoing digit's top half
 * hinges down about the character's centre line, and at the halfway point the
 * incoming digit's bottom half hinges up to meet it. There are no cards — the
 * particles are the leaves, and edge-on they collapse to a line the way a real
 * flap does.
 *
 * Two details carry the mechanism. Each character owns a fixed slot range and
 * is sampled on its own tabular cell, so a digit that did not change resolves
 * to identical targets and never moves. And a change walks the digit wheel one
 * position at a time — 3 to 4 is one flap, 9 to 0 is nine — because that is
 * what a real board does, and a single jump would read as a crossfade.
 */
const DIGITS = "0123456789";
const SLOTS_PER_CELL = 1400;
const DENSITY = 3; // preferred pixel sampling step, in CSS px
const PARTICLE_SIZE = 2.2;
const SCATTER = 190;
const REPEL_RADIUS = 120;
const REPEL_STRENGTH = 42;
const IDLE_DRIFT = 0.8;
const CAMERA_DISTANCE = 2.4;

const GATHER_MS = { full: 1600 };
const STAGGER_FRACTION = { full: 0.42 };
const FLIP_MS = 95;

const VERT = /* glsl */ `
  in vec3 position;   // the incoming glyph, in world units on the clock plane
  in vec3 aFrom;      // the outgoing glyph
  in vec2 aSeed;
  in float aActive;
  in float aCell;     // which character this point belongs to
  in vec2 aHalf;      // +1 top, -1 bottom, for the outgoing and incoming glyph

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uFlip[5];    // per-character flap progress, 0..1
  uniform float uHinge[5];   // the character's centre line, in world units
  uniform float uMorph;      // whole-board gather, for the first form and reset
  uniform float uStagger;
  uniform float uTime;
  uniform float uDrift;
  uniform vec2 uPointer;
  uniform float uRepelRadius;
  uniform float uRepelStrength;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uTear;

  out float vSeed;
  out float vActive;

  const float HALF_PI = 1.5707963;

  void main() {
    int cell = int(aCell + 0.5);
    float flip = uFlip[cell];
    float hinge = uHinge[cell];

    // Past halfway the point belongs to the incoming glyph; before it, to the
    // outgoing one. The swap is invisible because whichever half is moving is
    // edge-on at exactly that moment.
    bool second = flip >= 0.5;
    vec3 leaf = second ? position : aFrom;
    float side = second ? aHalf.y : aHalf.x;

    // Only the half that is actually swinging rotates: the outgoing top folds
    // down, then the incoming bottom folds up.
    bool swinging = second ? (side < 0.0) : (side > 0.0);
    float angle = second ? (1.0 - (flip - 0.5) * 2.0) * HALF_PI : -flip * 2.0 * HALF_PI;
    if (!swinging) angle = 0.0;

    float dy = leaf.y - hinge;
    vec3 local = vec3(leaf.x, hinge + dy * cos(angle), leaf.z + dy * sin(angle));

    // The whole-board gather, used for the first form and after a reset.
    float span = max(1.0 - uStagger, 0.001);
    float t = clamp((uMorph - aSeed.x * uStagger) / span, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    local = mix(aFrom, local, t);

    // Resting motion, so a formed clock is never completely dead.
    local.xy += vec2(
      sin(uTime * 0.8 + aSeed.x * 6.283),
      cos(uTime * 0.7 + aSeed.y * 6.283)
    ) * uDrift;

    // Travel smears the field sideways — the particle equivalent of the RGB
    // split the reference site drives from pointer speed.
    local.x += (aSeed.y - 0.5) * uTear;

    vec2 away = local.xy - uPointer;
    float distance = length(away);
    float falloff = max(0.0, 1.0 - distance / uRepelRadius);
    local.xy += normalize(away + 1e-6) * falloff * falloff * uRepelStrength;

    vSeed = aSeed.y;
    vActive = aActive;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
    gl_PointSize = uSize * uPixelRatio;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  in float vSeed;
  in float vActive;
  out vec4 fragColor;

  uniform vec3 uColor;
  uniform vec3 uHighlight;
  uniform float uOpacity;
  uniform float uPresence;

  void main() {
    if (vActive < 0.5 || uPresence < 0.01) discard;
    vec2 offset = gl_PointCoord - 0.5;
    float disc = 1.0 - smoothstep(0.18, 0.5, length(offset));
    if (disc < 0.01) discard;
    fragColor = vec4(mix(uColor, uHighlight, vSeed * vSeed), disc * uOpacity * uPresence);
  }
`;

export class ClockParticles {
  constructor(clockElement) {
    this.element = clockElement;
    this.text = "";
    this.morph = 1;
    this.morphDuration = GATHER_MS.full / 1000;
    this.pointer = new THREE.Vector2(1e4, 1e4);

    this.sampler = document.createElement("canvas");
    this.samplerContext = this.sampler.getContext("2d", { willReadFrequently: true });

    const slots = SLOTS_PER_CELL * 5;
    this.slots = slots;
    const target = new Float32Array(slots * 3);
    const from = new Float32Array(slots * 3);
    const seed = new Float32Array(slots * 2);
    const active = new Float32Array(slots);
    const cell = new Float32Array(slots);
    const halves = new Float32Array(slots * 2);
    for (let i = 0; i < slots; i += 1) {
      seed[i * 2] = Math.random();
      seed[i * 2 + 1] = Math.random();
      cell[i] = Math.floor(i / SLOTS_PER_CELL);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", withUsage(new THREE.BufferAttribute(target, 3)));
    this.geometry.setAttribute("aFrom", withUsage(new THREE.BufferAttribute(from, 3)));
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 2));
    this.geometry.setAttribute("aActive", withUsage(new THREE.BufferAttribute(active, 1)));
    this.geometry.setAttribute("aCell", new THREE.BufferAttribute(cell, 1));
    this.geometry.setAttribute("aHalf", withUsage(new THREE.BufferAttribute(halves, 2)));

    // One queue per character. A change pushes every intermediate digit, so the
    // wheel is walked rather than jumped.
    this.cells = Array.from({ length: 5 }, () => ({ queue: [], flip: 0, running: false }));

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uFlip: { value: new Float32Array(5) },
        uHinge: { value: new Float32Array(5) },
        uMorph: { value: 1 },
        uStagger: { value: STAGGER_FRACTION.full },
        uTime: { value: 0 },
        uDrift: { value: 0 },
        uPointer: { value: new THREE.Vector2(1e4, 1e4) },
        uRepelRadius: { value: 0 },
        uRepelStrength: { value: 0 },
        uSize: { value: PARTICLE_SIZE },
        uPixelRatio: { value: 1 },
        uTear: { value: 0 },
        uPresence: { value: 0 },
        uColor: { value: new THREE.Color(0xf4b65c) },
        uHighlight: { value: new THREE.Color(0xea4d32) },
        uOpacity: { value: 0.92 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.position.z = -CAMERA_DISTANCE;
  }

  /** World units per CSS pixel on the clock plane. */
  measure(camera) {
    const viewHeight = 2 * CAMERA_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.unit = viewHeight / window.innerHeight;

    const style = getComputedStyle(this.element);
    const rect = this.element.getBoundingClientRect();
    this.centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.fontSize = Number.parseFloat(style.fontSize) || 100;
    this.font = `${style.fontWeight} ${this.fontSize}px ${style.fontFamily}`;
    this.tracking = Number.parseFloat(style.letterSpacing) || 0;

    const uniforms = this.material.uniforms;
    uniforms.uRepelRadius.value = REPEL_RADIUS * this.unit;
    uniforms.uRepelStrength.value = REPEL_STRENGTH * this.unit;
    uniforms.uDrift.value = IDLE_DRIFT * this.unit;
    uniforms.uSize.value = PARTICLE_SIZE;

    // Every character hinges about the same line: the glyphs are drawn from a
    // shared vertical centre, so one value serves all five.
    const hinge = (window.innerHeight / 2 - this.centre.y) * this.unit;
    this.hinges = new Array(5).fill(hinge);
    uniforms.uHinge.value.fill(hinge);

    this.layout();
  }

  /**
   * Cell geometry, tabular by construction. Canvas 2D cannot ask for tabular
   * figures, so every digit gets the width of the widest one and is centred in
   * it — which is also what keeps a slot's target still when its digit does not
   * change.
   */
  layout() {
    const context = this.samplerContext;
    context.font = this.font;
    const digitWidth = Math.max(
      ...["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
        (digit) => context.measureText(digit).width,
      ),
    );
    const colonWidth = context.measureText(":").width;

    this.cellWidths = [digitWidth, digitWidth, colonWidth, digitWidth, digitWidth];
    this.cellHeight = this.fontSize * 1.25;
    const total =
      this.cellWidths.reduce((sum, width) => sum + width, 0) + this.tracking * 4;

    let cursor = -total / 2;
    this.cellOffsets = this.cellWidths.map((width) => {
      const centre = cursor + width / 2;
      cursor += width + this.tracking;
      return centre;
    });

    this.sampler.width = Math.ceil(Math.max(...this.cellWidths)) + 8;
    this.sampler.height = Math.ceil(this.cellHeight) + 8;
    this.step = this.chooseStep();
    this.text = "";
  }

  /**
   * The preferred 3px step keeps particle density constant in CSS pixels, but
   * the sample count grows with the square of the font size: at the clamp's
   * 290px ceiling a digit wants roughly 1900 samples against a 1400-slot
   * budget. The sampling loop used to simply stop once it ran out of slots,
   * which sheared the bottom off every glyph at wide viewports and when the
   * browser was zoomed out. Widen the step instead, so a glyph is always
   * sampled whole.
   */
  chooseStep() {
    const context = this.samplerContext;
    const { width, height } = this.sampler;
    context.clearRect(0, 0, width, height);
    context.font = this.font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    // 8 is the densest digit, so it sets the budget for every cell.
    context.fillText("8", width / 2, height / 2);

    const pixels = context.getImageData(0, 0, width, height).data;
    let count = 0;
    for (let y = 0; y < height; y += DENSITY) {
      for (let x = 0; x < width; x += DENSITY) {
        if (pixels[(y * width + x) * 4 + 3] >= 128) count += 1;
      }
    }
    if (count <= SLOTS_PER_CELL) return DENSITY;
    return Math.ceil(DENSITY * Math.sqrt(count / SLOTS_PER_CELL));
  }

  /** Samples one character into the world-space targets of its slot range. */
  sampleCell(index, character, target, active, halves) {
    const context = this.samplerContext;
    const { width, height } = this.sampler;
    context.clearRect(0, 0, width, height);
    context.font = this.font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    context.fillText(character, width / 2, height / 2);

    const pixels = context.getImageData(0, 0, width, height).data;
    const base = index * SLOTS_PER_CELL;
    const originX = this.centre.x + this.cellOffsets[index];
    const originY = this.centre.y;
    const step = this.step || DENSITY;
    let slot = 0;

    for (let y = 0; y < height && slot < SLOTS_PER_CELL; y += step) {
      for (let x = 0; x < width && slot < SLOTS_PER_CELL; x += step) {
        if (pixels[(y * width + x) * 4 + 3] < 128) continue;
        const screenX = originX + (x - width / 2);
        const screenY = originY + (y - height / 2);
        const at = (base + slot) * 3;
        target[at] = (screenX - window.innerWidth / 2) * this.unit;
        target[at + 1] = (window.innerHeight / 2 - screenY) * this.unit;
        target[at + 2] = 0;
        active[base + slot] = 1;
        // Which leaf this point rides: above the character's centre line or
        // below it.
        halves[(base + slot) * 2 + 1] = target[at + 1] >= this.hinges[index] ? 1 : -1;
        slot += 1;
      }
    }

    for (let rest = slot; rest < SLOTS_PER_CELL; rest += 1) active[base + rest] = 0;
  }

  /** Steps that walk `from` to `to` around the digit wheel. */
  static route(from, to) {
    const start = DIGITS.indexOf(from);
    const end = DIGITS.indexOf(to);
    if (start < 0 || end < 0) return from === to ? [] : [to];
    const steps = [];
    let index = start;
    while (index !== end) {
      index = (index + 1) % DIGITS.length;
      steps.push(DIGITS[index]);
    }
    return steps;
  }

  /**
   * `full` scatters everything and reforms — used on the first paint and when
   * the session resets. Otherwise only the characters that changed move.
   */
  /**
   * `full` scatters everything and re-forms — the first paint and a reset. A
   * plain tick instead queues one flap per position of the digit wheel.
   */
  set(text, { full = false } = {}) {
    if (!this.unit) return;
    const target = this.geometry.attributes.position.array;
    const from = this.geometry.attributes.aFrom.array;
    const active = this.geometry.attributes.aActive.array;
    const halves = this.geometry.attributes.aHalf.array;
    const seed = this.geometry.attributes.aSeed.array;

    if (full) {
      for (let index = 0; index < 5; index += 1) {
        const character = text[index] ?? " ";
        this.sampleCell(index, character, target, active, halves);
        const base = index * SLOTS_PER_CELL;
        for (let slot = 0; slot < SLOTS_PER_CELL; slot += 1) {
          const at = (base + slot) * 3;
          const angle = seed[(base + slot) * 2] * Math.PI * 2;
          const radius = (0.35 + seed[(base + slot) * 2 + 1] * 0.65) * SCATTER * this.unit;
          from[at] = target[at] + Math.cos(angle) * radius;
          from[at + 1] = target[at + 1] + Math.sin(angle) * radius;
          from[at + 2] = 0;
          halves[(base + slot) * 2] = halves[(base + slot) * 2 + 1];
        }
        const cell = this.cells[index];
        cell.queue.length = 0;
        cell.current = character;
        cell.flip = 1;
        cell.running = false;
        this.material.uniforms.uFlip.value[index] = 1;
      }
      this.uploadAll();
      this.text = text;
      this.morph = 0;
      this.pendingRest = true;
      return;
    }

    if (text === this.text) return;
    this.text = text;
    for (let index = 0; index < 5; index += 1) {
      const cell = this.cells[index];
      const character = text[index] ?? " ";
      // The colon is not on a wheel.
      if (index === 2 || !cell) continue;
      const settled = cell.queue.length ? cell.queue[cell.queue.length - 1] : cell.current;
      if (settled === character) continue;
      cell.queue.push(...ClockParticles.route(settled, character));
    }
  }

  /**
   * Starts one flap. What is on screen becomes the outgoing leaf, and the next
   * digit is sampled into the incoming one.
   */
  beginFlip(index, next) {
    const target = this.geometry.attributes.position.array;
    const from = this.geometry.attributes.aFrom.array;
    const active = this.geometry.attributes.aActive.array;
    const halves = this.geometry.attributes.aHalf.array;

    const base = index * SLOTS_PER_CELL;
    for (let slot = 0; slot < SLOTS_PER_CELL; slot += 1) {
      const at = (base + slot) * 3;
      from[at] = target[at];
      from[at + 1] = target[at + 1];
      from[at + 2] = target[at + 2];
      halves[(base + slot) * 2] = halves[(base + slot) * 2 + 1];
    }
    this.sampleCell(index, next, target, active, halves);
    this.uploadAll();
  }

  uploadAll() {
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aFrom.needsUpdate = true;
    this.geometry.attributes.aActive.needsUpdate = true;
    this.geometry.attributes.aHalf.needsUpdate = true;
  }

  /**
   * The clock does not exist until the session does. Before LOCK-IN there is
   * nothing to count, and a 00:00 sitting there is a promise the page has not
   * been asked for yet.
   */
  setPresence(target, dt) {
    const uniform = this.material.uniforms.uPresence;
    uniform.value += (target - uniform.value) * (1 - Math.exp(-dt * 3.2));
  }

  /** `amount` is roughly 0..2, in the same units the reference clamps to. */
  setTear(amount) {
    this.tear = Number.isFinite(amount) ? Math.min(2, Math.max(0, amount)) : 0;
  }

  setPointer(clientX, clientY) {
    if (!this.unit) return;
    this.pointer.set(
      (clientX - window.innerWidth / 2) * this.unit,
      (window.innerHeight / 2 - clientY) * this.unit,
    );
  }

  clearPointer() {
    this.pointer.set(1e4, 1e4);
  }

  update(dt, pixelRatio) {
    const uniforms = this.material.uniforms;
    uniforms.uTime.value += dt;
    uniforms.uPixelRatio.value = pixelRatio;
    uniforms.uPointer.value.copy(this.pointer);

    // This feeds gl_Position: one non-finite frame would latch through the
    // smoothing and erase the clock for the rest of the session, so the
    // accumulator is checked rather than trusted.
    const tear = (this.tear ?? 0) * 12 * (this.unit ?? 0);
    if (!Number.isFinite(uniforms.uTear.value)) uniforms.uTear.value = 0;
    const rate = Number.isFinite(dt) ? 1 - Math.exp(-dt * 10) : 1;
    uniforms.uTear.value += (tear - uniforms.uTear.value) * rate;

    if (this.morph < 1) {
      this.morph = Math.min(1, this.morph + dt / (GATHER_MS.full / 1000));
      uniforms.uMorph.value = this.morph;
      // Once gathered, the resting glyph becomes the outgoing leaf, so the
      // first flap after a re-form hinges from the right place.
      if (this.morph >= 1 && this.pendingRest) {
        const target = this.geometry.attributes.position.array;
        this.geometry.attributes.aFrom.array.set(target);
        this.geometry.attributes.aFrom.needsUpdate = true;
        this.pendingRest = false;
      }
    }

    for (let index = 0; index < 5; index += 1) {
      const cell = this.cells[index];
      if (!cell.running && cell.queue.length) {
        const next = cell.queue.shift();
        this.beginFlip(index, next);
        cell.current = next;
        cell.flip = 0;
        cell.running = true;
      }
      if (cell.running) {
        cell.flip = Math.min(1, cell.flip + (dt * 1000) / FLIP_MS);
        if (cell.flip >= 1) cell.running = false;
      }
      uniforms.uFlip.value[index] = cell.flip;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function withUsage(attribute) {
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}
