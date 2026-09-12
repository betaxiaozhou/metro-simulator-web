/**
 * ATO 列车自动运行（导则 §2.12~2.13、§4.4~4.6；建设指南 §3.3.7；运营规范 §4.1.10）。
 *
 * 仅输出纵向牵引/制动加速度（经 CMD_ACC_TAU 与车体共同积分）。控制结构：
 *   1. 站停 dwelling：双向抱闸保持；
 *   2. 跳跃对标（欠标/过标 ≤5 m）：以 ≤5 km/h 自动调整对标，最多 3 次，超次保持制动并报警；
 *   3. 区间运行：按 ATO 运行速度剖面（区段列车最高运行速度 + 前方降速/进站制动曲线）
 *      分「牵引加速 → 巡航（±2 km/h 波动带内惰行）→ 惰行 → 制动」工况控车，
 *      并以冲击率（jerk）限制平滑指令；
 *   4. 防护兜底：ATP 限制速度贴近时收牵引转制动，触及 EB 触发阈值前施加最大常用制动。
 */
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { clamp, ms2kmh, kmh2ms } from "../lib/math.js";
import { STATIONS } from "./route-model.js?v=line19-realism-2";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import { getZoneLimit } from "./signaling-atp.js?v=line19-realism-2";
import { capBelowSupervised } from "./supervised-limits.js?v=line19-realism-2";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { effectiveBrakeDecel } from "./vehicle-dynamics.js?v=line19-realism-2";

const JOG_V_MS = kmh2ms(CONST.ATO_JOG_SPEED_KMH);

function nextStation() {
  return STATIONS[train.nextStationIdx] ?? null;
}

/** 站停/对标保持：双向抱闸（与 EB 工况同类），禁止速度过零后变成反向牵引 */
function holdBrakeAcc() {
  const mag = CONST.HOLD_BRAKE_FRACTION * CONST.MAX_SERVICE_BRK;
  if (train.vel > 0.02) return -mag;
  if (train.vel < -0.02) return mag;
  return 0;
}

export function resetAtoAlignState() {
  train.atoJogAttempts = 0;
  train.atoJogActive = false;
  train.atoJogExhausted = false;
  train._atoAccPrev = 0;
}

/**
 * ATO 运行速度剖面（km/h）：
 * min(本区段列车最高运行速度, 前方低速区段按 ATO 制动率回算曲线, 进站停车制动曲线)。
 * 巡航目标取列车最高运行速度（导则 §3.2-2/§4.6），低于 ATP 限制速度（监督值 +5/+7）。
 */
export function computeAtoProfileKmh(p) {
  const a = effectiveBrakeDecel(CONST.ATO_SERVICE_DECEL, train.passengerLoadRatio);
  let v = getZoneLimit(p) * CONST.ATO_SCHEDULE_SPEED_FACTOR;
  for (let look = 5; look <= 700; look += 5) {
    const z = getZoneLimit(p + look) * CONST.ATO_SCHEDULE_SPEED_FACTOR;
    if (z < v) {
      const vt = kmh2ms(z);
      v = Math.min(v, ms2kmh(Math.sqrt(vt * vt + 2 * a * look)));
    }
  }
  const ns = nextStation();
  if (ns && !train.skipStation) {
    const dMark = ns.pos - p;
    if (dMark <= CONST.ATO_BLEND_STATION_M) {
      const dEff = Math.max(0, dMark - CONST.ATO_STOP_MARGIN_M);
      v = Math.min(v, ms2kmh(Math.sqrt(2 * a * dEff)));
    }
  }
  return capBelowSupervised(p, v);
}

/** DMI 推荐速度：ATO 剖面，且不超过 ATP 限制速度 */
export function computeAtoRecommendedKmh(atpLimit) {
  return Math.max(0, Math.min(computeAtoProfileKmh(train.pos), atpLimit - 0.5));
}

