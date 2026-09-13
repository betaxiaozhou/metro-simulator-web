/** 8A 单轴纵向动力学的可测试纯函数。 */
import { CONST } from "../config/constants.js?v=line19-realism-2";

export function dynamicMassKg(loadRatio = CONST.DEFAULT_PASSENGER_LOAD_RATIO) {
  const load = Math.max(0, Math.min(1, loadRatio));
  return CONST.EMPTY_MASS_KG + CONST.MAX_PASSENGER_MASS_KG * load;
}

export function massPerformanceFactor(loadRatio = CONST.DEFAULT_PASSENGER_LOAD_RATIO) {
  const referenceMass = dynamicMassKg(CONST.DEFAULT_PASSENGER_LOAD_RATIO);
  return referenceMass / dynamicMassKg(loadRatio);
}

/** 0–40 km/h 恒加速度，随后按恒功率近似反比衰减，120 km/h 硬截止。 */
export function maxTractionAcceleration(vKmh, loadRatio) {
  const speed = Math.abs(vKmh);
  if (speed >= CONST.VEHICLE_DESIGN_SPEED_KMH) return 0;
  const speedFactor = speed <= CONST.TRACTION_CONSTANT_ACC_END_KMH
    ? 1
    : CONST.TRACTION_CONSTANT_ACC_END_KMH / speed;
  return CONST.MAX_TRACTION_ACC * speedFactor * massPerformanceFactor(loadRatio);
}

/** 载荷增大时制动距离略增；范围受限，避免破坏制动保证能力。 */
export function effectiveBrakeDecel(baseDecel, loadRatio) {
  return baseDecel * Math.max(0.86, Math.min(1.08, massPerformanceFactor(loadRatio)));
}

/** 正坡度表示沿里程增加方向上坡，返回沿里程方向的加速度。 */
export function gradientAcceleration(gradientPermille) {
  return -9.80665 * gradientPermille / 1000;
}

/** 经验曲线附加阻力：等效坡度约 600/R ‰，始终反向于运动。 */
export function curveResistanceAcceleration(radiusM, velocityMs) {
  if (!Number.isFinite(radiusM) || radiusM <= 0 || Math.abs(velocityMs) < 0.05) return 0;
  const magnitude = 9.80665 * (600 / radiusM) / 1000;
  return -Math.sign(velocityMs) * magnitude;
}

export function regenerativeBrakeShare(vKmh, rapid = false) {
  if (rapid) return CONST.ELEC_BRAKE_SHARE_RAPID;
  const speed = Math.abs(vKmh);
  if (speed <= 0) return 0;
  const lowFactor = Math.min(1, speed / CONST.REGEN_KNEE_KMH_LOW);
  const highFactor = speed <= CONST.REGEN_FADE_START_KMH
    ? 1
    : Math.max(0.25, 1 - (speed - CONST.REGEN_FADE_START_KMH) / 70);
  return CONST.ELEC_BRAKE_SHARE_SB * lowFactor * highFactor;
}
