import * as THREE from "three";

/**
 * The bottom of the descent: one word, and pressing it starts the session.
 *
 * It is a plane in the world rather than a DOM button so that it arrives with
 * the depth everything else has — it grows out of the dark as the camera
 * reaches it, instead of being pasted over the scene.
 */
// Far enough ahead that it arrives rather than lands on the lens: the camera
// stops at -11.5, so this is read from 3.5 units out, where the frustum is
// about 2.0 tall.
const DEPTH = -15;
const OFFSET_Y = -0.55;

function plate() {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = 512 * scale;
  canvas.height = 256 * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.strokeStyle = "rgba(244, 182, 92, 0.55)";
  context.lineWidth = 1;
  context.strokeRect(96.5, 60.5, 320, 108);

  context.font = "600 56px Tektur, 'PingFang SC', sans-serif";
  context.fillStyle = "rgba(244, 182, 92, 0.95)";
  context.letterSpacing = "16px";
  context.fillText("开始", 264, 116);

  context.font = "400 15px Tektur, monospace";
  context.fillStyle = "rgba(172, 146, 118, 0.8)";
  context.letterSpacing = "7px";
  context.fillText("SPACE", 256, 200);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class EnterPlate {
  constructor() {
    this.texture = plate();
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), this.material);
    this.mesh.position.set(0, OFFSET_Y, DEPTH);
    this.mesh.scale.setScalar(0.4);
    this.mesh.frustumCulled = false;
    this.reveal = 0;
  }

  /** `arrival` is how far into the last section the camera has come, 0..1. */
  update(dt, arrival, worldOpacity) {
    this.reveal += (arrival - this.reveal) * (1 - Math.exp(-dt * 6));
    const eased = this.reveal * this.reveal * (3 - 2 * this.reveal);
    this.mesh.scale.setScalar(0.4 + eased * 0.6);
    this.material.opacity = eased * worldOpacity;
    this.mesh.visible = this.material.opacity > 0.01;
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
