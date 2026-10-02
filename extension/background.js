import { APP_RULES, BLOCKED_DOMAINS, NATIVE_HOST, isBlockedUrl } from "./blocklist.js";

// The filter has one switch: `locked` in storage. A timer page sets it when a
// session starts and clears it when that session is reset — nothing else does.
// Closing the tab, restarting the browser or pausing leaves it on, so the only
// way back to the noise is through the timer.

const PAGE_RULE = 1, FRAME_RULE = 2;
const DEFAULTS = { locked: false, since: 0, apps: "idle", appsClosed: 0 };

let locked = false;
let port = null;
const ready = chrome.storage.local.get(DEFAULTS).then(state => { locked = state.locked; });

const blockedPage = url => chrome.runtime.getURL("blocked.html") + "#" + url;

async function applyRules(on) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [PAGE_RULE, FRAME_RULE],
    addRules: on ? [
      {
        id: PAGE_RULE, priority: 1,
        // \0 carries the requested URL to the block page, which names the site.
        action: { type: "redirect", redirect: { regexSubstitution: chrome.runtime.getURL("blocked.html") + "#\\0" } },
        condition: { regexFilter: "^.+$", requestDomains: BLOCKED_DOMAINS, resourceTypes: ["main_frame"] },
      },
      {
        id: FRAME_RULE, priority: 1,
        action: { type: "block" },
        condition: { requestDomains: BLOCKED_DOMAINS, resourceTypes: ["sub_frame"] },
      },
    ] : [],
  });
}

// Network rules only stop new requests; pages that were already open, or that
// come back from the back/forward cache, are swapped out here.
async function sweepTabs() {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.url && isBlockedUrl(tab.url)) chrome.tabs.update(tab.id, { url: blockedPage(tab.url) }).catch(() => {});
  }
}

function setBadge(on) {
  chrome.action.setBadgeText({ text: on ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#ea4d32" });
}

function startAppGuard() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST);
  } catch {
    chrome.storage.local.set({ apps: "missing" });
    return;
  }
  const own = port;
  own.onMessage.addListener(async message => {
    if (message.type === "ready") chrome.storage.local.set({ apps: "on" });
    if (message.type === "closed") {
      const { appsClosed } = await chrome.storage.local.get(DEFAULTS);
      chrome.storage.local.set({ appsClosed: appsClosed + 1 });
    }
  });
  own.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message ?? "";
    if (port === own) port = null;
    // A missing host is a setup step, not a failure; the alarm retries the rest.
    chrome.storage.local.set({ apps: /not found/i.test(error) ? "missing" : locked ? "error" : "idle" });
  });
  own.postMessage({ type: "lock", rules: APP_RULES });
}

async function stopAppGuard() {
  if (port) {
    port.postMessage({ type: "unlock" });
    port.disconnect();
    port = null;
  }
  // "missing" stays visible in the popup until the host is installed.
  const { apps } = await chrome.storage.local.get(DEFAULTS);
  if (apps !== "missing") await chrome.storage.local.set({ apps: "idle" });
}

async function lock() {
  await ready;
  if (!locked) {
    locked = true;
    await chrome.storage.local.set({ locked: true, since: Date.now(), appsClosed: 0 });
  }
  await applyRules(true);
  setBadge(true);
  startAppGuard();
  await sweepTabs();
}

async function unlock() {
  await ready;
  locked = false;
  await chrome.storage.local.set({ locked: false, since: 0 });
  await applyRules(false);
  setBadge(false);
  await stopAppGuard();
}

// Brings the rules, badge and app host back in line with storage — after a
// browser restart, an extension update, or a host that dropped out.
async function reconcile() {
  await ready;
  if (locked) {
    await applyRules(true);
    setBadge(true);
    startAppGuard();
  } else {
    await applyRules(false);
    setBadge(false);
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!sender.tab) return;
  const action = message?.type === "lock" ? lock : message?.type === "unlock" ? unlock : null;
  if (!action) return;
  action().then(() => respond({ locked }), error => respond({ error: String(error) }));
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (!change.url) return;
  await ready;
  if (locked && isBlockedUrl(change.url)) chrome.tabs.update(tabId, { url: blockedPage(change.url) }).catch(() => {});
});

chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "reconcile") reconcile(); });
chrome.runtime.onStartup.addListener(reconcile);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("reconcile", { periodInMinutes: 1 });
  reconcile();
});
reconcile();
