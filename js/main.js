/**
 * 组装入口：仿真主循环、DOM 事件与各子系统实例化前的最后编排。
 * 业务逻辑见 js/systems/* 、js/audio/* 、js/ui/*
 */
import { CONST } from "./config/constants.js?v=line19-realism-2";
import { $ } from "./lib/dom.js";
import { clamp } from "./lib/math.js";
import { STATIONS } from "./systems/route-model.js?v=line19-realism-2";
import { train } from "./systems/vehicle-state.js?v=line19-realism-2";
import { physicsTick } from "./systems/physics-engine.js?v=line19-realism-2";
import {
  setLever,
  setMode,
  modeUp,
  modeDown,
} from "./systems/cab-driver-input.js?v=line19-realism-2";
import { openDoor, closeDoor, closeDoorSide } from "./systems/doors.js?v=line19-realism-2";
import { triggerEB, releaseEB } from "./systems/emergency-brake.js?v=line19-realism-2";
import { beep, stopAlarm } from "./audio/sfx-core.js";
import { updateCabPresentation } from "./audio/cab-ambience.js?v=line19-realism-2";
import { showMsg, tcmsLog } from "./ui/messages.js";
import { renderDashboard } from "./ui/render-dashboard.js?v=fixed-consist-order-1";
import { buildTrack, initTrackViewportControls, resetTrackViewport } from "./ui/track-view.js?v=line19-realism-2";
import { initSupervisedLimitEditor, resetSupervisedLimitEditorUI } from "./ui/supervised-limit-editor.js?v=line19-realism-2";
import { syncLeverHandlePos } from "./ui/lever-handle.js?v=tc-cab-names-4";
import { postVobcDmi, resetVobcDmiThrottle } from "./ui/dmi-bridge.js?v=tc-cab-names-4";
import { atoStartPreconditionsMet, disengageAto } from "./systems/ato-readiness.js?v=line19-realism-2";

function loop() {
  physicsTick(CONST.G_DT);
  updateCabPresentation();
  renderDashboard();
}

setInterval(loop, 1000 * CONST.G_DT);

setInterval(() => {
  const el = $("systemTime");
  if (el) el.textContent = new Date().toTimeString().slice(0, 8);
}, 1000);

const CAB_IDS = ["Tc1", "Tc2"];
train.activeCab = "Tc1";
train.cabKeys = { Tc1: true, Tc2: false };
/**
 * 方向手柄标识的是司机面前的物理方向；线路里程则固定以 Tc1 端前方为正向。
 * 因此在 Tc2 端操作时，F/R 与线路正反向相反。
 */
function routeDirectionForCab(cab, cabDirection) {
  if (cabDirection === "N") return "N";
  if (cab === "Tc1") return cabDirection;
  return cabDirection === "F" ? "R" : "F";
}
const cabControlId = (id, cab) => (cab === "Tc1" ? id : `${id}Tc2`);
const cabControl = (id, cab) => $(cabControlId(id, cab));
const cabIsActive = (cab) => train.keyOn && train.activeCab === cab;

function renderCabAuthority() {
  for (const cab of CAB_IDS) {
    const active = cabIsActive(cab);
    const conflict = Boolean(train.cabKeys[cab] && train.activeCab && train.activeCab !== cab);
    const root = document.querySelector(`.cab[data-cab="${cab}"]`);
    root?.classList.toggle("is-active", active);
    root?.classList.toggle("is-standby", !active);
    root?.classList.toggle("is-conflict", conflict);
    const status = document.querySelector(`[data-cab-status="${cab}"]`);
    if (status) {
      status.textContent = active
        ? "当前控制端"
        : conflict
          ? "VOBC 7区故障 · 对端激活"
          : "未占用";
    }
    root?.querySelectorAll(".ks-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.key === (train.cabKeys[cab] ? "on" : "off"));
    });
  }
}

function requireActiveCab(cab) {
  if (cabIsActive(cab)) return true;
  showMsg(`驾驶台 ${cab} 未取得控制权：司机钥匙可以处于 ON，但先激活的 ${train.activeCab || "另一"} 端仍保持占用`, "alarm");
  return false;
}

function grantCabAuthority(cab) {
  train.activeCab = cab;
  train.keyOn = true;
  train.direction = "N";
  train.lever = 0;
  syncLeverHandlePos(0);
  renderCabAuthority();
}

