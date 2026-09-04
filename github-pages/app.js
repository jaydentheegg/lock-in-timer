const milestones = [
  { seconds:600, previewSeconds:10, phase:"trace", code:"TRACE", message:"注意力链路稳定" },
  { seconds:1500, previewSeconds:25, phase:"deep", code:"DEEP", message:"外部信号正在衰减" },
  { seconds:2700, previewSeconds:45, phase:"null", code:"NULL", message:"只剩任务与呼吸" },
  { seconds:4500, previewSeconds:75, phase:"lock", code:"LOCK", message:"本次连接已不可逆" },
];

const broadcasts = [
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

// Anomalies fire on phase turnover only. Below DEEP the footage is still
// visible enough to tear; past it only the clock is left to glitch.
const anomalies = {
  surface:{ kind:"frame-loss", label:"FRAME LOSS" },
  deep:{ kind:"memory-echo", label:"MEMORY ECHO" },
};

const timing = {
  firstBroadcastMs:45000,
  broadcastMinMs:360000,
  broadcastMaxMs:660000,
  broadcastVisibleMs:4400,
  anomalyVisibleMs:1600,
  milestoneVisibleMs:3000,
  preview:{ firstBroadcastMs:3000, broadcastMinMs:5000, broadcastMaxMs:9000 },
};

const focusPage = document.querySelector("#focusPage");
const video = document.querySelector("#video");
const audio = document.querySelector("#audio");
const clock = document.querySelector("#clock");
const playButton = document.querySelector("#play");
const soundButton = document.querySelector("#sound");
const resetButton = document.querySelector("#reset");
const fullscreenButton = document.querySelector("#fullscreen");
const reminder = document.querySelector("#reminder");
const phaseName = document.querySelector("#phaseName");
const phaseRail = document.querySelector("#phaseRail");
const previewIndicator = document.querySelector("#previewIndicator");
const milestoneElement = document.querySelector("#milestone");
const milestoneCode = document.querySelector("#milestoneCode");
const milestoneMessage = document.querySelector("#milestoneMessage");
const anomalyLabel = document.querySelector("#anomalyLabel");

const previewMode = new URLSearchParams(window.location.search).get("preview") === "events";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (previewMode) previewIndicator.hidden = false;

let elapsedSeconds = 0;
let started = false;
let running = false;
let soundOn = true;
let broadcastDeck = [];
let broadcastScheduleTimer = 0;
let broadcastHideTimer = 0;
let anomalyHideTimer = 0;
let milestoneHideTimer = 0;
let currentPhase = "link";
const firedMilestones = new Set();

const formatClock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
const randomBetween = (minimum,maximum) => minimum + Math.round(Math.random() * (maximum - minimum));

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index],result[target]] = [result[target],result[index]];
  }
  return result;
}

function getThreshold(item) {
  return previewMode ? item.previewSeconds : item.seconds;
}

function getPhase(seconds) {
  let phase = "link";
  for (const item of milestones) if (seconds >= getThreshold(item)) phase = item.phase;
  return phase;
}

// One rail that fills once, across the whole session, to LOCK.
function getProgress(seconds) {
  const total = getThreshold(milestones[milestones.length - 1]);
  return Math.min(seconds / total,1);
}

function render() {
  const clockText = formatClock(elapsedSeconds);
  const phase = getPhase(elapsedSeconds);
  clock.textContent = clockText;
  clock.dataset.clock = clockText;
  clock.dateTime = `PT${elapsedSeconds}S`;
  focusPage.dataset.phase = phase;
  focusPage.dataset.started = String(started);
  focusPage.style.setProperty("--progress",getProgress(elapsedSeconds).toFixed(4));
  phaseName.textContent = phase.toUpperCase();
  currentPhase = phase;
  playButton.dataset.running = String(running);
  playButton.classList.toggle("is-active",running);
  playButton.setAttribute("aria-label",running ? "暂停计时" : started ? "继续计时" : "开始计时");
  playButton.setAttribute("aria-pressed",String(running));
  soundButton.dataset.sound = soundOn ? "on" : "off";
  soundButton.classList.toggle("is-active",soundOn);
  soundButton.setAttribute("aria-label",soundOn ? "关闭声音" : "打开声音");
  soundButton.setAttribute("aria-pressed",String(soundOn));
  resetButton.disabled = !started;
}

function clearBroadcast() {
  reminder.classList.remove("show");
  reminder.textContent = "";
}

function nextBroadcast() {
  if (broadcastDeck.length === 0) broadcastDeck = shuffled(broadcasts);
  return broadcastDeck.pop() ?? broadcasts[0];
}

