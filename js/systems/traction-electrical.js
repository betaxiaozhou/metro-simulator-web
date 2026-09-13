/**
 * 牵引 / 再生电制动电流示意模型（并联逆变器等效）。
 * 常用制动以大份额电制动（负电流）为主；快速/紧急制动以空气制动为主，负电流仅占小份额；
 * 低速再生能力减弱，更符合城轨逆变器特性。
 */
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { clamp, ms2kmh } from "../lib/math.js";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import { regenerativeBrakeShare } from "./vehicle-dynamics.js?v=line19-realism-2";

function rapidBrakeDemand(brakeDemandMag) {
  const rapid =
    train.ebActive ||
    brakeDemandMag >= CONST.EB_BRAKE * 0.88 ||
    train.lever <= -1.03;
  return rapid;
}

/**
 * @param {number} dt 步长 (s)
 * @param {number} cmdAcc 本拍已滤波后的纵向需求加速度（m/s²）
 * @param {"traction"|"brake"|"coast"} commandKind 指令性质；加速度正负仅表示线路方向
 */
export function updateMotorCurrentModel(dt, cmdAcc, commandKind) {
  const iRef = CONST.MOTOR_I_REF_A;
  let target = 0;

  if (!train.keyOn) {
    target = 0;
  } else if (commandKind === "traction" && Math.abs(cmdAcc) > 0.018) {
    target = iRef * clamp(Math.abs(cmdAcc) / CONST.MAX_TRACTION_ACC, 0, 1);
  } else if (commandKind === "brake" && Math.abs(cmdAcc) > 0.018) {
    const bmag = Math.abs(cmdAcc);
    const vKmh = ms2kmh(Math.abs(train.vel));
    const share = regenerativeBrakeShare(vKmh, rapidBrakeDemand(bmag));
    const elecDecel = bmag * share;
    target = -iRef * clamp(elecDecel / CONST.MAX_TRACTION_ACC, 0, 1.05);
    target = clamp(target, -iRef * 1.05, iRef * 1.05);
  } else target = 0;

  const tau = CONST.MOTOR_CURRENT_TAU_S;
  const alpha = 1 - Math.exp(-dt / tau);
  train.motorCurrentA += (target - train.motorCurrentA) * alpha;

  if (Math.abs(train.motorCurrentA) < 4) train.motorCurrentA = 0;
}
