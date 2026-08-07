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
const progress = document.querySelector("#progress");
const playButton = document.querySelector("#play");
const soundButton = document.querySelector("#sound");
const reminder = document.querySelector("#reminder");

let duration = 25;
let secondsLeft = duration * 60;
let running = true;
let soundOn = false;

const formatClock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;

function render() {
  clock.textContent = formatClock(secondsLeft);
  clock.dateTime = `PT${secondsLeft}S`;
  progress.style.width = `${((duration * 60 - secondsLeft) / (duration * 60)) * 100}%`;
  playButton.textContent = running ? "Ⅱ" : "▶";
  playButton.setAttribute("aria-label", running ? "暂停" : "播放");
  soundButton.textContent = soundOn ? "声音：开" : "声音：关";
}

function showReminder(text = reminders[Math.floor(Math.random() * reminders.length)]) {
  reminder.textContent = text;
  reminder.style.left = `${18 + Math.round(Math.random() * 64)}%`;
  reminder.style.top = `${22 + Math.round(Math.random() * 52)}%`;
  reminder.classList.remove("show");
  void reminder.offsetWidth;
  reminder.classList.add("show");
}

window.setInterval(() => {
  if (!running) return;
  if (secondsLeft <= 1) {
    secondsLeft = 0;
    running = false;
    video.pause();
    audio.pause();
    showReminder("这一段完成了。");
  } else {
    secondsLeft -= 1;
  }
  render();
}, 1000);

window.setTimeout(() => { if (running) showReminder(); }, 18000);
window.setInterval(() => { if (running) showReminder(); }, 52000);

document.querySelectorAll("[data-minutes]").forEach((button) => {
  button.addEventListener("click", () => {
    duration = Number(button.dataset.minutes);
    secondsLeft = duration * 60;
    running = true;
    video.currentTime = 0;
    void video.play();
    audio.currentTime = 0;
    if (soundOn) void audio.play();
    document.querySelectorAll("[data-minutes]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
});

playButton.addEventListener("click", () => {
  running = !running;
  if (running) {
    if (secondsLeft === 0) secondsLeft = duration * 60;
    void video.play();
    if (soundOn) void audio.play();
  } else {
    video.pause();
    audio.pause();
  }
  render();
});

soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn && running) void audio.play();
  else audio.pause();
  render();
});

document.querySelector("#fullscreen").addEventListener("click", async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
});

void video.play();
render();
