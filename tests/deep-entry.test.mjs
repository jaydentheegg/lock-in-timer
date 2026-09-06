import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {DEEP_ENTRY_MS, deepEntryFrame, mountFocus} from '../lib/focus-engine.js';

// Tiny deterministic DOM/media harness. These are lifecycle tests, not a claim
// of browser/GPU visual QA. No packages, media playback or real-time waits needed.
class Element extends EventTarget {
  constructor() {
    super();
    this.dataset = {}; this.textContent = ''; this.attributes = {};
    const names = new Set(), properties = new Map();
    this.classList = {add: n => names.add(n), remove: n => names.delete(n), contains: n => names.has(n)};
    this.style = {setProperty: (k,v) => properties.set(k,v), removeProperty: k => properties.delete(k)};
    this.width = 0; this.height = 0; this.draws = 0; this.plays = 0; this.pauses = 0;
    this.readyState = 2; this.videoWidth = 1920; this.videoHeight = 1080;
    this.context = {clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {},
      drawImage: () => this.draws++, createRadialGradient: () => ({addColorStop() {}})};
  }
  setAttribute(k,v) { this.attributes[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; }
  getContext() { return this.context; }
  append(child) { this.children ??= []; this.children.push(child); }
  remove() { this.removed = true; }
  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
  load() {}
  closest() { return null; }
  click() { this.dispatchEvent(new Event('click')); }
  getBoundingClientRect() { return {left: 0, top: 0, width: 1280, height: 720}; }
}

function harness(t, {reduced = false, preview = true, noCanvas = false, gl = false} = {}) {
  const originals = new Map();
  const install = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  };
  let now = 0, id = 0;
  const jobs = new Map();
  const schedule = (fn,delay,interval=0) => {jobs.set(++id,{fn,at:now+delay,interval});return id;};
  const elements = new Map(), steps = Array.from({length:5},()=>new Element());
  const get = key => {if(!elements.has(key))elements.set(key,new Element());return elements.get(key);};
  const page = get('.focus-page');
  const doc = new Element(); doc.hidden = false;
  doc.querySelector = get;
  doc.querySelectorAll = selector => selector === '[data-step]' ? steps : [];
  const cards = gl ? [new Element(),new Element()] : [];
  cards.forEach((card,i) => Object.assign(card.style, {backgroundImage:`url("./spiral/0${i}.jpg")`,zIndex:String(i),opacity:'.18',filter:'none'}));
  page.dataset.gl = gl ? 'on' : 'off';
  page.querySelectorAll = () => cards;
  doc.createElement = () => {const el=new Element();if(noCanvas)el.context=null;return el;};
  if (noCanvas) get('.interference').context = null;
  const motion = new Element(); motion.matches = reduced;
  install('document',doc); install('location',{search:preview?'?preview=events':''});
  install('matchMedia',()=>motion); install('innerWidth',1280); install('innerHeight',720);
  install('getComputedStyle',el=>el.style);
  install('Image',class {constructor(){this.complete=true;this.naturalWidth=100;this.naturalHeight=100;}});
  install('performance',{now:()=>now});
  install('setTimeout',(fn,delay)=>schedule(fn,delay)); install('clearTimeout',id=>jobs.delete(id));
  install('setInterval',(fn,delay)=>schedule(fn,delay,delay)); install('clearInterval',id=>jobs.delete(id));
  install('requestAnimationFrame',fn=>schedule(()=>fn(now),16)); install('cancelAnimationFrame',id=>jobs.delete(id));
  function advance(ms) {
    const until=now+ms;
    for (;;) {
      const next=[...jobs].filter(([,job])=>job.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;
      const [key,job]=next;now=job.at;jobs.delete(key);
      if(job.interval)jobs.set(key,{...job,at:now+job.interval});
      job.fn();
    }
    now=until;
  }
  const dispose=mountFocus(doc);
  t.after(()=>{dispose();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  return {get,page,doc,motion,jobs,advance,dispose,canvas:()=>page.children?.findLast(el=>!el.removed),
    jump(ms){now+=ms;[...jobs.values()].find(job=>job.interval)?.fn();},
    hide(hidden){doc.hidden=hidden;doc.dispatchEvent(new Event('visibilitychange'));}};
}

test('entry timeline pushes, pixelates, opens and clears at 1500 ms',()=>{
  assert.equal(DEEP_ENTRY_MS,1500);
  assert.deepEqual(deepEntryFrame(0),{progress:0,zoom:1,split:0,pixel:0,opacity:1,done:false});
  const middle=deepEntryFrame(850);
  assert.ok(middle.zoom>1 && middle.split>0 && middle.pixel===1 && middle.opacity<1);
  assert.equal(deepEntryFrame(1500).done,true);
  assert.equal(deepEntryFrame(1500).opacity,0);
  assert.equal(deepEntryFrame(-100).progress,0);
  assert.equal(deepEntryFrame(10000).progress,1);
  for(let ms=0;ms<=1500;ms+=50){const s=deepEntryFrame(ms,true);assert.equal(s.zoom,1);assert.equal(s.split,0);assert.equal(s.pixel,0);}
});

test('no events before start; preview DEEP uses background capture, not a clock-covering milestone',t=>{
  const h=harness(t);h.advance(30000);
  assert.equal(h.page.dataset.deepEntry,undefined);
  h.get('.play-button').click();h.advance(25000);
  assert.equal(h.page.dataset.phase,'deep');
  assert.equal(h.page.dataset.deepEntry,'entering');
  assert.equal(h.get('.milestone-event').classList.contains('show'),false);
  assert.equal(h.page.classList.contains('milestone-open'),false);
  assert.ok(h.canvas().draws>0);
  assert.equal(h.get('video').pauses,0);assert.equal(h.get('audio').pauses,0);
  h.advance(1520);
  assert.equal(h.canvas(),undefined);assert.equal(h.page.dataset.deepEntry,undefined);
  assert.equal(h.get('.screen-reminder').textContent,'DEEP / 已进入深层');
  h.advance(3800);assert.equal(h.get('.screen-reminder').textContent,'');
});

test('pause during entry freezes elapsed time, not the transition, media or later broadcasts',t=>{
  const h=harness(t);h.get('.play-button').click();h.advance(25400);
  h.get('.play-button').click();const value=h.get('.focus-clock').textContent;
  h.advance(2000);
  assert.equal(h.page.dataset.running,'false');assert.equal(h.page.dataset.started,'true');
  assert.equal(h.get('.focus-clock').textContent,value);
  assert.equal(h.page.dataset.phase,'deep');assert.equal(h.canvas(),undefined);
  assert.equal(h.get('video').pauses,0);assert.equal(h.get('audio').pauses,0);
  assert.ok(h.jobs.size>1);
  h.get('.play-button').click();h.advance(600);
  assert.equal(h.page.dataset.deepEntry,undefined);
});

test('normal mode triggers only at 25 minutes; later phases do not replay DEEP',t=>{
  const h=harness(t,{preview:false,reduced:true});h.get('.play-button').click();
  h.jump(1499000);assert.equal(h.page.dataset.phase,'trace');assert.equal(h.page.dataset.deepEntry,undefined);
  h.jump(1000);assert.equal(h.page.dataset.deepEntry,'entering');
  h.hide(true);h.jump(1200000);h.hide(false);
  assert.equal(h.page.dataset.phase,'null');assert.equal(h.page.dataset.deepEntry,undefined);
});

test('reduced motion uses no capture and still fades and clears the subtitle',t=>{
  const h=harness(t,{reduced:true});h.get('.play-button').click();h.advance(25000);
  assert.equal(h.page.dataset.deepEntry,'entering');assert.equal(h.canvas(),undefined);
  h.advance(1520);assert.equal(h.get('.screen-reminder').textContent,'DEEP / 已进入深层');
  h.advance(3800);assert.equal(h.get('.screen-reminder').textContent,'');
});

test('mid-transition motion preference changes do not alter time or leave a canvas',t=>{
  const h=harness(t);h.get('.play-button').click();h.advance(25300);
  h.motion.matches=true;h.motion.dispatchEvent(new Event('change'));h.advance(1600);
  assert.equal(h.canvas(),undefined);assert.equal(h.page.dataset.running,'true');
});

test('reset cancels entry and subtitles; next session can enter again',t=>{
  const h=harness(t);h.get('.play-button').click();h.advance(25300);h.get('.reset-button').click();
  assert.equal(h.canvas(),undefined);assert.equal(h.page.dataset.phase,'link');
  h.advance(3000);assert.equal(h.get('.screen-reminder').textContent,'');
  assert.equal(h.get('.focus-clock').textContent,'00:00');
  h.get('.play-button').click();h.advance(25200);assert.equal(h.page.dataset.deepEntry,'entering');
});

test('backgrounding cancels entry; returning does not replay missed effects',t=>{
  const h=harness(t);h.get('.play-button').click();h.advance(25200);h.hide(true);
  assert.equal(h.canvas(),undefined);h.advance(10000);h.hide(false);
  assert.equal(h.page.dataset.phase,'deep');assert.equal(h.page.dataset.deepEntry,undefined);
  assert.equal(h.get('.screen-reminder').textContent,'');
});

test('missing Canvas degrades safely and unmount releases all timers',t=>{
  const h=harness(t,{noCanvas:true});h.get('.play-button').click();h.advance(25000);
  assert.equal(h.page.dataset.deepEntry,'entering');h.advance(1520);
  assert.equal(h.page.dataset.phase,'deep');h.dispose();assert.equal(h.jobs.size,0);
});

test('WebGL spiral capture uses the existing cards and is removed on completion',t=>{
  const h=harness(t,{gl:true});h.get('.play-button').click();h.advance(25000);
  assert.ok(h.canvas().draws>0);assert.equal(h.page.classList.contains('deep-has-frame'),true);
  h.advance(1520);assert.equal(h.canvas(),undefined);assert.equal(h.page.classList.contains('deep-has-frame'),false);
});

test('unmount during entry releases the snapshot, animation frame and callbacks',t=>{
  const h=harness(t);h.get('.play-button').click();h.advance(25100);
  assert.ok(h.canvas());h.dispose();
  assert.equal(h.canvas(),undefined);assert.equal(h.jobs.size,0);
  h.advance(10000);assert.equal(h.get('.screen-reminder').textContent,'');
});

test('returning before DEEP rewarms the current spiral for a later capture',t=>{
  const h=harness(t,{gl:true});h.get('.play-button').click();h.advance(1000);
  h.hide(true);h.advance(2000);h.hide(false);h.advance(22000);
  assert.equal(h.page.classList.contains('deep-has-frame'),true);
});

test('unavailable media falls back to background fade without interrupting the session',t=>{
  const h=harness(t);h.get('video').readyState=0;
  h.get('.play-button').click();h.advance(25000);
  assert.equal(h.page.dataset.deepEntry,'entering');assert.equal(h.canvas(),undefined);
  h.advance(1520);assert.equal(h.page.dataset.running,'true');assert.equal(h.get('audio').pauses,0);
});

test('keyboard pause and sound remain independent during the transition',t=>{
  const h=harness(t);h.get('.play-button').click();h.advance(25100);
  function key(code,key){const event=new Event('keydown');Object.assign(event,{code,key});h.doc.dispatchEvent(event);}
  key('Space',' ');assert.equal(h.page.dataset.running,'false');
  key('KeyM','m');assert.equal(h.page.dataset.sound,'off');
  key('KeyM','m');assert.equal(h.page.dataset.sound,'on');
  h.advance(1520);assert.equal(h.canvas(),undefined);assert.equal(h.page.dataset.phase,'deep');
});

test('the WebGL camera lock follows session presence, not pause state',async()=>{
  const scene=await readFile(new URL('../site/src/gl/scene.js',import.meta.url),'utf8');
  assert.ok(scene.includes('this.lockTarget = this.page.dataset.started === "true" ? 1 : 0;'));
});
