/** ATS / 示意图：轨旁设备 + 速度-距离曲线（ATO/ATP 监督链）+ 区间缩放 */
import { $ } from "../lib/dom.js";
import { ms2kmh, clamp } from "../lib/math.js";
import {
  SPEED_ZONES,
  LINE_META,
  STATIONS,
  SIGNALS,
  BALISES,
  ROUTE_LEN,
  TRACK_W,
  TRACK_X0,
} from "../systems/route-model.js?v=line19-realism-2";
import { train } from "../systems/vehicle-state.js?v=line19-realism-2";
import {
  getZoneLimit,
  zoneSupervisedKmh,
  calcATPLimit,
} from "../systems/signaling-atp.js?v=line19-realism-2";
import { computeAtoProfileKmh } from "../systems/ato-controller.js?v=line19-realism-2";
import { getSupervisedZoneTable } from "../systems/supervised-limits.js?v=line19-realism-2";

/** 速度图纵轴：420px（viewBox 与 CSS 高度 1:1 映射） */
const CHART_H = 420;
const CHART_Y0 = 10;
const CHART_Y1 = CHART_Y0 + CHART_H;
const CHART_VMAX = LINE_META.vehicleDesignSpeedKmh;
const TRACK_SECTION_START = CHART_Y1 + 14;
const CHART_X1 = TRACK_X0;
const CHART_X2 = TRACK_X0 + TRACK_W;

/** 可见区间（m）：默认全线 */
const view = {
  posMin: 0,
  posMax: ROUTE_LEN,
  minSpan: 350,
};

const CURVES = [
  { id: "zone", label: "列车最高运行速度", short: "最高运行", color: "#4ade80", dash: "6 4", width: 1.4 },
  { id: "atp", label: "ATP 系统限制速度", short: "ATP 限制", color: "#fbbf24", dash: "", width: 1.8 },
  { id: "recommend", label: "推荐速度", short: "推荐", color: "#a3e635", dash: "", width: 2.2 },
  { id: "ato", label: "ATO 运行速度", short: "ATO 运行", color: "#f8fafc", dash: "", width: 2.4 },
  { id: "supervised", label: "列车运行最高限制速度", short: "最高限制", color: "#22d3ee", dash: "", width: 2.8 },
];

/** 各速度曲线是否显示（默认全开） */
const curveVisible = Object.fromEntries(CURVES.map((c) => [c.id, true]));

function viewSpan() {
  return view.posMax - view.posMin;
}

function posToXView(p) {
  const span = viewSpan();
  if (span <= 0) return CHART_X1;
  return CHART_X1 + ((p - view.posMin) / span) * TRACK_W;
}

function speedToY(vKmh) {
  const v = Math.max(0, Math.min(CHART_VMAX, vKmh));
  return CHART_Y1 - (v / CHART_VMAX) * (CHART_Y1 - CHART_Y0);
}

function inView(p, margin = 80) {
  return p >= view.posMin - margin && p <= view.posMax + margin;
}

function setViewport(posMin, posMax) {
  let span = clamp(posMax - posMin, view.minSpan, ROUTE_LEN);
  let min = clamp(posMin, 0, ROUTE_LEN - span);
  view.posMin = min;
  view.posMax = min + span;
  refreshTrackLayout();
}

function zoomAround(center, factor) {
  const span = viewSpan();
  const newSpan = clamp(span * factor, view.minSpan, ROUTE_LEN);
  let min = center - newSpan / 2;
  if (min < 0) min = 0;
  if (min + newSpan > ROUTE_LEN) min = ROUTE_LEN - newSpan;
  setViewport(min, min + newSpan);
}

export function resetTrackViewport() {
  setViewport(0, ROUTE_LEN);
}

export function zoomTrackIn(center = train.pos) {
  zoomAround(center, 0.55);
}

export function zoomTrackOut(center = (view.posMin + view.posMax) / 2) {
  zoomAround(center, 1.75);
}

function updateViewRangeLabel() {
  const el = $("trackViewRange");
  if (!el) return;
  const full = view.posMin <= 1 && view.posMax >= ROUTE_LEN - 1;
  el.textContent = full
    ? `全线 0 – ${ROUTE_LEN} m`
    : `区间 ${Math.round(view.posMin)} – ${Math.round(view.posMax)} m（${Math.round(viewSpan())} m）`;
}

