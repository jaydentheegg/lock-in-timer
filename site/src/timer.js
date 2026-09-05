export const MILESTONES = [
  { seconds: 600, previewSeconds: 10, phase: "trace", code: "TRACE", message: "注意力链路稳定" },
  { seconds: 1500, previewSeconds: 25, phase: "deep", code: "DEEP", message: "外部信号正在衰减" },
  { seconds: 2700, previewSeconds: 45, phase: "null", code: "NULL", message: "只剩任务与呼吸" },
  { seconds: 4500, previewSeconds: 75, phase: "lock", code: "LOCK", message: "本次连接已不可逆" },
];

export const BROADCASTS = [
  "注意力信号已捕获。",
  "外部噪声正在失去权限。",
  "保持当前输入。",
  "任务通道稳定。",
  "不要回应无关信号。",
  "认知负载：可控。",
  "继续。不要解释。",
  "别让自己昏过去。",
  "未登记频道：有人比你更早到达这里。",
  "归档损坏：你曾经完成过这一段。",
];

const formatClock = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Timing state, with no DOM and no WebGL in it, so the GL build and the CSS
 * fallback can eventually share one implementation.
 *
 * Elapsed time comes from wall-clock deltas rather than counting interval
 * ticks: a backgrounded tab throttles timers to once a minute, which made the
 * old setInterval build silently lose minutes off a long session.
 */
export class FocusTimer extends EventTarget {
  constructor({ previewMode = false } = {}) {
    super();
    this.previewMode = previewMode;
    this.elapsedMs = 0;
    this.startedAt = 0;
    this.started = false;
    this.running = false;
    this.soundOn = true;
    this.phase = "link";
    this.fired = new Set();
    this.lastSeconds = -1;
  }

  threshold(milestone) {
    return this.previewMode ? milestone.previewSeconds : milestone.seconds;
  }

  get seconds() {
    return Math.floor(this.elapsedMs / 1000);
  }

  get clockText() {
    return formatClock(this.seconds);
  }

  get progress() {
    const total = this.threshold(MILESTONES[MILESTONES.length - 1]);
    return Math.min(this.seconds / total, 1);
  }

  phaseAt(seconds) {
    let phase = "link";
    for (const milestone of MILESTONES) {
      if (seconds >= this.threshold(milestone)) phase = milestone.phase;
    }
    return phase;
  }

  toggle() {
    if (!this.started) {
      this.started = true;
      this.running = true;
      this.startedAt = performance.now();
      this.emit("start");
    } else if (this.running) {
      this.elapsedMs += performance.now() - this.startedAt;
      this.running = false;
      this.emit("pause");
    } else {
      this.startedAt = performance.now();
      this.running = true;
      this.emit("resume");
    }
    this.emit("change");
  }

  toggleSound() {
    this.soundOn = !this.soundOn;
    this.emit("sound");
    this.emit("change");
  }

  reset() {
    const previousPhase = this.phase;
    this.elapsedMs = 0;
    this.startedAt = 0;
    this.started = false;
    this.running = false;
    this.phase = "link";
    this.fired.clear();
    this.lastSeconds = -1;
    // Emitted here as well as from update(), or anything listening for phase
    // changes stays dressed for the phase the session ended in.
    if (previousPhase !== "link") this.emit("phase", { phase: "link" });
    this.emit("reset");
    this.emit("change");
  }

  // Driven from the render loop; safe to call at any rate.
  update() {
    if (this.running) {
      const now = performance.now();
      this.elapsedMs += now - this.startedAt;
      this.startedAt = now;
    }

    const seconds = this.seconds;
    if (seconds === this.lastSeconds) return;
    this.lastSeconds = seconds;

    const phase = this.phaseAt(seconds);
    if (phase !== this.phase) {
      this.phase = phase;
      this.emit("phase", { phase });
    }

    // Held back while the tab is away rather than marked fired, so a milestone
    // crossed in the background still lands once the user comes back.
    if (!document.hidden) {
      for (const milestone of MILESTONES) {
        if (seconds >= this.threshold(milestone) && !this.fired.has(milestone.code)) {
          this.fired.add(milestone.code);
          this.emit("milestone", { milestone });
        }
      }
    }

    this.emit("tick", { seconds });
    this.emit("change");
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
