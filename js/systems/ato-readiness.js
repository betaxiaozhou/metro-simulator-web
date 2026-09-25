/**
 * ATO 发车允许与 A/A 自动发车（运营规范 §4.1.10 站台发车条件）：
 * 车门「关闭且锁闭」、站台门「关闭且锁闭」（含回读延时）、出站信号开放（前方具备移动授权空间）、
 * 未扣车、非站停作业、无紧急制动、列车停稳、FAM/AM 授权且手柄零位。
 */
import { showMsg, tcmsLog } from "../ui/messages.js";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import { STATIONS } from "./route-model.js?v=line19-realism-2";
import { calcTargetInfo } from "./signaling-atp.js?v=line19-realism-2";
import { platformScreenDoorsOpenForDmi } from "./doors.js?v=line19-realism-2";
import { resetAtoAlignState } from "./ato-controller.js?v=line19-realism-2";

/** 列车停稳（与零速检测略留裕量，避免抖动） */
function approxStopped() {
  return train.zeroSpeed && Math.abs(train.vel) < 0.09;
}

export function disengageAto() {
  train.atoRunning = false;
  train.atoReady = false;
  /** 人工接管即清除对标调整状态（含超次报警闭锁），由人工处置后重新对标 */
  resetAtoAlignState();
}

/** 人工按 ATO 与「允许启动」灯、A/A 自动发车的共同条件 */
export function atoStartPreconditionsMet() {
  if (!train.keyOn) return false;
  if (!train.atpActive) return false;
  if (train.mode !== "AM" && train.mode !== "FAM") return false;
  if (train.direction !== "F") return false;
  if (Math.abs(train.lever) > 0.05) return false;
  /** 车门关闭且锁闭 */
  if (!train.doorClosed) return false;
  /** 站台门关闭且锁闭（含 PSD 关闭锁紧回读延时） */
  if (platformScreenDoorsOpenForDmi()) return false;
  if (train.ebActive) return false;
  /** 扣车：保持站台停车，不允许发车 */
  if (train.holdAtStation) return false;
  if (train.dwelling) return false;
  if (!approxStopped()) return false;
  const ns = STATIONS[train.nextStationIdx];
  if (!ns) return false;
  /** 出站信号开放（示意）：至下一限制性目标须保留移动授权空间，表示前方非闭锁 */
  const { dist } = calcTargetInfo();
  if (dist <= 8) return false;
  return true;
}

/** 仅 A/A：满足条件时自动投入 ATO（每帧可调用，内部幂等） */
export function tryAutoStartAtoAa() {
  if (train.doorMode !== "AA") return;
  if (train.atoRunning) return;
  if (!atoStartPreconditionsMet()) return;
  train.atoReady = true;
  train.atoRunning = true;
  showMsg("ATO 自动启动（站台发车条件满足）", "ok");
  tcmsLog("ATO 自动启动 (A/A)", "ok");
}