/** 按采样位置 p 设定「前方下一停车点」上下文，再计算依赖 nextStationIdx 的曲线 */
function withRouteContext(p, fn) {
  const savedIdx = train.nextStationIdx;
  const savedSkip = train.skipStation;
  let idx = STATIONS.length;
  for (let i = 0; i < STATIONS.length; i++) {
    if (STATIONS[i].pos > p + 0.5) {
      idx = i;
      break;
    }
  }
  train.nextStationIdx = idx;
  train.skipStation = idx === savedIdx ? savedSkip : false;
  try {
    return fn();
  } finally {
    train.nextStationIdx = savedIdx;
    train.skipStation = savedSkip;
  }
}

function sampleSpeeds(p) {
  const zone = getZoneLimit(p);
  const supervised = zoneSupervisedKmh(p);
  return withRouteContext(p, () => {
    const atp = Math.min(calcATPLimit(p), supervised);
    const ato = Math.min(computeAtoProfileKmh(p), supervised);
    const recommend = Math.max(0, Math.min(ato, atp - 0.5, supervised));
    return { zone, supervised, atp, recommend, ato };
  });
}

function sampleStep() {
  return Math.max(8, Math.round(viewSpan() / 180));
}

/** 区段常值曲线：水平段 + 边界处竖直阶跃（避免 polyline 在边界画出斜线） */
function buildStepSeriesFromZones(zoneList, p0, p1, valueOf) {
  const points = [];
  const sorted = [...zoneList].sort((a, b) => a.start - b.start);

  for (const z of sorted) {
    if (z.end <= p0 || z.start >= p1) continue;
    const segStart = Math.max(z.start, p0);
    const segEnd = Math.min(z.end, p1);
    const y = speedToY(valueOf(z)).toFixed(1);
    const xStart = posToXView(segStart).toFixed(1);
    const xEnd = posToXView(segEnd).toFixed(1);

    if (points.length === 0) {
      points.push(`${xStart},${y}`);
    } else {
      const [, lastY] = points[points.length - 1].split(",");
      if (lastY !== y) {
        points.push(`${xStart},${lastY}`);
        points.push(`${xStart},${y}`);
      }
    }
    points.push(`${xEnd},${y}`);
  }
  return points;
}

function buildAllCurvePoints() {
  const series = Object.fromEntries(CURVES.map((c) => [c.id, []]));
  const step = sampleStep();
  const p0 = Math.max(0, view.posMin);
  const p1 = Math.min(ROUTE_LEN, view.posMax);

  series.zone = buildStepSeriesFromZones(
    SPEED_ZONES,
    p0,
    p1,
    (z) => z.runKmh,
  );
  series.supervised = buildStepSeriesFromZones(getSupervisedZoneTable(), p0, p1, (z) => z.supervisedKmh);

  const dynamicIds = CURVES.filter((c) => c.id !== "zone" && c.id !== "supervised").map((c) => c.id);
  for (let p = p0; p <= p1; p += step) {
    const s = sampleSpeeds(p);
    const x = posToXView(p).toFixed(1);
    for (const id of dynamicIds) series[id].push(`${x},${speedToY(s[id]).toFixed(1)}`);
  }
  if ((p1 - p0) % step !== 0) {
    const s = sampleSpeeds(p1);
    const x = posToXView(p1).toFixed(1);
    for (const id of dynamicIds) series[id].push(`${x},${speedToY(s[id]).toFixed(1)}`);
  }
  return series;
}

function buildPosAxisTicks() {
  const g = $("speedPosAxis");
  if (!g) return;
  const span = viewSpan();
  let step = 500;
  if (span <= 800) step = 100;
  else if (span <= 2000) step = 200;
  else if (span <= 4000) step = 500;
  else step = 1000;
  let html = "";
  const start = Math.ceil(view.posMin / step) * step;
  for (let p = start; p <= view.posMax; p += step) {
    const x = posToXView(p);
    html += `<line class="speed-pos-tick" x1="${x}" y1="${CHART_Y1}" x2="${x}" y2="${CHART_Y1 + 5}"/>`;
    html += `<text class="speed-pos-label" x="${x}" y="${CHART_Y1 + 14}" text-anchor="middle">${p}</text>`;
  }
  g.innerHTML = html;
}

