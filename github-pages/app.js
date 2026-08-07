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

const anomalies = [
  { kind:"frame-loss", label:"FRAME LOSS" },
  { kind:"memory-echo", label:"MEMORY ECHO" },
  { kind:"signal-bleed", label:"SIGNAL BLEED" },
  { kind:"pixel-drop", label:"PIXEL DROP" },
];

const timing = {
  firstBroadcastMs:8000,
  broadcastMinMs:18000,
  broadcastMaxMs:32000,
  broadcastVisibleMs:3200,
  anomalyMinMs:240000,
  anomalyMaxMs:420000,
  anomalyVisibleMs:1800,
  milestoneVisibleMs:2600,
  preview:{ firstBroadcastMs:3000, broadcastMinMs:4000, broadcastMaxMs:7000, anomalyMinMs:12000, anomalyMaxMs:18000 },
};

const focusPage = document.querySelector("#focusPage");
const video = document.querySelector("#video");
const audio = document.querySelector("#audio");
const clock = document.querySelector("#clock");
const playButton = document.querySelector("#play");
const soundButton = document.querySelector("#sound");
const reminder = document.querySelector("#reminder");
const phaseName = document.querySelector("#phaseName");
const previewIndicator = document.querySelector("#previewIndicator");
const milestoneElement = document.querySelector("#milestone");
const milestoneCode = document.querySelector("#milestoneCode");
const milestoneMessage = document.querySelector("#milestoneMessage");
const anomalyLabel = document.querySelector("#anomalyLabel");
const pixelCanvas = document.querySelector("#pixelCanvas");

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
let anomalyScheduleTimer = 0;
let anomalyHideTimer = 0;
let milestoneHideTimer = 0;
let pixelAnimationFrame = 0;
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

function render() {
  const clockText = formatClock(elapsedSeconds);
  const phase = getPhase(elapsedSeconds);
  clock.textContent = clockText;
  clock.dataset.clock = clockText;
  clock.dateTime = `PT${elapsedSeconds}S`;
  focusPage.dataset.phase = phase;
  phaseName.textContent = phase.toUpperCase();
  playButton.dataset.running = String(running);
  playButton.classList.toggle("is-active",running);
  playButton.setAttribute("aria-label",running ? "暂停计时" : started ? "继续计时" : "开始计时");
  playButton.setAttribute("aria-pressed",String(running));
  soundButton.dataset.sound = soundOn ? "on" : "off";
  soundButton.classList.toggle("is-active",soundOn);
  soundButton.setAttribute("aria-label",soundOn ? "关闭声音" : "打开声音");
  soundButton.setAttribute("aria-pressed",String(soundOn));
}

function clearBroadcast() {
  reminder.classList.remove("show");
  reminder.textContent = "";
  reminder.removeAttribute("data-reminder");
}

function nextBroadcast() {
  if (broadcastDeck.length === 0) broadcastDeck = shuffled(broadcasts);
  return broadcastDeck.pop() ?? broadcasts[0];
}

