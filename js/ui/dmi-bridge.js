/** 国标 DMI（metro-simulator/vobc-dmi iframe）控件映射桥接 */
import { clamp, ms2kmh } from "../lib/math.js";
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { train } from "../systems/vehicle-state.js?v=line19-realism-2";
import { STATIONS } from "../systems/route-model.js?v=line19-realism-2";
import { calcATPLimit, calcEBILimit, calcTargetInfo } from "../systems/signaling-atp.js?v=line19-realism-2";
import { capBelowSupervised } from "../systems/supervised-limits.js?v=line19-realism-2";
import { computeAtoRecommendedKmh } from "../systems/ato-controller.js?v=line19-realism-2";
import { lastMmiMsg } from "./messages.js";
import { $ } from "../lib/dom.js";
import { platformScreenDoorsOpenForDmi } from "../systems/doors.js";

/** ATO/站停自动施加的零速保持制动（与 TCMS holdBrakeActive 一致） */
export function isHoldBrakeActive() {
  const autoModes = train.mode === "AM" || train.mode === "FAM";
  return (
    ((train.atoRunning && autoModes) || train.dwelling) &&
    train.zeroSpeed &&
    !train.ebActive
  );
}

/** DMI 18 区上行箭头：建议发车（晚点预警）；墙钟用 STATION_DWELL_DEPART_HINT_S（≠ A/A 自动关门时刻） */
function dmiZone18DepartSuggest() {
  if (!(train.mode === "AM" || train.mode === "FAM")) return false;
  if (!(train.doorMode === "AM" || train.doorMode === "AA")) return false;
  if (train.departSuggestAnchorIdx < 0 || !train.departSuggestEpochMs) return false;
  if (!train.zeroSpeed || train.ebActive || train.holdAtStation) return false;
  const st = STATIONS[train.departSuggestAnchorIdx];
  if (!st) return false;
  if (Math.abs(train.pos - st.pos) > CONST.DEPART_SUGGEST_ANCHOR_RADIUS_M) return false;
  if (Date.now() - train.departSuggestEpochMs < CONST.STATION_DWELL_DEPART_HINT_S * 1000) return false;
  if (!train.doorClosed || platformScreenDoorsOpenForDmi()) return false;
  return true;
}

/**
 * 19 区 / TCMS 门模式文案。
 */
export function formatDoorModeForDmi(mode) {
  const m = String(mode ?? "").trim();
  if (!m) return "";
  switch (m) {
    case "MM":
      return "M/M";
    case "AM":
      return "A/M";
    case "AA":
      return "A/A";
    default:
      return m;
  }
}

export function dmiZone5MaxAuthorizedLabel() {
  const ceiling = train.maxAuthorizedDrivingMode ?? "FAM";
  const cbtc = train.atpActive;
  if (ceiling === "RM") return "RM";
  if (ceiling === "CM") return cbtc ? "CM-C" : "CM-I";
  if (ceiling === "AM") return cbtc ? "AM-C" : "AM-I";
  if (ceiling === "FAM") return cbtc ? "FAM-C" : "AM-I";
  return cbtc ? "FAM-C" : "AM-I";
}

