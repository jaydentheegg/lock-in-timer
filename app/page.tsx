"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type Quality = "认真" | "主动" | "克制" | "坚持" | "勇气";

type Profile = {
  objectName: string;
  reasons: [string, string, string];
  cuePhrase: string;
  createdAt: string;
};

type DailyEvidence = {
  date: string;
  quality: Quality;
  morningCheckedAt?: string;
  evidence?: string;
  evidenceAt?: string;
  xpAwarded: boolean;
};

type AppState = {
  schemaVersion: 1;
  profile: Profile | null;
  records: Record<string, DailyEvidence>;
  totalXp: number;
};

const STORAGE_KEY = "wymcxvsure-v1";
const QUALITIES: Quality[] = ["认真", "主动", "克制", "坚持", "勇气"];
const DEFAULT_REASONS: [string, string, string] = [
  "把成绩稳定到全 A，补上英语短板。",
  "练出一项真正拿得出手的能力。",
  "积累让我更自信、更有生活选择权的证据。",
];
const DEFAULT_PHRASE = "今晚别让自己觉得混过去了。";
const STUDY_DURATIONS = [25, 45, 60];
const STUDY_REMINDERS = [
  "别让自己昏过去。",
  "抬头。回来。",
  "先把眼前这一分钟守住。",
  "你不是没状态，只是想逃一下。",
  "把这一小段做完。",
];

type StudyReminder = {
  id: number;
  text: string;
  x: number;
  y: number;
};

function localISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromISO(dateString: string) {
  return new Date(`${dateString}T12:00:00`);
}

function addDays(dateString: string, amount: number) {
  const date = dateFromISO(dateString);
  date.setDate(date.getDate() + amount);
  return localISO(date);
}

function mondayOf(dateString: string) {
  const date = dateFromISO(dateString);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return localISO(date);
}

function formatDate(dateString: string, includeYear = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    ...(includeYear ? { year: "numeric" } : {}),
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(dateFromISO(dateString));
}

function emptyRecord(date: string): DailyEvidence {
  return { date, quality: "认真", xpAwarded: false };
}

function validState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<AppState>;
  if (state.schemaVersion !== 1 || !state.profile || typeof state.records !== "object" || state.records === null) return false;
  if (typeof state.profile.objectName !== "string" || typeof state.profile.cuePhrase !== "string") return false;
  if (!Array.isArray(state.profile.reasons) || state.profile.reasons.length !== 3) return false;
  return Object.values(state.records).every(
    (record) =>
      record &&
      typeof record === "object" &&
      typeof record.date === "string" &&
      typeof record.xpAwarded === "boolean" &&
      QUALITIES.includes(record.quality),
  );
}

