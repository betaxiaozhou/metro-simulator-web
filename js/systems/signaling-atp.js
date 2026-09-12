/**
 * 信号 / ATP 层：区段限速、速度监督曲线、目标距离等。
 * 不直接积分列车运动；对外提供速度监督与目标信息供 ATO、DMI、仿真器使用。
 *
 * 速度监督链（最高限制速度为绝对上限，其余均在其下）：
 *   列车最高运行速度（getZoneLimit，ATO 巡航目标）
 *     < … ATP / ATO / 推荐 / EB 触发等（均钳制在最高限制速度以下）
 *     ≤ 列车运行最高限制速度（zoneSupervisedKmh：绝对上限，超过即紧急制动）
 */
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { clamp, ms2kmh, kmh2ms } from "../lib/math.js";
import { LINE_META, STATIONS, ROUTE_LEN, getRouteConditions } from "./route-model.js?v=line19-realism-2";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import { effectiveBrakeDecel } from "./vehicle-dynamics.js?v=line19-realism-2";
import {
  getSupervisedKmh,
  lineMaxSupervisedKmh,
  capBelowSupervised,
} from "./supervised-limits.js?v=line19-realism-2";

/** 区段「列车最高运行速度」（线路速度等级，ATO 以此巡航） */
export function getZoneLimit(p) {
  return Math.min(getRouteConditions(p).runKmh, LINE_META.operatingMaxSpeedKmh);
}

/** 区段「列车运行最高限制速度」：绝对上限（可编辑，超过即严重超速） */
export function zoneSupervisedKmh(p) {
  return getSupervisedKmh(p);
}

/**
 * 触发速度求解：距目标点 d 处须降至 vt 时，当前允许的最大速度 v。
 * 计入响应延时 tResp 内的匀速走行（导则图 4-2 ①②③ 过程）：
 *   v·tResp + (v² − vt²)/(2a) = d  →  v = −a·t + √(a²t² + vt² + 2ad)
 */
function triggerSpeedKmh(vtKmh, d, decel, tResp) {
  const vt = kmh2ms(Math.max(0, vtKmh));
  const at = decel * tResp;
  const v = -at + Math.sqrt(at * at + vt * vt + 2 * decel * Math.max(0, d));
  return ms2kmh(Math.max(0, v));
}

/** 通用监督曲线：当前监督限速与前方所有降速点/停车点制动曲线取最小 */
function supervisionCurveKmh(p, { includeStation, decel, tResp, stopMargin }) {
  p = clamp(p, 0, ROUTE_LEN);
  let lim = zoneSupervisedKmh(p);
  for (let look = 3; look <= 900; look += 3) {
    const pp = p + look;
    if (pp > ROUTE_LEN) break;
    const z = zoneSupervisedKmh(pp);
    if (z < lim) lim = Math.min(lim, triggerSpeedKmh(z, look, decel, tResp));
  }
  const ns = STATIONS[train.nextStationIdx];
  if (includeStation && ns && !train.skipStation) {
    /** 防护终点（危险点）位于停车标后方 stopMargin 处：曲线在「标 + 裕量」处归零，
     *  停车标本身留有低速对标空间（过标 >1 m 另由过标监督触发 EB） */
    const d = ns.pos + stopMargin - p;
    if (d > 0 && ns.pos - p <= 700) lim = Math.min(lim, triggerSpeedKmh(0, d, decel, tResp));
  }
  return Math.min(lim, zoneSupervisedKmh(p));
}

export function modeMaxKmh() {
  if (train.mode === "RM") return CONST.RM_LIMIT;
  return Math.min(LINE_META.operatingMaxSpeedKmh, lineMaxSupervisedKmh());
}

/** ATP 系统限制速度（导则 §2.9）：以最大常用制动率向前方目标回算的允许速度 */
export function calcATPLimit(p, includeStation = true) {
  if (p === undefined) p = train.pos;
  p = clamp(p, 0, ROUTE_LEN);
  const path = supervisionCurveKmh(p, {
    includeStation,
    decel: effectiveBrakeDecel(CONST.MAX_SERVICE_BRK, train.passengerLoadRatio),
    tResp: 0,
    stopMargin: CONST.ATP_STOP_MARGIN_M,
  });
  return capBelowSupervised(p, Math.min(modeMaxKmh(), path));
}

/** ATP 最大常用制动触发速度：钳制在绝对上限以下 */
export function calcFsbTriggerKmh(p) {
  return capBelowSupervised(
    p,
    calcATPLimit(p) + CONST.ATP_FSB_TRIGGER_MARGIN,
  );
}

/**
 * ATP 紧急制动触发曲线基线（导则 §2.10/§4.7）。
 * 实际触发阈值 = 本值 + ATP_OVERSPEED_MARGIN（测速误差等最不利因素，由调用方叠加，
 * 与 DMI EBI 指示一致）。曲线采用保证紧急制动率并计入 ATP/车辆响应延时走行距离。
 */
export function calcEBILimit(p) {
  /** 任一侧车门开启：紧急制动干预限速视为 0 km/h（与 DMI EBI 指示一致） */
  if (!train.doorClosed) return 0;
  if (p === undefined) p = train.pos;
  p = clamp(p, 0, ROUTE_LEN);
  const path = supervisionCurveKmh(p, {
    includeStation: false,
    decel: effectiveBrakeDecel(CONST.ATP_GUARANTEED_EB_DECEL, train.passengerLoadRatio),
    tResp: CONST.ATP_RESPONSE_TIME_S,
    stopMargin: CONST.ATP_EB_STOP_MARGIN_M,
  });
  return capBelowSupervised(p, Math.min(modeMaxKmh(), path));
}

/** 下一限制性目标（停车点或低速区段）的距离与目标速度，供 DMI 与发车条件判断 */
export function calcTargetInfo() {
  const p = train.pos;
  let dist = 9999;
  let target = LINE_META.operatingMaxSpeedKmh;
  const nextStn = STATIONS[train.nextStationIdx];
  if (nextStn && !train.skipStation) {
    const d = nextStn.pos - p;
    if (d > 0 && d < dist) {
      dist = d;
      target = 0;
    }
  }
  const cur = getZoneLimit(p);
  for (let look = 1; look < 1500; look++) {
    const z = getZoneLimit(p + look);
    if (z < cur) {
      if (look < dist) {
        dist = look;
        target = z;
      }
      break;
    }
  }
  return { dist, target };
}