function showBroadcast() {
  if (!started || document.hidden) return;
  reminder.textContent = nextBroadcast();
  reminder.style.left = `${30 + Math.round(Math.random() * 40)}%`;
  reminder.style.top = `${26 + Math.round(Math.random() * 44)}%`;
  reminder.classList.remove("show");
  void reminder.offsetWidth;
  reminder.classList.add("show");
  window.clearTimeout(broadcastHideTimer);
  broadcastHideTimer = window.setTimeout(clearBroadcast,timing.broadcastVisibleMs);
  scheduleBroadcast();
}

function scheduleBroadcast(delay) {
  window.clearTimeout(broadcastScheduleTimer);
  if (!started || document.hidden) return;
  const minimum = previewMode ? timing.preview.broadcastMinMs : timing.broadcastMinMs;
  const maximum = previewMode ? timing.preview.broadcastMaxMs : timing.broadcastMaxMs;
  broadcastScheduleTimer = window.setTimeout(showBroadcast,delay ?? randomBetween(minimum,maximum));
}

function clearAnomaly() {
  focusPage.dataset.anomaly = "none";
  anomalyLabel.classList.remove("show");
  anomalyLabel.textContent = "";
}

function showAnomaly() {
  if (!started || document.hidden || reducedMotion.matches) return;
  const selected = currentPhase === "link" || currentPhase === "trace" ? anomalies.surface : anomalies.deep;
  clearAnomaly();
  void anomalyLabel.offsetWidth;
  focusPage.dataset.anomaly = selected.kind;
  anomalyLabel.textContent = selected.label;
  anomalyLabel.classList.add("show");
  window.clearTimeout(anomalyHideTimer);
  anomalyHideTimer = window.setTimeout(clearAnomaly,timing.anomalyVisibleMs);
}

function hideMilestone() {
  milestoneElement.classList.remove("show");
  focusPage.classList.remove("milestone-open");
}

function showMilestone(item) {
  milestoneCode.textContent = item.code;
  milestoneMessage.textContent = item.message;
  milestoneElement.classList.remove("show");
  void milestoneElement.offsetWidth;
  milestoneElement.classList.add("show");
  focusPage.classList.add("milestone-open");
  window.clearTimeout(milestoneHideTimer);
  milestoneHideTimer = window.setTimeout(hideMilestone,timing.milestoneVisibleMs);
}

function checkMilestones() {
  if (document.hidden) return;
  for (const item of milestones) {
    if (elapsedSeconds >= getThreshold(item) && !firedMilestones.has(item.code)) {
      firedMilestones.add(item.code);
      currentPhase = item.phase;
      showMilestone(item);
      showAnomaly();
    }
  }
}

function clearAllTimers() {
  window.clearTimeout(broadcastScheduleTimer);
  window.clearTimeout(broadcastHideTimer);
  window.clearTimeout(anomalyHideTimer);
  window.clearTimeout(milestoneHideTimer);
}

function start() {
  started = true;
  running = true;
  void video.play();
  if (soundOn) void audio.play();
  scheduleBroadcast(previewMode ? timing.preview.firstBroadcastMs : timing.firstBroadcastMs);
}

function togglePlay() {
  if (!started) start();
  else running = !running;
  render();
}

function toggleSound() {
  soundOn = !soundOn;
  if (soundOn && started) void audio.play();
  else audio.pause();
  render();
}

function reset() {
  clearAllTimers();
  clearBroadcast();
  clearAnomaly();
  hideMilestone();
  firedMilestones.clear();
  started = false;
  running = false;
  elapsedSeconds = 0;
  currentPhase = "link";
  video.pause();
  video.currentTime = 0;
  audio.pause();
  audio.currentTime = 0;
  render();
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

window.setInterval(() => {
  if (!running) return;
  elapsedSeconds += 1;
  checkMilestones();
  render();
},1000);

document.addEventListener("visibilitychange",() => {
  window.clearTimeout(broadcastScheduleTimer);
  if (!started) return;
  if (document.hidden) {
    window.clearTimeout(broadcastHideTimer);
    window.clearTimeout(anomalyHideTimer);
    clearBroadcast();
    clearAnomaly();
  } else {
    scheduleBroadcast();
  }
});

playButton.addEventListener("click",togglePlay);
soundButton.addEventListener("click",toggleSound);
resetButton.addEventListener("click",reset);
fullscreenButton.addEventListener("click",toggleFullscreen);

document.addEventListener("keydown",(event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  // Let a focused button handle its own Space/Enter activation.
  const isSpace = event.key === " " || event.code === "Space";
  if (document.activeElement instanceof HTMLButtonElement && (isSpace || event.key === "Enter")) return;
  if (isSpace) { event.preventDefault(); togglePlay(); return; }
  const key = event.key.toLowerCase();
  if (key === "r") reset();
  else if (key === "m") toggleSound();
  else if (key === "f") void toggleFullscreen();
});

window.addEventListener("pagehide",clearAllTimers);

render();