function buildSpeedProfileLayer() {
  const g = $("speedProfileLayer");
  if (!g) return;

  let html = `
    <rect class="speed-chart-bg" x="${CHART_X1 - 2}" y="${CHART_Y0 - 4}" width="${TRACK_W + 4}" height="${CHART_Y1 - CHART_Y0 + 14}" rx="3"/>
    <line class="speed-chart-axis" x1="${CHART_X1}" y1="${CHART_Y1}" x2="${CHART_X2}" y2="${CHART_Y1}"/>
    <g id="speedPosAxis"></g>
  `;

  for (const v of [20, 40, 60, 80, 100, 120]) {
    const y = speedToY(v);
    html += `<line class="speed-chart-grid" x1="${CHART_X1}" y1="${y}" x2="${CHART_X2}" y2="${y}"/>`;
    html += `<text class="speed-chart-tick" x="${CHART_X1 - 6}" y="${y + 3}" text-anchor="end">${v}</text>`;
  }
  html += `<text class="speed-chart-unit" x="${CHART_X1 - 6}" y="${CHART_Y0 + 2}" text-anchor="end">km/h</text>`;
  const operatingY = speedToY(LINE_META.operatingMaxSpeedKmh);
  html += `<text class="speed-chart-tick" x="${CHART_X2}" y="${operatingY - 4}" text-anchor="end">运营上限 100 · 车辆设计 120</text>`;

  for (const c of CURVES) {
    html += `<polyline class="speed-curve speed-curve-${c.id}" id="curve_${c.id}" fill="none"
      stroke="${c.color}" stroke-width="${c.width}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ""}/>`;
  }

  html += `<line class="speed-train-pos" id="speedTrainPos" x1="0" y1="${CHART_Y0 - 2}" x2="0" y2="${CHART_Y1 + 2}"/>`;
  html += `<circle class="speed-train-dot" id="speedTrainDot" r="4" cx="0" cy="0"/>`;

  let lx = CHART_X1 + 8;
  let ly = CHART_Y0 + 2;
  for (const c of CURVES) {
    html += `<g class="speed-legend-item" id="legend_${c.id}" transform="translate(${lx},${ly})">
      <line x1="0" y1="0" x2="14" y2="0" stroke="${c.color}" stroke-width="${c.width}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ""}/>
      <text x="18" y="3">${c.label}</text>
    </g>`;
    lx += 168;
    if (lx > 900) {
      lx = CHART_X1 + 8;
      ly += 11;
    }
  }

  g.innerHTML = html;
  applyCurveVisibility();
}

function applyCurveVisibility() {
  for (const c of CURVES) {
    const on = curveVisible[c.id];
    const el = $(`curve_${c.id}`);
    const leg = $(`legend_${c.id}`);
    if (el) el.style.display = on ? "" : "none";
    if (leg) leg.classList.toggle("off", !on);
    const chk = document.querySelector(`input[data-curve="${c.id}"]`);
    if (chk) chk.checked = on;
  }
}

function buildCurveToggleUI() {
  const host = $("trackCurveToggles");
  if (!host) return;
  host.innerHTML = `
    <span class="track-curve-toggles-label">显示速度：</span>
    ${CURVES.map(
      (c) => `
      <label class="track-curve-toggle" style="--curve-color:${c.color}" title="${c.label}">
        <input type="checkbox" data-curve="${c.id}" ${curveVisible[c.id] ? "checked" : ""}/>
        <span class="track-curve-swatch"></span>
        <span>${c.short}</span>
      </label>`,
    ).join("")}
    <button type="button" class="track-zoom-btn track-curve-preset" data-preset="all">全选</button>
    <button type="button" class="track-zoom-btn track-curve-preset" data-preset="ato">ATO</button>
    <button type="button" class="track-zoom-btn track-curve-preset" data-preset="atp">ATP</button>
  `;
  host.querySelectorAll("input[data-curve]").forEach((inp) => {
    inp.addEventListener("change", () => {
      curveVisible[inp.dataset.curve] = inp.checked;
      applyCurveVisibility();
    });
  });
  host.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.dataset.preset;
      if (p === "all") {
        for (const c of CURVES) curveVisible[c.id] = true;
      } else if (p === "ato") {
        for (const c of CURVES) curveVisible[c.id] = ["zone", "ato", "recommend"].includes(c.id);
      } else if (p === "atp") {
        for (const c of CURVES) curveVisible[c.id] = ["supervised", "atp"].includes(c.id);
      }
      applyCurveVisibility();
    });
  });
}

