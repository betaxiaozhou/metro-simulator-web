/**
 * 站台作业：停站计时、A/A 自动关门、扣车保持开门、对标停准后释放门允许。
 * 依据建设指南 §3.3.8（站台发车/扣车时车门与站台门重新打开）与运营规范 §4.1.10。
 */
import { CONST } from "../config/constants.js?v=line19-realism-2";
import { STATIONS } from "./route-model.js?v=line19-realism-2";
import { train } from "./vehicle-state.js?v=line19-realism-2";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { openDoor, closeDoor, clearDoorAtpAllows } from "./doors.js?v=line19-realism-2";
import { disengageAto } from "./ato-readiness.js?v=line19-realism-2";

export function handleStation() {
  if (!train.dwelling) return;
  train.dwellTimer += CONST.G_DT;

  if (!train.doorClosed) train.dwellHadDoorOpenDuringStop = true;

  const autoModes = train.mode === "AM" || train.mode === "FAM";

  /**
   * 扣车（建设指南 §3.3.8）：停站期间设置扣车时，已关闭的车门重新打开并保持，
   * 扣车取消后由停站计时自动关门发车。
   */
  if (
    autoModes &&
    train.holdAtStation &&
    train.doorClosed &&
    train.dwellHadDoorOpenDuringStop &&
    train.doorMode !== "MM"
  ) {
    const stn = STATIONS[train.nextStationIdx];
    if (stn) {
      openDoor(stn.platform);
      showMsg("扣车：车门与站台门重新打开并保持", "alarm");
      tcmsLog("扣车设置 → 重新联动开门", "info");
    }
  }

  /** A/A 停站计时到点自动关门；扣车期间保持开门不关闭 */
  if (
    train.dwellTimer > CONST.STATION_AA_AUTOCLOSE_DWELL_S &&
    autoModes &&
    !train.holdAtStation
  ) {
    if (train.doorMode === "AA" && train.doorOpenSide !== "none") closeDoor();
  }

  if (
    train.dwelling &&
    train.doorClosed &&
    train.dwellHadDoorOpenDuringStop &&
    !train.holdAtStation &&
    autoModes
  ) {
    train.dwelling = false;
    train.nextStationIdx++;
    clearDoorAtpAllows();
    if (train.nextStationIdx < STATIONS.length) {
      tcmsLog(`下一站 ${STATIONS[train.nextStationIdx].name}`, "info");
    } else {
      /** 终点站：乘降完毕后 ATO 退出并保持，不再自动发车 */
      disengageAto();
      showMsg("已抵达终点站，本次运营结束，ATO 退出", "ok");
      tcmsLog("终点站乘降完毕：ATO 退出，列车保持", "ok");
    }
    return;
  }

  if (train.dwelling && train.doorClosed && (train.mode === "CM" || train.mode === "RM")) {
    train.dwelling = false;
    clearDoorAtpAllows();
  }
}

export function tryReleaseDoorAllowAligned(nextStn) {
  if (!nextStn || !train.dwelling || train.autoDoorReleased) return;
  if (
    train.mode !== "AM" &&
    train.mode !== "FAM" &&
    train.mode !== "CM" &&
    train.mode !== "RM"
  )
    return;
  if (!train.zeroSpeed) return;
  if (Math.abs(nextStn.pos - train.pos) > CONST.STOP_TOLERANCE) return;
  train.autoDoorReleased = true;
  train.doorAtpLeft = nextStn.platform === "left";
  train.doorAtpRight = nextStn.platform === "right";
  const platZh = nextStn.platform === "left" ? "左" : "右";
  const e = train.pos - nextStn.pos;
  const errStrMag = Math.abs(e) < 1.2 ? `${(e * 100).toFixed(1)} cm` : `${e.toFixed(3)} m`;
  if (train.doorMode === "MM") {
    showMsg(`对标停准（误差 ${errStrMag}），ATP ${platZh}侧站台门允许 · M/M 请开该侧车门`, "ok");
    tcmsLog(`停准：ATP ${platZh}侧门允许 · ${errStrMag} · M/M 手动开门`, "ok");
    return;
  }
  showMsg(`对标停准（误差 ${errStrMag}），ATP ${platZh}侧站台门允许`, "ok");
  tcmsLog(`停准：ATP ${platZh}侧门允许 · 误差 ${errStrMag}`, "ok");
  if (train.mode === "AM" || train.mode === "FAM") {
    setTimeout(() => {
      if (train.doorMode !== "MM") openDoor(nextStn.platform);
    }, 500);
  }
}