function showBroadcast() {
  if (!started || document.hidden) return;
  const text = nextBroadcast();
  reminder.textContent = text;
  reminder.dataset.reminder = text;
  reminder.style.left = `${28 + Math.round(Math.random() * 44)}%`;
  reminder.style.top = `${22 + Math.round(Math.random() * 52)}%`;
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

function showMilestone(item) {
  milestoneCode.textContent = item.code;
  milestoneMessage.textContent = item.message;
  milestoneElement.classList.remove("show");
  void milestoneElement.offsetWidth;
  milestoneElement.classList.add("show");
  window.clearTimeout(milestoneHideTimer);
  milestoneHideTimer = window.setTimeout(() => milestoneElement.classList.remove("show"),timing.milestoneVisibleMs);
}

function checkMilestones() {
  if (document.hidden) return;
  for (const item of milestones) {
    if (elapsedSeconds >= getThreshold(item) && !firedMilestones.has(item.code)) {
      firedMilestones.add(item.code);
      showMilestone(item);
    }
  }
}

function stopPixelDrop() {
  window.cancelAnimationFrame(pixelAnimationFrame);
  const context = pixelCanvas.getContext("2d");
  context?.clearRect(0,0,pixelCanvas.width,pixelCanvas.height);
}

function startPixelDrop() {
  const context = pixelCanvas.getContext("2d",{ alpha:false });
  if (!context) return;
  pixelCanvas.width = 96;
  pixelCanvas.height = 54;
  let lastDraw = 0;
  const draw = (now) => {
    if (now - lastDraw > 80 && video.readyState >= 2) {
      try {
        context.drawImage(video,0,0,pixelCanvas.width,pixelCanvas.height);
      } catch {
        context.fillStyle = "#171816";
        context.fillRect(0,0,pixelCanvas.width,pixelCanvas.height);
      }
      lastDraw = now;
    }
    pixelAnimationFrame = window.requestAnimationFrame(draw);
  };
  pixelAnimationFrame = window.requestAnimationFrame(draw);
}

function clearAnomaly() {
  stopPixelDrop();
  focusPage.dataset.anomaly = "none";
  anomalyLabel.classList.remove("show");
  anomalyLabel.textContent = "";
}

function showAnomaly() {
  if (!started || document.hidden) return;
  if (!reducedMotion.matches) {
    const selected = anomalies[Math.floor(Math.random() * anomalies.length)];
    clearAnomaly();
    focusPage.dataset.anomaly = selected.kind;
    anomalyLabel.textContent = selected.label;
    void anomalyLabel.offsetWidth;
    anomalyLabel.classList.add("show");
    if (selected.kind === "pixel-drop") startPixelDrop();
    window.clearTimeout(anomalyHideTimer);
    anomalyHideTimer = window.setTimeout(clearAnomaly,timing.anomalyVisibleMs);
  }
  scheduleAnomaly();
}

function scheduleAnomaly() {
  window.clearTimeout(anomalyScheduleTimer);
  if (!started || document.hidden) return;
  const minimum = previewMode ? timing.preview.anomalyMinMs : timing.anomalyMinMs;
  const maximum = previewMode ? timing.preview.anomalyMaxMs : timing.anomalyMaxMs;
  anomalyScheduleTimer = window.setTimeout(showAnomaly,randomBetween(minimum,maximum));
}

function startExperience() {
  const firstDelay = previewMode ? timing.preview.firstBroadcastMs : timing.firstBroadcastMs;
  scheduleBroadcast(firstDelay);
  scheduleAnomaly();
}

window.setInterval(() => {
  if (!running) return;
  elapsedSeconds += 1;
  checkMilestones();
  render();
},1000);

document.addEventListener("visibilitychange",() => {
  window.clearTimeout(broadcastScheduleTimer);
  window.clearTimeout(anomalyScheduleTimer);
  if (!started) return;
  if (document.hidden) {
    window.clearTimeout(broadcastHideTimer);
    window.clearTimeout(anomalyHideTimer);
    clearBroadcast();
    clearAnomaly();
  } else {
    scheduleBroadcast();
    scheduleAnomaly();
  }
});

playButton.addEventListener("click",() => {
  if (!started) {
    started = true;
    running = true;
    void video.play();
    if (soundOn) void audio.play();
    startExperience();
  } else {
    running = !running;
  }
  render();
});

soundButton.addEventListener("click",() => {
  soundOn = !soundOn;
  if (soundOn && started) void audio.play();
  else audio.pause();
  render();
});

document.querySelector("#fullscreen").addEventListener("click",async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
});

window.addEventListener("pagehide",() => {
  window.clearTimeout(broadcastScheduleTimer);
  window.clearTimeout(broadcastHideTimer);
  window.clearTimeout(anomalyScheduleTimer);
  window.clearTimeout(anomalyHideTimer);
  window.clearTimeout(milestoneHideTimer);
  stopPixelDrop();
});

render();
