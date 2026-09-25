/**
 * 列车纵向动力学：加速度由 ATP 监督、ATO 牵引/制动或司机手柄后经车体响应滤波，再扣除阻力后对速度、位置数值积分。
 * 速度带符号（前进为正、后退为负）；「后退 R」为人工限速工况，ATO 仍要求「前进 F」
 * （跳跃对标的向后调整为 ATO 自动作业，规范允许，不属于退行）。
 *
 * ATP 速度监督（导则 §4.3）分两级干预：
 *   超过最大常用制动触发速度 → 施加最大常用制动直至回到限制速度以下；
 *   超过列车运行最高限制速度（绝对上限）→ 紧急制动；
 *   超过紧急制动触发速度（EBI + 裕量）→ 紧急制动，停稳前不得缓解。
 */
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { ms2kmh, clamp } from "../lib/math.js";
import { STATIONS, ROUTE_LEN, getRouteConditions } from "./route-model.js?v=line19-realism-2";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import {
  curveResistanceAcceleration,
  effectiveBrakeDecel,
  gradientAcceleration,
  maxTractionAcceleration,
} from "./vehicle-dynamics.js?v=line19-realism-2";
import { calcATPLimit, calcEBILimit, calcFsbTriggerKmh, zoneSupervisedKmh } from "./signaling-atp.js?v=line19-realism-2";
import { atoControl, resetAtoAlignState } from "./ato-controller.js?v=line19-realism-2";
import { handleStation, tryReleaseDoorAllowAligned } from "./station-service.js?v=line19-realism-2";
import { disengageAto, tryAutoStartAtoAa } from "./ato-readiness.js?v=line19-realism-2";
import { clearDoorAtpAllows } from "./doors.js?v=line19-realism-2";
import { triggerEB } from "./emergency-brake.js?v=line19-realism-2";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { beep, stopAlarm } from "../audio/sfx-core.js";
import { announceArrival, announceDeparture } from "../audio/pa-announcer.js";
import { updateMotorCurrentModel } from "./traction-electrical.js?v=line19-realism-2";

function fmtStopErr(trainPos, markPos) {
  const m = trainPos - markPos;
  const a = Math.abs(m);
  if (a < 1.5) return `${(m * 100).toFixed(1)} cm`;
  return `${m.toFixed(2)} m`;
}

function brakingAgainstMotion(mag) {
  const effective = effectiveBrakeDecel(mag, train.passengerLoadRatio);
  if (train.vel > 0.02) return -effective;
  if (train.vel < -0.02) return effective;
  return 0;
}

/** 零速仍保持的制动需求 (m/s²)，不受 brakingAgainstMotion 方向死区影响 */
function heldBrakeDemandMag(autoModes) {
  if (train.ebActive) return CONST.EB_BRAKE;
  if (train.atpSbActive) return CONST.MAX_SERVICE_BRK;
  if (train.atoRunning && autoModes) return CONST.HOLD_BRAKE_FRACTION * CONST.MAX_SERVICE_BRK;
  if (train.lever <= -1.05) return CONST.EB_BRAKE;
  if (train.lever < 0) return Math.abs(train.lever) * CONST.MAX_SERVICE_BRK;
  return 0;
}

function bkPctFromDecel(mag) {
  return Math.min(100, Math.round((mag / CONST.MAX_SERVICE_BRK) * 100));
}

/** FAM 进站过标监督（建设指南 §3.3.7）：过标 >1 m 自动紧急制动；停稳后 ≤5 m 自动缓解并向后跳跃对标 */
function superviseStationOverrun(autoModes) {
  const ns = STATIONS[train.nextStationIdx];

  if (
    autoModes &&
    train.atoRunning &&
    ns &&
    !train.dwelling &&
    !train.skipStation &&
    !train.ebActive
  ) {
    const err = train.pos - ns.pos;
    if (err > CONST.ATO_OVERRUN_EB_M && train.vel > 0.1) {
      train.atoOverrunPending = true;
      triggerEB(
        `FAM 进站过标 ${err.toFixed(2)} m（>${CONST.ATO_OVERRUN_EB_M.toFixed(0)} m），自动施加紧急制动`,
      );
    }
  }

  if (train.atoOverrunPending && train.ebActive && Math.abs(train.vel) < 0.05) {
    train.atoOverrunPending = false;
    const err = ns ? train.pos - ns.pos : Infinity;
    if (ns && err <= CONST.ATO_JOG_MAX_ERR_M) {
      train.ebActive = false;
      train.ebReason = "";
      stopAlarm();
      train.atoReady = true;
      train.atoRunning = true;
      resetAtoAlignState();
      showMsg(
        `过标 ${err.toFixed(2)} m ≤ ${CONST.ATO_JOG_MAX_ERR_M} m：紧急制动自动缓解，向后跳跃方式调整对标`,
        "ok",
      );
      tcmsLog("过标 EB 自动缓解 → 向后跳跃对标", "info");
    } else {
      showMsg(
        `过标 ${err.toFixed(1)} m 超过 ${CONST.ATO_JOG_MAX_ERR_M} m：紧急制动不可缓解，不允许退行，已报警等待人工处置`,
        "alarm",
      );
      tcmsLog("过标超限：EB 保持，ATS 报警，通知人工上车处置", "err");
    }
  }
}

