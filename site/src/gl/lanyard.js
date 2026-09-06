import * as THREE from "three";

/**
 * The opening: an access card swinging on a lanyard, which you can grab.
 *
 * After the React Bits Lanyard, but not a port of it. That component is built
 * on React Three Fiber, drei, a Rapier WASM physics world, meshline and a
 * baked .glb — around a megabyte of dependencies and a React runtime, into a
 * build that has none of those and a 210KB budget. The behaviour is what
 * matters, and a rope is one of the few things in physics simple enough to
 * write out: this is a verlet chain with distance constraints, which gives the
 * same swing, the same droop, and the same feeling of weight when you drag it.
 *
 * The card face is drawn to a canvas rather than modelled — a lock whose shackle
 * is a clock hand, which is the whole product in one mark.
 */
// The card hangs 4.2 units out, where the frame is 2.4 units tall: the rope has
// to be short enough that the card lands inside it rather than below the fold.
const SEGMENTS = 14;
const SEGMENT_LENGTH = 0.085;
const ANCHOR = new THREE.Vector3(0, 1.52, 0);
const GRAVITY = new THREE.Vector3(0, -9.4, 0);
const DAMPING = 0.972;
const RELAX = 7;
const CARD_WIDTH = 0.66;
const CARD_HEIGHT = 1.04;
const CARD_DEPTH = -4.2; // in front of everything, close enough to fill the eye

