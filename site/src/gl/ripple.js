import * as THREE from "three";

/**
 * The pointer ripple field.
 *
 * Ported from the React Bits RippleDistortion component, with one change of
 * substance: that component distorts a still image inside its own ogl canvas,
 * and this build already has the footage on a plane in the three.js scene. So
 * only the displacement pass lives here — the composite happens inside the
 * backdrop shader, which means the ripples disturb the live video rather than
 * a photograph, and no second canvas or renderer is involved.
 */
const MAX_WAVES = 100;
const QUALITY_SCALE = { low: 0.4, medium: 0.7, high: 1 };
const START_SCALE = 1.5;
const LIFE_CONSTANT = Math.log(500);

const VERT = /* glsl */ `
  precision highp float;

  attribute vec2 position;
  attribute vec2 uv;
  attribute vec2 iOffset;
  attribute vec2 iScale;
  attribute float iOpacity;

  varying vec2 vUv;
  varying float vOpacity;

  void main() {
    vUv = uv;
    vOpacity = iOpacity;
    gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying float vOpacity;

  uniform float uRings;

  const float PI = 3.141592653589793;
  const float EDGE = 0.006737947;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = dot(p, p);
    if (r > 1.0) discard;

    float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);
    brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);

    gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);
  }
`;

export class RippleField {
  constructor({
    brushSize = 150,
    spread = 5,
    fade = 3,
    spacing = 26,
    rings = 4,
    quality = "low",
    clickStrength = 2,
  } = {}) {
    Object.assign(this, { brushSize, spread, fade, spacing, clickStrength });
    this.quality = QUALITY_SCALE[quality] ?? QUALITY_SCALE.low;
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

    this.offsets = new Float32Array(MAX_WAVES * 2);
    this.scales = new Float32Array(MAX_WAVES * 2);
    this.opacities = new Float32Array(MAX_WAVES);
    this.waves = Array.from({ length: MAX_WAVES }, () => ({
      x: 0,
      y: 0,
      scale: START_SCALE,
      target: START_SCALE,
      size: 1,
      opacity: 0,
    }));
    this.next = 0;
    this.live = 0;
    this.previous = { x: 0, y: 0 };

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        2,
      ),
    );
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), 2),
    );
    geometry.setAttribute("iOffset", dynamic(new THREE.InstancedBufferAttribute(this.offsets, 2)));
    geometry.setAttribute("iScale", dynamic(new THREE.InstancedBufferAttribute(this.scales, 2)));
    geometry.setAttribute(
      "iOpacity",
      dynamic(new THREE.InstancedBufferAttribute(this.opacities, 1)),
    );
    geometry.instanceCount = MAX_WAVES;
    this.geometry = geometry;

    this.material = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uRings: { value: rings } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;

    // The wave shader writes clip space directly, so the camera is a formality.
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.target = new THREE.WebGLRenderTarget(2, 2, {
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });

    this.onPointerMove = (event) => this.trail(event.clientX, event.clientY);
    this.onPointerDown = (event) =>
      this.spawn(event.clientX, event.clientY, Math.max(1, this.clickStrength));
  }

  get texture() {
    return this.target.texture;
  }

  attach() {
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
  }

  detach() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
  }

  resize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    const fieldWidth = Math.max(2, Math.round(width * pixelRatio * this.quality));
    const fieldHeight = Math.max(2, Math.round(height * pixelRatio * this.quality));
    this.target.setSize(fieldWidth, fieldHeight);
    this.texel = new THREE.Vector2(1 / fieldWidth, 1 / fieldHeight);
  }

  spawn(clientX, clientY, power = 1) {
    if (this.reduceMotion.matches) return;
    const x = clientX;
    const y = this.height - clientY;
    const wave = this.waves[this.next];
    this.next = (this.next + 1) % MAX_WAVES;
    wave.x = x;
    wave.y = y;
    wave.scale = START_SCALE * power;
    wave.target = START_SCALE * Math.max(1, this.spread) * power;
    wave.size = Math.max(1, this.brushSize);
    wave.opacity = 1;
  }

  // One ripple per `spacing` px of pointer travel, so a fast sweep leaves a
  // trail and a slow one does not flood the buffer.
  trail(clientX, clientY) {
    const x = clientX;
    const y = this.height - clientY;
    const step = Math.max(1, this.spacing);
    if (Math.abs(x - this.previous.x) <= step && Math.abs(y - this.previous.y) <= step) return;
    this.spawn(clientX, clientY, 1);
    this.previous = { x, y };
  }

  update(dt) {
    const growth = this.reduceMotion.matches ? 0 : 1 - Math.exp(-dt * 1.09);
    const decay = this.reduceMotion.matches
      ? 1
      : Math.exp((-dt * LIFE_CONSTANT) / Math.max(0.15, this.fade));

    let live = 0;
    for (let i = 0; i < MAX_WAVES; i += 1) {
      const wave = this.waves[i];
      if (wave.opacity <= 0) {
        this.opacities[i] = 0;
        continue;
      }

      wave.opacity *= decay;
      wave.scale += (wave.target - wave.scale) * growth;

      if (wave.opacity < 0.002) {
        wave.opacity = 0;
        this.opacities[i] = 0;
        continue;
      }

      const half = (wave.scale * wave.size) / 2;
      this.offsets[i * 2] = (wave.x / this.width) * 2 - 1;
      this.offsets[i * 2 + 1] = (wave.y / this.height) * 2 - 1;
      this.scales[i * 2] = (half / this.width) * 2;
      this.scales[i * 2 + 1] = (half / this.height) * 2;
      this.opacities[i] = wave.opacity;
      live += 1;
    }

    this.geometry.attributes.iOffset.needsUpdate = true;
    this.geometry.attributes.iScale.needsUpdate = true;
    this.geometry.attributes.iOpacity.needsUpdate = true;

    // One frame of grace after the last wave dies, so the field clears once and
    // then the whole pass is skipped while the pointer is still.
    this.wasLive = this.live > 0;
    this.live = live;
  }

  render(renderer) {
    if (this.live === 0 && !this.wasLive) return;
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previousTarget);
  }

  dispose() {
    this.detach();
    this.geometry.dispose();
    this.material.dispose();
    this.target.dispose();
  }
}

function dynamic(attribute) {
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}
