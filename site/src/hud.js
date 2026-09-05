import { BROADCASTS } from "./timer.js";

const BROADCAST_TIMING = {
  firstMs: 45000,
  minMs: 360000,
  maxMs: 660000,
  visibleMs: 4400,
  preview: { firstMs: 3000, minMs: 5000, maxMs: 9000 },
};
const MILESTONE_VISIBLE_MS = 3000;

const randomBetween = (min, max) => min + Math.round(Math.random() * (max - min));

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Everything still drawn by the DOM: rail, labels, controls, the two overlays. */
export class Hud {
  constructor(timer, { previewMode = false } = {}) {
    this.timer = timer;
    this.previewMode = previewMode;
    this.deck = [];
    this.broadcastTimer = 0;
    this.broadcastHideTimer = 0;
    this.milestoneHideTimer = 0;

    const $ = (id) => document.getElementById(id);
    this.page = $("focusPage");
    this.rail = $("phaseRail");
    this.phaseName = $("phaseName");
    this.playButton = $("play");
    this.soundButton = $("sound");
    this.resetButton = $("reset");
    this.fullscreenButton = $("fullscreen");
    this.reminder = $("reminder");
    this.milestone = $("milestone");
    this.milestoneCode = $("milestoneCode");
    this.milestoneMessage = $("milestoneMessage");
    this.srClock = $("srClock");

    if (previewMode) $("previewIndicator").hidden = false;

    this.bindControls();
    this.bindTimer();
    this.render();
  }

  bindControls() {
    this.playButton.addEventListener("click", () => this.timer.toggle());
    this.soundButton.addEventListener("click", () => this.timer.toggleSound());
    this.resetButton.addEventListener("click", () => this.timer.reset());
    this.fullscreenButton.addEventListener("click", () => this.toggleFullscreen());

    document.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const isSpace = event.key === " " || event.code === "Space";
      const onButton = document.activeElement instanceof HTMLButtonElement;
      if (onButton && (isSpace || event.key === "Enter")) return;
      if (isSpace) {
        event.preventDefault();
        this.timer.toggle();
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "r") this.timer.reset();
      else if (key === "m") this.timer.toggleSound();
      else if (key === "f") void this.toggleFullscreen();
    });

    document.addEventListener("visibilitychange", () => {
      window.clearTimeout(this.broadcastTimer);
      if (!this.timer.started) return;
      if (document.hidden) {
        window.clearTimeout(this.broadcastHideTimer);
        this.clearBroadcast();
      } else {
        this.scheduleBroadcast();
      }
    });

    window.addEventListener("pagehide", () => this.clearTimers());
  }

  bindTimer() {
    this.timer.addEventListener("change", () => this.render());
    this.timer.addEventListener("start", () => {
      this.scheduleBroadcast(
        this.previewMode ? BROADCAST_TIMING.preview.firstMs : BROADCAST_TIMING.firstMs,
      );
    });
    this.timer.addEventListener("reset", () => {
      this.clearTimers();
      this.clearBroadcast();
      this.hideMilestone();
    });
    this.timer.addEventListener("milestone", (event) => this.showMilestone(event.detail.milestone));
  }

  async toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }

  render() {
    const { timer } = this;
    this.page.dataset.phase = timer.phase;
    this.page.dataset.started = String(timer.started);
    this.page.style.setProperty("--progress", timer.progress.toFixed(4));
    this.phaseName.textContent = timer.phase.toUpperCase();

    // The clock itself lives in WebGL, so the DOM keeps a text-only mirror for
    // screen readers and for the accessibility tree.
    this.srClock.textContent = timer.clockText;
    this.srClock.dateTime = `PT${timer.seconds}S`;

    this.playButton.dataset.running = String(timer.running);
    this.playButton.classList.toggle("is-active", timer.running);
    this.playButton.setAttribute(
      "aria-label",
      timer.running ? "暂停计时" : timer.started ? "继续计时" : "开始计时",
    );
    this.playButton.setAttribute("aria-pressed", String(timer.running));

    this.soundButton.dataset.sound = timer.soundOn ? "on" : "off";
    this.soundButton.classList.toggle("is-active", timer.soundOn);
    this.soundButton.setAttribute("aria-label", timer.soundOn ? "关闭声音" : "打开声音");
    this.soundButton.setAttribute("aria-pressed", String(timer.soundOn));

    this.resetButton.disabled = !timer.started;
  }

  nextBroadcast() {
    if (this.deck.length === 0) this.deck = shuffled(BROADCASTS);
    return this.deck.pop() ?? BROADCASTS[0];
  }

  showBroadcast() {
    if (!this.timer.started || document.hidden) return;
    this.reminder.textContent = this.nextBroadcast();
    this.reminder.style.left = `${30 + Math.round(Math.random() * 40)}%`;
    this.reminder.style.top = `${26 + Math.round(Math.random() * 44)}%`;
    this.reminder.classList.remove("show");
    void this.reminder.offsetWidth;
    this.reminder.classList.add("show");
    window.clearTimeout(this.broadcastHideTimer);
    this.broadcastHideTimer = window.setTimeout(
      () => this.clearBroadcast(),
      BROADCAST_TIMING.visibleMs,
    );
    this.scheduleBroadcast();
  }

  scheduleBroadcast(delay) {
    window.clearTimeout(this.broadcastTimer);
    if (!this.timer.started || document.hidden) return;
    const range = this.previewMode ? BROADCAST_TIMING.preview : BROADCAST_TIMING;
    this.broadcastTimer = window.setTimeout(
      () => this.showBroadcast(),
      delay ?? randomBetween(range.minMs, range.maxMs),
    );
  }

  clearBroadcast() {
    this.reminder.classList.remove("show");
    this.reminder.textContent = "";
  }

  showMilestone(milestone) {
    this.milestoneCode.textContent = milestone.code;
    this.milestoneMessage.textContent = milestone.message;
    this.milestone.classList.remove("show");
    void this.milestone.offsetWidth;
    this.milestone.classList.add("show");
    this.page.classList.add("milestone-open");
    window.clearTimeout(this.milestoneHideTimer);
    this.milestoneHideTimer = window.setTimeout(() => this.hideMilestone(), MILESTONE_VISIBLE_MS);
  }

  hideMilestone() {
    this.milestone.classList.remove("show");
    this.page.classList.remove("milestone-open");
  }

  clearTimers() {
    window.clearTimeout(this.broadcastTimer);
    window.clearTimeout(this.broadcastHideTimer);
    window.clearTimeout(this.milestoneHideTimer);
  }
}
