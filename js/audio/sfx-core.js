/** 驾驶室提示音：蜂鸣、警铃共用音频上下文 */

let audioCtx = null;

export function audio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export function beep(freq = 880, dur = 0.1, vol = 0.15, type = "square") {
  try {
    const c = audio();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start();
    o.stop(c.currentTime + dur);
  } catch (e) {}
}

let alarmInt = null;

export function startAlarm() {
  if (alarmInt) return;
  let hi = true;
  alarmInt = setInterval(() => {
    beep(hi ? 1200 : 800, 0.18, 0.12, "square");
    hi = !hi;
  }, 220);
}

export function stopAlarm() {
  if (alarmInt) {
    clearInterval(alarmInt);
    alarmInt = null;
  }
}

/** 紧急制动客室广播（PA），与驾驶室蜂鸣叠加播放 */
let ebBuffer = null;
let ebSource = null;
let ebLoading = false;

async function ensureEbBuffer() {
  if (ebBuffer || ebLoading) return;
  ebLoading = true;
  try {
    const c = audio();
    const resp = await fetch("assets/announcements/emergency/19号线-紧急制动.wav");
    const arr = await resp.arrayBuffer();
    ebBuffer = await c.decodeAudioData(arr);
  } catch (e) {
  } finally {
    ebLoading = false;
  }
}

export function playEbAnnouncement() {
  try {
    const c = audio();
    c.resume?.();
    ensureEbBuffer().then(() => {
      if (!ebBuffer || ebSource) return;
      const src = c.createBufferSource();
      src.buffer = ebBuffer;
      src.loop = true;
      src.connect(c.destination);
      src.start();
      ebSource = src;
    });
  } catch (e) {}
}

export function stopEbAnnouncement() {
  if (ebSource) {
    try {
      ebSource.stop();
    } catch (e) {}
    ebSource = null;
  }
}