function countAwarded(records: Record<string, DailyEvidence>) {
  return Object.values(records).filter((record) => record.xpAwarded && record.evidence?.trim()).length;
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function Home() {
  const [state, setState] = useState<AppState>({ schemaVersion: 1, profile: null, records: {}, totalXp: 0 });
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [objectDraft, setObjectDraft] = useState("硬币");
  const [reasonDrafts, setReasonDrafts] = useState<[string, string, string]>(DEFAULT_REASONS);
  const [phraseDraft, setPhraseDraft] = useState(DEFAULT_PHRASE);
  const [evidenceDraft, setEvidenceDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [studyMinutes, setStudyMinutes] = useState(25);
  const [studyOpen, setStudyOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [activeReminder, setActiveReminder] = useState<StudyReminder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const reminderIdRef = useRef(0);
  const today = localISO();

  useEffect(() => {
    const loader = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (validState(parsed)) {
            const totalXp = countAwarded(parsed.records) * 20;
            setState({ ...parsed, totalXp });
            setObjectDraft(parsed.profile.objectName);
            setReasonDrafts(parsed.profile.reasons);
            setPhraseDraft(parsed.profile.cuePhrase);
            setEvidenceDraft(parsed.records[today]?.evidence ?? "");
          }
        } catch {
          setNotice("本地记录读取失败，旧数据没有被覆盖。");
        }
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(loader);
  }, [today]);

  useEffect(() => {
    if (!ready || !state.profile) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  useEffect(() => {
    if (!studyOpen || !isRunning) return;
    const timer = window.setTimeout(() => {
      if (secondsLeft <= 1) {
        setSecondsLeft(0);
        setIsRunning(false);
        videoRef.current?.pause();
        audioRef.current?.pause();
        setActiveReminder({ id: ++reminderIdRef.current, text: "这一段完成了。别急着加码。", x: 50, y: 44 });
      } else {
        setSecondsLeft(secondsLeft - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [studyOpen, isRunning, secondsLeft]);

  useEffect(() => {
    if (!studyOpen || !isRunning) return;
    let hideTimer = 0;
    const showReminder = () => {
      const phrases = [state.profile?.cuePhrase || DEFAULT_PHRASE, ...STUDY_REMINDERS];
      const text = phrases[Math.floor(Math.random() * phrases.length)];
      setActiveReminder({
        id: ++reminderIdRef.current,
        text,
        x: 20 + Math.round(Math.random() * 60),
        y: 24 + Math.round(Math.random() * 48),
      });
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setActiveReminder(null), 5600);
    };
    const firstReminder = window.setTimeout(showReminder, 60000);
    const recurringReminder = window.setInterval(showReminder, 90000);
    return () => {
      window.clearTimeout(firstReminder);
      window.clearTimeout(hideTimer);
      window.clearInterval(recurringReminder);
    };
  }, [studyOpen, isRunning, state.profile?.cuePhrase]);

  const todayRecord = state.records[today] ?? emptyRecord(today);
  const totalXp = state.totalXp;
  const level = Math.floor(totalXp / 100) + 1;
  const levelProgress = totalXp % 100;
  const weekStart = mondayOf(today);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const currentWeekRecords = weekDates.map((date) => state.records[date]).filter((record) => record?.xpAwarded && record.evidence?.trim());

  const groupedWeeks = (() => {
    const groups = new Map<string, DailyEvidence[]>();
    Object.values(state.records)
      .filter((record) => record.xpAwarded && record.evidence?.trim())
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((record) => {
        const key = mondayOf(record.date);
        const group = groups.get(key) ?? [];
        group.push(record);
        groups.set(key, group);
      });
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  })();

  const weeklySummary = (() => {
    const lines = currentWeekRecords
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((record) => `${formatDate(record.date)}｜${record.quality}｜${record.evidence}`);
    return [
      `wymcxvsure｜${formatDate(weekStart)}—${formatDate(addDays(weekStart, 6))}`,
      `本周留下 ${currentWeekRecords.length}/5 条证据。`,
      "",
      ...(lines.length ? lines : ["本周还没有留下证据。"]),
      "",
      "Thinking Block：哪一次提醒最有用？下周我最想守住哪一种品质？",
    ].join("\n");
  })();

  const saveProfile = () => {
    const objectName = objectDraft.trim() || "硬币";
    const reasons = reasonDrafts.map((reason, index) => reason.trim() || DEFAULT_REASONS[index]) as [string, string, string];
    const cuePhrase = phraseDraft.trim() || DEFAULT_PHRASE;
    setState((current) => ({
      ...current,
      profile: { objectName, reasons, cuePhrase, createdAt: current.profile?.createdAt ?? new Date().toISOString() },
    }));
    setObjectDraft(objectName);
    setReasonDrafts(reasons);
    setPhraseDraft(cuePhrase);
    setSettingsOpen(false);
    setNotice(currentProfileNotice(state.profile));
  };

  const updateToday = (patch: Partial<DailyEvidence>) => {
    setState((current) => ({
      ...current,
      records: {
        ...current.records,
        [today]: { ...emptyRecord(today), ...current.records[today], ...patch },
      },
    }));
  };

  const saveEvidence = () => {
    const evidence = evidenceDraft.trim();
    if (!evidence) return;
    setState((current) => {
      const previous = current.records[today] ?? emptyRecord(today);
      const firstAward = !previous.xpAwarded;
      return {
        ...current,
        totalXp: current.totalXp + (firstAward ? 20 : 0),
        records: {
          ...current.records,
          [today]: {
            ...previous,
            evidence,
            evidenceAt: new Date().toISOString(),
            xpAwarded: true,
          },
        },
      };
    });
    setNotice(todayRecord.xpAwarded ? "证据已更新，没有重复增加经验值。" : "+20 XP。今天没有混过去。");
  };

  const exportBackup = () => {
    const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `wymcxvsure-backup-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("备份文件已导出。");
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!validState(parsed)) throw new Error("invalid");
      const evidenceCount = countAwarded(parsed.records);
      if (!window.confirm(`备份中有 ${evidenceCount} 条证据。导入会替换当前 wymcxvsure 数据，确认继续吗？`)) return;
      const restored = { ...parsed, totalXp: evidenceCount * 20 };
      setState(restored);
      setObjectDraft(restored.profile.objectName);
      setReasonDrafts(restored.profile.reasons);
      setPhraseDraft(restored.profile.cuePhrase);
      setEvidenceDraft(restored.records[today]?.evidence ?? "");
      setNotice(`已恢复 ${evidenceCount} 条证据。`);
      setSettingsOpen(false);
    } catch {
      setNotice("无法导入：文件不是有效的 wymcxvsure 备份。");
    }
  };

  const resetData = () => {
    if (!window.confirm("这会清除新版站点中的所有理由、证据和经验值。旧晨间实验数据不会受影响。确认清除吗？")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setState({ schemaVersion: 1, profile: null, records: {}, totalXp: 0 });
    setObjectDraft("硬币");
    setReasonDrafts(DEFAULT_REASONS);
    setPhraseDraft(DEFAULT_PHRASE);
    setEvidenceDraft("");
    setSettingsOpen(false);
    setNotice("");
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(weeklySummary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const startStudy = () => {
    setSecondsLeft(studyMinutes * 60);
    setActiveReminder(null);
    setStudyOpen(true);
    setIsRunning(true);
    window.setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        void videoRef.current.play();
      }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        if (soundOn) void audioRef.current.play();
      }
    }, 0);
  };

  const toggleStudy = () => {
    if (secondsLeft === 0) setSecondsLeft(studyMinutes * 60);
    setIsRunning((current) => {
      const next = !current;
      if (next) {
        void videoRef.current?.play();
        if (soundOn) void audioRef.current?.play();
      } else {
        videoRef.current?.pause();
        audioRef.current?.pause();
      }
      return next;
    });
  };

  const closeStudy = () => {
    setStudyOpen(false);
    setIsRunning(false);
    setActiveReminder(null);
    videoRef.current?.pause();
    audioRef.current?.pause();
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next && isRunning) void audioRef.current?.play();
    else audioRef.current?.pause();
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };

  if (!ready) return <main className="loading">正在取回今天的理由。</main>;

  if (!state.profile) {
    return (
      <main className="onboarding-shell">
        <header className="onboarding-brand">wymcxvsure <span>01</span></header>
        <section className="onboarding">
          <div className="onboarding-copy">
            <p className="eyebrow">SET YOUR ANCHOR</p>
            <h1>先选一个每天<br />会碰到的东西。</h1>
            <p>它不负责监督你。它只负责在你快要忘记时，把现在这股劲叫回来。</p>
          </div>
          <form className="onboarding-form" onSubmit={(event) => { event.preventDefault(); saveProfile(); }}>
            <label htmlFor="object-name">
              <span>随身物件</span>
              <input id="object-name" value={objectDraft} onChange={(event) => setObjectDraft(event.target.value)} placeholder="硬币、卡片或手环" />
            </label>
            <fieldset>
              <legend>我为什么不想混过去</legend>
              {reasonDrafts.map((reason, index) => (
                <label key={index} htmlFor={`reason-${index}`}>
                  <b>0{index + 1}</b>
                  <textarea
                    id={`reason-${index}`}
                    rows={2}
                    value={reason}
                    onChange={(event) => {
                      const next = [...reasonDrafts] as [string, string, string];
                      next[index] = event.target.value;
                      setReasonDrafts(next);
                    }}
                  />
                </label>
              ))}
            </fieldset>
            <label htmlFor="cue-phrase">
              <span>摸到它时，对自己说</span>
              <input id="cue-phrase" value={phraseDraft} onChange={(event) => setPhraseDraft(event.target.value)} />
            </label>
            <button className="wide-button" type="submit"><span>保存，明早开始</span><i>→</i></button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <a href="#today" className="brand">wymcxvsure</a>
        <div className="top-actions">
          <span>LV.{String(level).padStart(2, "0")}</span>
          <button onClick={startStudy}>开始学习</button>
          <button onClick={() => setSettingsOpen(true)}>设置</button>
        </div>
      </header>

      <section className="hero" id="today">
        <p className="eyebrow">{formatDate(today, true)} · TODAY&apos;S CUE</p>
        <h1>{state.profile.cuePhrase}</h1>
        <div className="hero-foot">
          <p>摸到你的{state.profile.objectName}时，不用规划整天。做一个今晚愿意承认的动作。</p>
          <span>{todayRecord.xpAwarded ? "今日证据已留下" : "今天还没有证据"}</span>
        </div>
      </section>

      <section className="study-launcher" aria-labelledby="study-launch-title">
        <div>
          <p className="eyebrow">LANDSCAPE FOCUS MODE</p>
          <h2 id="study-launch-title">别等状态。<br />先进入画面。</h2>
        </div>
        <div className="study-launch-controls">
          <span>选择这一段的长度</span>
          <div role="group" aria-label="选择学习时长">
            {STUDY_DURATIONS.map((minutes) => (
              <button
                key={minutes}
                className={studyMinutes === minutes ? "selected" : ""}
                onClick={() => setStudyMinutes(minutes)}
                aria-pressed={studyMinutes === minutes}
              >
                {minutes} MIN
              </button>
            ))}
          </div>
          <button className="enter-study" onClick={startStudy}><span>开始学习</span><i>↗</i></button>
          <small>视频会循环播放。提醒偶尔出现，不要求你立刻变得热血。</small>
        </div>
      </section>

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="关闭提示">×</button></div>}

      <section className="morning section-pad">
        <div className="section-number">01</div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">早上 · 30 秒</p>
            <h2>把理由带出门。</h2>
          </div>
          <p>不用给今天列任务。读完这三句，选一个想守住的品质，然后带上你的{state.profile.objectName}。</p>
        </div>
        <ol className="reason-list">
          {state.profile.reasons.map((reason, index) => <li key={reason}><b>0{index + 1}</b><span>{reason}</span></li>)}
        </ol>
        <div className="quality-row">
          <span>今天想守住</span>
          <div role="group" aria-label="选择今日品质">
            {QUALITIES.map((quality) => (
              <button
                key={quality}
                className={todayRecord.quality === quality ? "selected" : ""}
                onClick={() => updateToday({ quality })}
                aria-pressed={todayRecord.quality === quality}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>
        <button
          className={`anchor-button ${todayRecord.morningCheckedAt ? "checked" : ""}`}
          onClick={() => updateToday({ morningCheckedAt: todayRecord.morningCheckedAt ?? new Date().toISOString() })}
        >
          <span>{todayRecord.morningCheckedAt ? `今天已经带上${state.profile.objectName}` : `带上${state.profile.objectName}`}</span>
          <i>{todayRecord.morningCheckedAt ? "✓" : "→"}</i>
        </button>
        <p className="micro-copy">这一步不加经验值。想法不是证据，行动才是。</p>
      </section>

      <section className="cue-band">
        <p className="eyebrow">白天 · 每次摸到它</p>
        <blockquote>“{state.profile.cuePhrase}”</blockquote>
        <p>做完一个对得起目标的动作后，把{state.profile.objectName}换到另一只手或另一个口袋。</p>
      </section>

      <section className="evidence section-pad">
        <div className="section-number light">02</div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">晚上 · 1 分钟</p>
            <h2>今天哪件事算数？</h2>
          </div>
          <p>学习、克制娱乐、健身、主动表达都可以。写事实，不写评价。</p>
        </div>
        <label className="evidence-input" htmlFor="evidence-text">
          <span>今天的证据</span>
          <textarea
            id="evidence-text"
            rows={4}
            value={evidenceDraft}
            onChange={(event) => setEvidenceDraft(event.target.value)}
            placeholder="例如：想刷视频时停了下来，先把英语作业写完。"
          />
        </label>
        <button className="save-evidence" disabled={!evidenceDraft.trim()} onClick={saveEvidence}>
          <span>{todayRecord.xpAwarded ? "更新今天的证据" : "保存证据 · +20 XP"}</span><i>↗</i>
        </button>
      </section>

      <section className="progress section-pad">
        <div className="section-number">03</div>
        <div className="level-grid">
          <div className="level-display">
            <p className="eyebrow">LIFETIME LEVEL</p>
            <strong>{String(level).padStart(2, "0")}</strong>
            <span>{totalXp} XP TOTAL</span>
          </div>
          <div className="level-detail">
            <div className="progress-label"><span>距离下一级</span><b>{levelProgress} / 100 XP</b></div>
            <div className="progress-track"><i style={{ width: `${levelProgress}%` }} /></div>
            <div className="week-count"><strong>{currentWeekRecords.length}</strong><span>/ 5 条本周证据</span></div>
            <p>五条真实证据大约升一级。漏一天没有惩罚，下次继续留下证据就行。</p>
          </div>
        </div>
      </section>

      <section className="week section-pad">
        <div className="section-heading compact">
          <div><p className="eyebrow">THIS WEEK</p><h2>这一周，留下了什么。</h2></div>
          <span>{formatDate(weekStart)}—{formatDate(addDays(weekStart, 6))}</span>
        </div>
        <div className="week-grid">
          {weekDates.map((date) => {
            const record = state.records[date];
            const isFuture = date > today;
            return (
              <article key={date} className={`${record?.xpAwarded ? "has-proof" : ""} ${isFuture ? "future" : ""}`}>
                <div><span>{formatDate(date)}</span><b>{record?.xpAwarded ? record.quality : "—"}</b></div>
                <p>{record?.evidence || (isFuture ? "还没到这一天" : "没有记录，也不用补")}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="thinking section-pad">
        <div className="section-heading compact">
          <div><p className="eyebrow">SUNDAY THINKING BLOCK</p><h2>把证据带去复盘。</h2></div>
          <button onClick={copySummary}>{copied ? "已复制" : "复制本周摘要"}</button>
        </div>
        <pre>{weeklySummary}</pre>
      </section>

      <section className="wall section-pad">
        <div className="section-heading compact">
          <div><p className="eyebrow">EVIDENCE ARCHIVE</p><h2>证据墙</h2></div>
          <span>不是连续签到，是你确实做过的事。</span>
        </div>
        {groupedWeeks.length ? (
          groupedWeeks.map(([start, records]) => (
            <div className="archive-week" key={start}>
              <div className="archive-label"><span>{formatDate(start)}—{formatDate(addDays(start, 6))}</span><b>{records.length} 条</b></div>
              <div className="archive-cards">
                {records.map((record) => (
                  <article key={record.date}>
                    <div><span>{formatDate(record.date)}</span><b>{record.quality}</b></div>
                    <p>{record.evidence}</p>
                    <small>+20 XP</small>
                  </article>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-wall">第一条证据会出现在这里。不需要漂亮，只需要是真的。</div>
        )}
      </section>

      <footer>
        <span>wymcxvsure / {new Date().getFullYear()}</span>
        <strong>想法不计分。<br />做过的事才算。</strong>
      </footer>

      {studyOpen && (
        <section className="study-mode" aria-label="横屏学习倒计时">
          <video
            ref={videoRef}
            className="study-video"
            src="/study-background.m4v"
            autoPlay
            loop
            playsInline
            muted
            preload="auto"
          >
            <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
          </video>
          <audio ref={audioRef} src="/study-audio.m4a" loop preload="auto">
            <track kind="captions" src="/empty-captions.vtt" srcLang="zh" label="无对白" default />
          </audio>
          <div className="study-shade" />
          <header className="study-header">
            <span aria-hidden="true" />
            <button onClick={closeStudy} aria-label="退出学习模式">退出 ×</button>
          </header>
          <div className="study-clock" aria-live="off">
            <strong>{formatClock(secondsLeft)}</strong>
          </div>
          <div className="study-controls">
            <button className="study-primary" onClick={toggleStudy}>{isRunning ? "暂停" : secondsLeft === 0 ? "再来一段" : "继续"}</button>
            <button onClick={toggleSound}>{soundOn ? "关闭环境音" : "打开环境音"}</button>
            <button onClick={toggleFullscreen}>全屏</button>
          </div>
          <div className="study-progress" aria-hidden="true"><i style={{ width: `${((studyMinutes * 60 - secondsLeft) / (studyMinutes * 60)) * 100}%` }} /></div>
          {activeReminder && (
            <div
              key={activeReminder.id}
              className="screen-reminder"
              style={{ left: `${activeReminder.x}%`, top: `${activeReminder.y}%` }}
              role="status"
            >
              {activeReminder.text}
            </div>
          )}
          <div className="portrait-hint">把设备横过来，画面会更完整。</div>
        </section>
      )}

      {settingsOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSettingsOpen(false); }}>
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="dialog-head"><div><p className="eyebrow">SETTINGS</p><h2 id="settings-title">设置</h2></div><button onClick={() => setSettingsOpen(false)} aria-label="关闭设置">×</button></div>
            <label htmlFor="settings-object"><span>随身物件</span><input id="settings-object" value={objectDraft} onChange={(event) => setObjectDraft(event.target.value)} /></label>
            <fieldset>
              <legend>三个理由</legend>
              {reasonDrafts.map((reason, index) => (
                <label key={index} htmlFor={`settings-reason-${index}`}><b>0{index + 1}</b><textarea id={`settings-reason-${index}`} rows={2} value={reason} onChange={(event) => { const next = [...reasonDrafts] as [string, string, string]; next[index] = event.target.value; setReasonDrafts(next); }} /></label>
              ))}
            </fieldset>
            <label htmlFor="settings-phrase"><span>提醒句</span><input id="settings-phrase" value={phraseDraft} onChange={(event) => setPhraseDraft(event.target.value)} /></label>
            <button className="wide-button" onClick={saveProfile}><span>保存设置</span><i>→</i></button>
            <div className="data-tools">
              <button onClick={exportBackup}>导出备份</button>
              <label htmlFor="import-backup">导入备份<input id="import-backup" type="file" accept="application/json" onChange={importBackup} /></label>
              <button className="danger" onClick={resetData}>清除新版数据</button>
            </div>
            <p className="storage-note">记录只保存在当前浏览器。换手机或清理浏览器前，请先导出备份。</p>
          </section>
        </div>
      )}
    </main>
  );
}

function currentProfileNotice(profile: Profile | null) {
  return profile ? "设置已保存。" : "锚点已经设好。";
}
