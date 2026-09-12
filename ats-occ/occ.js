const stations = [
  "牡丹园","北太平庄","积水潭","平安里","太平桥",
  "牛街","景风门","草桥","新发地","新宫",
];
const xs = [210,445,680,915,1150,1385,1620,1855,2090,2325];
const TRACK_Y = [230, 470];
const BASE_WIDTH = 2520;
const BASE_HEIGHT = 700;
const svgNS = "http://www.w3.org/2000/svg";
const q = (s) => document.querySelector(s);
const make = (name, attrs = {}, text = "") => {
  const node = document.createElementNS(svgNS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
};
const addTitle = (node, text) => {
  node.append(make("title", {}, text));
  return node;
};

const segmentLayer = q("#trackSegments");
for (let i = 0; i < xs.length - 1; i += 1) {
  for (const y of TRACK_Y) {
    const sectionId = `${1901 + i}${y === TRACK_Y[0] ? "G" : "H"}`;
    const state = i === 0 && y === TRACK_Y[0] ? "occupied" : "idle";
    const line = make("path", {
      d: `M${xs[i]} ${y}H${xs[i + 1]}`,
      class: `track-segment ${state}`,
      "data-state": state,
    });
    segmentLayer.append(addTitle(line, `${sectionId} · ${state === "occupied" ? "CBTC列车占用" : "区段空闲"}`));
    segmentLayer.append(make("text", {
      x: (xs[i] + xs[i + 1]) / 2,
      y: y + (y === TRACK_Y[0] ? -13 : 24),
      class: "track-section-label",
    }, sectionId));
  }
}

const turnoutLayer = q("#turnouts");
const renderCrossover = (left, right, firstPoint) => {
  const routes = [
    {d: `M${left} ${TRACK_Y[0]}L${right} ${TRACK_Y[1]}`, name: String(firstPoint), x: left},
    {d: `M${left} ${TRACK_Y[1]}L${right} ${TRACK_Y[0]}`, name: String(firstPoint + 2), x: right},
  ];
  routes.forEach(({d, name, x}, index) => {
    turnoutLayer.append(addTitle(make("path", {d, class: "turnout-route"}), `${name}号道岔 · 定位`));
    turnoutLayer.append(make("text", {
      x,
      y: index === 0 ? TRACK_Y[0] - 24 : TRACK_Y[1] + 35,
      class: "point-name",
    }, name));
  });
};
renderCrossover(285, 405, 1);
renderCrossover(2120, 2240, 5);

const stationLayer = q("#stations");
stations.forEach((name, index) => {
  const x = xs[index];
  const group = make("g", {class: "station"});
  group.append(
    make("text", {x: x - 66, y: 342, class: "station-index"}, String(index + 1).padStart(2, "0")),
    make("text", {x, y: 342, class: "station-name"}, name),
    make("rect", {x: x - 58, y: 270, width: 116, height: 38, rx: 1, class: `platform-stopped${index === 0 ? " active" : ""}`}),
    make("path", {d: `M${x - 53} 273H${x + 53}`, class: "platform-door"}),
    make("rect", {x: x - 58, y: 392, width: 116, height: 38, rx: 1, class: "platform"}),
    make("path", {d: `M${x - 53} 427H${x + 53}`, class: "platform-door"}),
    make("text", {x, y: 294, class: "platform-label"}, `${name} 上行站台 · 站台门关闭`),
    make("text", {x, y: 416, class: "platform-label"}, `${name} 下行站台 · 站台门关闭`),
    make("circle", {cx: x + 71, cy: 348, r: 5, class: "control-dot"}),
    make("text", {x: x + 80, y: 351, class: "control-label"}, "中控"),
  );
  group.append(make("title", {}, `${name} · 中控模式 · 站台门关闭${index === 0 ? " · 上行站台列车停稳" : ""}`));
  stationLayer.append(group);
});

const signalLayer = q("#signals");
xs.forEach((x, index) => {
  for (const [y, dir] of [[TRACK_Y[0], -1], [TRACK_Y[1], 1]]) {
    const sx = x + dir * 76;
    signalLayer.append(
      make("path", {d: `M${sx} ${y}v${dir * 22}`, class: "signal-mast"}),
      addTitle(make("circle", {cx: sx, cy: y + dir * 27, r: 6, class: "signal-head"}), "稳定红色 · 不准列车越过"),
      make("text", {x: sx - 16, y: y + dir * 38, class: "signal-name"}, `X${index + 1}${dir < 0 ? "1" : "2"}`),
    );
  }
});

const trainLayer = q("#trainLayer");
const trainX = 300;
trainLayer.append(
  make("line", {x1: trainX + 44, y1: TRACK_Y[0], x2: trainX + 158, y2: TRACK_Y[0], class: "ma-line"}),
  addTitle(make("rect", {x: trainX - 40, y: 182, width: 82, height: 34, rx: 1, class: "train-box"}), "19005次 · AM模式 · 向右运行"),
  make("rect", {x: trainX + 35, y: 182, width: 7, height: 34, class: "train-mode AM"}),
  make("text", {x: trainX - 3, y: 204, class: "train-number"}, "19005"),
  make("path", {d: `M${trainX + 43} 190l16 9-16 9z`, class: "train-arrow"}),
  make("text", {x: trainX - 36, y: 174, class: "train-flags"}, "D"),
);

const tickClock = () => {
  const now = new Date();
  q("#clock").textContent = now.toLocaleTimeString("zh-CN", {hour12: false});
  q("#alarmRows tr:first-child td:nth-child(2)").textContent = q("#clock").textContent;
};
tickClock();
setInterval(tickClock, 1000);

let zoom = 1;
const viewport = q("#viewport");
const plan = q("#trackPlan");
const applyZoom = () => {
  plan.style.width = `${BASE_WIDTH * zoom}px`;
  plan.style.height = `${BASE_HEIGHT * zoom}px`;
};
const fit = () => {
  zoom = Math.max(.2, Math.min(1,
    (viewport.clientWidth - 6) / BASE_WIDTH,
    (viewport.clientHeight - 6) / BASE_HEIGHT,
  ));
  applyZoom();
  viewport.scrollTo({left: 0, top: 0, behavior: "smooth"});
};
const follow = () => {
  zoom = Math.max(.75, zoom);
  applyZoom();
  const target = Math.max(0, trainX * zoom - viewport.clientWidth / 2);
  viewport.scrollTo({left: target, top: 105 * zoom, behavior: "smooth"});
};
const zoomBy = (factor) => {
  const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom;
  const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / zoom;
  zoom = Math.max(.2, Math.min(1.8, zoom * factor));
  applyZoom();
  viewport.scrollTo({
    left: centerX * zoom - viewport.clientWidth / 2,
    top: centerY * zoom - viewport.clientHeight / 2,
  });
};

document.querySelectorAll(".tool[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "fit") fit();
    if (action === "follow") follow();
    if (action === "zoom-in") zoomBy(1.25);
    if (action === "zoom-out") zoomBy(.8);
    if (action === "labels") {
      document.body.classList.toggle("hide-labels");
      button.classList.toggle("selected", document.body.classList.contains("hide-labels"));
    }
  });
});

let drag = null;
viewport.addEventListener("pointerdown", (event) => {
  drag = {x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop};
  viewport.classList.add("dragging");
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener("pointermove", (event) => {
  if (!drag) return;
  viewport.scrollLeft = drag.left - (event.clientX - drag.x);
  viewport.scrollTop = drag.top - (event.clientY - drag.y);
});
const endDrag = () => { drag = null; viewport.classList.remove("dragging"); };
viewport.addEventListener("pointerup", endDrag);
viewport.addEventListener("pointercancel", endDrag);

q("#alarmRows").addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) return;
  document.querySelectorAll("#alarmRows tr").forEach((item) => item.classList.remove("selected"));
  row.classList.add("selected");
});
const acknowledge = (all = false) => {
  const rows = all ? document.querySelectorAll("#alarmRows tr") : document.querySelectorAll("#alarmRows tr.selected");
  rows.forEach((row) => {
    row.lastElementChild.textContent = "已确认";
    row.classList.remove("unacked");
  });
};
q("#ackAlarm").addEventListener("click", () => acknowledge(false));
q("#ackAll").addEventListener("click", () => acknowledge(true));
window.addEventListener("resize", fit);
requestAnimationFrame(fit);
