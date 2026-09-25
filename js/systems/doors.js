import { beep } from "../audio/sfx-core.js";
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import { announceDoors } from "../audio/pa-announcer.js";

export function clearDoorAtpAllows() {
  train.doorAtpLeft = false;
  train.doorAtpRight = false;
}

function syncDoorAggregateState() {
  const L = train.doorLeftOpen;
  const R = train.doorRightOpen;
  train.doorClosed = !L && !R;
  if (L && R) train.doorOpenSide = "both";
  else if (L) train.doorOpenSide = "left";
  else if (R) train.doorOpenSide = "right";
  else train.doorOpenSide = "none";
}

/** HMI 20 区「站台门未关闭」：开门中，或车门已关但 PSD 尚在关闭锁紧窗口内 */
export function platformScreenDoorsOpenForDmi() {
  return !train.doorClosed || Date.now() < train.psdAllClosedLockedNotBefore;
}

/** 该侧是否具备开门允许：仅人工「车门允许（两侧）」或 ATP 已释放该侧（含各模式停准站台后） */
export function doorSideEnabled(side) {
  if (train.doorManualBoth) return true;
  if (side === "left") return train.doorAtpLeft;
  return train.doorAtpRight;
}

export function openDoor(side) {
  if (!train.zeroSpeed) {
    showMsg("非零速，不能开门", "alarm");
    return;
  }
  if (!doorSideEnabled(side)) {
    train.doorIllegalOpenIndicateUntil = Date.now() + CONST.DMI_DOOR_ILLEGAL_INDICATE_MS;
    showMsg(
      "非法打开：该侧无门允许。须本站停准后由 ATP 释放站台侧，或按「车门允许」人工授权两侧",
      "alarm",
    );
    tcmsLog(`非法开门尝试（无门允许） ${side}`, "alarm");
    return;
  }
  train.doorIllegalOpenIndicateUntil = 0;
  const wasAllClosed = !train.doorLeftOpen && !train.doorRightOpen;
  if (side === "left") train.doorLeftOpen = true;
  else train.doorRightOpen = true;
  syncDoorAggregateState();
  train.psdAllClosedLockedNotBefore = 0;
  if (wasAllClosed) train.doorOpenedAtMs = Date.now();
  showMsg(`${side === "left" ? "左" : "右"}侧车门已开`, "ok");
  tcmsLog(`开门 ${side}`, "info");
  beep(440, 0.2);
  /** 到站开门广播：停站作业中首次开门后 5 s 播报本站（区间号 = nextStationIdx） */
  if (train.dwelling && wasAllClosed) {
    const seg = train.nextStationIdx;
    setTimeout(() => announceDoors(seg), 5000);
  }
}

/** 关闭指定侧；两侧均关后触发 PSD 锁闭计时（与全关一致） */
export function closeDoorSide(side) {
  const left = side === "left";
  if (left && !train.doorLeftOpen) {
    showMsg("左侧车门未开启", "alarm");
    return;
  }
  if (!left && !train.doorRightOpen) {
    showMsg("右侧车门未开启", "alarm");
    return;
  }
  if (left) train.doorLeftOpen = false;
  else train.doorRightOpen = false;
  syncDoorAggregateState();
  if (train.doorClosed) {
    train.doorOpenedAtMs = 0;
    train.psdAllClosedLockedNotBefore = Date.now() + CONST.PSD_PLATFORM_CLOSE_MS;
    showMsg("车门关闭", "ok");
    tcmsLog("关门（全列）", "info");
  } else {
    showMsg(`${left ? "左" : "右"}侧车门已关`, "ok");
    tcmsLog(`关门 ${side}`, "info");
  }
  beep(660, 0.1);
  setTimeout(() => beep(440, 0.1), 120);
}

/** 一次关闭两侧（A/A 自动关门等） */
export function closeDoor() {
  train.doorLeftOpen = false;
  train.doorRightOpen = false;
  syncDoorAggregateState();
  train.doorOpenedAtMs = 0;
  train.psdAllClosedLockedNotBefore = Date.now() + CONST.PSD_PLATFORM_CLOSE_MS;
  showMsg("车门关闭", "ok");
  tcmsLog("关门", "info");
  beep(660, 0.1);
  setTimeout(() => beep(440, 0.1), 120);
}
