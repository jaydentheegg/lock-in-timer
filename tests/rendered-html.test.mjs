import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createSessionClock,phaseAt} from '../lib/focus-engine.js';
import {focusMarkup} from '../lib/focus-markup.js';

test('elapsed time survives delayed updates and excludes paused time',()=>{
  let now=0;
  const clock=createSessionClock(()=>now);
  assert.equal(clock.seconds(),0);
  clock.resume(); now=12345;
  assert.equal(clock.seconds(),12);
  clock.pause(); now+=100000;
  assert.equal(clock.seconds(),12);
  clock.resume(); now+=655;
  assert.equal(clock.seconds(),13);
  clock.pause(); clock.pause();
  clock.reset();
  assert.equal(clock.seconds(),0); assert.equal(clock.running,false);
});
test('resume is idempotent and background time is counted only while running',()=>{
  let now=0; const clock=createSessionClock(()=>now);
  clock.resume(); now=1000; clock.resume(); now=1500000;
  assert.equal(clock.seconds(),1500);
  assert.equal(phaseAt(clock.seconds()),2);
});
test('normal and accelerated phases switch at the exact boundaries',()=>{
  for(const [preview,boundaries] of [[false,[600,1500,2700,4500]],[true,[10,25,45,75]]]){
    assert.equal(phaseAt(0,preview),0);
    boundaries.forEach((seconds,index)=>{
      assert.equal(phaseAt(seconds-1,preview),index);
      assert.equal(phaseAt(seconds,preview),index+1);
    });
    assert.equal(phaseAt(999999,preview),4);
  }
});
test('Pages receives the same markup, runtime and styles as React',async()=>{
  const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
  const [html,css,staticCss,engine,staticEngine]=await Promise.all([read('github-pages/index.html'),read('app/globals.css'),read('github-pages/styles.css'),read('lib/focus-engine.js'),read('github-pages/app.js')]);
  assert.ok(html.includes(focusMarkup));
  assert.equal(staticCss,css.replaceAll("url('/fonts/","url('./fonts/"));
  assert.ok(staticEngine.startsWith(engine));
});
test('built page serves the complete focus interface',async()=>{
  const {default:worker}=await import('../dist/server/index.js');
  const response=await worker.fetch(new Request('http://localhost/',{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.ok(html.includes('aria-label="开始计时"'));
  assert.ok(html.includes('aria-label="重置计时"'));
  assert.ok(html.includes('study-poster.jpg'));
});