export function buildVobcControlMap(cab = train.activeCab ?? "Tc1") {
  const cabPowered = Boolean(train.cabKeys?.[cab]);
  const cabConflict = Boolean(cabPowered && train.activeCab && train.activeCab !== cab);
  const oppositeCab = cab === "Tc1" ? "Tc2" : "Tc1";
  const oppositeKeyOn = Boolean(train.cabKeys?.[oppositeCab]);
  const oppositeFault = Boolean(cabPowered && train.activeCab === cab && oppositeKeyOn);
  const v = ms2kmh(Math.abs(train.vel));
  const atpLimit = calcATPLimit();
  const ebiLimit = calcEBILimit();
  const tinfo = calcTargetInfo();
  let recommend = Math.max(0, atpLimit - CONST.AM_REC_OFFSET);
  if (train.mode === "AM" || train.mode === "FAM")
    recommend = computeAtoRecommendedKmh(atpLimit);
  recommend = capBelowSupervised(train.pos, recommend);
  const hideRecommendSpd =
    train.mode === "AM" ||
    train.mode === "FAM" ||
    !train.doorClosed;
  const hideEbSpd = false;
  const ebLim = capBelowSupervised(
    train.pos,
    train.doorClosed ? ebiLimit + CONST.ATP_OVERSPEED_MARGIN : ebiLimit,
  );
  const ns = STATIONS[train.nextStationIdx];
  const term = STATIONS[STATIONS.length - 1];

  let z1 = "none";
  if (train.ebActive) z1 = "red";
  else if (!hideRecommendSpd && v > recommend + 0.5) z1 = "orange";

  const distRaw = tinfo.dist >= 9000 ? 9999 : Math.max(0, tinfo.dist);
  const z2 = String(Math.round(distRaw));
  const z2tNum =
    tinfo.target === 0 ? 0 : Math.round(clamp(tinfo.target, 0, 110) * 10) / 10;
  const z2t = String(z2tNum);
  const fmtKmh01 = (x) => String(Math.round(clamp(x, 0, 110) * 10) / 10);

  let z4 = "coasting";
  if (train.ebActive || train.atpSbActive) z4 = "braking";
  else if (train.trPct > 2) z4 = "traction";
  else if (train.bkPct > 2 || isHoldBrakeActive()) z4 = "braking";

  let z5 = dmiZone5MaxAuthorizedLabel();

  let z13 = train.mode;
  if (z13 !== "AM" && z13 !== "CM" && z13 !== "RM" && z13 !== "FAM") z13 = "CM";

  let z14 = train.mode === "RM" ? "RM" : train.atpActive ? "CBTC" : "ITC";

  let z11 = "none";
  if (train.skipStation) z11 = "skip";
  else if (train.holdAtStation) z11 = "hold";

  let z17 = "1";
  const illegalUntil = train.doorIllegalOpenIndicateUntil ?? 0;
  if (Date.now() < illegalUntil && !train.doorClosed) z17 = "8";
  else if (!train.doorClosed) {
    if (train.doorOpenSide === "both") z17 = "7";
    else if (train.doorOpenSide === "left") z17 = "5";
    else if (train.doorOpenSide === "right") z17 = "6";
    else z17 = "1";
  } else if (train.doorManualBoth) z17 = "2";
  else if (train.doorAtpLeft) z17 = "3";
  else if (train.doorAtpRight) z17 = "4";
  else z17 = "1";

  let z18 = "none";
  if (!train.doorClosed) {
    const sinceOpen =
      train.doorOpenedAtMs > 0 ? Date.now() - train.doorOpenedAtMs : 0;
    if (sinceOpen >= CONST.DMI_Z18_CLOSE_HINT_DELAY_MS) z18 = "close";
  } else if (dmiZone18DepartSuggest()) z18 = "depart";

  const z20 = platformScreenDoorsOpenForDmi() ? "psd" : "none";

  let z16 = "none";
  if (ns) {
    const d = ns.pos - train.pos;
    if (train.dwelling && Math.abs(d) < 8) z16 = "precision";
    else if (d > 0 && d < 80 && train.zeroSpeed) z16 = "stop-range";
    else if (d > 0 && d < 220) z16 = "platform";
  }

  const trainIdEl = $("trainId");
  const trip = trainIdEl ? trainIdEl.textContent.replace(/^车次\s*/, "").trim() : "19005";

  return {
    "c-z1": z1,
    "c-z2": z2,
    "c-z2-tgt": z2t,
    "c-z3-spd": fmtKmh01(v),
    "c-z3-tgt": fmtKmh01(recommend),
    "c-z3-eb": fmtKmh01(ebLim),
    "c-hide-recommend": hideRecommendSpd ? "1" : "0",
    "c-hide-eb": hideEbSpd ? "1" : "0",
    "c-locked": cabPowered ? "0" : "1",
    "c-z4": z4,
    "c-z5": z5,
    "c-z6": "1",
    "c-z7": cabConflict ? "3" : oppositeFault ? "2" : "1",
    "c-z8": term.name,
    "c-z9": ns ? ns.name : term.name,
    "c-z10": trip,
    "c-z11": z11,
    "c-z13": z13,
    "c-z14": z14,
    "c-z15": "none",
    "c-z16": z16,
    "c-z17": z17,
    "c-z18": z18,
    "c-z19": formatDoorModeForDmi(train.doorMode),
    "c-z20": z20,
    "c-z21": "none",
    "c-z22": "none",
    "c-z23": "",
    "c-z25": String(lastMmiMsg),
  };
}

let _vobcPostT = 0;

export function resetVobcDmiThrottle() {
  _vobcPostT = 0;
}

/** Tc1/Tc2 两端车载 DMI iframe；数据源共享，锁定状态按驾驶台占用权分别下发 */
const VOBC_DMI_IDS = ["mmi-vobc", "mmi-vobc2"];

export function postVobcDmi() {
  const now = performance.now();
  if (now - _vobcPostT < 55) return;
  _vobcPostT = now;
  const targetOrigin = window.location.origin;
  for (const [index, id] of VOBC_DMI_IDS.entries()) {
    const fr = document.getElementById(id);
    if (!fr?.contentWindow) continue;
    try {
      const controls = buildVobcControlMap(index === 0 ? "Tc1" : "Tc2");
      fr.contentWindow.postMessage(
        { type: "metro-vobc-dmi", controls },
        targetOrigin,
      );
    } catch (e) {}
  }
}
