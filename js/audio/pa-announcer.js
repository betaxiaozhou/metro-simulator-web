/**
 * 客室报站广播（PA）：19 号线下行，按区间编号播报。
 *
 * 广播文件命名：assets/announcements/stations/19号线-下行-{区间}-{类型}.wav
 *   区间 N = 1..9，对应 STATIONS[N-1] → STATIONS[N]（牡丹园…新宫）。
 *   类型 1 = 离开发车站（列车出站）
 *   类型 2 = 进入下一站（到站）
 *   类型 3 = 到站开门
 *
 * 全部走 WebAudio（AudioBufferSourceNode + 已 resume 的 audio() 上下文），
 * 与紧急制动广播、驾驶室蜂鸣共用同一条已解锁的音频通路，
 * 不使用 HTMLAudioElement，避免集成浏览器静默拦截媒体元素播放。
 * 报站为一次性播放（不循环），多次播报各自独立 source 可叠加。
 */
import { audio } from "./sfx-core.js";

const bufferCache = new Map();
const loadingPromises = new Map();

async function loadBuffer(seg, type) {
  const key = `${seg}-${type}`;
  if (bufferCache.has(key)) return bufferCache.get(key);
  if (loadingPromises.has(key)) return loadingPromises.get(key);

  const p = (async () => {
    try {
      const c = audio();
      const resp = await fetch(`assets/announcements/stations/19号线-下行-${seg}-${type}.wav`);
      if (!resp.ok) return null;
      const arr = await resp.arrayBuffer();
      const buf = await c.decodeAudioData(arr);
      bufferCache.set(key, buf);
      return buf;
    } catch (e) {
      return null;
    } finally {
      loadingPromises.delete(key);
    }
  })();
  loadingPromises.set(key, p);
  return p;
}

function playOnce(seg, type) {
  if (seg < 1 || seg > 9) return;
  try {
    const c = audio();
    c.resume?.();
    loadBuffer(seg, type).then((buf) => {
      if (!buf) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start();
    });
  } catch (e) {}
}

/** 离开发车站（区间 seg，列车刚出 STATIONS[seg-1]） */
export function announceDeparture(seg) {
  playOnce(seg, 1);
}

/** 进入下一站（区间 seg，到达 STATIONS[seg]） */
export function announceArrival(seg) {
  playOnce(seg, 2);
}

/** 到站开门（区间 seg，在 STATIONS[seg] 开门） */
export function announceDoors(seg) {
  playOnce(seg, 3);
}
