/** 北京地铁 19 号线运行查询层；原始数据只存在于 data/line19.js。 */
import {
  LINE_META,
  STATION_DATA,
  SPEED_ZONE_DATA,
  GRADIENT_ZONE_DATA,
  CURVE_ZONE_DATA,
  SIGNAL_DATA,
  BALISE_DATA,
} from "../data/line19.js";

export { LINE_META };
export const STATIONS = STATION_DATA;
export const SPEED_ZONES = SPEED_ZONE_DATA;
export const GRADIENT_ZONES = GRADIENT_ZONE_DATA;
export const CURVE_ZONES = CURVE_ZONE_DATA;
export const SIGNALS = SIGNAL_DATA;
export const BALISES = BALISE_DATA;
export const ROUTE_LEN = LINE_META.operatingLengthM;

function zoneAt(zones, p) {
  return zones.find((zone) => p >= zone.start && p < zone.end) ?? zones.at(-1);
}

export function getRouteConditions(positionM) {
  const p = Math.max(0, Math.min(ROUTE_LEN, positionM));
  const speed = zoneAt(SPEED_ZONES, p);
  const gradient = zoneAt(GRADIENT_ZONES, p);
  const curve = zoneAt(CURVE_ZONES, p);
  return {
    positionM: p,
    runKmh: speed.runKmh,
    operatingMaxSpeedKmh: LINE_META.operatingMaxSpeedKmh,
    gradientPermille: gradient.gradientPermille,
    curveRadiusM: curve.radiusM,
    confidence: {
      speed: speed.confidence,
      gradient: gradient.confidence,
      curve: curve.confidence,
    },
  };
}

export const TRACK_W = 1020;
export const TRACK_X0 = 40;

export function posToX(p) {
  return TRACK_X0 + (p / ROUTE_LEN) * TRACK_W;
}