/** A lock whose shackle doubles as the sweep of a clock hand. */
function face(textureSize, back = false) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = textureSize;
  canvas.height = Math.round(textureSize * (CARD_HEIGHT / CARD_WIDTH));
  const context = canvas.getContext("2d");
  const height = size * CARD_HEIGHT / CARD_WIDTH;
  context.scale(textureSize/size,textureSize/size);

  const plate = context.createLinearGradient(0, 0, size, height);
  plate.addColorStop(0, "#20252b");
  plate.addColorStop(.35, "#11151a");
  plate.addColorStop(1, "#080b0e");
  context.fillStyle = plate;
  roundRect(context,0,0,size,height,30);context.fill();

  context.strokeStyle = "rgba(225, 235, 244, .22)";
  context.lineWidth = 1;
  roundRect(context,16,16,size-32,height-32,22);context.stroke();
  context.fillStyle="rgba(238,244,250,.025)";
  for(let y=24;y<height-24;y+=5)context.fillRect(24,y,size-48,1);

  context.fillStyle="#a4adb7";context.font="500 16px Tektur, monospace";
  context.textAlign="left";context.letterSpacing="2px";
  context.fillText(back?"PERSONAL ACCESS":"ATTENTION SYSTEMS",40,124);
  context.fillStyle="#f4b65c";context.fillRect(size-52,111,8,8);

  // The punch hole the lanyard threads through.
  context.fillStyle = "#050608";
  context.beginPath();
  context.ellipse(size / 2, 64, 54, 17, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(225, 235, 244, .5)";
  context.lineWidth = 2;
  context.stroke();

  const centreX = size / 2;
  const centreY = height * 0.40;
  const bodyWidth = 210;
  const bodyHeight = 168;
  const bodyTop = centreY - 6;
  const radius = 104;

  context.save();context.translate(centreX,centreY);context.scale(.58,.58);context.translate(-centreX,-centreY);
  if(back){context.restore();}else{
  // Shackle: three quarters of a dial, left open at the top right where a hand
  // would be sweeping out of it.
  context.strokeStyle = "#e6edf3";
  context.lineCap = "round";
  context.lineWidth = 22;
  context.beginPath();
  context.arc(centreX, bodyTop - 8, radius, Math.PI * 0.86, Math.PI * 1.92);
  context.stroke();

  // The hand, running from the dial's centre out through the gap.
  context.lineWidth = 15;
  context.strokeStyle = "#f4b65c";
  context.beginPath();
  context.moveTo(centreX, bodyTop - 8);
  context.lineTo(centreX + radius * 0.92, bodyTop - 8 - radius * 0.42);
  context.stroke();

  context.fillStyle = "#e6edf3";
  context.beginPath();
  context.arc(centreX, bodyTop - 8, 13, 0, Math.PI * 2);
  context.fill();

  // Lock body.
  context.fillStyle = "#e6edf3";
  roundRect(context, centreX - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight, 16);
  context.fill();

  context.fillStyle = "#120c06";
  context.beginPath();
  context.arc(centreX, bodyTop + bodyHeight * 0.42, 22, 0, Math.PI * 2);
  context.fill();
  context.fillRect(centreX - 8, bodyTop + bodyHeight * 0.42, 16, 48);
  context.restore();
  }

  if(back){
    context.fillStyle="#dce4eb";context.font="500 22px Tektur, monospace";
    context.textAlign="left";context.letterSpacing="1px";
    context.fillText("STAY PRESENT.",40,280);
    context.fillStyle="#82909e";context.font="400 15px Tektur, monospace";
    context.fillText("ONE SESSION AT A TIME.",40,318);
    context.fillText("ISSUED / 001",40,358);
  }

  context.fillStyle = "#eef3f7";
  context.font = "600 34px Tektur, monospace";
  context.textAlign = "center";
  context.letterSpacing = "0px";
  context.fillText("Lock-In Timer", centreX, height * .67);

  context.strokeStyle="#58616b";context.lineWidth=1;
  context.beginPath();context.moveTo(40,height*.73);context.lineTo(size-40,height*.73);context.stroke();
  context.fillStyle="#9faab5";context.textAlign="left";
  context.font="400 14px Tektur, monospace";context.letterSpacing="1px";
  context.fillText("ACCESS / 01",40,height-148);
  context.fillStyle="#f4b65c";context.fillRect(40,height-126,30,2);
  context.fillStyle="#c9d1d9";
  for(let i=0,x=40;i<52;i++){
    const width=i%3===0?3:1;
    context.fillRect(x,height-92,width,28+(i%7===0?7:0));x+=width+3;
  }

  context.fillStyle = "#6d7884";
  context.font = "400 12px Tektur, monospace";
  context.letterSpacing = "2px";
  context.fillText("LOCK IN. TUNE OUT.",40,height-38);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export class Lanyard {
  constructor({textureSize=1024}={}) {
    this.textureSize=textureSize;this.disposed=false;
    this.motion=matchMedia("(prefers-reduced-motion: reduce)");
    this.group = new THREE.Group();
    this.group.position.z = CARD_DEPTH;

    this.points = Array.from({ length: SEGMENTS }, (_, index) => {
      const position = new THREE.Vector3(0, ANCHOR.y - index * SEGMENT_LENGTH, 0);
      return { position, previous: position.clone() };
    });

    const cordGeometry = new THREE.BufferGeometry();
    cordGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SEGMENTS * 6), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const indices=[];
    for(let i=0;i<SEGMENTS-1;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    cordGeometry.setIndex(indices);
    this.cord = new THREE.Mesh(
      cordGeometry,
      new THREE.MeshBasicMaterial({ color: 0x555e69, transparent: true, opacity: 0.95, side:THREE.DoubleSide }),
    );
    this.cord.frustumCulled = false;

    this.card = new THREE.Group();
    const outline=new THREE.Shape();
    const x=-CARD_WIDTH/2,y=-CARD_HEIGHT/2,w=CARD_WIDTH,h=CARD_HEIGHT,r=.035;
    outline.moveTo(x+r,y);outline.lineTo(x+w-r,y);outline.quadraticCurveTo(x+w,y,x+w,y+r);
    outline.lineTo(x+w,y+h-r);outline.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    outline.lineTo(x+r,y+h);outline.quadraticCurveTo(x,y+h,x,y+h-r);
    outline.lineTo(x,y+r);outline.quadraticCurveTo(x,y,x+r,y);outline.closePath();
    const shell=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.018,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.006,bevelThickness:.005,curveSegments:8}),
      new THREE.MeshStandardMaterial({color:0x8a96a4,metalness:.85,roughness:.28,transparent:true}));
    this.card.add(shell);
    this.front=new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH,CARD_HEIGHT),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0}));
    this.front.position.z=.025;
    this.back=new THREE.Mesh(this.front.geometry.clone(),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0}));
    this.back.position.z=-.006;this.back.rotation.y=Math.PI;
    this.card.add(this.front,this.back);
    const clasp=new THREE.Mesh(new THREE.TorusGeometry(.035,.008,8,24),new THREE.MeshStandardMaterial({color:0xd0dae5,metalness:.95,roughness:.2,transparent:true}));
    clasp.position.set(0,CARD_HEIGHT/2+.026,.009);this.card.add(clasp);
    const connector=new THREE.Mesh(new THREE.BoxGeometry(.065,.06,.025),clasp.material.clone());
    connector.position.set(0,CARD_HEIGHT/2-.018,.01);this.card.add(connector);
    const light=new THREE.DirectionalLight(0xe7f0ff,3.5);light.position.set(-2,3,4);
    this.group.add(light,new THREE.AmbientLight(0xffffff,1.3));
    this.card.frustumCulled = false;

    this.group.add(this.cord, this.card);
    this.opacity = 1;
    this.dragging = false;
    this.pointer = new THREE.Vector3();
  }

  get tail() {
    return this.points[this.points.length - 1];
  }

  buildFaces() {
    if(this.disposed||this.texture)return;
    this.texture=face(this.textureSize);
    this.backTexture=face(this.textureSize,true);
    this.front.material.map=this.texture;this.front.material.needsUpdate=true;
    this.back.material.map=this.backTexture;this.back.material.needsUpdate=true;
  }

  /**
   * Verlet: position carries its own velocity as the gap to where it was last
   * frame, so a constraint pass is all that holds the rope together.
   */
  step(dt) {
    const clamped = Math.min(dt, 1 / 45);
    for (let index = 1; index < this.points.length; index += 1) {
      const point = this.points[index];
      const velocity = point.position.clone().sub(point.previous).multiplyScalar(this.motion.matches?0:DAMPING);
      point.previous.copy(point.position);
      point.position.add(velocity).addScaledVector(GRAVITY, clamped * clamped);
    }

    this.points[0].position.copy(ANCHOR);
    if (this.dragging) this.tail.position.copy(this.pointer);

    for (let pass = 0; pass < RELAX; pass += 1) {
      for (let index = 0; index < this.points.length - 1; index += 1) {
        const a = this.points[index];
        const b = this.points[index + 1];
        const delta = b.position.clone().sub(a.position);
        const distance = delta.length() || 1e-6;
        const correction = delta.multiplyScalar((distance - SEGMENT_LENGTH) / distance / 2);
        if (index > 0) a.position.add(correction);
        else a.position.copy(ANCHOR);
        if (!(this.dragging && index + 1 === this.points.length - 1)) {
          b.position.sub(correction);
        }
      }
      this.points[0].position.copy(ANCHOR);
      if (this.dragging) this.tail.position.copy(this.pointer);
    }

    const positions = this.cord.geometry.attributes.position;
    for (let index = 0; index < this.points.length; index += 1) {
      const { x, y, z } = this.points[index].position;
      const next=this.points[Math.min(index+1,SEGMENTS-1)].position;
      const previous=this.points[Math.max(0,index-1)].position;
      const direction=next.clone().sub(previous).normalize();
      positions.setXYZ(index*2,x+direction.y*.018,y-direction.x*.018,z);
      positions.setXYZ(index*2+1,x-direction.y*.018,y+direction.x*.018,z);
    }
    positions.needsUpdate = true;

    // The card hangs off the last link and leans into whichever way it swings.
    const tail = this.tail.position;
    const lean = tail.clone().sub(this.points[this.points.length - 2].position);
    this.card.position.set(tail.x, tail.y - CARD_HEIGHT / 2, tail.z);
    this.card.rotation.z = Math.atan2(-lean.x, -lean.y) * 0.9;
    this.card.rotation.y = THREE.MathUtils.clamp(-lean.x * 1.2, -0.7, 0.7);
  }

  setOpacity(value) {
    this.opacity = value;
    this.card.traverse(object=>{if(object.material)object.material.opacity=(object===this.front||object===this.back)&&!this.texture?0:value;});
    this.cord.material.opacity = value * 0.85;
    this.group.visible = value > 0.01;
  }

  dispose() {
    this.disposed=true;
    this.texture?.dispose();this.backTexture?.dispose();
    this.card.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
    this.cord.geometry.dispose();
    this.cord.material.dispose();
  }
}

export const LANYARD_DEPTH = CARD_DEPTH;
