"use client";

import { useEffect, useRef, useState } from "react";

const DURATIONS = [25, 45, 60];
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
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const reminderIdRef = useRef(0);

  useEffect(() => {
    void videoRef.current?.play();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      if (secondsLeft <= 1) {
        setSecondsLeft(0);
        setRunning(false);
        videoRef.current?.pause();
        audioRef.current?.pause();
        setReminder({ id: ++reminderIdRef.current, text: "这一段完成了。", x: 50, y: 44 });
      } else {
        setSecondsLeft(secondsLeft - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [running, secondsLeft]);

  useEffect(() => {
    if (!running) return;
    let hideTimer = 0;
    const showReminder = () => {
      setReminder({
        id: ++reminderIdRef.current,
        text: REMINDERS[Math.floor(Math.random() * REMINDERS.length)],
        x: 18 + Math.round(Math.random() * 64),
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
  }, [running]);

  const selectDuration = (minutes: number) => {
    setDuration(minutes);
    setSecondsLeft(minutes * 60);
    setReminder(null);
    setRunning(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      if (soundOn) void audioRef.current.play();
    }
  };

  const togglePlayback = () => {
    if (running) {
      setRunning(false);
      videoRef.current?.pause();
      audioRef.current?.pause();
      return;
    }
    if (secondsLeft === 0) setSecondsLeft(duration * 60);
    setReminder(null);
    setRunning(true);
    void videoRef.current?.play();
    if (soundOn) void audioRef.current?.play();
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next && running) void audioRef.current?.play();
    else audioRef.current?.pause();
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };

  const elapsedPercent = ((duration * 60 - secondsLeft) / (duration * 60)) * 100;

  return (
    <main className="focus-page" aria-label="专注倒计时">
      <video ref={videoRef} className="focus-video" src="/study-background.m4v" autoPlay loop muted playsInline preload="auto">
        <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
      </video>
      <audio ref={audioRef} src="/study-audio.m4a" loop preload="auto">
        <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
      </audio>

      <div className="focus-shade" aria-hidden="true" />

      <div className="duration-picker" role="group" aria-label="选择倒计时时长">
        {DURATIONS.map((minutes) => (
          <button key={minutes} className={duration === minutes ? "selected" : ""} onClick={() => selectDuration(minutes)} aria-pressed={duration === minutes}>
            {minutes}
          </button>
        ))}
      </div>

      <button className="fullscreen-button" onClick={toggleFullscreen}>全屏</button>

      <time className="focus-clock" dateTime={`PT${secondsLeft}S`}>{formatClock(secondsLeft)}</time>

      <div className="playback-controls">
        <button className="play-button" onClick={togglePlayback} aria-label={running ? "暂停" : "播放"}>{running ? "Ⅱ" : "▶"}</button>
        <button className="sound-button" onClick={toggleSound}>{soundOn ? "声音：开" : "声音：关"}</button>
      </div>

      <div className="focus-progress" aria-hidden="true"><i style={{ width: `${elapsedPercent}%` }} /></div>

      {reminder && (
        <div key={reminder.id} className="screen-reminder" style={{ left: `${reminder.x}%`, top: `${reminder.y}%` }} role="status">
          {reminder.text}
        </div>
      )}

      <div className="portrait-hint">横过来。</div>
    </main>
  );
}
