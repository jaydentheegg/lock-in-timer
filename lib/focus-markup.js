// Trusted shared interface for the React view and standalone Pages.
export const focusMarkup = `
<main class="focus-page" aria-label="专注计时器" data-phase="link" data-started="false" data-running="false" data-sound="on" data-burst="none">
  <video class="focus-video" src="./study-background.mp4" poster="./study-poster.jpg" loop muted playsinline preload="metadata"><track kind="captions" src="./empty-captions.vtt" srclang="zh" label="无对白" default></video>
  <audio src="./study-audio.m4a" loop preload="none"></audio>
  <div class="cinema-shade" aria-hidden="true"></div><div class="film-grain" aria-hidden="true"></div><div class="scanline" aria-hidden="true"></div>
  <canvas class="interference" aria-hidden="true"></canvas>
  <header class="top-line">
    <div class="connection"><i></i><span class="connection-label">STANDBY</span><span class="channel"> / 01</span></div>
    <span class="preview-indicator" hidden>加速预览 · 秒级切换</span>
    <button class="fullscreen-button" aria-label="进入全屏" title="全屏 · F"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button>
  </header>
  <div class="reticle" aria-hidden="true">
    <svg viewBox="0 0 600 600"><circle class="orbit-ticks" cx="300" cy="300" r="284"/><circle class="orbit-inner" cx="300" cy="300" r="261"/><circle class="orbit-progress" cx="300" cy="300" r="284" pathLength="100"/><path class="crosshair" d="M300 0v28m0 544v28M0 300h28m544 0h28"/></svg>
    <span class="reticle-top">+ &nbsp; ATTENTION CHANNEL &nbsp; +</span><span class="reticle-bottom">SIGNAL / <span class="phase-code">LINK</span></span>
  </div>
  <div class="clock-area">
    <div class="clock-caption"><span class="session-label">等待接入</span><span class="coordinate">REC / 0000</span></div>
    <time class="focus-clock" datetime="PT0S" data-clock="00:00">00:00</time>
    <div class="clock-baseline" aria-hidden="true"><span>+</span><i></i><span>+</span></div>
  </div>
  <div class="side-mark left-mark" aria-hidden="true">NOISE ↓ &nbsp; / &nbsp; FOCUS ↑</div><div class="side-mark right-mark" aria-hidden="true">保持当前输入</div>
  <div class="screen-reminder" role="status" aria-live="polite"></div>
  <section class="milestone-event" role="status" aria-live="polite"><span class="milestone-caption">CHANNEL TRANSITION</span><div class="milestone-code"></div><p></p><i class="milestone-rule"></i></section>
  <footer class="console">
    <div class="playback-controls">
      <button class="hud-button sound-button" aria-label="关闭声音" aria-pressed="true" title="声音 · M"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 12h6l7-6v20l-7-6H4z" fill="currentColor"/><path class="sound-on" d="M21 11c3 3 3 7 0 10m4-14c5 5 5 13 0 18"/><path class="sound-off" d="m22 12 7 8m0-8-7 8"/></svg></button>
      <button class="hud-button play-button" aria-label="开始计时" aria-pressed="false" title="开始或暂停 · 空格"><svg viewBox="0 0 32 32" aria-hidden="true"><path class="play-icon" d="M9 5 27 16 9 27Z" fill="currentColor"/><path class="pause-icon" d="M10 6v20M22 6v20" stroke-width="5"/></svg></button>
      <button class="hud-button reset-button" aria-label="重置计时" title="重置 · R" disabled><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25 12a10 10 0 1 0 1 8M26 4v8h-8"/></svg></button>
    </div>
    <div class="phase-track" aria-label="专注阶段">
      <div data-step="0"><i></i><span>01 / LINK</span><small>00:00</small></div><div data-step="1"><i></i><span>02 / TRACE</span><small>10:00</small></div><div data-step="2"><i></i><span>03 / DEEP</span><small>25:00</small></div><div data-step="3"><i></i><span>04 / NULL</span><small>45:00</small></div><div data-step="4"><i></i><span>05 / LOCK</span><small>75:00</small></div>
    </div>
  </footer>
  <div class="bottom-note"><span class="key-hint">SPACE 开始 / 暂停 <b>·</b> M 声音 <b>·</b> R 重置</span><span class="event-readout" aria-hidden="true">AWAITING INPUT_</span></div>
  <div class="media-message" role="status"></div>
</main>`;
