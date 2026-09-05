import * as THREE from "three";

// One quad per glyph, laid out on a tabular grid. The clock changes every
// second, so the geometry is allocated once and rewritten in place.
const MAX_GLYPHS = 8;

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

// Outline first, fill second: the stroke is the design, the fill only gives the
// digits enough body to sit against bright footage.
const FRAG = /* glsl */ `
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uAtlas;
  uniform float uDistanceRange;
  uniform float uStrokePx;
  uniform vec3 uStrokeColor;
  uniform vec3 uFillColor;
  uniform float uFillAlpha;
  uniform float uOpacity;

  float median(vec3 msdf) {
    return max(min(msdf.r, msdf.g), min(max(msdf.r, msdf.g), msdf.b));
  }

  // Converts the atlas's signed distance into screen pixels, so the stroke
  // stays one weight at every scale and DPR.
  float screenPxRange() {
    vec2 unitRange = vec2(uDistanceRange) / vec2(textureSize(uAtlas, 0));
    vec2 screenTexSize = vec2(1.0) / fwidth(vUv);
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
  }

  void main() {
    // Not named 'sample': that is a reserved word in GLSL ES 3.00.
    vec3 texel = texture(uAtlas, vUv).rgb;
    float signedPx = (median(texel) - 0.5) * screenPxRange();

    float stroke = 1.0 - smoothstep(uStrokePx - 1.0, uStrokePx + 1.0, abs(signedPx));
    float fill = smoothstep(-1.0, 1.0, signedPx);

    float alpha = max(stroke, fill * uFillAlpha) * uOpacity;
    if (alpha < 0.002) discard;
    fragColor = vec4(mix(uFillColor, uStrokeColor, stroke), alpha);
  }
`;

export class MsdfText {
  constructor(font, atlas) {
    this.font = font;
    this.glyphs = new Map(font.chars.map((char) => [char.char, char]));

    // Tektur's digits are not tabular — 1 advances 41 where 0 advances 62 — so
    // the clock would twitch on every tick. Pin every digit to one cell.
    const digits = font.chars.filter((char) => /[0-9]/.test(char.char));
    this.digitAdvance = Math.max(...digits.map((char) => char.xadvance));

    // Vertical fitting and centring both work off the digits' real ink box.
    // lineHeight would overstate it by the ascender and descender the clock
    // never uses — 125 units against the digits' 73.
    const { base } = font.common;
    this.digitTop = Math.max(...digits.map((char) => base - char.yoffset));
    this.digitBottom = Math.min(...digits.map((char) => base - char.yoffset - char.height));
    this.capHeight = this.digitTop - this.digitBottom;
    this.opticalCentre = (this.digitTop + this.digitBottom) / 2;

    const position = new THREE.BufferAttribute(new Float32Array(MAX_GLYPHS * 4 * 3), 3);
    const uv = new THREE.BufferAttribute(new Float32Array(MAX_GLYPHS * 4 * 2), 2);
    position.setUsage(THREE.DynamicDrawUsage);
    uv.setUsage(THREE.DynamicDrawUsage);

    // Vertices are written top-left, top-right, bottom-right, bottom-left; in a
    // y-up space that walk is clockwise, which back-face culling would throw
    // away. Index them counter-clockwise instead.
    const index = [];
    for (let glyph = 0; glyph < MAX_GLYPHS; glyph += 1) {
      const base = glyph * 4;
      index.push(base, base + 3, base + 2, base, base + 2, base + 1);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", position);
    this.geometry.setAttribute("uv", uv);
    this.geometry.setIndex(index);

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uAtlas: { value: atlas },
        uDistanceRange: { value: font.distanceField.distanceRange },
        uStrokePx: { value: 1.6 },
        uStrokeColor: { value: new THREE.Color(0xd8dfe7) },
        uFillColor: { value: new THREE.Color(0xf2a21d) },
        uFillAlpha: { value: 0.05 },
        uOpacity: { value: 1 },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.textWidth = 0;
    this.text = "";
  }

  advanceFor(char) {
    if (/[0-9]/.test(char)) return this.digitAdvance;
    return this.glyphs.get(char)?.xadvance ?? this.digitAdvance;
  }

  measure(text) {
    let width = 0;
    for (const char of text) width += this.advanceFor(char);
    return width;
  }

  // Font units, y-up, origin at the centre of the string.
  set(text) {
    if (text === this.text) return;
    this.text = text;

    const { scaleW, scaleH, base } = this.font.common;
    const position = this.geometry.attributes.position;
    const uv = this.geometry.attributes.uv;
    const total = this.measure(text);
    this.textWidth = total;

    let cursor = -total / 2;
    let drawn = 0;

    for (const char of text) {
      const glyph = this.glyphs.get(char);
      const advance = this.advanceFor(char);
      if (!glyph) {
        cursor += advance;
        continue;
      }

      // Centre each glyph inside its tabular cell rather than trusting the
      // font's own left bearing, which is what makes the column line up.
      const left = cursor + (advance - glyph.width) / 2;
      const right = left + glyph.width;
      const top = base - glyph.yoffset;
      const bottom = top - glyph.height;

      const vertex = drawn * 4;
      position.setXYZ(vertex + 0, left, top, 0);
      position.setXYZ(vertex + 1, right, top, 0);
      position.setXYZ(vertex + 2, right, bottom, 0);
      position.setXYZ(vertex + 3, left, bottom, 0);

      const u0 = glyph.x / scaleW;
      const u1 = (glyph.x + glyph.width) / scaleW;
      const v0 = glyph.y / scaleH;
      const v1 = (glyph.y + glyph.height) / scaleH;
      uv.setXY(vertex + 0, u0, v0);
      uv.setXY(vertex + 1, u1, v0);
      uv.setXY(vertex + 2, u1, v1);
      uv.setXY(vertex + 3, u0, v1);

      cursor += advance;
      drawn += 1;
    }

    position.needsUpdate = true;
    uv.needsUpdate = true;
    this.geometry.setDrawRange(0, drawn * 6);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export async function loadMsdfFont(jsonUrl, pngUrl) {
  const [font, atlas] = await Promise.all([
    fetch(jsonUrl).then((response) => response.json()),
    new THREE.TextureLoader().loadAsync(pngUrl),
  ]);
  // BMFont lays glyphs out from the top-left; three flips textures by default,
  // which mirrors every glyph into empty atlas space.
  atlas.flipY = false;
  atlas.generateMipmaps = false;
  atlas.minFilter = THREE.LinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.colorSpace = THREE.NoColorSpace;
  return { font, atlas };
}
