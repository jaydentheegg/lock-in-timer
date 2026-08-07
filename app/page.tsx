"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ANOMALIES,
  BROADCASTS,
  EXPERIENCE_TIMING,
  MILESTONES,
  getMilestoneThreshold,
  getPhase,
  randomBetween,
  shuffled,
  type AnomalyKind,
  type Milestone,
} from "@/lib/experience";

type Broadcast = {
  id: number;
  text: string;
  x: number;
  y: number;
};

type MilestoneSignal = Milestone & { id: number };

type AnomalySignal = {
  id: number;
  kind: AnomalyKind;
  label: string;
};

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

const subscribeToPreviewMode = () => () => undefined;
const getPreviewModeSnapshot = () => new URLSearchParams(window.location.search).get("preview") === "events";
const getPreviewModeServerSnapshot = () => false;

export default function FocusPage() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [milestone, setMilestone] = useState<MilestoneSignal | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalySignal | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const broadcastIdRef = useRef(0);
  const milestoneIdRef = useRef(0);
  const anomalyIdRef = useRef(0);
  const broadcastDeckRef = useRef<string[]>([]);
  const firedMilestonesRef = useRef(new Set<string>());
  const milestoneHideRef = useRef(0);
  const previewMode = useSyncExternalStore(subscribeToPreviewMode,getPreviewModeSnapshot,getPreviewModeServerSnapshot);
  const phase = getPhase(elapsedSeconds, previewMode);
  const clockText = formatClock(elapsedSeconds);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!started || document.hidden) return;
    const reached = MILESTONES.filter((item) => {
      const threshold = getMilestoneThreshold(item, previewMode);
      return elapsedSeconds >= threshold && !firedMilestonesRef.current.has(item.code);
    });
    const next = reached.at(-1);
    if (!next) return;
    firedMilestonesRef.current.add(next.code);
    setMilestone({ ...next, id: ++milestoneIdRef.current });
    window.clearTimeout(milestoneHideRef.current);
    milestoneHideRef.current = window.setTimeout(() => setMilestone(null), EXPERIENCE_TIMING.milestoneVisibleMs);
  }, [elapsedSeconds, previewMode, started]);

  useEffect(() => () => window.clearTimeout(milestoneHideRef.current), []);

  useEffect(() => {
    if (!started) return;
    let scheduleTimer = 0;
    let hideTimer = 0;
    let disposed = false;
    const firstDelay = previewMode ? EXPERIENCE_TIMING.preview.firstBroadcastMs : EXPERIENCE_TIMING.firstBroadcastMs;
    const minimumDelay = previewMode ? EXPERIENCE_TIMING.preview.broadcastMinMs : EXPERIENCE_TIMING.broadcastMinMs;
    const maximumDelay = previewMode ? EXPERIENCE_TIMING.preview.broadcastMaxMs : EXPERIENCE_TIMING.broadcastMaxMs;

    const takeNextBroadcast = () => {
      if (broadcastDeckRef.current.length === 0) broadcastDeckRef.current = shuffled(BROADCASTS);
      return broadcastDeckRef.current.pop() ?? BROADCASTS[0];
    };

    const schedule = (delay = randomBetween(minimumDelay, maximumDelay)) => {
      window.clearTimeout(scheduleTimer);
      if (disposed || document.hidden) return;
      scheduleTimer = window.setTimeout(showBroadcast, delay);
    };

    const showBroadcast = () => {
      if (disposed || document.hidden) return;
      setBroadcast({
        id: ++broadcastIdRef.current,
        text: takeNextBroadcast(),
        x: 28 + Math.round(Math.random() * 44),
        y: 22 + Math.round(Math.random() * 52),
      });
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setBroadcast(null), EXPERIENCE_TIMING.broadcastVisibleMs);
      schedule();
    };

    const handleVisibility = () => {
      window.clearTimeout(scheduleTimer);
      if (document.hidden) {
        window.clearTimeout(hideTimer);
        setBroadcast(null);
      } else {
        schedule();
      }
    };

    schedule(firstDelay);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      window.clearTimeout(scheduleTimer);
      window.clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [previewMode, started]);

  useEffect(() => {
    if (!started) return;
    let scheduleTimer = 0;
    let hideTimer = 0;
    let disposed = false;
    const minimumDelay = previewMode ? EXPERIENCE_TIMING.preview.anomalyMinMs : EXPERIENCE_TIMING.anomalyMinMs;
    const maximumDelay = previewMode ? EXPERIENCE_TIMING.preview.anomalyMaxMs : EXPERIENCE_TIMING.anomalyMaxMs;

    const schedule = () => {
      window.clearTimeout(scheduleTimer);
      if (disposed || document.hidden) return;
      scheduleTimer = window.setTimeout(showAnomaly, randomBetween(minimumDelay, maximumDelay));
    };

    const showAnomaly = () => {
      if (disposed || document.hidden) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        const selected = ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)];
        setAnomaly({ ...selected, id: ++anomalyIdRef.current });
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => setAnomaly(null), EXPERIENCE_TIMING.anomalyVisibleMs);
      }
      schedule();
    };

    const handleVisibility = () => {
      window.clearTimeout(scheduleTimer);
      if (document.hidden) {
        window.clearTimeout(hideTimer);
        setAnomaly(null);
      } else {
        schedule();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      window.clearTimeout(scheduleTimer);
      window.clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [previewMode, started]);

  useEffect(() => {
    if (anomaly?.kind !== "pixel-drop") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = pixelCanvasRef.current;
    const video = videoRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !video || !context) return;
    canvas.width = 96;
    canvas.height = 54;
    let animationFrame = 0;
    let lastDraw = 0;
    const draw = (now: number) => {
      if (now - lastDraw > 80 && video.readyState >= 2) {
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          context.fillStyle = "#171816";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        lastDraw = now;
      }
      animationFrame = window.requestAnimationFrame(draw);
    };
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [anomaly]);

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
    <main className="focus-page" aria-label="专注计时器" data-phase={phase} data-anomaly={anomaly?.kind ?? "none"}>
      <video ref={videoRef} className="focus-video" src="/study-background.mp4" loop muted playsInline preload="auto">
        <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
      </video>
      <audio ref={audioRef} src="/study-audio.m4a" loop preload="auto">
        <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
      </audio>

      <div className="focus-shade" aria-hidden="true" />
      <div className="phase-atmosphere" aria-hidden="true" />
      <div className="signal-bleed" aria-hidden="true" />
      <canvas ref={pixelCanvasRef} className="pixel-canvas" aria-hidden="true" />

      <div className="phase-indicator" aria-hidden="true"><span>{phase.toUpperCase()}</span><i /></div>
      {previewMode && <div className="preview-indicator">PREVIEW // ACCELERATED</div>}
      <button className="fullscreen-button" onClick={toggleFullscreen}>全屏</button>

      <time className="focus-clock" dateTime={`PT${elapsedSeconds}S`} data-clock={clockText}>{clockText}</time>

      <div className="playback-controls">
        <button className={`play-button cyber-control${running ? " is-active" : ""}`} onClick={togglePlayback} aria-label={running ? "暂停计时" : started ? "继续计时" : "开始计时"} aria-pressed={running}>
          <svg className="control-icon" viewBox="0 0 32 32" aria-hidden="true">
            {running ? <path d="M7 5h7v22H7zM18 5h7v22h-7z" /> : <path d="M8 4 27 16 8 28V4Zm5 8v8l7-4-7-4Z" fillRule="evenodd" />}
          </svg>
        </button>
        <button className={`sound-button cyber-control${soundOn ? " is-active" : ""}`} onClick={toggleSound} aria-label={soundOn ? "关闭声音" : "打开声音"} aria-pressed={soundOn}>
          <svg className="control-icon" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M4 12h6l7-6v20l-7-6H4v-8Z" />
            {soundOn ? (
              <path d="M21 11c2.6 2.7 2.6 7.3 0 10M24.5 7.5c4.7 4.7 4.7 12.3 0 17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
            ) : (
              <path d="m21 12 7 8m0-8-7 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
            )}
          </svg>
        </button>
      </div>

      {broadcast && (
        <div key={broadcast.id} className="screen-reminder show" data-reminder={broadcast.text} style={{ left: `${broadcast.x}%`, top: `${broadcast.y}%` }} role="status">
          {broadcast.text}
        </div>
      )}

      {milestone && (
        <section key={milestone.id} className="milestone-event show" role="status" aria-live="polite">
          <div className="milestone-code">{milestone.code}</div>
          <p>{milestone.message}</p>
          <div className="milestone-scan" aria-hidden="true" />
        </section>
      )}

      {anomaly && <div key={anomaly.id} className="anomaly-label show" aria-hidden="true">{anomaly.label}</div>}
      <div className="portrait-hint">横过来。</div>
    </main>
  );
}
