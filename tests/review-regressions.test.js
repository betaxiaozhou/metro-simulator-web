import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyZoneTable,
  getSupervisedZoneTable,
  resetSupervisedLimits,
} from "../js/systems/supervised-limits.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../js/main.js", import.meta.url), "utf8");
const editor = readFileSync(new URL("../js/ui/supervised-limit-editor.js", import.meta.url), "utf8");
const tcms = readFileSync(new URL("../tcms-dmi/index.html", import.meta.url), "utf8");
const messages = readFileSync(new URL("../js/ui/messages.js", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../js/ui/render-dashboard.js", import.meta.url), "utf8");

test("rejected zone-table edits leave the live table unchanged", () => {
  resetSupervisedLimits();
  const before = structuredClone(getSupervisedZoneTable());
  const edits = structuredClone(before);
  edits[0].end = edits[1].start + 1;

  assert.equal(applyZoneTable(edits).ok, false);
  assert.deepEqual(getSupervisedZoneTable(), before);
  assert.doesNotMatch(editor, /setZone(?:Start|End)|setSupervisedKmh/);
});

test("TCMS messages use and require the same-origin parent", () => {
  assert.match(tcms, /event\.origin\s*!==\s*window\.location\.origin/);
  assert.match(tcms, /event\.source\s*!==\s*window\.parent/);
  assert.match(messages, /const targetOrigin\s*=\s*globalThis\.location\?\.origin/);
  assert.match(dashboard, /const targetOrigin\s*=\s*window\.location\.origin/);
  assert.doesNotMatch(messages, /postMessage\(payload,\s*"\*"/);
  assert.doesNotMatch(dashboard, /},\s*"\*"\)/);
});

test("both cabs expose and bind every auxiliary control", () => {
  for (const id of ["btnHeadlight", "btnCabinLight", "btnSalonLight", "btnAC", "btnWiperL", "btnWiperH"]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, new RegExp(`id="${id}Tc2"`));
  }
  for (const id of ["btnHeadlight", "btnCabinLight", "btnSalonLight", "btnAC"]) {
    assert.match(main, new RegExp(`bindToggle\\("${id}"`));
  }
  assert.match(main, /bindCabControl\("btnWiperL"/);
  assert.match(main, /bindCabControl\("btnWiperH"/);
});

test("the intentionally hidden OCC entry is not overridden by its flex style", () => {
  assert.match(html, /class="occ-entry"[^>]*hidden/);
  assert.match(css, /\.occ-entry\[hidden\]\s*\{\s*display:\s*none/);
});
