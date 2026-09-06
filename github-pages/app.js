export const PHASES = [
  {name:"link",seconds:0,preview:0,message:"注意力信号已捕获"},
  {name:"trace",seconds:600,preview:10,message:"注意力链路稳定"},
  {name:"deep",seconds:1500,preview:25,message:"外部信号正在衰减"},
  {name:"null",seconds:2700,preview:45,message:"只剩任务与呼吸"},
  {name:"lock",seconds:4500,preview:75,message:"保持连接。继续向前。"},
];
export function phaseAt(seconds, preview = false) {
  return PHASES.findLastIndex(phase => seconds >= phase[preview ? "preview" : "seconds"]);
}
export function createSessionClock(now = () => performance.now()) {
  let accumulated = 0;
  let since = null;
  return {
    get running() { return since !== null; },
    seconds() { return Math.floor((accumulated + (since === null ? 0 : now() - since)) / 1000); },
    resume() { if (since === null) since = now(); },
    pause() { if (since !== null) { accumulated += now() - since; since = null; } },
    reset() { accumulated = 0; since = null; },
  };
}

export const DEEP_ENTRY_MS = 1500;
const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

/** Lightweight, deterministic non-WebGL background; also the safe capture fallback. */
export function mountStardust(page, motion) {
  const canvas = document.createElement("canvas");
  canvas.className = "stardust-fallback"; canvas.setAttribute("aria-hidden", "true");
  page.append(canvas);
  const ctx = canvas.getContext("2d");
  let lastKey = "";
  function draw(force = false) {
    if (!ctx || document.hidden || (!force && (page.dataset.gl === "on" || ["deep","null","lock"].includes(page.dataset.phase)))) return;
    const width = Math.min(innerWidth,1280), height = Math.round(width*innerHeight/innerWidth);
    const quiet = motion.matches;
    const time = quiet ? 0 : performance.now() / 1000;
    const key = `${width}/${height}/${page.dataset.started}/${quiet}/${Math.floor(time*10)}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle="#000";ctx.fillRect(0,0,width,height);
    for(let i=0;i<360;i++){
      const seed=((i*7919)%1009)/1009;
      const x=(((i*.61803398875)%1)+Math.sin(time*.07+seed*6.28)*.004)*width;
      const y=(((i*.41421356237)%1)+Math.cos(time*.05+seed*9)*.004)*height;
      const size=.65+seed*1.25;
      ctx.fillStyle=`rgba(240,244,250,${(.18+seed*.52)*(page.dataset.started==='true'?.58:1)})`;
      ctx.fillRect(x,y,size,size);
    }
  }
  draw();
  const timer=setInterval(draw,100);
  return {capture(){draw(true);return ctx?canvas:null;},dispose(){clearInterval(timer);canvas.remove();}};
}

/** Deterministic geometry: no random flicker or new tile layout on each frame. */
export function deepEntryFrame(elapsed, reduced = false) {
  const progress = clamp01(elapsed / DEEP_ENTRY_MS);
  return {
    progress,
    zoom: reduced ? 1 : 1 + .16 * smooth(progress / .65),
    split: reduced ? 0 : smooth((progress - .3) / .7),
    pixel: reduced ? 0 : smooth((progress - .26) / .2),
    opacity: 1 - smooth((progress - .35) / .65),
    done: progress >= 1,
  };
}

/** Background-only transition, shared by the WebGL view and CSS fallback.
 * Captures background particles only, never the clock, badge or controls.
 * The bounded snapshot is released on completion, reset, backgrounding and unmount.
 */
export function createDeepEntry(page, captureBackground, motion) {
  let frame = 0, canvas = null, snapshot = null, pixels = null;
  let active = false, began = 0, done = null;
  function stop() {
    active = false;
    cancelAnimationFrame(frame); frame = 0;
    canvas?.remove(); canvas = snapshot = pixels = null;
    page.classList.remove("deep-has-frame");
    delete page.dataset.deepEntry;
    page.style.removeProperty("--deep-opacity");
    done = null;
  }
  function capture() {
    const scaleToFit = Math.min(1, 1280 / innerWidth, 900 / innerHeight);
    const w = Math.max(1, Math.round(innerWidth * scaleToFit)), h = Math.max(1, Math.round(innerHeight * scaleToFit));
    snapshot = document.createElement("canvas");
    snapshot.width = w; snapshot.height = h;
    const ctx = snapshot.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    const source = captureBackground?.();
    if (!source) return false;
    ctx.drawImage(source,0,0,w,h);
    pixels = document.createElement("canvas");
    pixels.width = 96; pixels.height = Math.max(1, Math.round(96*h/w));
    const pc = pixels.getContext("2d");
    if (!pc) return false;
    pc.drawImage(snapshot, 0, 0, pixels.width, pixels.height);
    // Maximum-value pooling keeps tiny white stars visible as coarse blocks;
    // ordinary thumbnail averaging would erase them against the black.
    if(ctx.getImageData && pc.createImageData){
      const source=ctx.getImageData(0,0,w,h).data;
      const pooled=pc.createImageData(pixels.width,pixels.height);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const from=(y*w+x)*4;
        const to=(Math.floor(y/h*pixels.height)*pixels.width+Math.floor(x/w*pixels.width))*4;
        for(let c=0;c<3;c++)pooled.data[to+c]=Math.max(pooled.data[to+c],source[from+c]);
        pooled.data[to+3]=255;
      }
      pc.putImageData(pooled,0,0);
    }
    canvas = document.createElement("canvas");
    canvas.className = "deep-transition-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = w; canvas.height = h;
    page.append(canvas);
    return Boolean(canvas.getContext("2d"));
  }
  function draw(state) {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w/2, h/2); ctx.scale(state.zoom, state.zoom); ctx.translate(-w/2, -h/2);
    ctx.imageSmoothingEnabled = false;
    // Vary tile widths across rows, so the image opens in irregular slabs.
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 12;) {
        const span = Math.min(12-col, (row+col)%3 === 0 ? 2 : 1);
        const x = col*w/12, y = row*h/6, tw = span*w/12, th = h/6;
        const seed = ((row*17+col*13)%19)/19;
        const travel = smooth((state.split-seed*.16)/.84);
        const dx = (x+tw/2-w/2)*travel*1.8;
        const dy = (y+th/2-h/2)*travel*.35;
        ctx.globalAlpha = state.opacity*(1-state.pixel);
        ctx.drawImage(snapshot, x, y, tw, th, x+dx, y+dy, tw+.5, th+.5);
        ctx.globalAlpha = state.opacity*state.pixel;
        ctx.drawImage(pixels, x/w*pixels.width, y/h*pixels.height, tw/w*pixels.width, th/h*pixels.height,
          x+dx, y+dy, tw+.5, th+.5);
        col += span;
      }
    }
    ctx.restore();
  }
  function tick(now) {
    if (!active) return;
    if (document.hidden) { stop(); return; }
    const state = deepEntryFrame(now-began, motion.matches);
    page.style.setProperty("--deep-opacity", String(state.opacity));
    if (!motion.matches) draw(state);
    if (state.done) { const complete = done; stop(); complete?.(); return; }
    frame = requestAnimationFrame(tick);
  }
  return {
    get active() { return active; },
    start(complete) {
      if (active) stop();
      active = true; began = performance.now(); done = complete;
      page.dataset.deepEntry = "entering";
      page.style.setProperty("--deep-opacity", "1");
      try {
        if (!motion.matches && capture()) { draw(deepEntryFrame(0)); page.classList.add("deep-has-frame"); }
      } catch { canvas?.remove(); canvas = snapshot = pixels = null; }
      frame = requestAnimationFrame(tick);
    },
    stop,
  };
}

/** Shared by React and the standalone GitHub Pages build. */
export function mountFocus(root, { captureBackground } = {}) {
  const $ = selector => root.querySelector(selector);
  const page = $(".focus-page"), video = $("video"), audio = $("audio");
  const clock = $(".focus-clock"), play = $(".play-button"), sound = $(".sound-button"), resetButton = $(".reset-button");
  const reminder = $(".screen-reminder"), milestone = $(".milestone-event"), canvas = $(".interference");
  const context = canvas.getContext("2d");
  const tiny = document.createElement("canvas");
  tiny.width = 80; tiny.height = 45;
  const tinyContext = tiny.getContext("2d");
  const preview = new URLSearchParams(location.search).get("preview") === "events";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const stardust = mountStardust(page, motion);
  const deepEntry = createDeepEntry(page, () => {
    try { return captureBackground?.() || stardust.capture(); }
    catch { return stardust.capture(); }
  }, motion);
  const session = createSessionClock();
  const timers = new Map();
  const listeners = [];
  let started = false, soundOn = true, disposed = false, phase = 0, lastSeconds = -1, raf = 0;
  let deck = [], burstSequence = 0;
  const broadcasts = ["别让自己昏过去。","保持当前输入。","不要回应无关信号。","继续。不要解释。","外部噪声正在失去权限。","任务通道稳定。","注意力信号已捕获。","认知负载：可控。","未登记频道：有人比你更早到达这里。","归档损坏：你曾经完成过这一段。"];
  const random = (min,max) => min + Math.random() * (max - min);
  const on = (target,event,handler) => { target.addEventListener(event,handler); listeners.push(() => target.removeEventListener(event,handler)); };
  function cancel(name) { clearTimeout(timers.get(name)); timers.delete(name); }
  function later(name,fn,delay) { cancel(name); timers.set(name,setTimeout(() => {timers.delete(name); if (!disposed) fn();},delay)); }
  function safePlay(media) {
    media.play()?.catch(() => {
      if (disposed || !started) return;
      $(".media-message").textContent = media === audio ? "声音未能播放，点声音图标重试。" : "画面暂时无法播放，稍后重新开始可重试。";
      if (media === audio) { soundOn = false; render(); }
    });
  }
  function clearBurst() {
    cancelAnimationFrame(raf); raf = 0;
    context?.clearRect(0,0,canvas.width,canvas.height);
    page.dataset.burst = "none";
    $(".event-readout").textContent = started ? "CHANNEL / " + PHASES[phase].name.toUpperCase() : "AWAITING INPUT_";
  }
  function burst() {
    if (!started || document.hidden || motion.matches || deepEntry.active) return;
    clearBurst();
    const deep = phase >= 2;
    page.dataset.burst = deep ? "pixel" : "tear";
    $(".event-readout").textContent = deep ? "MEMORY FRAGMENT / " + String(++burstSequence).padStart(3,"0") : "SIGNAL INTERRUPTION";
    if (deep && context && tinyContext) {
      // Cap resolution and rate; only copy video frames during a short burst.
      canvas.width = Math.min(innerWidth,1440);
      canvas.height = Math.round(canvas.width * innerHeight / innerWidth);
      context.imageSmoothingEnabled = false;
      const began = performance.now();
      let lastFrame = -100;
      const seed = Math.random();
      const draw = now => {
        if (disposed || document.hidden || motion.matches || now-began>1150) {clearBurst();return;}
        if (now - lastFrame >= 90) {
          lastFrame = now;
          context.clearRect(0,0,canvas.width,canvas.height);
          if (video.readyState >= 2 && video.videoWidth) {
            const w = canvas.width, h = canvas.height;
            const ratio = w / h, vr = video.videoWidth / video.videoHeight;
            const sw = vr > ratio ? video.videoHeight * ratio : video.videoWidth;
            const sh = vr > ratio ? video.videoHeight : video.videoWidth / ratio;
            try {
              tinyContext.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,0,0,80,45);
              if (deep) {
                // Disconnected crops, never a full-screen replacement.
                for (let i=0;i<3;i++) {
                  const x = ((seed + i*.31 + Math.floor((now-began)/240)*.07) % .65) * w;
                  const y = ((seed*.71 + i*.29) % .74) * h;
                  const width = w * (i === 0 ? .34 : .14), height = h * (i === 0 ? .19 : .07);
                  context.globalAlpha = i === 0 ? .86 : .5;
                  context.drawImage(tiny,Math.floor(x/w*55),Math.floor(y/h*28),22,10,x,y,width,height);
                }
                for (let i=0;i<2;i++) {
                  context.globalAlpha=.32;
                  context.drawImage(tiny,12+i*30,5,1,30,w*((seed+i*.47)%.95),h*.18,w*.006,h*.5);
                }
              } else {
                for (let i=0;i<6;i++) {
                  const x = ((seed+i*.167) % .96)*w;
                  const width = w*(i%2 ? .009 : .024);
                  context.globalAlpha = .6;
                  context.drawImage(video,(video.videoWidth-sw)/2+x/w*sw,(video.videoHeight-sh)/2,width/w*sw,sh,x+Math.sin(i)*12,-15+(i%3)*14,width,h);
                }
              }
            } catch { /* Missing media frames should not interrupt the timer. */ }
          }
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    }
    later("burstEnd",clearBurst,1200);
  }
  function scheduleBurst() {
    cancel("burst");
    if (!started || document.hidden || motion.matches) return;
    later("burst",() => { burst(); scheduleBurst(); },preview ? random(3200,5300) : random(5000,8500));
  }
  function clearBroadcast() { reminder.classList.remove("show"); reminder.textContent=""; reminder.removeAttribute("data-text"); reminder.removeAttribute("aria-label"); }
  function broadcast() {
    if (!started || document.hidden || deepEntry.active) return;
    if (!deck.length) {
      deck = [...broadcasts];
      for (let i=deck.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];}
    }
    clearBroadcast();
    reminder.textContent = deck.pop(); reminder.dataset.text = reminder.textContent;
    reminder.setAttribute("aria-label",reminder.textContent);
    // Keep even the longest broadcast on one line on narrow phones.
    reminder.style.fontSize=`min(clamp(15px, 2.1vw, 32px), ${88/(reminder.textContent.length*1.2)}vw)`;
    void reminder.offsetWidth; reminder.classList.add("show");
    later("broadcastEnd",clearBroadcast,3800);
    scheduleBroadcast();
  }
  function scheduleBroadcast(first = false) {
    cancel("broadcast");
    if (!started || document.hidden) return;
    later("broadcast",broadcast,first ? (preview ? 3000 : 8000) : preview ? random(5500,9000) : random(24000,42000));
  }
  function hideMilestone() { milestone.classList.remove("show"); page.classList.remove("milestone-open"); }
  function transition(index) {
    hideMilestone(); clearBroadcast();
    if (index === 2) {
      ["broadcast", "burst", "broadcastEnd", "burstEnd", "milestoneEnd", "milestoneBurst"].forEach(cancel);
      clearBurst();
      deepEntry.start(() => {
        reminder.textContent = "DEEP / 已进入深层";
        reminder.dataset.text = reminder.textContent;
        reminder.setAttribute("aria-label", reminder.textContent);
        reminder.style.removeProperty("font-size");
        reminder.classList.add("show");
        later("broadcastEnd", clearBroadcast, 3800);
        scheduleBroadcast(); scheduleBurst();
      });
      return;
    }
    $(".milestone-code").textContent = PHASES[index].name.toUpperCase();
    $(".milestone-event p").textContent = PHASES[index].message;
    void milestone.offsetWidth; milestone.classList.add("show"); page.classList.add("milestone-open");
    later("milestoneEnd",hideMilestone,2800);
    later("milestoneBurst",burst,2850);
    scheduleBurst();
  }
  function render() {
    const seconds = session.seconds();
    const next = phaseAt(seconds,preview);
    if (next !== phase) { phase=next; if (!document.hidden && started) transition(phase); }
    if (seconds !== lastSeconds) {
      const value = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
      clock.textContent=value; clock.dataset.clock=value; clock.dateTime=`PT${seconds}S`;
      clock.setAttribute("aria-label",`${Math.floor(seconds/60)} 分 ${seconds%60} 秒`);
      $(".coordinate").textContent="REC / "+String(seconds).padStart(4,"0");
      lastSeconds=seconds;
    }
    page.dataset.phase=PHASES[phase].name;
    page.dataset.started=String(started); page.dataset.running=String(session.running); page.dataset.sound=soundOn?"on":"off";
    page.style.setProperty("--progress",String(Math.min(seconds/(preview?75:4500),1)));
    $(".connection-label").textContent=started?(session.running?"CONNECTED":"ON HOLD"):"STANDBY";
    $(".session-label").textContent=started?(session.running?"专注进行中":"计时已暂停") : "等待接入";
    if (!started) $(".event-readout").textContent="AWAITING INPUT_";
    root.querySelectorAll("[data-step]").forEach((step,i) => {step.dataset.active=String(i===phase); step.dataset.complete=String(i<phase);});
    play.setAttribute("aria-label",session.running?"暂停计时":started?"继续计时":"开始计时"); play.setAttribute("aria-pressed",String(session.running));
    sound.setAttribute("aria-label",soundOn?"关闭声音":"打开声音"); sound.setAttribute("aria-pressed",String(soundOn)); resetButton.disabled=!started;
  }
  function togglePlay() {
    if (!started) { started=true; session.resume(); safePlay(video); if(soundOn)safePlay(audio); scheduleBroadcast(true); scheduleBurst(); }
    else if(session.running)session.pause(); else session.resume();
    render();
  }
  function toggleSound() { soundOn=!soundOn; $(".media-message").textContent=""; if(soundOn&&started)safePlay(audio); else audio.pause(); render(); }
  function reset() {
    timers.forEach(clearTimeout); timers.clear(); deepEntry.stop(); clearBurst(); clearBroadcast(); hideMilestone();
    started=false; session.reset(); phase=0; deck=[]; burstSequence=0;
    video.pause(); audio.pause(); video.load(); audio.currentTime=0;
    $(".media-message").textContent=""; $(".event-readout").textContent="AWAITING INPUT_"; render();
  }
  async function fullscreen() {
    try { if(document.fullscreenElement)await document.exitFullscreen();else await page.requestFullscreen(); }
    catch { $(".media-message").textContent="当前浏览器不支持全屏，可以横屏观看。"; }
  }
  on(play,"click",togglePlay); on(sound,"click",toggleSound); on(resetButton,"click",reset); on($(".fullscreen-button"),"click",fullscreen);
  on(document,"fullscreenchange",() => $(".fullscreen-button").setAttribute("aria-label",document.fullscreenElement?"退出全屏":"进入全屏"));
  on(document,"keydown",event => {
    if(event.repeat||event.metaKey||event.ctrlKey||event.altKey||event.target.closest?.("input,textarea,select,[contenteditable=true]"))return;
    if(event.code==="Space") {if(event.target.closest?.("button"))return; event.preventDefault();togglePlay();}
    else if(event.key.toLowerCase()==="m")toggleSound();
    else if(event.key.toLowerCase()==="r")reset();
    else if(event.key.toLowerCase()==="f")void fullscreen();
  });
  on(document,"visibilitychange",() => {
    ["broadcast","burst","broadcastEnd","burstEnd","milestoneEnd","milestoneBurst"].forEach(cancel);
    deepEntry.stop(); clearBroadcast(); clearBurst(); hideMilestone();
    // Returning from the background updates state without replaying missed transitions.
    phase=phaseAt(session.seconds(),preview); render();
    if(!document.hidden){scheduleBroadcast();scheduleBurst();}
  });
  on(motion,"change",() => {clearBurst();scheduleBurst();});
  $(".preview-indicator").hidden=!preview;
  if(preview)root.querySelectorAll("[data-step] small").forEach((el,i)=>{el.textContent=String(PHASES[i].preview).padStart(2,"0")+"s";});
  const ticker=setInterval(render,200);
  render();
  return () => { disposed=true; clearInterval(ticker); timers.forEach(clearTimeout); timers.clear(); deepEntry.stop(); stardust.dispose(); clearBurst(); clearBroadcast(); hideMilestone(); listeners.forEach(remove=>remove()); video.pause(); audio.pause(); };
}

const dispose = mountFocus(document);
window.addEventListener("pagehide",dispose,{once:true});
window.addEventListener("pageshow",event=>{if(event.persisted)location.reload();});