function setCabKey(cab, turnOn) {
  if (turnOn) {
    train.cabKeys[cab] = true;
    if (train.activeCab && train.activeCab !== cab) {
      renderCabAuthority();
      showMsg(`驾驶台 ${cab} 钥匙已转到 ON，但控制权仍由先激活的 ${train.activeCab} 端保持；本端 VOBC 7区报故障`, "alarm");
      tcmsLog(`${cab} KEY ON · 对端 ${train.activeCab} 已占用 · VOBC 7区故障`, "err");
      return;
    }
    if (train.activeCab === cab) {
      renderCabAuthority();
      return;
    }
    if (Math.abs(train.vel) > 0.02) {
      train.cabKeys[cab] = false;
      showMsg("换端：列车必须停稳", "alarm");
      return;
    }
    grantCabAuthority(cab);
    showMsg(`驾驶台 ${cab} 已取得列车控制权 · ATP/ATO 车载核心继续共用`, "ok");
    tcmsLog(`${cab} ACTIVE · 车载信号系统控制端切换`, "ok");
    return;
  }

  if (!cabIsActive(cab)) {
    train.cabKeys[cab] = false;
    renderCabAuthority();
    tcmsLog(`${cab} KEY OFF · VOBC 7区故障解除`, "info");
    return;
  }
  if (Math.abs(train.vel) > 0.02) {
    showMsg("关闭司机钥匙：列车必须停稳", "alarm");
    return;
  }
  if (Math.abs(train.lever) > 0.05 || train.direction !== "N") {
    showMsg("关闭司机钥匙：请先将主控手柄归零、方向手柄置于 N 位", "alarm");
    return;
  }
  disengageAto();
  train.cabKeys[cab] = false;
  const waitingCab = CAB_IDS.find((candidate) => candidate !== cab && train.cabKeys[candidate]);
  if (waitingCab) {
    grantCabAuthority(waitingCab);
    showMsg(`驾驶台 ${cab} 已释放，钥匙处于 ON 的 ${waitingCab} 端取得控制权`, "ok");
    tcmsLog(`${cab} RELEASED → ${waitingCab} ACTIVE`, "ok");
  } else {
    train.activeCab = null;
    train.keyOn = false;
    renderCabAuthority();
    showMsg(`驾驶台 ${cab} 已释放控制权，可在另一端打开司机钥匙`, "ok");
    tcmsLog(`${cab} RELEASED · 两端未占用`, "info");
  }
}

function bindCabControl(id, handler) {
  for (const cab of CAB_IDS) {
    cabControl(id, cab)?.addEventListener("click", (event) => {
      if (!requireActiveCab(cab)) return;
      handler(cab, event);
    });
  }
}

function bindToggle(id, key) {
  bindCabControl(id, (cab) => {
    train[key] = !train[key];
    cabControl(id, cab)?.classList.toggle("on", train[key]);
    tcmsLog(`${id}: ${train[key] ? "ON" : "OFF"}`);
    beep(700, 0.05);
  });
}

bindToggle("btnHeadlight", "headlight");
bindToggle("btnCabinLight", "cabinLight");
bindToggle("btnSalonLight", "salonLight");
bindToggle("btnAC", "ac");
bindToggle("btnHorn", "horn");

bindCabControl("btnWiperL", () => {
  train.wiper = train.wiper === 1 ? 0 : 1;
  tcmsLog(`雨刮低速: ${train.wiper === 1 ? "ON" : "OFF"}`);
  beep(700, 0.05);
});
bindCabControl("btnWiperH", () => {
  train.wiper = train.wiper === 2 ? 0 : 2;
  tcmsLog(`雨刮高速: ${train.wiper === 2 ? "ON" : "OFF"}`);
  beep(700, 0.05);
});

for (const cab of CAB_IDS) {
  cabControl("btnHorn", cab)?.addEventListener("mousedown", () => {
    if (cabIsActive(cab)) beep(220, 0.6, 0.2, "sawtooth");
  });
}

bindCabControl("btnDoorLeft", () => openDoor("left"));
bindCabControl("btnDoorRight", () => openDoor("right"));
bindCabControl("btnDoorCloseLeft", () => closeDoorSide("left"));
bindCabControl("btnDoorCloseRight", () => closeDoorSide("right"));

function startAtoFromCab() {
  if (!atoStartPreconditionsMet()) {
    showMsg(
      "ATO 条件未满足：钥匙 ON、AM/FAM、前进 F、手柄零位、门关好锁紧、无 EB、未扣车、非站停中、已停稳，且前方具备移动授权空间",
      "alarm",
    );
    return;
  }
  train.atoReady = true;
  train.atoRunning = true;
  showMsg("ATO 启动 - 自动驾驶", "ok");
  tcmsLog("ATO 启动（人工确认）", "ok");
  beep(880, 0.1);
  setTimeout(() => beep(1100, 0.15), 120);
}
bindCabControl("btnATO", startAtoFromCab);

