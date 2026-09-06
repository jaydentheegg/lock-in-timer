import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../site/node_modules/three/build/three.module.js';
import {ParticleField} from '../site/src/gl/particles.js';
import {Lanyard} from '../site/src/gl/lanyard.js';
import {EnterParticles} from '../site/src/gl/enter.js';

function drawingHarness(t) {
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const originalMotion=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
  const labels=[];const canvases=[];
  const context={
    scale(){},fillRect(){},strokeRect(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},arcTo(){},ellipse(){},arc(){},fill(){},stroke(){},save(){},restore(){},translate(){},
    createLinearGradient(){return {addColorStop(){}};},
    fillText(text){labels.push(text);},measureText(){return {width:500};},
    getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let row=30;row<70;row++)for(let col=30;col<300;col++)data[(row*w+col)*4+3]=255;return {data};},
  };
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){const canvas={width:0,height:0,getContext:()=>context};canvases.push(canvas);return canvas;}}});
  Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})});
  t.after(()=>{if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else delete globalThis.document;if(originalMotion)Object.defineProperty(globalThis,'matchMedia',originalMotion);else delete globalThis.matchMedia;});
  return {labels,canvases};
}

test('white particle material and reduced-motion update remain static',()=>{
  const field=new ParticleField();
  assert.equal(field.material.uniforms.uColor.value.getHex(),0xf0f4fa);
  const mouse=new THREE.Vector2(.1,.2);
  field.update(1,{mouse,pixelRatio:1,cameraZ:0});
  const time=field.material.uniforms.uTime.value;
  field.update(10,{mouse,pixelRatio:1,cameraZ:0,reduced:true});
  assert.equal(field.material.uniforms.uTime.value,time);
  assert.equal(field.material.uniforms.uRepelForce.value,0);
  field.setDensity(.5);assert.equal(field.geometry.drawRange.count,3000);
  field.dispose();
});

test('badge has thickness, ribbon width, independently printed faces and exact title',t=>{
  const h=drawingHarness(t);const badge=new Lanyard({textureSize:1024});
  assert.equal(badge.texture,undefined,'faces must wait for explicit font-ready build');
  assert.equal(badge.cord.geometry.attributes.position.count,28);
  assert.ok(badge.card.children.some(object=>object.geometry.type==='ExtrudeGeometry'));
  badge.buildFaces();
  assert.equal(h.labels.filter(text=>text==='Lock-In Timer').length,2);
  assert.ok(h.labels.includes('ACCESS / 01'));
  assert.equal(badge.back.rotation.y,Math.PI);
  assert.notEqual(badge.front.material.map,badge.back.material.map);
  assert.equal(h.canvases[0].width,1024);
  badge.setOpacity(.5);assert.equal(badge.front.material.opacity,.5);
  badge.dragging=true;badge.pointer.set(.1,.2,0);badge.step(.016);
  assert.equal(badge.tail.position.x,.1);
  assert.ok(Number.isFinite(badge.card.position.y));
  badge.dispose();
});

test('LOCK-IN visible points shrink to 70 percent without shrinking the hit mesh',t=>{
  drawingHarness(t);const entry=new EnterParticles();entry.build();
  assert.equal(entry.points.scale.x,.7);assert.equal(entry.points.scale.y,.7);
  assert.equal(entry.hit.geometry.parameters.width,1.16);
  assert.equal(entry.hit.scale.x,1);
  entry.dispose();
});

test('active scene never imports spiral images; capture isolates the particle layer',async()=>{
  const scene=await readFile(new URL('../site/src/gl/scene.js',import.meta.url),'utf8');
  assert.equal(scene.includes('new Spiral'),false);assert.equal(scene.includes('import { Spiral }'),false);
  assert.ok(scene.includes('this.particles.points.layers.set(1)'));
  assert.ok(scene.includes('this.camera.layers.set(1)'));
  assert.ok(scene.includes('this.camera.layers.mask=mask'));
  assert.ok(scene.includes('target.dispose()'));
});
