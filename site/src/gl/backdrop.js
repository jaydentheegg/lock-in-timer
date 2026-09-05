import * as THREE from "three";

// The footage, the shade gradient and the vignette were three stacked DOM
// layers in the CSS build. Here they are one fragment shader on one plane.
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
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform vec3 uGround;
  uniform vec2 uCover;

  void main() {
    // object-fit: cover, done in UV space so the plane can stay a unit quad.
    vec2 uv = (vUv - 0.5) / uCover + 0.5;
    vec3 color = uGround;

    if (uHasMap > 0.5 && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      color = texture(uMap, uv).rgb;
      color *= uBrightness;
      color = (color - 0.5) * uContrast + 0.5;
      float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(grey), color, uSaturation);
      color = mix(uGround, color, uGain);
    }

    // Top and bottom shade, then a radial vignette — same stops as the CSS.
    float vertical = mix(0.42, 0.58, smoothstep(0.45, 1.0, vUv.y))
                   * (1.0 - smoothstep(0.0, 0.45, vUv.y) * 0.95);
    float radius = length((vUv - 0.5) * vec2(1.0, 0.86)) * 2.0;
    float vignette = smoothstep(0.34, 0.96, radius) * 0.4;

    color = mix(color, uGround, clamp(vertical + vignette, 0.0, 1.0));
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
        uBrightness: { value: 0.74 },
        uContrast: { value: 1.1 },
        uSaturation: { value: 0.52 },
        uGround: { value: new THREE.Color(0x06080a) },
        uCover: { value: new THREE.Vector2(1, 1) },
      },
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.position.z = DEPTH;
    this.mesh.frustumCulled = false;
    this.targetGain = 1;

    // Until the video has decoded a frame there is nothing to sample, and a
    // pure black first paint is exactly the failure the poster exists to
    // prevent — so the poster is the texture until the video takes over.
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

    const ready = () => {
      this.material.uniforms.uMap.value = this.texture;
      this.material.uniforms.uHasMap.value = 1;
      this.poster?.dispose();
      this.poster = null;
      this.fit();
    };
    // Swap on `playing`, not `loadeddata`: the clip opens on a black frame, so
    // handing the texture over as soon as data exists reintroduces the black
    // first paint the poster is there to prevent.
    video.addEventListener("playing", ready, { once: true });
  }

  // Phase decay replaces the CSS build's per-phase opacity steps.
  setGain(gain) {
    this.targetGain = gain;
  }

  resize(camera) {
    this.camera = camera;
    const distance = Math.abs(DEPTH - camera.position.z);
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
    const uniforms = this.material.uniforms;
    uniforms.uGain.value += (this.targetGain - uniforms.uGain.value) * (1 - Math.exp(-dt * 0.45));
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
