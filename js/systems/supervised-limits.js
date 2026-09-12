/**
 * 各区段「列车运行最高限制速度」（绝对上限，可编辑）。
 * 超过此速度视为严重超速，ATP 将触发紧急制动；其余速度曲线均不得高于本值。
 */
import { clamp } from "../lib/math.js";
import { SPEED_ZONES, ROUTE_LEN } from "./route-model.js?v=line19-realism-2";
import { CONST } from "../config/constants.js?v=line19-realism-2";

function defaultSupervisedKmh(runKmh) {
  const allow =
    runKmh >= CONST.ZONE_ALLOW_SPLIT_KMH
      ? CONST.ZONE_OVERSPEED_ALLOW_HIGH
      : CONST.ZONE_OVERSPEED_ALLOW_LOW;
  return runKmh + allow;
}

function buildDefaults() {
  return SPEED_ZONES.map((zone) => ({
    start: zone.start,
    end: zone.end,
    runKmh: zone.runKmh,
    supervisedKmh: Math.min(CONST.OPERATING_MAX_SPEED_KMH, defaultSupervisedKmh(zone.runKmh)),
  }));
}

/** @type {{ start: number, end: number, runKmh: number, supervisedKmh: number }[]} */
let zones = buildDefaults();

export function getSupervisedZoneTable() {
  return zones;
}

export function getSupervisedKmh(p) {
  for (const z of zones) {
    if (p >= z.start && p < z.end) return z.supervisedKmh;
  }
  return zones.length ? zones[zones.length - 1].supervisedKmh : 87;
}

export function lineMaxSupervisedKmh() {
  let m = 0;
  for (const z of zones) m = Math.max(m, z.supervisedKmh);
  return m;
}

/** 将任意速度值钳制在绝对上限（最高限制速度）以下 */
export function capBelowSupervised(p, vKmh) {
  return Math.min(vKmh, getSupervisedKmh(p));
}

function clampBoundary(v) {
  return clamp(Math.round(v), 0, ROUTE_LEN);
}

export function setZoneStart(index, start) {
  if (index < 0 || index >= zones.length) return false;
  const z = zones[index];
  start = clampBoundary(start);
  if (start >= z.end) return false;
  z.start = start;
  return true;
}

export function setZoneEnd(index, end) {
  if (index < 0 || index >= zones.length) return false;
  const z = zones[index];
  end = clampBoundary(end);
  if (end <= z.start) return false;
  z.end = end;
  return true;
}

export function setSupervisedKmh(index, kmh) {
  if (index < 0 || index >= zones.length) return false;
  const z = zones[index];
  z.supervisedKmh = clamp(Math.round(kmh), z.runKmh, CONST.OPERATING_MAX_SPEED_KMH);
  return true;
}

/**
 * 批量应用区段编辑（起点、终点、最高限制速度）。
 * 按起点排序后检查重叠；允许线路未全覆盖（未覆盖区沿用上一区段上限）。
 */
export function applyZoneTable(edits) {
  if (!edits?.length || edits.length !== zones.length) {
    return { ok: false, msg: "区段数量不匹配" };
  }

  const next = zones.map((z, i) => {
    const start = clampBoundary(edits[i].start);
    const end = clampBoundary(edits[i].end);
    const supervisedKmh = clamp(
      Math.round(edits[i].supervisedKmh),
      z.runKmh,
      CONST.OPERATING_MAX_SPEED_KMH,
    );
    return { start, end, runKmh: z.runKmh, supervisedKmh };
  });

  for (const z of next) {
    if (z.start >= z.end) {
      return {
        ok: false,
        msg: `区段 ${z.start}–${z.end} m 无效：起点须小于终点（0–${ROUTE_LEN} m）`,
      };
    }
  }

  next.sort((a, b) => a.start - b.start);

  for (let i = 1; i < next.length; i++) {
    if (next[i].start < next[i - 1].end) {
      return {
        ok: false,
        msg: `区段重叠：${next[i - 1].start}–${next[i - 1].end} m 与 ${next[i].start}–${next[i].end} m`,
      };
    }
  }

  zones = next;
  return { ok: true };
}

export function resetSupervisedLimits() {
  zones = buildDefaults();
}
