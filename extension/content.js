// Bridges a timer page and the filter. The page owns the session: `data-started`
// turning true engages the filter, a `focusreset` event releases it. The filter
// state goes back on <html data-noise-filter>, which the page shows in its HUD.
(() => {
  const page = document.querySelector(".focus-page");
  if (!page) return;
  const root = document.documentElement;
  let locked = null;

  const send = type => {
    try { chrome.runtime.sendMessage({ type }).catch(() => {}); } catch { /* Extension reloaded under the page. */ }
  };
  const show = value => { locked = value; root.dataset.noiseFilter = value ? "engaged" : "armed"; };
  // Also re-engages if another timer tab released the filter while this one is
  // still running.
  const sync = () => {
    if (page.dataset.started === "true" && locked === false) { locked = true; send("lock"); }
  };

  chrome.storage.local.get({ locked: false }).then(state => { show(state.locked); sync(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.locked) { show(changes.locked.newValue); sync(); }
  });
  new MutationObserver(sync).observe(page, { attributes: true, attributeFilter: ["data-started"] });
  page.addEventListener("focusreset", () => send("unlock"));
})();
