import * as THREE from "three";

/**
 * The bottom of the descent: one word, made of the same stuff as the clock.
 *
 * Drawn as particles rather than a texture on a plate, and with no frame around
 * it — the gather is what says "this is a control", so a border would only be
 * describing what the motion already does.
 */
const DEPTH = -15;
const OFFSET_Y = -0.55;
const TARGET_WIDTH = 1.55; // world units, read from ~3.5 units out
const FONT_SIZE = 132;
const STEP = 3;
const SCATTER = 1.1; // world units
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
    this.group.position.set(0, OFFSET_Y, DEPTH);
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
    this.hit = new THREE.Mesh(
      new THREE.PlaneGeometry(TARGET_WIDTH * 1.25, 0.75),
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

    context.font = font;
    context.letterSpacing = `${Math.round(FONT_SIZE * 0.14)}px`;
    const metrics = context.measureText("开始");
    const width = Math.ceil(metrics.width) + 24;
    const height = Math.ceil(FONT_SIZE * 1.5);

    canvas.width = width;
    canvas.height = height;
    // Sizing the canvas resets the context, so the font is set again.
    context.font = font;
    context.letterSpacing = `${Math.round(FONT_SIZE * 0.14)}px`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    context.fillText("开始", width / 2, height / 2);

    const pixels = context.getImageData(0, 0, width, height).data;
    const unit = TARGET_WIDTH / width;
    const targets = [];
    for (let y = 0; y < height; y += STEP) {
      for (let x = 0; x < width; x += STEP) {
        if (pixels[(y * width + x) * 4 + 3] < 128) continue;
        targets.push((x - width / 2) * unit, (height / 2 - y) * unit, 0);
      }
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
      from[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
      seed[i * 2] = Math.random();
      seed[i * 2 + 1] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 2));

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
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

  dispose() {
    this.points?.geometry.dispose();
    this.hit.geometry.dispose();
    this.hit.material.dispose();
    this.material.dispose();
  }
}