bindCabControl("btnModeUp", modeUp);
bindCabControl("btnModeDown", modeDown);
bindCabControl("btnConfirm", () => {
  showMsg("确认", "ok");
  beep(880, 0.05);
});
bindCabControl("btnDoorEnable", (cab) => {
  train.doorManualBoth = !train.doorManualBoth;
  cabControl("btnDoorEnable", cab)?.classList.toggle("on", train.doorManualBoth);
  showMsg(`人工车门允许（两侧） ${train.doorManualBoth ? "ON" : "OFF"}`, "ok");
  tcmsLog(`人工门允许 ${train.doorManualBoth ? "两侧" : "关"}`, "info");
});
bindCabControl("btnSkip", (cab) => {
  train.skipStation = !train.skipStation;
  cabControl("btnSkip", cab)?.classList.toggle("on", train.skipStation);
});
bindCabControl("btnHold", (cab) => {
  train.holdAtStation = !train.holdAtStation;
  cabControl("btnHold", cab)?.classList.toggle("on", train.holdAtStation);
});

for (const cab of CAB_IDS) {
  cabControl("doorModeSelect", cab)?.addEventListener("change", (e) => {
    if (!requireActiveCab(cab)) {
      e.target.value = train.doorMode;
      return;
    }
    const v = e.target.value;
    if (v === "MM" || v === "AM" || v === "AA") {
      train.doorMode = v;
      const lab = v === "MM" ? "M/M" : v === "AM" ? "A/M" : "A/A";
      tcmsLog(`门模式 → ${lab}`, "info");
      beep(660, 0.06);
    }
  });

  cabControl("maxAuthModeSelect", cab)?.addEventListener("change", (e) => {
    if (!requireActiveCab(cab)) {
      e.target.value = train.maxAuthorizedDrivingMode;
      return;
    }
    const v = e.target.value;
    if (v === "RM" || v === "CM" || v === "AM" || v === "FAM") {
      train.maxAuthorizedDrivingMode = v;
      tcmsLog(`最高驾驶模式（DMI 5 区授权） → ${v}`, "info");
      beep(620, 0.06);
    }
  });
}

function toggleEmergencyBrake(cab) {
  if (!requireActiveCab(cab)) return;
  if (train.ebActive) releaseEB();
  else triggerEB("司机紧急按钮");
}
for (const cab of CAB_IDS) {
  cabControl("emergencyBtn", cab)?.addEventListener("click", () => toggleEmergencyBrake(cab));
}

document.querySelectorAll(".ks-btn").forEach((b) => {
  b.addEventListener("click", () => {
    setCabKey(b.dataset.cab, b.dataset.key === "on");
  });
});

document.querySelectorAll(".dir-pos").forEach((b) => {
  b.addEventListener("click", () => {
    const cab = b.dataset.cab;
    if (!requireActiveCab(cab)) return;
    if (Math.abs(train.vel) > 0.2) {
      showMsg("方向：列车需停稳", "alarm");
      return;
    }
    if (Math.abs(train.lever) > 0.05) {
      showMsg("换向：请先将主控手柄归零", "alarm");
      return;
    }
    document.querySelector(`.cab[data-cab="${cab}"]`)?.querySelectorAll(".dir-pos").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    train.direction = routeDirectionForCab(cab, b.dataset.dir);
    if (train.direction !== "F") disengageAto();
    tcmsLog(`方向 ${train.direction}`);
    beep(660, 0.05);
  });
});

function leverFromY(track, clientY) {
  const r = track.getBoundingClientRect();
  const t = clamp((clientY - r.top) / r.height, 0, 1);
  const range = 2.2;
  return 1 - t * range;
}

function bindLeverTrack(cab) {
  const track = cabControl("leverTrack", cab);
  let dragging = false;
  track?.addEventListener("pointerdown", (e) => {
    if (!requireActiveCab(cab)) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging = true;
    try {
      track.setPointerCapture(e.pointerId);
    } catch (err) {}
    setLever(leverFromY(track, e.clientY));
  });
  track?.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    setLever(leverFromY(track, e.clientY));
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      if (e?.pointerId != null) track.releasePointerCapture(e.pointerId);
    } catch (err) {}
  };
  track?.addEventListener("pointerup", endDrag);
  track?.addEventListener("pointercancel", endDrag);
}
for (const cab of CAB_IDS) bindLeverTrack(cab);

window.addEventListener("keydown", (e) => {
  const hm = $("helpModal");
  if (hm && !hm.hidden) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (!train.activeCab) return;
  switch (e.key.toLowerCase()) {
    case "w":
      if (!e.repeat) setLever(clamp(train.lever + 0.1, -1.2, 1));
      break;
    case "s":
      if (!e.repeat) setLever(clamp(train.lever - 0.1, -1.2, 1));
      break;
    case "q":
      modeUp();
      break;
    case "e":
      modeDown();
      break;
    case "enter":
      cabControl("btnATO", train.activeCab)?.click();
      break;
    case "escape":
      toggleEmergencyBrake(train.activeCab);
      break;
    case "h":
      cabControl("btnHorn", train.activeCab)?.dispatchEvent(new MouseEvent("mousedown"));
      break;
  }
});

