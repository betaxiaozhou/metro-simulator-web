/** 页面底部：列车运行最高限制速度（绝对上限）区段编辑器 */
import { $ } from "../lib/dom.js";
import { LINE_META, ROUTE_LEN } from "../systems/route-model.js?v=line19-realism-2";
import {
  getSupervisedZoneTable,
  resetSupervisedLimits,
  applyZoneTable,
} from "../systems/supervised-limits.js?v=line19-realism-2";
import { refreshTrackCharts } from "./track-view.js?v=line19-realism-2";
import { showMsg, tcmsLog } from "./messages.js";

function renderTable() {
  const body = $("supervisedLimitBody");
  if (!body) return;
  body.innerHTML = getSupervisedZoneTable()
    .map(
      (z, i) => `
    <tr>
      <td>
        <input type="number" class="supervised-bound-input" data-idx="${i}" data-field="start"
          min="0" max="${ROUTE_LEN}" step="1" value="${z.start}"/>
      </td>
      <td>
        <input type="number" class="supervised-bound-input" data-idx="${i}" data-field="end"
          min="0" max="${ROUTE_LEN}" step="1" value="${z.end}"/>
      </td>
      <td>${z.runKmh}</td>
      <td>
        <input type="number" class="supervised-limit-input" data-idx="${i}" data-field="supervised"
          min="${z.runKmh}" max="${LINE_META.operatingMaxSpeedKmh}" step="1" value="${z.supervisedKmh}"/>
      </td>
    </tr>`,
    )
    .join("");
}

function readRowsFromInputs() {
  const rows = [];
  document.querySelectorAll("#supervisedLimitBody tr").forEach((tr) => {
    rows.push({
      start: Number(tr.querySelector('[data-field="start"]')?.value),
      end: Number(tr.querySelector('[data-field="end"]')?.value),
      supervisedKmh: Number(tr.querySelector('[data-field="supervised"]')?.value),
    });
  });
  return rows;
}

function applyFromInputs() {
  const result = applyZoneTable(readRowsFromInputs());
  if (!result.ok) {
    showMsg(result.msg, "alarm");
    renderTable();
    return false;
  }
  renderTable();
  refreshTrackCharts();
  return true;
}

export function initSupervisedLimitEditor() {
  renderTable();

  $("btnSupervisedApply")?.addEventListener("click", () => {
    if (!applyFromInputs()) return;
    showMsg("区段范围与列车运行最高限制速度已更新", "ok");
    tcmsLog("已应用各区段起点/终点与最高限制速度", "info");
  });

  $("btnSupervisedReset")?.addEventListener("click", () => {
    resetSupervisedLimits();
    renderTable();
    refreshTrackCharts();
    showMsg("区段与列车运行最高限制速度已恢复默认", "ok");
    tcmsLog("区段与最高限制速度恢复默认", "info");
  });

}

export function resetSupervisedLimitEditorUI() {
  resetSupervisedLimits();
  renderTable();
}
