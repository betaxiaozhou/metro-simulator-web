/** 若页面内仍存在独立速度表 SVG，则由此初始化刻度（可选用） */
import { clamp } from "../lib/math.js";
import { $ } from "../lib/dom.js";

const SPEEDO = {
  cx: 160,
  cy: 160,
  r: 140,
  startA: 135,
  endA: 405,
  maxV: 100,
};

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function vToAngle(v) {
  const t = clamp(v / SPEEDO.maxV, 0, 1);
  return SPEEDO.startA + t * (SPEEDO.endA - SPEEDO.startA);
}

export function buildTicks() {
  const g = $("ticks");
  if (!g) return;
  let html = "";
  for (let v = 0; v <= 100; v += 10) {
    const a = vToAngle(v);
    const [x1, y1] = polar(SPEEDO.cx, SPEEDO.cy, SPEEDO.r - 20, a);
    const [x2, y2] = polar(SPEEDO.cx, SPEEDO.cy, SPEEDO.r - 6, a);
    html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const [tx, ty] = polar(SPEEDO.cx, SPEEDO.cy, SPEEDO.r - 32, a);
    html += `<text x="${tx}" y="${ty + 3}" text-anchor="middle">${v}</text>`;
  }
  g.innerHTML = html;
}

export function arcPath(cx, cy, r, a1, a2) {
  const [x1, y1] = polar(cx, cy, r, a1);
  const [x2, y2] = polar(cx, cy, r, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function updateSpeedo(actual, target, limit) {
  if (!$("limitArc")) return;
  const a0 = SPEEDO.startA;
  const aActual = vToAngle(actual);
  const aTarget = vToAngle(target);
  const aLimit = vToAngle(limit);
  $("limitArc").setAttribute("d", limit > 0.1 ? arcPath(SPEEDO.cx, SPEEDO.cy, SPEEDO.r, a0, aLimit) : "");
  $("targetArc").setAttribute("d", target > 0.1 ? arcPath(SPEEDO.cx, SPEEDO.cy, SPEEDO.r - 9, a0, aTarget) : "");
  $("actualArc").setAttribute("d", actual > 0.1 ? arcPath(SPEEDO.cx, SPEEDO.cy, SPEEDO.r, a0, aActual) : "");
}