$("btnReset")?.addEventListener("click", () => {
  if (!confirm("重置整个模拟？")) return;
  Object.assign(train, {
    pos: 0,
    vel: 0,
    acc: 0,
    lever: 0,
    direction: "N",
    activeCab: "Tc1",
    cabKeys: { Tc1: true, Tc2: false },
    keyOn: true,
    mode: "RM",
    atpActive: true,
    atoReady: false,
    atoRunning: false,
    atpSbActive: false,
    ebActive: false,
    ebReason: "",
    atoJogAttempts: 0,
    atoJogActive: false,
    atoJogExhausted: false,
    atoOverrunPending: false,
    _atoAccPrev: 0,
    doorAtpLeft: false,
    doorAtpRight: false,
    doorManualBoth: false,
    doorLeftOpen: false,
    doorRightOpen: false,
    doorOpenSide: "none",
    doorClosed: true,
    psdAllClosedLockedNotBefore: 0,
    doorOpenedAtMs: 0,
    doorIllegalOpenIndicateUntil: 0,
    zeroSpeed: true,
    nextStationIdx: 1,
    passengerLoadRatio: CONST.DEFAULT_PASSENGER_LOAD_RATIO,
    dwelling: false,
    dwellTimer: 0,
    dwellHadDoorOpenDuringStop: false,
    departSuggestEpochMs: 0,
    departSuggestAnchorIdx: -1,
    autoDoorReleased: false,
    doorMode: "AA",
    maxAuthorizedDrivingMode: "FAM",
    headlight: false,
    cabinLight: true,
    salonLight: true,
    ac: false,
    wiper: 0,
    mrPress: 900,
    bcPress: 0,
    trPct: 0,
    bkPct: 0,
    _cmdAccLag: 0,
    motorCurrentA: 0,
    skipStation: false,
    holdAtStation: false,
    paArrivalPlayedForIdx: -1,
    paDeparturePlayedForIdx: -1,
  });
  document.querySelectorAll(".op-btn").forEach((b) => b.classList.remove("on"));
  document.querySelectorAll(".dir-pos").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll('[data-dir="N"]').forEach((b) => b.classList.add("active"));
  renderCabAuthority();
  stopAlarm();
  for (const cab of CAB_IDS) {
    const dmSel = cabControl("doorModeSelect", cab);
    if (dmSel) dmSel.value = train.doorMode;
    const maxSel = cabControl("maxAuthModeSelect", cab);
    if (maxSel) maxSel.value = train.maxAuthorizedDrivingMode;
  }
  showMsg("系统重置完成", "ok");
  tcmsLog("=== 系统重置 ===", "info");
  syncLeverHandlePos(train.lever);
  resetSupervisedLimitEditorUI();
  resetTrackViewport();
});

$("btnHelp")?.addEventListener("click", () => {
  const m = $("helpModal");
  if (m) m.hidden = false;
});
$("closeHelp")?.addEventListener("click", () => {
  const m = $("helpModal");
  if (m) m.hidden = true;
});

function init() {
  renderCabAuthority();
  for (const cab of CAB_IDS) {
    const dmSel = cabControl("doorModeSelect", cab);
    if (dmSel) dmSel.value = train.doorMode;
    const maxSel = cabControl("maxAuthModeSelect", cab);
    if (maxSel) maxSel.value = train.maxAuthorizedDrivingMode;
  }
  buildTrack();
  initTrackViewportControls();
  initSupervisedLimitEditor();
  syncLeverHandlePos(train.lever);
  showMsg("系统就绪 · RM 限制模式 · ZK=ON 时请建立方向手柄（前进 F）后牵引", "ok");
  tcmsLog("=== METRO-SIM 启动完成 ===", "ok");
  tcmsLog("CBTC 信号系统初始化", "info");
  tcmsLog("MB-TN TCMS 自检完成", "info");
  tcmsLog(`列车位于：${STATIONS[0].name}`, "info");
  tcmsLog(`下一站：${STATIONS[1].name}`, "info");
  $("mmi-vobc")?.addEventListener("load", () => {
    resetVobcDmiThrottle();
    postVobcDmi();
  });
  // Tc2 端车载 DMI：加载后触发首帧推送
  $("mmi-vobc2")?.addEventListener("load", () => postVobcDmi());
}

init();
