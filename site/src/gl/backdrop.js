import * as THREE from "three";

// .focus-video and .cinema-shade, drawn as one plane instead of two stacked DOM
// layers. The filter and both gradients below are ports of the globals.css
// rules, not reinterpretations of them.
//
// The plane hangs off the camera rather than sitting in the world. Left in the
// world it magnified as the camera descended, and by the bottom of the travel
// the frame was a 2.4x crop of the building's dark underside — hard-edged black
// slabs where there had been a city. Parallax is the depth field's job; a
// backdrop should hold its framing.
const DEPTH = -24;

const VERT = /* glsl */ `
  in vec3 position;
  in vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uGain;
  uniform float uDescent;
  uniform vec2 uCover;

  // Pointer ripples, ported from React Bits' RippleDistortion. The field is
  // rendered separately; this is its composite half, applied to the live
  // footage instead of a still image.
  uniform sampler2D uRipple;
  uniform vec2 uTexel;
  uniform vec3 uTint;
  uniform vec3 uHighlight;
  uniform float uStrength;
  uniform float uSwirl;
  uniform float uDispersion;
  uniform float uGlint;
  uniform float uTintAmount;

  const float TAU = 6.283185307179586;

  // Gradient stops interpolate premultiplied, the way browsers composite them.
  vec4 stopMix(vec4 a, vec4 b, float k) {
    vec4 premultiplied = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), k);
    return vec4(premultiplied.a > 0.0 ? premultiplied.rgb / premultiplied.a : vec3(0.0), premultiplied.a);
  }

  vec3 over(vec3 backdrop, vec4 source) {
    return mix(backdrop, source.rgb, source.a);
  }

  // linear-gradient(180deg, rgba(9,5,1,.65), transparent 34%,
  //                 rgba(4,2,0,.2) 54%, #080400 100%)
  vec4 verticalShade(float t) {
    vec4 top = vec4(vec3(9.0, 5.0, 1.0) / 255.0, 0.65);
    vec4 clear = vec4(0.0);
    vec4 mid = vec4(vec3(4.0, 2.0, 0.0) / 255.0, 0.2);
    vec4 foot = vec4(vec3(8.0, 4.0, 0.0) / 255.0, 1.0);
    if (t < 0.34) return stopMix(top, clear, t / 0.34);
    if (t < 0.54) return stopMix(clear, mid, (t - 0.34) / 0.2);
    return stopMix(mid, foot, (t - 0.54) / 0.46);
  }

  // radial-gradient(ellipse at 50% 40%, transparent 15%, rgba(0,0,0,.55) 100%)
  // The default farthest-corner from (0.5, 0.4) gives radii of 0.5 and 0.6.
  vec4 vignette(vec2 css) {
    float radius = length((css - vec2(0.5, 0.4)) / vec2(0.5, 0.6));
    return vec4(0.0, 0.0, 0.0, clamp((radius - 0.15) / 0.85, 0.0, 1.0) * 0.55);
  }

  void main() {
    // CSS space: y counted from the top, the way the gradients are written.
    vec2 css = vec2(vUv.x, 1.0 - vUv.y);
    vec3 color = vec3(0.0);

    float ripple = texture(uRipple, vUv).r;

    if (uHasMap > 0.5) {
      // object-fit: cover, in UV space, so the plane stays a unit quad.
      vec2 uv = (vUv - 0.5) / uCover + 0.5;

      // The push direction sweeps as a ripple builds, which is what folds the
      // footage rather than merely sliding it.
      float theta = ripple * uSwirl * TAU;
      vec2 push = vec2(sin(theta), cos(theta)) * ripple * uStrength;
      uv += push;

      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
        vec3 frame;
        if (uDispersion > 0.001) {
          vec2 base = (vUv - 0.5) / uCover + 0.5;
          float split = uDispersion * 0.25;
          frame.r = texture(uMap, base + push * (1.0 + split)).r;
          frame.g = texture(uMap, uv).g;
          frame.b = texture(uMap, base + push * (1.0 - split)).b;
        } else {
          frame = texture(uMap, uv).rgb;
        }

        // filter: brightness(.71) saturate(.83) contrast(1.12), in that order.
        frame *= 0.71;
        float grey = dot(frame, vec3(0.2126, 0.7152, 0.0722));
        frame = mix(vec3(grey), frame, 0.83);
        frame = (frame - 0.5) * 1.12 + 0.5;

        if (uTintAmount > 0.001) {
          frame = mix(frame, frame * uTint * 1.9, clamp(ripple * 1.6, 0.0, 1.0) * uTintAmount);
        }

        if (uGlint > 0.001) {
          float ex = texture(uRipple, vUv + vec2(uTexel.x, 0.0)).r
                   - texture(uRipple, vUv - vec2(uTexel.x, 0.0)).r;
          float ey = texture(uRipple, vUv + vec2(0.0, uTexel.y)).r
                   - texture(uRipple, vUv - vec2(0.0, uTexel.y)).r;
          vec3 normal = normalize(vec3(-ex * 26.0, -ey * 26.0, 1.0));
          vec3 light = normalize(vec3(-0.35, 0.55, 1.0));
          float raw = pow(max(dot(normal, light), 0.0), 22.0);
          // Not named 'flat': reserved as an interpolation qualifier in GLSL ES 3.00.
          float flatSpec = pow(max(light.z, 0.0), 22.0);
          frame += uHighlight * clamp((raw - flatSpec) / max(1.0 - flatSpec, 0.0001), 0.0, 1.0) * uGlint;
        }

        color = frame * uGain * (1.0 - uDescent);
      }
    }

    color = over(color, vignette(css));
    color = over(color, verticalShade(css.y));
    fragColor = vec4(color, 1.0);
  }
`;

