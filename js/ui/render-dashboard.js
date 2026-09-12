import { $ } from "../lib/dom.js";
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { STATIONS } from "../systems/route-model.js?v=line19-realism-2";
import { train } from "../systems/vehicle-state.js?v=line19-realism-2";
import { postVobcDmi, formatDoorModeForDmi, isHoldBrakeActive } from "./dmi-bridge.js?v=tc-cab-names-4";
import { updateTrainMarker } from "./track-view.js?v=line19-realism-2";
import { atoStartPreconditionsMet } from "../systems/ato-readiness.js?v=line19-realism-2";

let _tcmsPostT = 0;

/** Tc1/Tc2 两端 TCMS iframe；车辆状态共享，控制端上电状态分别下发 */
const TCMS_DMI_IDS = ["mmi-tcms", "mmi-tcms2"];

function postTcmsDmi(ns) {
  const now = performance.now();
  if (now - _tcmsPostT < 80) return;
  _tcmsPostT = now;

  const date = new Date();
  const targetOrigin = window.location.origin;
  const term = STATIONS[STATIONS.length - 1];
  const trainIdEl = $("trainId");
  const trainNo = trainIdEl ? trainIdEl.textContent.replace(/^车次\s*/, "").trim() : "19005";
  const sharedState = {
      trainNo,
      date: date.toISOString().slice(0, 10),
      time: date.toTimeString().slice(0, 8),
      nextStation: ns ? ns.name : term.name,
      terminalStation: term.name,
      speedKmh: Math.abs(train.vel) * 3.6,
      lineV: CONST.LINE_VOLTAGE,
      motorCurrentA: train.motorCurrentA,
      mrPress: train.mrPress,
      bcPress: train.bcPress,
      trPct: train.trPct,
      bkPct: train.bkPct,
      mode: train.mode,
      ebActive: train.ebActive,
      atpSbActive: train.atpSbActive,
      zeroSpeed: train.zeroSpeed,
      /** 仅自动施加抱闸（ATO 运行或站停乘降）时才算「保持制动」；
       *  手动驾驶停稳且手柄归零应与手柄读数一致显示「惰行」。 */
      holdBrakeActive: isHoldBrakeActive(),
      dwelling: train.dwelling,
      doorOpenSide: train.doorOpenSide,
      consistLength: CONST.CONSIST_LENGTH,
      doorsPerSide: CONST.DOORS_PER_SIDE,
      ac: train.ac,
  };

  for (const [index, id] of TCMS_DMI_IDS.entries()) {
    const fr = document.getElementById(id);
    if (!fr?.contentWindow) continue;
    try {
      const cab = index === 0 ? "Tc1" : "Tc2";
      const powered = Boolean(train.cabKeys?.[cab]);
      // 两块 TCMS 始终按 Tc1 → Tc2 的固定编组方向显示。
      const endSide = (end) => end === "Tc1" ? "left" : "right";
      const activeEnd = train.activeCab ? endSide(train.activeCab) : "right";
      const directionEnd =
        train.direction === "F" ? "Tc1" : train.direction === "R" ? "Tc2" : train.activeCab ?? cab;
      fr.contentWindow.postMessage({
        type: "metro-tcms-dmi",
        state: {
          ...sharedState,
          trainNo: `${trainNo}(${cab})`,
          keyOn: powered,
          lineV: powered ? CONST.LINE_VOLTAGE : 0,
          activeEnd,
          runningDirection: endSide(directionEnd),
        },
      }, targetOrigin);
    } catch (e) {}
  }
}

export function renderDashboard() {
  const ns = STATIONS[train.nextStationIdx];
  postVobcDmi();
  postTcmsDmi(ns);
  updateTrainMarker();

  const setText = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
  };

  setText("totalDist", train.pos.toFixed(0));
  setText("absPos", train.pos.toFixed(1));
  setText("atpLevel", train.atpActive ? "CBTC L2" : "降级");
  setText("moveAuth", ns ? Math.max(0, ns.pos - train.pos).toFixed(0) + "m" : "—");

  const trBar = $("trBar");
  const bkBar = $("bkBar");
  if (trBar) trBar.style.width = train.trPct + "%";
  if (bkBar) bkBar.style.width = train.bkPct + "%";
  setText("trPct", String(train.trPct));
  setText("bkPct", String(train.bkPct));
  setText("mrPress", train.mrPress.toFixed(0));
  setText("bcPress", train.bcPress.toFixed(0));
  setText("thirdRailState", train.keyOn ? "受电弓升弓" : "ZK OFF");
  setText("lineV", train.keyOn ? String(CONST.LINE_VOLTAGE) : "0");

  const ia = train.motorCurrentA;
  const iWrap = $("motorCurrentWrap");
  if (iWrap) {
    iWrap.className =
      "num motor-i-wrap " + (ia < -8 ? "regen" : ia > 8 ? "traction" : "neutral");
  }
  const iAbs = Math.abs(ia) < 0.5 ? "0" : (ia > 0 ? "+" : "") + ia.toFixed(0);
  setText("motorCurrentA", iAbs);

  const dms = formatDoorModeForDmi(train.doorMode);
  const doorTxt =
    train.doorOpenSide === "both"
      ? "双开"
      : train.doorOpenSide === "left"
        ? "左开"
        : train.doorOpenSide === "right"
          ? "右开"
          : "全关";
  const allowHint =
    train.doorManualBoth ? "人双" : train.doorAtpLeft ? "ATP左" : train.doorAtpRight ? "ATP右" : "—";
  setText("doorState", `${doorTxt} · ${dms || "—"} · ${allowHint}`);
  setText("acState", train.ac ? "开" : "关");

  setText("leverPos", (train.lever * 100).toFixed(0));
  setText("leverPosTc2", (train.lever * 100).toFixed(0));
  let st = "惰行";
  if (train.ebActive) st = "ATP 紧急制动";
  else if (train.atpSbActive) st = "ATP 常用制动";
  else if (isHoldBrakeActive()) st = "保持制动";
  else if (train.trPct > 2) st = "牵引";
  else if (train.bkPct > 2) st = train.bkPct >= 100 ? "EB 快速制动" : "常用制动";
  setText("leverState", st);
  setText("leverStateTc2", st);

  for (const cab of ["Tc1", "Tc2"]) {
    const suffix = cab === "Tc1" ? "" : "Tc2";
    const active = train.keyOn && train.activeCab === cab;
    const controlStates = {
      btnHeadlight: train.headlight,
      btnCabinLight: train.cabinLight,
      btnSalonLight: train.salonLight,
      btnAC: train.ac,
      btnWiperL: train.wiper === 1,
      btnWiperH: train.wiper === 2,
      btnHorn: train.horn,
      btnDoorEnable: train.doorManualBoth,
      btnSkip: train.skipStation,
      btnHold: train.holdAtStation,
    };
    for (const [id, on] of Object.entries(controlStates)) {
      $(`${id}${suffix}`)?.classList.toggle("on", active && on);
    }
    const doorMode = $(`doorModeSelect${suffix}`);
    if (doorMode) doorMode.value = train.doorMode;
    const maxMode = $(`maxAuthModeSelect${suffix}`);
    if (maxMode) maxMode.value = train.maxAuthorizedDrivingMode;
    const btnAto = $(`btnATO${suffix}`);
    if (btnAto) {
      btnAto.classList.toggle("on", active && train.atoRunning);
      const aut = active && (train.mode === "AM" || train.mode === "FAM");
      const showReady = aut && !train.atoRunning && atoStartPreconditionsMet();
      btnAto.classList.toggle("ready", showReady);
    }
  }
}
