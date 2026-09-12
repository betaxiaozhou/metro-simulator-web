/** 列车与司机室运行状态（单列车仿真域） */
export const train = {
  pos: 0,
  vel: 0,
  acc: 0,
  lever: 0,
  direction: "N",
  /** 当前取得列车控制权的驾驶台；两端共用同一套 ATP/ATO/TCMS 核心状态 */
  activeCab: "Tc1",
  /** 两端司机钥匙独立，可同时为 ON；activeCab 只授予先激活的一端控制权 */
  cabKeys: { Tc1: true, Tc2: false },
  keyOn: true,
  mode: "RM",
  preMode: "RM",

  atpActive: true,
  atoReady: false,
  atoRunning: false,
  /** ATP 最大常用制动干预中（超过常用制动触发速度，回到限制速度以下解除） */
  atpSbActive: false,
  ebActive: false,
  ebReason: "",
  /** 跳跃对标（建设指南 §3.3.7）：本站已调整次数 / 调整进行中 / 超次闭锁报警 */
  atoJogAttempts: 0,
  atoJogActive: false,
  atoJogExhausted: false,
  /** FAM 过标 >1 m 紧急制动后待停稳判定（≤5 m 自动缓解并向后跳跃） */
  atoOverrunPending: false,
  /** ATO 上一帧加速度指令（冲击率限制用） */
  _atoAccPrev: 0,
  /** ATP/停稳自动释放：仅站台侧为 true（与 route 中 platform 一致） */
  doorAtpLeft: false,
  doorAtpRight: false,
  /** 人工「车门允许」：为 true 时两侧均可开门（CM/调车等） */
  doorManualBoth: false,
  /** 门模式：MM 手开手关 · AM 自开手关 · AA 自开自关（仅影响 AM/FAM 停站自动化） */
  doorMode: "AA",
  /** DMI 5 区「最高驾驶模式」授权上限：RM / CM / AM / FAM（结合 ATP 级别映射为 -C / -I） */
  maxAuthorizedDrivingMode: "FAM",
  /** 各侧车门开启（可双侧同时开） */
  doorLeftOpen: false,
  doorRightOpen: false,
  /** 汇总：左/右/双侧/无，由 doors 模块同步 */
  doorOpenSide: "none",
  doorClosed: true,
  /** PSD 全部关闭锁紧的最早时刻 (ms)；门关好后推进，在此之前 HMI 20 区显示未关闭 */
  psdAllClosedLockedNotBefore: 0,
  /** 最近一次开门时刻 (epoch ms)，用于 18 区关门提示延时 */
  doorOpenedAtMs: 0,
  /** 无允许开门尝试：至此时间前若车门实际开启则 DMI 17 区显示非法打开 (epoch ms) */
  doorIllegalOpenIndicateUntil: 0,
  zeroSpeed: true,

  headlight: false,
  cabinLight: true,
  salonLight: true,
  ac: false,
  wiper: 0,
  horn: false,

  /** 初始停在牡丹园停车标，运营目标从北太平庄开始。 */
  nextStationIdx: 1,
  passengerLoadRatio: 0.35,
  dwelling: false,
  dwellTimer: 0,
  /** AM/FAM：本站是否曾开过门；关门结束站停时需此标志，避免到站瞬间车门关闭误判离站 */
  dwellHadDoorOpenDuringStop: false,
  /** DMI 18 区「建议发车」时钟起点 (epoch ms)；与 ATP 许可无关 */
  departSuggestEpochMs: 0,
  /** 对应 STATIONS 索引；-1 表示未锚定本站 */
  departSuggestAnchorIdx: -1,
  holdAtStation: false,
  skipStation: false,
  autoDoorReleased: false,

  /** 客室报站广播（PA）一次性标志：记录已为哪一站（STATIONS 索引）播过，避免重复触发 */
  paArrivalPlayedForIdx: -1,
  paDeparturePlayedForIdx: -1,

  mrPress: 900,
  bcPress: 0,
  trPct: 0,
  bkPct: 0,
  _cmdAccLag: 0,
  /** 牵引变流器等效直流侧电流（A），正值牵引、再生制动为负 */
  motorCurrentA: 0,
};
