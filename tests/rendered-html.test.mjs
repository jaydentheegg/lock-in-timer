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

test("renders the wymcxvsure evidence system", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /wymcxvsure/);
  assert.match(html, /每日证据/);
  assert.doesNotMatch(html, /早起点火|codex-preview|react-loading-skeleton/i);

  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /wymcxvsure-v1/);
  assert.match(page, /\+20 XP/);
  assert.match(page, /本周摘要/);
  assert.match(page, /导出备份/);
  assert.match(page, /导入会替换当前 wymcxvsure 数据/);
  assert.match(page, /morningCheckedAt/);
  assert.match(page, /xpAwarded/);
});
