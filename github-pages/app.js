const reminders = [
  "别让自己昏过去。",
  "抬头。回来。",
  "只处理眼前这一分钟。",
  "别把注意力交出去。",
  "你现在只需要继续。",
  "把这一小段守住。",
];

const video = document.querySelector("#video");
const audio = document.querySelector("#audio");
const clock = document.querySelector("#clock");
const playButton = document.querySelector("#play");
const soundButton = document.querySelector("#sound");
const reminder = document.querySelector("#reminder");

let elapsedSeconds = 0;
let started = false;
let running = false;
let soundOn = true;

const formatClock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;

function render() {
  clock.textContent = formatClock(elapsedSeconds);
  clock.dataset.clock = formatClock(elapsedSeconds);
  clock.dateTime = `PT${elapsedSeconds}S`;
  playButton.dataset.running = String(running);
  playButton.classList.toggle("is-active", running);
  playButton.setAttribute("aria-label", running ? "暂停计时" : started ? "继续计时" : "开始计时");
  playButton.setAttribute("aria-pressed", String(running));
  soundButton.dataset.sound = soundOn ? "on" : "off";
  soundButton.classList.toggle("is-active", soundOn);
  soundButton.setAttribute("aria-label", soundOn ? "关闭声音" : "打开声音");
  soundButton.setAttribute("aria-pressed", String(soundOn));
}

function showReminder(text = reminders[Math.floor(Math.random() * reminders.length)]) {
  reminder.textContent = text;
  reminder.dataset.reminder = text;
  reminder.style.left = `${28 + Math.round(Math.random() * 44)}%`;
  reminder.style.top = `${22 + Math.round(Math.random() * 52)}%`;
  reminder.classList.remove("show");
  void reminder.offsetWidth;
  reminder.classList.add("show");
}

window.setInterval(() => {
  if (!running) return;
  elapsedSeconds += 1;
  render();
}, 1000);

window.setTimeout(() => { if (started) showReminder(); }, 8000);
window.setInterval(() => { if (started) showReminder(); }, 24000);

playButton.addEventListener("click", () => {
  if (!started) {
    started = true;
    running = true;
    void video.play();
    if (soundOn) void audio.play();
  } else {
    running = !running;
  }
  render();
});

soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn && started) void audio.play();
  else audio.pause();
  render();
});

document.querySelector("#fullscreen").addEventListener("click", async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
});

render();