/** 跳跃对标控制：按剩余偏差包络限速（≤5 km/h），低速贴近停车标 */
function jogAcc(err, v) {
  const dir = err < 0 ? 1 : -1;
  const dRemain = Math.max(0, Math.abs(err) - 0.05);
  /** 保守包络（0.22 m/s² 等效减速率）+ 强跟踪增益，避免动量冲过停车标 */
  const vEnv = Math.min(JOG_V_MS, Math.sqrt(2 * 0.22 * dRemain) + 0.04);
  const vDes = dir * vEnv;
  return clamp(2.0 * (vDes - v), -0.85, 0.55);
}

/**
 * 跳跃对标管理（建设指南 §3.3.7、运营规范 §4.1.10）：
 * 列车停于停车窗外且 |偏差| ≤ 5 m 时，以 ≤5 km/h 向前/向后跳跃调整；
 * 超过允许次数（3 次）自动施加制动并报警，等待人工处置。
 * 返回 null 表示当前不处于对标调整工况。
 */
function alignmentAcc() {
  const ns = nextStation();
  if (!ns || train.skipStation) return null;

  if (train.atoJogExhausted) return holdBrakeAcc();

  const err = train.pos - ns.pos; /** >0 过标，<0 欠标 */
  const absErr = Math.abs(err);
  const v = train.vel;

  if (train.atoJogActive) {
    if (
      (absErr <= 0.12 && Math.abs(v) <= 0.4) ||
      (Math.abs(v) < 0.04 && absErr <= CONST.STOP_TOLERANCE)
    ) {
      train.atoJogActive = false;
      return holdBrakeAcc();
    }
    return jogAcc(err, v);
  }

  const stopped = Math.abs(v) < 0.12;
  const outsideWindow = absErr > CONST.STOP_TOLERANCE;
  const inJogRange = absErr <= CONST.ATO_JOG_MAX_ERR_M;
  if (!(stopped && outsideWindow && inJogRange)) return null;

  if (train.atoJogAttempts >= CONST.ATO_JOG_MAX_ATTEMPTS) {
    train.atoJogExhausted = true;
    showMsg(
      `对标调整已达 ${CONST.ATO_JOG_MAX_ATTEMPTS} 次仍未停准，ATO 施加制动并报警，等待人工处置`,
      "alarm",
    );
    tcmsLog("跳跃对标超次：保持制动，ATS 报警", "err");
    return holdBrakeAcc();
  }

  train.atoJogAttempts++;
  train.atoJogActive = true;
  /** 跳跃从静止起步：清除残留的制动指令记忆，防止冲击率爬升期间向反方向溜车 */
  train._atoAccPrev = Math.max(train._atoAccPrev ?? 0, 0);
  train._cmdAccLag = Math.max(train._cmdAccLag ?? 0, 0);
  const dirZh = err < 0 ? "前" : "后";
  showMsg(
    `对标偏差 ${(err * 100).toFixed(0)} cm，跳跃模式向${dirZh}调整（第 ${train.atoJogAttempts} 次，≤${CONST.ATO_JOG_SPEED_KMH} km/h）`,
    "alarm",
  );
  tcmsLog(`跳跃对标：向${dirZh} ${absErr.toFixed(2)} m（第 ${train.atoJogAttempts} 次）`, "info");
  return jogAcc(err, v);
}

/** 指令收尾：牵引方向冲击率限制（制动加深不限），记录上一帧指令 */
function finalize(acc) {
  acc = clamp(acc, -CONST.MAX_SERVICE_BRK, CONST.MAX_TRACTION_ACC);
  const prev = train._atoAccPrev ?? 0;
  /** 低速对标/跳跃工况放宽冲击率：避免「制动→牵引」转换迟滞造成溜车、突破跳跃限速 */
  const rate =
    Math.abs(train.vel) < 1.6 ? CONST.ATO_JERK_LIMIT * 4 : CONST.ATO_JERK_LIMIT;
  const dMax = rate * CONST.G_DT;
  if (acc > prev) acc = Math.min(acc, prev + dMax);
  train._atoAccPrev = acc;
  return acc;
}

