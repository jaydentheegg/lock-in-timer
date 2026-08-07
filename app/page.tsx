"use client";

import { useEffect, useRef, useState } from "react";

const REMINDERS = [
  "别让自己昏过去。",
  "抬头。回来。",
  "只处理眼前这一分钟。",
  "别把注意力交出去。",
  "你现在只需要继续。",
  "把这一小段守住。",
];

type Reminder = {
  id: number;
  text: string;
  x: number;
  y: number;
};

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function FocusPage() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const reminderIdRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      setElapsedSeconds(elapsedSeconds + 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, elapsedSeconds]);

  useEffect(() => {
    if (!started) return;
    let hideTimer = 0;
    const showReminder = () => {
      setReminder({
        id: ++reminderIdRef.current,
        text: REMINDERS[Math.floor(Math.random() * REMINDERS.length)],
        x: 28 + Math.round(Math.random() * 44),
        y: 22 + Math.round(Math.random() * 52),
      });
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setReminder(null), 5600);
    };
    const firstReminder = window.setTimeout(showReminder, 18000);
    const recurringReminder = window.setInterval(showReminder, 52000);
    return () => {
      window.clearTimeout(firstReminder);
      window.clearTimeout(hideTimer);
      window.clearInterval(recurringReminder);
    };
  }, [started]);

  const togglePlayback = () => {
    if (!started) {
      setStarted(true);
      setRunning(true);
      void videoRef.current?.play();
      if (soundOn) void audioRef.current?.play();
      return;
    }
    setRunning((current) => !current);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next && started) void audioRef.current?.play();
    else audioRef.current?.pause();
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };

  return (
    <main className="focus-page" aria-label="专注计时器">
      <video ref={videoRef} className="focus-video" src="/study-background.mp4" loop muted playsInline preload="auto">
        <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
      </video>
      <audio ref={audioRef} src="/study-audio.m4a" loop preload="auto">
        <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
      </audio>

      <div className="focus-shade" aria-hidden="true" />

      <button className="fullscreen-button" onClick={toggleFullscreen}>全屏</button>

      <time className="focus-clock" dateTime={`PT${elapsedSeconds}S`}>{formatClock(elapsedSeconds)}</time>

      <div className="playback-controls">
        <button className="play-button" onClick={togglePlayback} aria-label={running ? "暂停计时" : started ? "继续计时" : "开始计时"}>{running ? "Ⅱ" : "▶"}</button>
        <button className="sound-button" onClick={toggleSound}>{soundOn ? "声音：开" : "声音：关"}</button>
      </div>

      {reminder && (
        <div key={reminder.id} className="screen-reminder" style={{ left: `${reminder.x}%`, top: `${reminder.y}%` }} role="status">
          {reminder.text}
        </div>
      )}

      <div className="portrait-hint">横过来。</div>
    </main>
  );
}
