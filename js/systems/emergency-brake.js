import { startAlarm, stopAlarm, playEbAnnouncement, stopEbAnnouncement } from "../audio/sfx-core.js";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import { disengageAto } from "./ato-readiness.js?v=line19-realism-2";

export function triggerEB(reason) {
  if (train.ebActive) return;
  train.ebActive = true;
  disengageAto();
  train.ebReason = reason;
  showMsg(`紧急制动！${reason}`, "alarm");
  tcmsLog(`EB 触发: ${reason}`, "err");
  startAlarm();
  playEbAnnouncement();
}

export function releaseEB() {
  if (!train.zeroSpeed) {
    showMsg("EB 缓解需先停稳", "alarm");
    return;
  }
  if (Math.abs(train.lever) > 0.05) {
    showMsg("EB 缓解：请先将手柄归零", "alarm");
    return;
  }
  train.ebActive = false;
  train.ebReason = "";
  showMsg("EB 已缓解", "ok");
  tcmsLog("EB 缓解", "ok");
  stopAlarm();
  stopEbAnnouncement();
}