export function atoControl(atpLimit, ebiLimit) {
  const ns = nextStation();

  /** 站停乘降：抱闸保持，并复位本站对标计数 */
  if (train.dwelling) {
    resetAtoAlignState();
    return finalize(holdBrakeAcc());
  }

  /** 对标调整工况（停车窗外低速/静止） */
  const alignAcc = alignmentAcc();
  if (alignAcc !== null) return finalize(alignAcc);

  const v = train.vel;
  const vKmh = ms2kmh(Math.abs(v));
  const dMark = ns ? ns.pos - train.pos : Infinity;

  /** 轻微过标（≤1 m，>1 m 由 ATP 触发紧急制动）仍在移动：逆运动方向最大常用制动停车，随后跳跃对标 */
  if (ns && !train.skipStation && dMark < 0 && Math.abs(v) > 0.05) {
    return finalize(v > 0 ? -CONST.MAX_SERVICE_BRK : CONST.MAX_SERVICE_BRK);
  }

  /** 末端精确对标段：低速贴近停车标蠕动至停车窗内（一次到位，减少跳跃调整概率） */
  if (ns && !train.skipStation && dMark > 0 && dMark <= 2.2 && Math.abs(v) <= 1.05) {
    const dRemain = Math.max(0, dMark - 0.05);
    const vDes = Math.min(0.8, Math.sqrt(2 * 0.35 * dRemain) + 0.04);
    return finalize(clamp(1.5 * (vDes - v), -0.6, 0.35));
  }

  const vTgtKmh = Math.min(computeAtoProfileKmh(train.pos), Math.max(0, atpLimit - 0.5));
  const vT = kmh2ms(vTgtKmh);
  const e = vT - v;

  /** 进站/降速制动管理段：剖面已明显低于区段巡航速度 */
  const cruiseKmh = getZoneLimit(train.pos);
  const inBraking =
    vTgtKmh < cruiseKmh - 1 &&
    ((ns && !train.skipStation && dMark > 0 && dMark < CONST.ATO_BLEND_STATION_M) ||
      vTgtKmh < cruiseKmh - 3);

  let acc;
  if (inBraking) {
    if (e >= 0.15) {
      /** 低于曲线较多（如跳跃后再启动）：缓和牵引贴近曲线 */
      acc = clamp(0.3 * e, 0, 0.35 * CONST.MAX_TRACTION_ACC);
    } else {
      /** 沿曲线制动：理想制动率前馈 + 比例修正 */
      acc = -effectiveBrakeDecel(CONST.ATO_SERVICE_DECEL, train.passengerLoadRatio)
        + clamp(1.1 * e, -0.35, 0.3);
    }
  } else {
    /** 巡航管理：波动带内惰行（导则 §4.5 巡航波动 ±2 km/h，上限收紧防触监督曲线） */
    const bandLo = kmh2ms(CONST.ATO_CRUISE_DEADBAND_KMH);
    const bandHi = kmh2ms(0.5);
    if (e > bandLo) acc = clamp(0.3 * (e - bandLo) + 0.12, 0, 0.85 * CONST.MAX_TRACTION_ACC);
    else if (e < -bandHi) acc = clamp(0.6 * (e + bandHi), -0.6 * CONST.MAX_SERVICE_BRK, 0);
    else acc = 0;
  }

  /** 距离-动能兜底：剩余距离内须以不超过常用制动停尽（消化指令滤波滞后） */
  if (ns && !train.skipStation && dMark > 0 && v > 0.05) {
    const dEff = Math.max(0.3, dMark - 0.05);
    const need = (v * v) / (2 * dEff);
    const atoDecel = effectiveBrakeDecel(CONST.ATO_SERVICE_DECEL, train.passengerLoadRatio);
    const maxService = effectiveBrakeDecel(CONST.MAX_SERVICE_BRK, train.passengerLoadRatio);
    if (need > atoDecel * 1.06)
      acc = Math.min(acc, -Math.min(maxService, need * 1.15));
  }

  /** ATP 限制速度防触碰：贴近限制速度即收牵引转制动 */
  if (vKmh > atpLimit - 1.0) acc = Math.min(acc, -0.5 * CONST.MAX_SERVICE_BRK);

  /** EB 触发阈值贴近：全常用制动规避紧急制动干预 */
  if (vKmh > ebiLimit + CONST.ATP_OVERSPEED_MARGIN - 1.5) acc = -CONST.MAX_SERVICE_BRK;

  return finalize(acc);
}
