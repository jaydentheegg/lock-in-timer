import { BLOCKED_DOMAINS, NATIVE_HOST } from "./blocklist.js";

const $ = id => document.getElementById(id);
const pad = value => String(value).padStart(2, "0");
let probed = false;
const INSTALL = "未安装 · 在仓库里运行 <code>node extension/native/install.mjs</code>";

$("sites").textContent = `${BLOCKED_DOMAINS.length} 个社交、视频、游戏域名`;

chrome.extension.isAllowedIncognitoAccess().then(allowed => {
  $("incognito").textContent = allowed ? "已允许，无痕窗口同样屏蔽" : "未允许 · 在扩展详情里打开「在无痕模式下启用」，否则无痕窗口不受限";
  $("incognito").classList.toggle("warn", !allowed);
});

async function render() {
  const state = await chrome.storage.local.get({ locked: false, since: 0, apps: "idle", appsClosed: 0 });
  let label = "NOISE FILTER / ARMED";
  if (state.locked) {
    const minutes = Math.floor((Date.now() - state.since) / 60000);
    label = `NOISE FILTER / ENGAGED · ${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
  }
  $("state").textContent = label;
  $("state").parentElement.style.color = state.locked ? "" : "var(--amber)";

  const apps = $("apps");
  apps.classList.toggle("warn", state.apps === "missing" || state.apps === "error");
  if (state.apps === "on") apps.textContent = `运行中 · 本次已拦下 ${state.appsClosed} 次启动`;
  else if (state.apps === "error") apps.textContent = "连接中断，每分钟自动重试";
  else if (state.apps === "missing") apps.innerHTML = INSTALL;
  else apps.textContent = probed ? "已安装，开始专注后关闭游戏和社交应用" : "检测中…";
}

// Ask the host directly whether it is installed, so the popup is right even
// before the first session.
chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: "ping" }).then(
  () => chrome.storage.local.get({ apps: "idle" }).then(({ apps }) => apps === "missing" && chrome.storage.local.set({ apps: "idle" })),
  () => chrome.storage.local.get({ apps: "idle" }).then(({ apps }) => apps !== "on" && chrome.storage.local.set({ apps: "missing" })),
).finally(() => { probed = true; render(); });

chrome.storage.onChanged.addListener(render);
render();
