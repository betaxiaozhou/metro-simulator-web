import { $ } from "../lib/dom.js";

export function syncLeverHandlePos(lever) {
  const range = 2.2;
  const t = (1 - lever) / range;
  for (const id of ["leverHandle", "leverHandleTc2"]) {
    const h = $(id);
    if (h) h.style.top = t * 100 + "%";
  }
}
