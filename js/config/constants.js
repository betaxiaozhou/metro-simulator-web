/**
 * 仿真标定与车辆常量（与各子系统共用）。
 *
 * 速度体系依据《城市轨道交通列车运行速度控制导则》：
 *   列车最高运行速度（SPEED_ZONES 区段值，ATO 巡航目标）
 *     < 列车运行最高限制速度（区段值 + 超速容许量：≥80 区段 +7，低速/车站区段 +5）
 *     < ATP 系统限制速度（按制动曲线动态计算，含前移裕量）
 *     < ATP 最大常用制动触发速度（限制速度 + FSB 触发裕量）
 *     < ATP 紧急制动触发速度（EB 曲线，含响应延时走行距离与测速误差）。
 */
export const CONST = {
  MAX_TRACTION_ACC: 1.0,
  MAX_SERVICE_BRK: 1.1,
  EB_BRAKE: 1.3,
  VEHICLE_DESIGN_SPEED_KMH: 120,
  OPERATING_MAX_SPEED_KMH: 100,
  TRACTION_CONSTANT_ACC_END_KMH: 40,
  /** 8A 质量为公开资料不足情况下的工程估算；载荷率可由状态层动态修改。 */
  EMPTY_MASS_KG: 368000,
  MAX_PASSENGER_MASS_KG: 112000,
  DEFAULT_PASSENGER_LOAD_RATIO: 0.35,

  /* ───────── ATP 速度监督链（导则 §2.9~2.11、§4.3、§4.7） ───────── */

  /** 运行最高限制速度相对列车最高运行速度的容许量：≥80 km/h 区段（导则表 3-1：80→87） */
  ZONE_OVERSPEED_ALLOW_HIGH: 7,
  /** 同上：<80 km/h 区段（车站/道岔限速按 +5，导则表 3-1/3-2） */
  ZONE_OVERSPEED_ALLOW_LOW: 5,
  /** 区段速度判定「高速/低速」容许量的分界 (km/h) */
  ZONE_ALLOW_SPLIT_KMH: 80,

  /** ATP 最大常用制动触发速度 = ATP 限制速度 + 此裕量（导则 §4.3-3，可按 EB 触发速度配置） */
  ATP_FSB_TRIGGER_MARGIN: 3,
  /**
   * ATP 紧急制动触发裕量（km/h）：EB 曲线之上再叠加的触发阈值，
   * 概括导则 §4.7 中测速误差、定位误差等最不利因素。
   * DMI 显示的 EBI 速度 = calcEBILimit() + 本值（dmi-bridge 既有契约，勿改名）。
   */
  ATP_OVERSPEED_MARGIN: 5,
  /** ATP 超速报警裕量：超过 ATP 限制速度此值即在 DMI 报警（先于制动干预） */
  ATP_WARN_MARGIN: 2,
  /**
   * ATP/车辆响应延时合计 (s)：紧急制动触发曲线按「延时内列车继续走行」前移
   * （导则 §4.3-2 图 4-2：ATP 响应延时 + 车辆响应延时 + 制动建立过程）。
   */
  ATP_RESPONSE_TIME_S: 1.2,
  /** EB 曲线采用的「平直干燥轨道上车辆能保证的紧急制动最小减速度」(m/s²)，留有保证率 */
  ATP_GUARANTEED_EB_DECEL: 1.15,
  /** ATP 常用制动停车监督的防护终点位于停车标后方此距离 (m)（与过标 EB 阈值一致，导则图 4-2） */
  ATP_STOP_MARGIN_M: 1.0,
  /** EB 触发曲线防护终点相对停车标后方距离 (m)（预留，EB 曲线当前不计站台停车点） */
  ATP_EB_STOP_MARGIN_M: 0.5,

  RM_LIMIT: 25,

  /* ───────── ATO 运行控制（导则 §2.12~2.13、§4.4~4.6） ───────── */

  /** ATO 运行速度相对 ATP 限制速度的安全偏置 (km/h)，保证正常驾驶不触碰监督曲线 */
  AM_REC_OFFSET: 5,
  /** 巡航速度允许波动范围 ±2 km/h（导则 §4.5/4.6），亦作为巡航控制死区 */
  ATO_CRUISE_DEADBAND_KMH: 2,
  /** ATO 进站理想制动率 (m/s²)：偏舒适的常用制动，低于最大常用制动留调节余量 */
  ATO_SERVICE_DECEL: 0.8,
  /** 正常运行图相对线路区段上限的速度系数，保留恢复余量并贴近约 30 min 全程时分。 */
  ATO_SCHEDULE_SPEED_FACTOR: 0.85,
  /** ATO 制动曲线相对停车标的对标前移 (m)，消化指令滤波滞后 */
  ATO_STOP_MARGIN_M: 0.35,
  /** ATO/站停零速保持制动强度（相对最大常用制动 100% 的份额） */
  HOLD_BRAKE_FRACTION: 0.6,
  /** 距停车标此距离内进入进站制动管理段 (m) */
  ATO_APPROACH_DIST_M: 260,
  /** 进站曲线与区间推荐速度开始融合的距离 (m) */
  ATO_BLEND_STATION_M: 600,
  /** 加速度指令变化率限制 (m/s³)：模拟冲击率（jerk）限制，乘客舒适性 */
  ATO_JERK_LIMIT: 0.75,

  /* ───── 对标停车与跳跃调整（建设指南 §3.3.7、运营规范 §4.1.10/6.3.10） ───── */

  /** 停车窗（对标容差）±m：在窗内即视为对标停准，释放车门允许 */
  STOP_TOLERANCE: 0.3,
  /** 进入站停判定的最大纵向误差 (m)：低速停于此窗内即认为到站（窗外触发跳跃调整） */
  ATO_ARRIVAL_WINDOW_M: 0.42,
  /** 欠标/过标不超过此距离 (m) 时允许跳跃方式自动调整对标（宜设置为 5 m） */
  ATO_JOG_MAX_ERR_M: 5,
  /** 跳跃调整运行速度上限 (km/h)（规范：不高于 5 km/h） */
  ATO_JOG_SPEED_KMH: 5,
  /** 跳跃调整允许次数（一般为 3 次），超过后施加制动并报警等待人工处置 */
  ATO_JOG_MAX_ATTEMPTS: 3,
  /** FAM 过标超过此距离 (m) 自动施加紧急制动（建设指南：宜设置为 1 m） */
  ATO_OVERRUN_EB_M: 1.0,

  CMD_ACC_TAU: 0.32,
  /** 主控手柄零位死区（±3% 以内视为惰行，忽略输入） */
  LEVER_DEADZONE: 0.03,

  G_DT: 1 / 30,

  /* ───────── 站台作业（建设指南 §3.3.8、运营规范 §4.1.10） ───────── */

  /**
   * 站台门：列车门关闭后，PSD 继续关闭并锁紧的回读延时 (ms)。
   * 此期间 DMI 20 区显示「站台门未关闭」；到点后视为关闭锁紧，20 区熄灭。
   */
  PSD_PLATFORM_CLOSE_MS: 2000,

  /**
   * AM/FAM · A/A：自**进站 dwelling 起算**的仿真停站时间（s），达到后**自动关门**。
   * 与 DMI「请关门」、与「建议发车」均为**独立**参数，可分别标定。
   */
  STATION_AA_AUTOCLOSE_DWELL_S: 35,

  /**
   * DMI 18 区**建议发车（晚点预警）**上行箭头：自**到站** `departSuggestEpochMs` 起算的墙钟秒数；
   * 非 ATP 许可，且**不得**与 A/A 自动关门共用同一常量。
   */
  STATION_DWELL_DEPART_HINT_S: 24,

  /** DMI 建议发车锚点：列车越过停车标前方此距离 (m) 后清除本站晚点预警时钟 */
  DEPART_SUGGEST_CLEAR_PAST_STATION_M: 110,

  /** 仍可视为停留在锚点站台附近的最大 |Δ位置| (m)，防止途中误亮建议发车 */
  DEPART_SUGGEST_ANCHOR_RADIUS_M: 140,

  /**
   * DMI 18 区「请关门」：自**本次开门** `doorOpenedAtMs` 起算的墙钟 (ms)，到时显示关门提示。
   */
  DMI_Z18_CLOSE_HINT_DELAY_MS: 20000,

  /** 无门允许却操作开门时告警窗口；仅车门未全关时 DMI 17 区才显示「非法打开」(c-z17=8) */
  DMI_DOOR_ILLEGAL_INDICATE_MS: 5000,

  /** 北京地铁 19 号线 A 型车 8 节编组 */
  CONSIST_LENGTH: 8,
  /** 每节车每侧客室门数量（TCMS 中 A/B 侧各 N 扇） */
  DOORS_PER_SIDE: 5,
  /** 接触网额定电压（V） */
  LINE_VOLTAGE: 1500,

  /** 牵引/电制动电流模型（多台逆变器并联等效为安培，示意量纲） */
  MOTOR_I_REF_A: 720,
  /** 低速以下再生能力快速衰减起点 (km/h) */
  REGEN_KNEE_KMH_LOW: 4,
  /** 高速区再生能力下降起点 (km/h) */
  REGEN_FADE_START_KMH: 70,
  /** 常用制动中归因于电制动（再生）的能量份额，其余折算为摩擦/空压机制动 */
  ELEC_BRAKE_SHARE_SB: 0.88,
  /** 快速/紧急制动仍以空气制动为主，电制动仅占小份额 */
  ELEC_BRAKE_SHARE_RAPID: 0.14,
  /** 电流指令一阶滤波 (s)，略快于机械制动建压 */
  MOTOR_CURRENT_TAU_S: 0.1,
};