export function physicsTick(dt) {
  if (!train.keyOn) {
    train.motorCurrentA = 0;
    return;
  }

  const atpLimit = calcATPLimit();
  const ebiLimit = calcEBILimit();
  const supervisedMax = zoneSupervisedKmh(train.pos);
  const autoModes = train.mode === "AM" || train.mode === "FAM";

  superviseStationOverrun(autoModes);

  /** ATP 速度监督：
   *  RM：固定限速 EB；
   *  CM：仅 EBI 曲线 EB（司机自行控速，ATP 只在超 EBI 时触发紧急制动，导则 §4.3）；
   *  AM/FAM：ATO 主动在 FSB 阈值以下控速，ATP 仍以 EBI 兜底 EB。
   */
  const vKmh = ms2kmh(Math.abs(train.vel));
  if (train.atpActive) {
    const ebTrigger = ebiLimit + CONST.ATP_OVERSPEED_MARGIN;
    const fsbTrigger = calcFsbTriggerKmh(train.pos);
    const doorOpenMoving = !train.doorClosed && Math.abs(train.vel) > 0.08;
    if (doorOpenMoving) {
      triggerEB(`车门开启 · EBI 限速 0 km/h · 当前 ${vKmh.toFixed(1)} km/h`);
    } else if (train.doorClosed && vKmh > supervisedMax) {
      triggerEB(
        `超过列车运行最高限制速度 ${vKmh.toFixed(0)} > ${supervisedMax} km/h（绝对上限）`,
      );
    } else if (train.doorClosed && vKmh > ebTrigger) {
      triggerEB(
        `超速触发紧急制动 ${vKmh.toFixed(0)} > ${ebTrigger.toFixed(0)} km/h（EB 触发速度）`,
      );
    } else if (train.doorClosed && vKmh > fsbTrigger && !train.atpSbActive && !train.ebActive && (train.mode === "AM" || train.mode === "FAM")) {
      train.atpSbActive = true;
      showMsg(
        `ATP 超速干预：${vKmh.toFixed(0)} > ${fsbTrigger.toFixed(0)} km/h，施加最大常用制动`,
        "alarm",
      );
      tcmsLog(`ATP 最大常用制动触发（${vKmh.toFixed(0)} km/h）`, "err");
    }
    if (train.atpSbActive && vKmh <= atpLimit - 1.0) {
      train.atpSbActive = false;
      tcmsLog("ATP 常用制动干预解除（已回到限制速度以下）", "ok");
    }
  } else {
    train.atpSbActive = false;
  }

  let cmdAccRaw = 0;
  let commandKind = "coast";
  if (train.ebActive) {
    cmdAccRaw = brakingAgainstMotion(CONST.EB_BRAKE);
    commandKind = "brake";
  } else if (train.atoRunning && autoModes) {
    cmdAccRaw = atoControl(atpLimit, ebiLimit);
    if (cmdAccRaw > 1e-6) commandKind = "traction";
    else if (cmdAccRaw < -1e-6) commandKind = "brake";
  } else {
    if (train.lever > 0) {
      if (train.direction === "F") {
        cmdAccRaw = train.lever * CONST.MAX_TRACTION_ACC;
        commandKind = "traction";
      } else if (train.direction === "R") {
        cmdAccRaw = -train.lever * CONST.MAX_TRACTION_ACC;
        commandKind = "traction";
      }
    } else if (train.lever <= -1.05) {
      cmdAccRaw = brakingAgainstMotion(CONST.EB_BRAKE);
      commandKind = "brake";
    } else if (train.lever < 0) {
      cmdAccRaw = brakingAgainstMotion(Math.abs(train.lever) * CONST.MAX_SERVICE_BRK);
      commandKind = "brake";
    }
  }

  /** ATP 最大常用制动干预：覆盖 ATO/人工指令 */
  if (train.atpSbActive && !train.ebActive) {
    cmdAccRaw = brakingAgainstMotion(CONST.MAX_SERVICE_BRK);
    commandKind = "brake";
  }

  if (train.direction === "N" && commandKind === "traction") {
    cmdAccRaw = 0;
    commandKind = "coast";
  }
  if (!train.doorClosed && train.lever > 0) {
    cmdAccRaw = 0;
    commandKind = "coast";
  }

  if (commandKind === "traction") {
    const cap = maxTractionAcceleration(vKmh, train.passengerLoadRatio);
    cmdAccRaw = Math.sign(cmdAccRaw) * Math.min(Math.abs(cmdAccRaw), cap);
  }

  let cmdAcc;
  /** 牵引/制动指令经车体响应滤波；站停 dwelling 内同步滞后状态，避免进站大制动惯性把车速「夹」过零造成倒车 */
  if (train.ebActive) {
    cmdAcc = cmdAccRaw;
    train._cmdAccLag = cmdAccRaw;
  } else if (train.dwelling) {
    cmdAcc = cmdAccRaw;
    train._cmdAccLag = cmdAccRaw;
  } else {
    /** 加速度正负表示线路方向，不能据此判断牵引或制动；R 位牵引本来就是负加速度。 */
    const deepenBrk = commandKind === "brake" && (
      cmdAccRaw * train._cmdAccLag <= 0 ||
      Math.abs(cmdAccRaw) > Math.abs(train._cmdAccLag) + 1e-6
    );
    let tau = deepenBrk ? CONST.CMD_ACC_TAU * 0.38 : CONST.CMD_ACC_TAU;
    /** ATO 进站加深制动：加快追随指令，减小「曲线已到而车体制动尚未建起」导致的冲标 */
    if (train.atoRunning && autoModes && deepenBrk) {
      const apStn = STATIONS[train.nextStationIdx];
      if (apStn && !train.dwelling) {
        const dMark = apStn.pos - train.pos;
        if (dMark > 0 && dMark < CONST.ATO_APPROACH_DIST_M) tau *= 0.62;
      }
    }
    const alpha = 1 - Math.exp(-dt / tau);
    train._cmdAccLag += (cmdAccRaw - train._cmdAccLag) * alpha;
    cmdAcc = train._cmdAccLag;
  }

  const v = train.vel;
  const conditions = getRouteConditions(train.pos);
  const dragMag = 0.005 * 9.8 + 0.0005 * v * v;
  let acc = cmdAcc;
  if (Math.abs(v) > 0.05) acc -= Math.sign(v) * dragMag;
  acc += gradientAcceleration(conditions.gradientPermille);
  acc += curveResistanceAcceleration(conditions.curveRadiusM, v);

  train.vel += acc * dt;

  train.pos += train.vel * dt;

  train.pos = clamp(train.pos, 0, ROUTE_LEN);
  if (train.pos <= 0 && train.vel < 0) train.vel = 0;
  if (train.pos >= ROUTE_LEN && train.vel > 0) train.vel = 0;

  /** 站台停稳：消除近零残余速度，避免乘降阶段肉眼可见蠕动 */
  if (train.dwelling && Math.abs(train.vel) < 0.028) train.vel = 0;

  if (train.direction === "N" && Math.abs(train.vel) < 0.02) train.vel = 0;

  /**
   * 人工制动停稳夹零：手柄在制动区（lever<0）且速度进入零点死区时，立即夹零并清除滤波器余量。
   * 防止 _cmdAccLag 在 brakingAgainstMotion 死区翻转时越过零点产生虚假正向加速度（幻象牵引）。
   * EB/ATO 制动路径不经过滞后滤波器，不受此影响。
   */
  if (!train.ebActive && !train.atoRunning && train.lever < 0 && Math.abs(train.vel) < 0.02) {
    train.vel = 0;
    train._cmdAccLag = 0;
  }

  const atoDriving = train.atoRunning && autoModes;
  const atZero = Math.abs(train.vel) < 0.072;
  /** 牵引/制动百分比：按指令性质显示；加速度符号只代表 F/R 线路方向。 */
  train.trPct = 0;
  train.bkPct = 0;
  if (train.ebActive) {
    train.bkPct = Math.max(100, bkPctFromDecel(Math.abs(cmdAcc)));
  } else if (commandKind === "traction" && Math.abs(cmdAcc) > 1e-6) {
    train.trPct = Math.min(100, Math.round((Math.abs(cmdAcc) / CONST.MAX_TRACTION_ACC) * 100));
  } else if (commandKind === "brake" && Math.abs(cmdAcc) > 1e-6) {
    train.bkPct = bkPctFromDecel(Math.abs(cmdAcc));
  } else if (atZero) {
    const holdMag = heldBrakeDemandMag(autoModes);
    if (holdMag > 0) train.bkPct = bkPctFromDecel(holdMag);
  }

  updateMotorCurrentModel(dt, cmdAcc, commandKind);

  const bcTarget = train.bkPct * 4;
  train.bcPress += (bcTarget - train.bcPress) * 0.15;

  if (train.bkPct > 0) train.mrPress = Math.max(700, train.mrPress - 0.3 * dt);
  else train.mrPress = Math.min(900, train.mrPress + 1.5 * dt);

  handleStation();

  train.zeroSpeed = Math.abs(train.vel) < 0.072;

  /** 须在 handleStation 之后取站：否则 idx 已 ++ 仍用旧站判断进站会重复触发 dwelling，对标指向下一站轨旁标 */
  const nextStn = STATIONS[train.nextStationIdx] ?? null;
  /**
   * 到站判定窗：ATO 运行时按停车窗（窗外由跳跃对标继续调整），
   * 人工驾驶按较宽到站窗（窗内即视为到站，停准与否另由门允许判定）。
   */
  const arrivalWin = atoDriving ? CONST.STOP_TOLERANCE : CONST.ATO_ARRIVAL_WINDOW_M;
  const arrivalSlow = Math.abs(train.vel) < 0.12;
  if (
    nextStn &&
    !train.dwelling &&
    !train.skipStation &&
    Math.abs(nextStn.pos - train.pos) <= arrivalWin &&
    arrivalSlow
  ) {
    clearDoorAtpAllows();
    train.dwelling = true;
    train.dwellTimer = 0;
    train.autoDoorReleased = false;
    train.dwellHadDoorOpenDuringStop = false;
    train.departSuggestEpochMs = Date.now();
    train.departSuggestAnchorIdx = train.nextStationIdx;
    resetAtoAlignState();
    const errDisp = fmtStopErr(train.pos, nextStn.pos);
    if (autoModes && (train.doorMode === "MM" || train.doorMode === "AM")) {
      disengageAto();
      tcmsLog("进站：M/M、A/M — ATO 已退出，乘降完毕且「允许启动」亮灯后可按 ATO 发车", "info");
    }
    showMsg(`到达 ${nextStn.name}（停车误差 ${errDisp}）`, "ok");
    tcmsLog(`抵达 ${nextStn.name}, 停车误差 ${errDisp}`, "ok");
    if (autoModes && Math.abs(nextStn.pos - train.pos) > CONST.STOP_TOLERANCE) {
      showMsg(
        `对标未满足（停车窗 ±${(CONST.STOP_TOLERANCE * 100).toFixed(0)} cm），停稳后对准停车标`,
        "alarm",
      );
      tcmsLog(`待对标停准（当前 |Δ|=${fmtStopErr(train.pos, nextStn.pos)}）`, "alarm");
    }
    beep(660, 0.15);
    setTimeout(() => beep(880, 0.2), 180);
  }

  tryReleaseDoorAllowAligned(nextStn);

  /** 越站（含跳停）：越过停车标一定距离后切换下一站目标 */
  if (nextStn && !train.dwelling && train.pos > nextStn.pos + 30 && train.doorClosed) {
    const skipped = train.skipStation;
    if (skipped) tcmsLog(`跳停通过 ${nextStn.name}`, "info");
    train.nextStationIdx++;
    clearDoorAtpAllows();
    resetAtoAlignState();
    if (train.nextStationIdx < STATIONS.length)
      tcmsLog(`下一站 ${STATIONS[train.nextStationIdx].name}`, "info");
    else tcmsLog("已抵达终点站", "ok");
  }

  /**
   * 客室报站广播（位置驱动）：
   *   2 号（到站预告）：距下一站停车标前 200 m 触发一次；
   *   1 号（离站）：越过刚离开车站停车标后 40 m 触发一次（非跳停）。
   * 区间号 = nextStationIdx（2 号指向即将到达的站；1 号指向离开站 +1 的区间）。
   * 注意：用 STATIONS[train.nextStationIdx] 实时取站，不使用上方可能因越站块 ++ 而过期的 nextStn。
   */
  const paTarget = STATIONS[train.nextStationIdx] ?? null;
  if (
    paTarget &&
    train.nextStationIdx >= 1 &&
    train.paArrivalPlayedForIdx !== train.nextStationIdx &&
    train.pos >= paTarget.pos - 200
  ) {
    train.paArrivalPlayedForIdx = train.nextStationIdx;
    announceArrival(train.nextStationIdx);
  }
  if (
    train.nextStationIdx >= 1 &&
    train.paDeparturePlayedForIdx !== train.nextStationIdx &&
    !train.skipStation
  ) {
    const leftStn = STATIONS[train.nextStationIdx - 1];
    if (leftStn && train.pos >= leftStn.pos + 40) {
      train.paDeparturePlayedForIdx = train.nextStationIdx;
      announceDeparture(train.nextStationIdx);
    }
  }

  if (train.departSuggestAnchorIdx >= 0) {
    const ap = STATIONS[train.departSuggestAnchorIdx]?.pos;
    if (ap !== undefined && train.pos > ap + CONST.DEPART_SUGGEST_CLEAR_PAST_STATION_M) {
      train.departSuggestAnchorIdx = -1;
      train.departSuggestEpochMs = 0;
    }
  }

  tryAutoStartAtoAa();
}