function buildTrackElems() {
  const g = $("trackElems");
  if (!g) return;
  let html = "";
  for (const { start: s, end: e, runKmh: v } of SPEED_ZONES) {
    if (v >= 80) continue;
    if (e < view.posMin || s > view.posMax) continue;
    const x1 = posToXView(Math.max(s, view.posMin));
    const x2 = posToXView(Math.min(e, view.posMax));
    if (x2 <= x1) continue;
    html += `<rect class="speed-zone" x="${x1}" y="${TRACK_SECTION_START + 38}" width="${x2 - x1}" height="35"/>`;
    const midP = clamp((s + e) / 2, view.posMin, view.posMax);
    html += `<text class="speed-zone-text" x="${posToXView(midP)}" y="${TRACK_SECTION_START + 93}" text-anchor="middle">${v} km/h</text>`;
  }
  for (const b of BALISES) {
    if (!inView(b.pos, 0)) continue;
    const x = posToXView(b.pos);
    html += `<rect class="balise" x="${x - 3}" y="${TRACK_SECTION_START + 71}" width="6" height="6"/>`;
  }
  for (const s of STATIONS) {
    if (!inView(s.pos, 40)) continue;
    const x = posToXView(s.pos);
    html += `<rect class="station-rect" x="${x - 30}" y="${TRACK_SECTION_START + 8}" width="60" height="38" rx="2"/>`;
    html += `<text class="station-text" x="${x}" y="${TRACK_SECTION_START + 23}">${s.name}</text>`;
    html += `<text class="station-text" x="${x}" y="${TRACK_SECTION_START + 39}" style="font-size:9px;fill:#8aa6c2">${s.pos}m</text>`;
  }
  for (const sig of SIGNALS) {
    if (!inView(sig.pos, 0)) continue;
    const x = posToXView(sig.pos);
    html += `<line class="signal-mast" x1="${x}" y1="${TRACK_SECTION_START + 103}" x2="${x}" y2="${TRACK_SECTION_START + 128}"/>`;
    html += `<circle class="signal-light" id="sigL_${sig.pos}" cx="${x}" cy="${TRACK_SECTION_START + 105}" r="3" fill="#1ed760"/>`;
    html += `<circle class="signal-light" cx="${x}" cy="${TRACK_SECTION_START + 113}" r="3" fill="#332"/>`;
    html += `<circle class="signal-light" cx="${x}" cy="${TRACK_SECTION_START + 121}" r="3" fill="#332"/>`;
  }
  g.innerHTML = html;
}

function updateSpeedProfiles() {
  const series = buildAllCurvePoints();
  for (const c of CURVES) {
    const el = $(`curve_${c.id}`);
    if (el) el.setAttribute("points", series[c.id].join(" "));
  }

  const x = posToXView(train.pos);
  const vNow = ms2kmh(Math.abs(train.vel));
  const posLine = $("speedTrainPos");
  const dot = $("speedTrainDot");
  if (posLine) {
    posLine.setAttribute("x1", x);
    posLine.setAttribute("x2", x);
    posLine.style.display = train.pos >= view.posMin && train.pos <= view.posMax ? "" : "none";
  }
  if (dot) {
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", speedToY(vNow));
    dot.style.display = posLine?.style.display === "none" ? "none" : "";
  }
}

function refreshTrackLayout() {
  buildTrackElems();
  buildPosAxisTicks();
  updateSpeedProfiles();
  updateTrainMarker();
  updateViewRangeLabel();
}

export function refreshTrackCharts() {
  refreshTrackLayout();
}

export function buildTrack() {
  buildSpeedProfileLayer();
  refreshTrackLayout();
}

export function updateTrainMarker() {
  const tm = $("trainMarker");
  if (tm) {
    const visible = train.pos >= view.posMin && train.pos <= view.posMax;
    tm.style.display = visible ? "" : "none";
    if (visible) tm.setAttribute("transform", `translate(${posToXView(train.pos)},0)`);
  }
  updateSpeedProfiles();
}

export function initTrackViewportControls() {
  $("btnTrackZoomIn")?.addEventListener("click", () => zoomTrackIn(train.pos));
  $("btnTrackZoomOut")?.addEventListener("click", () => zoomTrackOut());
  $("btnTrackZoomReset")?.addEventListener("click", () => resetTrackViewport());
  $("btnTrackZoomTrain")?.addEventListener("click", () => {
    const span = Math.min(1800, Math.max(view.minSpan, viewSpan()));
    let min = train.pos - span / 2;
    if (min < 0) min = 0;
    if (min + span > ROUTE_LEN) min = ROUTE_LEN - span;
    setViewport(min, min + span);
  });

  const wrap = $("trackWrap");
  wrap?.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const focus = view.posMin + ratio * viewSpan();
      if (e.deltaY < 0) zoomAround(focus, 0.72);
      else zoomAround(focus, 1.38);
    },
    { passive: false },
  );

  updateViewRangeLabel();
  buildCurveToggleUI();
}
