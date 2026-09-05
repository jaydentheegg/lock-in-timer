import "../../app/globals.css";
import "./gl-overlay.css";
import { mountFocus } from "../../lib/focus-engine.js";

/**
 * The WebGL build. It adds nothing to the interface: the markup, the timing and
 * every HUD behaviour come from the same shared modules the React view and the
 * Pages fallback use. All this layer does is take over the two background
 * layers — the footage and the shade — and render them, plus a depth field, in
 * one canvas that later phases can move a camera through.
 */
function hasWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

// Without WebGL2 the CSS build is served instead — the full experience, not a
// degraded one.
if (!hasWebGL2()) {
  location.replace(`${import.meta.env.BASE_URL}fallback/${location.search}`);
} else {
  void boot();
}

async function boot() {
  const dispose = mountFocus(document);
  window.addEventListener("pagehide", dispose, { once: true });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });

  const page = document.querySelector(".focus-page");
  const canvas = document.createElement("canvas");
  canvas.className = "gl-scene";
  canvas.setAttribute("aria-hidden", "true");
  page.prepend(canvas);

  const { Scene } = await import("./gl/scene.js");
  const scene = new Scene(canvas, page, page.querySelector("video"));
  scene.start();

  // Only now do the CSS background layers step aside, so a failure above
  // leaves the page rendering exactly as the fallback would.
  page.dataset.gl = "on";

  if (import.meta.env.DEV) Object.assign(window, { scene });
}
