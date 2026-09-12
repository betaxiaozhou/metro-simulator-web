/** 车体环境声（与告警蜂鸣共用 audio()） */
import { clamp, ms2kmh } from "../lib/math.js";
import { audio } from "./sfx-core.js";
import { $ } from "../lib/dom.js";
import { train } from "../systems/vehicle-state.js?v=line19-realism-2";

let cabAudioNodes = null;

function ensureCabAudio() {
  if (cabAudioNodes) return cabAudioNodes;
  const c = audio();
  const rumble = c.createOscillator();
  rumble.type = "sawtooth";
  rumble.frequency.value = 48;
  const traction = c.createOscillator();
  traction.type = "sine";
  traction.frequency.value = 165;
  const gR = c.createGain();
  const gT = c.createGain();
  gR.gain.value = 0;
  gT.gain.value = 0;
  rumble.connect(gR);
  traction.connect(gT);
  gR.connect(c.destination);
  gT.connect(c.destination);
  rumble.start();
  traction.start();
  cabAudioNodes = { c, rumble, traction, gR, gT };
  return cabAudioNodes;
}

export function updateCabPresentation() {
  const cab = $("cabScreens");
  if (cab) {
    const vabs = Math.abs(train.vel);
    const shake =
      Math.min(4.8, vabs * vabs * 0.00019) + (Math.abs(train._cmdAccLag) > 0.25 ? 0.55 : 0);
    const t = performance.now() * 0.001;
    const x = Math.sin(t * 38.7) * shake * 0.38;
    const y = Math.sin(t * 27.4) * shake * 0.28;
    cab.style.transform = train.keyOn ? `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)` : "none";
  }
  if (!train.keyOn) return;
  try {
    const ca = ensureCabAudio();
    ca.c.resume?.();
    const spdKmh = ms2kmh(Math.abs(train.vel));
    const rum = clamp(spdKmh / 88, 0, 1) * 0.052;
    const trg = clamp(train.trPct / 100, 0, 1) * 0.042;
    ca.gR.gain.setTargetAtTime(rum + (train.ebActive ? 0.02 : 0), ca.c.currentTime, 0.1);
    ca.gT.gain.setTargetAtTime(trg, ca.c.currentTime, 0.08);
  } catch (e) {}
}
