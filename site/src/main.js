import "./styles.css";
import { FocusTimer } from "./timer.js";
import { Hud } from "./hud.js";

const previewMode = new URLSearchParams(location.search).get("preview") === "events";

// The CSS build is the fallback target, not a stripped-down second design —
// anything without WebGL2 gets the full previous experience instead of a
// broken canvas.
function hasWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

if (!hasWebGL2()) {
  location.replace(`${import.meta.env.BASE_URL}fallback/${location.search}`);
} else {
  boot();
}

async function boot() {
  const video = document.getElementById("video");
  const audio = document.getElementById("audio");
  const timer = new FocusTimer({ previewMode });
  const hud = new Hud(timer, { previewMode });

  const { Scene } = await import("./gl/scene.js");
  const scene = new Scene(document.getElementById("gl"), video, video.getAttribute("poster"));
  await scene.load();

  scene.setClock(timer.clockText);
  scene.setPhase(timer.phase);
  document.getElementById("focusPage").dataset.gl = "on";

  timer.addEventListener("start", () => {
    void video.play();
    if (timer.soundOn) void audio.play();
  });
  timer.addEventListener("sound", () => {
    if (timer.soundOn && timer.started) void audio.play();
    else audio.pause();
  });
  timer.addEventListener("reset", () => {
    // Paused, not rewound: the clip opens on a black frame, and seeking back to
    // it would blank the backdrop every time someone resets.
    video.pause();
    audio.pause();
  });
  timer.addEventListener("tick", () => scene.setClock(timer.clockText));
  timer.addEventListener("phase", () => scene.setPhase(timer.phase));

  // Phase 1 stands in for the scroll-driven mode switch: the scene calms down
  // the moment the timer is actually running.
  const syncMode = () => scene.setInstrumentMode(timer.running);
  timer.addEventListener("start", syncMode);
  timer.addEventListener("pause", syncMode);
  timer.addEventListener("resume", syncMode);
  timer.addEventListener("reset", syncMode);

  scene.onFrame = () => timer.update();
  scene.start();

  if (import.meta.env.DEV) Object.assign(window, { timer, hud, scene });
}
