const target = (() => {
  try {
    const url = new URL(location.hash.slice(1));
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
})();
if (target) document.getElementById("host").textContent = target.hostname.replace(/^www\./, "");

const elapsed = document.getElementById("elapsed");
let since = 0;
const pad = value => String(value).padStart(2, "0");
function tick() {
  if (!since) return;
  const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const hours = Math.floor(seconds / 3600);
  elapsed.textContent = (hours ? hours + ":" : "") + pad(Math.floor(seconds / 60) % 60) + ":" + pad(seconds % 60);
}

// Once the session is reset the page offers the way through instead of a
// reload, so the reader decides whether the detour is still worth it.
function render(state) {
  since = state.since;
  document.body.classList.toggle("released", !state.locked);
  document.getElementById("state").textContent = state.locked ? "NOISE FILTER / ENGAGED" : "NOISE FILTER / RELEASED";
  document.getElementById("reason").textContent = state.locked
    ? "专注会话进行中，社交媒体、视频和游戏都已屏蔽。"
    : "计时器已重置，屏蔽已经解除。";
  document.querySelector(".meta").hidden = !state.locked;
  const resume = document.getElementById("resume");
  resume.hidden = state.locked || !target;
  if (target) resume.href = target.href;
  tick();
}

chrome.storage.local.get({ locked: false, since: 0 }).then(render);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.locked || changes.since)) chrome.storage.local.get({ locked: false, since: 0 }).then(render);
});
setInterval(tick, 1000);
