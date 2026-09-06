import * as THREE from "three";

/**
 * The bottom of the descent: one word, made of the same stuff as the clock.
 *
 * Drawn as particles rather than a texture on a plate, and with no frame around
 * it — the gather is what says "this is a control", so a border would only be
 * describing what the motion already does.
 */
const LABEL = "LOCK-IN";
const DEPTH = -15;
// The camera's resting depth at the bottom of the descent. Sizing against a
// fixed distance keeps the word the same size on screen however it got there.
const READ_FROM = -11.5;
const FONT_SIZE = 118;
const CURSOR_PADDING = 8;
const STEP = 3;
const SCATTER = 0.5; // as a share of the word's width
const PARTICLE_SIZE = 2.2;

const VERT = /* glsl */ `
  in vec3 position;
  in vec3 aFrom;
  in vec2 aSeed;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uReveal;
  uniform float uStagger;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  out float vSeed;

  void main() {
    float span = max(1.0 - uStagger, 0.001);
    float t = clamp((uReveal - aSeed.x * uStagger) / span, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);

    vec3 local = mix(aFrom, position, t);
    local.xy += vec2(
      sin(uTime * 0.7 + aSeed.x * 6.283),
      cos(uTime * 0.6 + aSeed.y * 6.283)
    ) * 0.004;

    vSeed = aSeed.y;
    vec4 view = modelViewMatrix * vec4(local, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (uSize * uPixelRatio * 3.5) / max(-view.z, 0.5);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  in float vSeed;
  out vec4 fragColor;

  uniform vec3 uColor;
  uniform vec3 uHighlight;
  uniform float uOpacity;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float disc = 1.0 - smoothstep(0.18, 0.5, length(offset));
    if (disc < 0.01) discard;
    fragColor = vec4(mix(uColor, uHighlight, vSeed * vSeed), disc * uOpacity);
  }
`;

export class EnterParticles {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, DEPTH);
    this.reveal = 0;

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uReveal: { value: 0 },
        uStagger: { value: 0.45 },
        uTime: { value: 0 },
        uSize: { value: PARTICLE_SIZE },
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color(0xf4b65c) },
        uHighlight: { value: new THREE.Color(0xea4d32) },
        uOpacity: { value: 0 },
      },
    });

    // Points are awkward to raycast; an invisible quad over the same area is
    // what the click actually tests against.
    // Unit-sized; layout() scales the whole group, so this tracks the word.
    this.hit = new THREE.Mesh(
      new THREE.PlaneGeometry(1.16, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.group.add(this.hit);
    this.group.visible = false;
  }

  /** Needs the display face, so this waits for document.fonts.ready. */
  build() {
    if (this.points) return;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const font = `600 ${FONT_SIZE}px Tektur, "PingFang SC", sans-serif`;
    const tracking = `${Math.round(FONT_SIZE * 0.1)}px`;

    context.font = font;
    context.letterSpacing = tracking;
    const metrics = context.measureText(LABEL);
    const width = Math.ceil(metrics.width) + 24;
    const height = Math.ceil(FONT_SIZE * 1.5);

    canvas.width = width;
    canvas.height = height;
    // Sizing the canvas resets the context, so the font is set again.
    context.font = font;
    context.letterSpacing = tracking;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    context.fillText(LABEL, width / 2, height / 2);

    const pixels = context.getImageData(0, 0, width, height).data;
    const sampled = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < height; y += STEP) {
      for (let x = 0; x < width; x += STEP) {
        if (pixels[(y * width + x) * 4 + 3] < 128) continue;
        sampled.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // Normalised to the ink's own box, one unit wide: the group's scale then
    // sets the size and the word is centred by construction, whatever padding
    // the rasteriser left around it.
    const inkWidth = Math.max(1, maxX - minX);
    const inkHeight = Math.max(1, maxY - minY);
    this.aspect = inkHeight / inkWidth;
    const centreX = (minX + maxX) / 2;
    const centreY = (minY + maxY) / 2;

    const targets = [];
    for (let i = 0; i < sampled.length; i += 2) {
      targets.push((sampled[i] - centreX) / inkWidth, (centreY - sampled[i + 1]) / inkWidth, 0);
    }

    const count = targets.length / 3;
    const position = new Float32Array(targets);
    const from = new Float32Array(count * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = (0.3 + Math.random() * 0.7) * SCATTER;
      from[i * 3] = position[i * 3] + Math.cos(angle) * radius;
      from[i * 3 + 1] = position[i * 3 + 1] + Math.sin(angle) * radius;
      from[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
      seed[i * 2] = Math.random();
      seed[i * 2 + 1] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 2));

    this.points = new THREE.Points(geometry, this.material);
    // Shrink only the visible ink; layout and the original hit area stay intact.
    this.points.scale.setScalar(.7);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  /** Keep the entry word at the visual centre on every viewport. */
  layout(camera) {
    if (!this.points) return;
    const height = window.innerHeight;
    const distance = Math.abs(DEPTH - READ_FROM);
    const unit = (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / height;
    const bandHeight = height * 0.42 * unit;
    const maxWidth = window.innerWidth * 0.62 * unit;
    const worldWidth = Math.min(maxWidth, bandHeight / Math.max(this.aspect, 0.001));

    this.group.scale.setScalar(worldWidth);
    this.group.position.y = 0;
    this.hit.scale.set(1, Math.max(this.aspect * 1.5, 0.5), 1);
  }

  /** `arrival` is how far into the last section the camera has come, 0..1. */
  update(dt, arrival, worldOpacity) {
    this.reveal += (arrival - this.reveal) * (1 - Math.exp(-dt * 5));
    const eased = this.reveal * this.reveal * (3 - 2 * this.reveal);

    this.material.uniforms.uTime.value += dt;
    this.material.uniforms.uReveal.value = eased;
    this.material.uniforms.uOpacity.value = eased * worldOpacity * 0.95;
    this.group.visible = Boolean(this.points) && eased * worldOpacity > 0.02;
  }

  setPixelRatio(pixelRatio) {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  /**
   * Screen rectangle of the hit area, for the target cursor to square up
   * around. Null when the word is not on screen.
   */
  screenRect(camera, width, height) {
    if (!this.group.visible || !this.points) return null;
    // The hit mesh intentionally stays generous for touch and click. The
    // cursor frame follows only the visible ink, so it hugs LOCK-IN instead of
    // revealing that larger invisible target.
    const halfWidth = 0.5;
    const halfHeight = this.aspect / 2;
    this.points.updateWorldMatrix(true, false);
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const corner = new THREE.Vector3(sx * halfWidth, sy * halfHeight, 0);
      this.points.localToWorld(corner);
      corner.project(camera);
      const x = (corner.x * 0.5 + 0.5) * width;
      const y = (-corner.y * 0.5 + 0.5) * height;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return {
      left: left - CURSOR_PADDING,
      top: top - CURSOR_PADDING,
      right: right + CURSOR_PADDING,
      bottom: bottom + CURSOR_PADDING,
    };
  }

  dispose() {
    this.points?.geometry.dispose();
    this.hit.geometry.dispose();
    this.hit.material.dispose();
    this.material.dispose();
  }
}