export class Backdrop {
  constructor(video, posterUrl) {
    this.video = video;
    this.texture = new THREE.VideoTexture(video);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      uniforms: {
        uMap: { value: this.texture },
        uHasMap: { value: 0 },
        uGain: { value: 1 },
        // Scroll depth, applied straight rather than eased: it should track the
        // wheel exactly, while the per-phase gain keeps its 1.8s transition.
        uDescent: { value: 0 },
        uCover: { value: new THREE.Vector2(1, 1) },
        uRipple: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        // The disturbed water takes the interface's own amber rather than the
        // component's default violet; the sheen is a warm white off it.
        uTint: { value: new THREE.Color(0xf4b65c) },
        uHighlight: { value: new THREE.Color(0xffe6c2) },
        // Gentler than the component's 0.2 default: this lands on moving
        // footage rather than a still hero image, and the interface is meant to
        // stay quiet.
        uStrength: { value: 0.07 },
        uSwirl: { value: 1 },
        uDispersion: { value: 0.3 },
        uGlint: { value: 0.18 },
        uTintAmount: { value: 0.1 },
      },
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.position.z = DEPTH;
    this.mesh.frustumCulled = false;
    this.targetGain = 1;

    // The poster holds the backdrop until the video is actually playing rather
    // than merely decoded — the clip's own first frame is black.
    if (posterUrl) {
      new THREE.TextureLoader().load(posterUrl, (poster) => {
        if (this.material.uniforms.uHasMap.value) return;
        poster.colorSpace = THREE.SRGBColorSpace;
        this.poster = poster;
        this.posterSize = { width: poster.image.width, height: poster.image.height };
        this.material.uniforms.uMap.value = poster;
        this.material.uniforms.uHasMap.value = 1;
        this.fit();
      });
    }

    video.addEventListener(
      "playing",
      () => {
        this.material.uniforms.uMap.value = this.texture;
        this.material.uniforms.uHasMap.value = 1;
        this.poster?.dispose();
        this.poster = null;
        this.fit();
      },
      { once: true },
    );
  }

  setRipple(texture, texel) {
    this.material.uniforms.uRipple.value = texture;
    this.material.uniforms.uTexel.value.copy(texel);
  }

  // Mirrors --scene-opacity, which globals.css steps per phase.
  setGain(gain) {
    this.targetGain = gain;
  }

  /** How far the camera has travelled away from the surface, 0..1. */
  setDescent(amount) {
    this.material.uniforms.uDescent.value = Math.min(1, Math.max(0, amount));
  }

  resize(camera) {
    // Camera-parented, so the distance is the offset and nothing else.
    const distance = Math.abs(DEPTH);
    const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.mesh.scale.set(height * camera.aspect, height, 1);
    this.planeAspect = camera.aspect;
    this.fit();
  }

  fit() {
    const width = this.video.videoWidth || this.posterSize?.width;
    const height = this.video.videoHeight || this.posterSize?.height;
    if (!width || !height || !this.planeAspect) return;
    const videoAspect = width / height;
    const cover = this.material.uniforms.uCover.value;
    if (videoAspect > this.planeAspect) cover.set(videoAspect / this.planeAspect, 1);
    else cover.set(1, this.planeAspect / videoAspect);
  }

  update(dt) {
    // globals.css transitions --scene-opacity over 1.8s.
    const uniforms = this.material.uniforms;
    uniforms.uGain.value += (this.targetGain - uniforms.uGain.value) * (1 - Math.exp(-dt * 1.55));
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
