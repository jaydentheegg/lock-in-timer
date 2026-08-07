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
});
