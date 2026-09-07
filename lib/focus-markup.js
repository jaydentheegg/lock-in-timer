// Trusted shared interface for the React view and standalone Pages.
export const focusMarkup = `
<main class="focus-page" aria-label="Timer" data-phase="link" data-started="false" data-running="false" data-sound="on" data-burst="none">
  <video class="focus-video" style="opacity:0" poster="./study-poster.jpg" loop muted playsinline preload="metadata"><source src="./study-loop.av1.mp4" type="video/mp4; codecs=av01.0.05M.08"><source src="./study-loop.mp4" type="video/mp4; codecs=avc1.640028"><track kind="captions" src="./empty-captions.vtt" srclang="en" label="No dialogue" default></video>
  <audio src="./study-audio.m4a" loop preload="none"></audio>
  <div class="cinema-shade" aria-hidden="true"></div><div class="film-grain" aria-hidden="true"></div><div class="scanline" aria-hidden="true"></div>
  <canvas class="interference" aria-hidden="true"></canvas>
  <header class="top-line">
    <div class="connection"><i></i><span class="connection-label">STANDBY</span><span class="channel"> / 01</span></div>
    <span class="preview-indicator" hidden>ACCELERATED PREVIEW · SECOND-SCALE PHASES</span>
    <button class="fullscreen-button" aria-label="Enter fullscreen" title="Fullscreen · F"><svg viewBox="0 0 40 40" aria-hidden="true"><path class="icon-main" d="M15 7H7v8m18-8h8v8M7 25v8h8m18-8v8h-8"/><path class="icon-detail" d="M12 7h3M7 12v3m21-8h-3m8 5v3M7 28v-3m5 8h3m18-5v-3m-5 8h-3"/><path class="icon-accent" d="M18 20h4M20 18v4"/></svg></button>
  </header>
  <div class="reticle" aria-hidden="true">
    <svg viewBox="0 0 600 600"><circle class="orbit-ticks" cx="300" cy="300" r="284"/><circle class="orbit-inner" cx="300" cy="300" r="261"/><circle class="orbit-progress" cx="300" cy="300" r="284" pathLength="100"/><path class="crosshair" d="M300 0v28m0 544v28M0 300h28m544 0h28"/></svg>
    <span class="reticle-top">+ &nbsp; ATTENTION CHANNEL &nbsp; +</span><span class="reticle-bottom">SIGNAL / <span class="phase-code">LINK</span></span>
  </div>
  <div class="clock-area">
    <div class="clock-caption"><span class="session-label">AWAITING LINK</span><span class="coordinate">REC / 0000</span></div>
    <time class="focus-clock" datetime="PT0S" data-clock="00:00">00:00</time>
    <div class="clock-baseline" aria-hidden="true"><span>+</span><i></i><span>+</span></div>
  </div>
  <div class="side-mark left-mark" aria-hidden="true">NOISE ↓ &nbsp; / &nbsp; FOCUS ↑</div><div class="side-mark right-mark" aria-hidden="true">MAINTAIN INPUT</div>
  <div class="screen-reminder" role="status" aria-live="polite"></div>
  <section class="milestone-event" role="status" aria-live="polite"><span class="milestone-caption">CHANNEL TRANSITION</span><div class="milestone-code"></div><p></p><i class="milestone-rule"></i></section>
  <footer class="console">
    <div class="playback-controls">
      <button class="hud-button sound-button" aria-label="Mute audio" aria-pressed="true" title="Audio · M"><svg viewBox="0 0 40 40" aria-hidden="true"><path class="icon-core" d="M5 16h7l8-7v22l-8-7H5z"/><path class="icon-detail" d="M9 20h4m7-8v16"/><g class="sound-on"><path class="icon-main" d="M25 15c2.7 2.7 2.7 7.3 0 10m4-14c5 5 5 13 0 18"/><path class="icon-accent" d="m32 10 3-3"/></g><g class="sound-off"><path class="icon-main" d="m25 14 10 12m0-12-10 12"/><path class="icon-accent" d="m31 11 4-4"/></g></svg></button>
      <button class="hud-button play-button" aria-label="Start timer" aria-pressed="false" title="Start or pause · Space"><svg viewBox="0 0 40 40" aria-hidden="true"><g class="play-icon"><path class="icon-core" d="M10 6 33 20 10 34v-9l12-5-12-5z"/><path class="icon-detail" d="M6 11v18m29-14v10"/><path class="icon-accent" d="m11 15 11 5"/></g><g class="pause-icon"><path class="icon-core" d="M9 7h8v26H9zm14 0h8v26h-8z"/><path class="icon-detail" d="M5 12v16m30-16v16"/><path class="icon-accent" d="m10 28 6-4m8-12 6-4"/></g></svg></button>
      <button class="hud-button reset-button" aria-label="Reset timer" title="Reset · R" disabled><svg viewBox="0 0 40 40" aria-hidden="true"><path class="icon-main" d="M31 13A13 13 0 1 0 33 26"/><path class="icon-core" d="M31 6v9h-9z"/><path class="icon-detail" d="M20 5v5M7 20H2m18 15v-5"/><path class="icon-accent" d="m29 10 5-5"/></svg></button>
    </div>
    <div class="phase-track" aria-label="Focus phases">
      <div data-step="0"><i></i><span>01 / LINK</span><small>00:00</small></div><div data-step="1"><i></i><span>02 / TRACE</span><small>10:00</small></div><div data-step="2"><i></i><span>03 / DEEP</span><small>25:00</small></div><div data-step="3"><i></i><span>04 / NULL</span><small>45:00</small></div><div data-step="4"><i></i><span>05 / LOCK</span><small>75:00</small></div>
    </div>
  </footer>
  <div class="bottom-note"><span class="key-hint">SPACE START / PAUSE <b>·</b> M AUDIO <b>·</b> R RESET</span><span class="event-readout" aria-hidden="true">AWAITING INPUT_</span></div>
  <div class="media-message" role="status"></div>
</main>`;
