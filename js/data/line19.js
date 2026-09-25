/**
 * 北京地铁 19 号线一期统一数据源。
 *
 * 坐标采用当前运营模拟口径：牡丹园停车标为 0 m，新宫停车标为 20,840 m，
 * 运行边界为 20,900 m。工程全长 22.4 km 与运营全长 20.9 km 属于不同公开
 * 口径，二者均保留，不通过拉伸站间距强行统一。
 */

const OFFICIAL_OPERATION_SOURCE =
  "https://jtw.beijing.gov.cn/xxgk/xwfbh/202207/t20220729_2781907.html";
const OFFICIAL_PROJECT_SOURCE =
  "https://zdb.beijing.gov.cn/zdxmjs/gdjtjs/202503/t20250328_4048646.html";

export const LINE_META = Object.freeze({
  id: "beijing-line-19-phase-1",
  name: "北京地铁19号线一期",
  projectLengthM: 22400,
  operatingLengthM: 20900,
  vehicleDesignSpeedKmh: 120,
  operatingMaxSpeedKmh: 100,
  provenance: Object.freeze({
    projectLengthM: { confidence: "official", source: OFFICIAL_PROJECT_SOURCE },
    operatingLengthM: { confidence: "official", source: OFFICIAL_OPERATION_SOURCE },
    vehicleDesignSpeedKmh: { confidence: "official", source: OFFICIAL_PROJECT_SOURCE },
    operatingMaxSpeedKmh: { confidence: "official", source: OFFICIAL_OPERATION_SOURCE },
  }),
});

/**
 * 停车标间距沿用项目既有的用户给定精确输入；公开资料不足以证明站台侧与
 * 有效长度，因此将其写成显式估算值，而不是由站序奇偶动态生成。
 */
export const STATION_DATA = Object.freeze([
  { name: "牡丹园", pos: 0, platformLengthM: 186, platform: "right", reversePlatform: "left" },
  { name: "北太平庄", pos: 920, platformLengthM: 186, platform: "left", reversePlatform: "right" },
  { name: "积水潭", pos: 3370, platformLengthM: 186, platform: "right", reversePlatform: "left" },
  { name: "平安里", pos: 4960, platformLengthM: 186, platform: "left", reversePlatform: "right" },
  { name: "太平桥", pos: 7670, platformLengthM: 186, platform: "right", reversePlatform: "left" },
  { name: "牛街", pos: 9810, platformLengthM: 186, platform: "left", reversePlatform: "right" },
  { name: "景风门", pos: 12770, platformLengthM: 186, platform: "right", reversePlatform: "left" },
  { name: "草桥", pos: 15450, platformLengthM: 186, platform: "left", reversePlatform: "right" },
  { name: "新发地", pos: 18100, platformLengthM: 186, platform: "right", reversePlatform: "left" },
  { name: "新宫", pos: 20840, platformLengthM: 186, platform: "left", reversePlatform: "right" },
].map((station) => Object.freeze({
  ...station,
  provenance: Object.freeze({
    pos: { confidence: "verified", source: "project-user-supplied-station-distances" },
    platformLengthM: { confidence: "estimated", source: "8-car-A-type-platform-baseline" },
    platform: { confidence: "estimated", source: "public-layout-not-confirmed" },
    reversePlatform: { confidence: "estimated", source: "public-layout-not-confirmed" },
  }),
})));

/** 运营限速估算基线：站区 60、普通区间 100、终端 40 km/h。 */
export const SPEED_ZONE_DATA = Object.freeze([
  [0, 200, 60],
  [200, 720, 100],
  [720, 1120, 60],
  [1120, 3170, 100],
  [3170, 3570, 60],
  [3570, 4760, 100],
  [4760, 5160, 60],
  [5160, 7470, 100],
  [7470, 7870, 60],
  [7870, 9610, 100],
  [9610, 10010, 60],
  [10010, 12570, 100],
  [12570, 12970, 60],
  [12970, 15250, 100],
  [15250, 15650, 60],
  [15650, 17900, 100],
  [17900, 18300, 60],
  [18300, 20640, 100],
  [20640, 20800, 60],
  [20800, 20900, 40],
].map(([start, end, runKmh]) => Object.freeze({
  start,
  end,
  runKmh,
  confidence: "estimated",
  source: "operating-baseline-60-100-40",
})));

/** 暂无可信公开纵断面与曲线表；中性值仍显式携带估算标记。 */
export const GRADIENT_ZONE_DATA = Object.freeze([
  Object.freeze({ start: 0, end: 20900, gradientPermille: 0, confidence: "estimated", source: "neutral-profile" }),
]);

export const CURVE_ZONE_DATA = Object.freeze([
  Object.freeze({ start: 0, end: 20900, radiusM: Infinity, confidence: "estimated", source: "neutral-profile" }),
]);

/** 轨旁点位为显式估算数据，不表示现场设备位置。 */
export const SIGNAL_DATA = Object.freeze([
  60, 980, 3430, 5020, 7730, 9870, 12830, 15510, 18160,
].map((pos, index) => Object.freeze({
  id: `X19-${String(index + 1).padStart(2, "0")}`,
  pos,
  aspect: "G",
  confidence: "estimated",
  source: "departure-protection-baseline",
})));

export const BALISE_DATA = Object.freeze([
  620, 3070, 4660, 7370, 9510, 12470, 15150, 17800, 20540,
].map((pos, index) => Object.freeze({
  id: `B19-${String(index + 1).padStart(2, "0")}`,
  pos,
  confidence: "estimated",
  source: "station-approach-baseline",
})));
