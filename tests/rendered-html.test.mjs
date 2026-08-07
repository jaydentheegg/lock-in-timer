import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js",import.meta.url);
  workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);
  const { default:worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/",{ headers:{ accept:"text/html" } }),
    { ASSETS:{ fetch:async () => new Response("Not found",{ status:404 }) } },
    { waitUntil(){}, passThroughOnException(){} },
  );
}

test("renders the immersive focus experience",async () => {
  const response = await render();
  assert.equal(response.status,200);
  const html = await response.text();
  assert.match(html,/专注计时器/);

  const page = await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  const styles = await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  const experience = await readFile(new URL("../lib/experience.ts",import.meta.url),"utf8");
  const staticPage = await readFile(new URL("../github-pages/index.html",import.meta.url),"utf8");
  const staticApp = await readFile(new URL("../github-pages/app.js",import.meta.url),"utf8");
  const staticStyles = await readFile(new URL("../github-pages/styles.css",import.meta.url),"utf8");
  const workflow = await readFile(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8");

  assert.match(page,/study-background\.mp4/);
  assert.match(page,/study-audio\.m4a/);
  assert.match(page,/data-phase/);
  assert.match(page,/data-anomaly/);
  assert.match(page,/pixelCanvasRef/);
  assert.match(page,/drawImage/);
  assert.match(page,/visibilitychange/);
  assert.match(page,/preview.*events/is);
  assert.match(page,/cyber-control/);
  assert.match(page,/aria-pressed/);
  assert.doesNotMatch(page,/DURATIONS|secondsLeft|\bXP\b|证据墙|随身物件|设置|localStorage/);

  for (const token of ["link","trace","deep","null","lock","FRAME LOSS","MEMORY ECHO","SIGNAL BLEED","PIXEL DROP"]) {
    assert.match(experience,new RegExp(token));
    assert.match(staticApp,new RegExp(token));
  }
  for (const timing of ["600","1500","2700","4500","8000","18000","32000","240000","420000","3200","2600"]) {
    assert.match(experience,new RegExp(timing));
    assert.match(staticApp,new RegExp(timing));
  }
  for (const previewSecond of ["previewSeconds: 10","previewSeconds: 25","previewSeconds: 45","previewSeconds: 75"]) {
    assert.match(experience,new RegExp(previewSecond));
  }
  assert.match(experience,/别让自己昏过去/);
  assert.match(experience,/有人比你更早到达这里/);
  assert.match(staticApp,/broadcastDeck/);
  assert.match(staticApp,/document\.hidden/);
  assert.match(staticApp,/stopPixelDrop/);
  assert.doesNotMatch(staticApp,/localStorage/);

  assert.match(styles,/Wallpoet Display/);
  assert.match(styles,/phase-atmosphere/);
  assert.match(styles,/milestone-enter/);
  assert.match(styles,/frame-loss/);
  assert.match(styles,/memory-echo/);
  assert.match(styles,/signal-bleed/);
  assert.match(styles,/pixel-drop/);
  assert.match(styles,/prefers-reduced-motion/);
  assert.match(styles,/#e53430/);
  assert.match(styles,/#f2a21d/);
  assert.match(styles,/white-space:nowrap/);
  assert.doesNotMatch(styles,/border-left/);
  assert.match(staticStyles,/phase-atmosphere/);
  assert.match(staticStyles,/pixel-canvas/);

  assert.match(staticPage,/data-phase="link"/);
  assert.match(staticPage,/pixelCanvas/);
  assert.match(staticPage,/styles\.css\?v=7/);
  assert.match(staticPage,/app\.js\?v=7/);
  assert.doesNotMatch(workflow,/agent\/immersive-focus-events/);
});
