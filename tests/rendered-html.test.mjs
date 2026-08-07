import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders only the focus stopwatch experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /专注计时器/);

  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /study-background\.mp4/);
  assert.match(page, /study-audio\.m4a/);
  assert.match(page, /别让自己昏过去/);
  assert.match(page, /reminder-burst|screen-reminder/);
  assert.match(page, /elapsedSeconds/);
  assert.match(page, /started/);
  assert.doesNotMatch(page, /DURATIONS|secondsLeft|XP|证据墙|随身物件|设置/);

  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const staticPage = await readFile(new URL("../github-pages/index.html", import.meta.url), "utf8");
  assert.match(styles, /Tektur Display/);
  assert.match(styles, /QingKe Display/);
  assert.match(styles, /Wallpoet Display/);
  assert.match(page, /cyber-control/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /data-clock/);
  assert.match(page, /data-reminder/);
  assert.match(page, /8000/);
  assert.match(page, /24000/);
  assert.match(page, /3200/);
  assert.match(styles, /clock-glitch-a/);
  assert.match(styles, /clock-glitch-b/);
  assert.match(styles, /subtitle-glitch-a/);
  assert.match(styles, /subtitle-glitch-b/);
  assert.doesNotMatch(styles, /90,224,255|73,219,255/);
  assert.match(styles, /color:rgba\(245,237,222,\.5\)/);
  assert.match(styles, /color:rgba\(0,0,0,\.82\)/);
  assert.match(styles, /#e53430/);
  assert.match(styles, /#f2a21d/);
  assert.match(styles, /mask-image:repeating-linear-gradient/);
  assert.match(styles, /white-space:nowrap/);
  assert.doesNotMatch(styles, /border-left/);
  assert.match(staticPage, /styles\.css\?v=6/);
  assert.match(staticPage, /app\.js\?v=6/);
});
