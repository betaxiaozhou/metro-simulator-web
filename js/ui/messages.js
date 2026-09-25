import { $ } from "../lib/dom.js";

export let lastMmiMsg = "系统就绪";
/** 与两端 MMI 告警条样式同步（由 render-mmi 每帧刷 class） */
export let lastMmiMsgLevel = "info";

let logCount = 0;

/** Tc1/Tc2 两端共享同一车载事件日志 */
const TCMS_DMI_IDS = ["mmi-tcms", "mmi-tcms2"];

export function tcmsLog(msg, type = "") {
  const payload = { type: "metro-tcms-log", message: msg, level: type || "info" };
  const targetOrigin = globalThis.location?.origin;
  for (const id of TCMS_DMI_IDS) {
    const fr = document.getElementById(id);
    if (fr?.contentWindow && targetOrigin) {
      try {
        fr.contentWindow.postMessage(payload, targetOrigin);
      } catch (e) {}
    }
  }

  const el = $("tcmsLog");
  if (!el) return;
  const d = el.ownerDocument.createElement("div");
  if (type) d.className = type;
  const t = new Date().toTimeString().slice(0, 8);
  d.textContent = `[${t}] ${msg}`;
  el.insertBefore(d, el.firstChild);
  if (++logCount > 50) el.removeChild(el.lastChild);
}

export function showMsg(msg, level = "info") {
  lastMmiMsg = msg;
  lastMmiMsgLevel = level;
  const el = $("mmiMsg");
  if (el) {
    el.textContent = msg;
    el.className = "mmi-msg " + (level === "alarm" ? "alarm" : level === "ok" ? "ok" : "");
  }
}
