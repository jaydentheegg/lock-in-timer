import * as THREE from "three";

// A depth field the camera will later travel through. In Phase 1 it only
// drifts and reacts to the cursor — that reaction is the seed of P-01.
const VERT = /* glsl */ `
  in vec3 position;
  in vec2 seed;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2 uMouse;
  uniform float uRepelRadius;
  uniform float uRepelForce;

  out float vDepth;
  out float vSeed;

  void main() {
    vec3 drifted = position;
    // Two slow sines per axis, detuned by the per-point seed, so no two points
    // share a period and the field never visibly loops.
    drifted.x += sin(uTime * 0.11 + seed.x * 6.283) * 0.22;
    drifted.y += cos(uTime * 0.09 + seed.y * 6.283) * 0.18;

    vec4 viewPosition = modelViewMatrix * vec4(drifted, 1.0);
    vec4 clip = projectionMatrix * viewPosition;

    // Cursor repulsion in normalised device space: no per-point state to keep,
    // so it costs one divide and stays exact at any point count.
    vec2 ndc = clip.xy / clip.w;
    vec2 away = ndc - uMouse;
    float falloff = exp(-dot(away, away) / (uRepelRadius * uRepelRadius));
    ndc += normalize(away + 1e-5) * falloff * uRepelForce;
    clip.xy = ndc * clip.w;

    gl_Position = clip;
    vDepth = -viewPosition.z;
    vSeed = seed.x;
    gl_PointSize = (uSize * uPixelRatio) / max(-viewPosition.z, 0.4);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  in float vDepth;
  in float vSeed;
  out vec4 fragColor;

  uniform vec3 uColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uOpacity;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float disc = 1.0 - smoothstep(0.32, 0.5, length(offset));
    if (disc < 0.01) discard;

    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
    float brightness = mix(0.45, 1.0, vSeed);
    fragColor = vec4(mix(uColor, uFogColor, fog), disc * brightness * uOpacity * (1.0 - fog));
  }
`;

export class ParticleField {
  constructor({ count = 12000, depth = [-2, -20], spread = 9 } = {}) {
    this.count = count;

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * spread * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = depth[0] + Math.random() * (depth[1] - depth[0]);
      seeds[i * 2 + 0] = Math.random();
      seeds[i * 2 + 1] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 2));

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.75 },
        uPixelRatio: { value: 1 },
        uMouse: { value: new THREE.Vector2(2, 2) },
        uRepelRadius: { value: 0.34 },
        uRepelForce: { value: 0.06 },
        uColor: { value: new THREE.Color(0xf2a21d) },
        uFogColor: { value: new THREE.Color(0x06080a) },
        uFogDensity: { value: 0.012 },
        uOpacity: { value: 0.3 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  // Draw range is how Phase 1 honours the instrument-mode budget: the same
  // buffer, fewer points, no reallocation.
  setDensity(fraction) {
    this.geometry.setDrawRange(0, Math.max(1, Math.round(this.count * fraction)));
  }

  update(dt, { mouse, pixelRatio }) {
    const uniforms = this.material.uniforms;
    uniforms.uTime.value += dt;
    uniforms.uPixelRatio.value = pixelRatio;
    uniforms.uMouse.value.lerp(mouse, 1 - Math.exp(-dt * 6));
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
