import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../ats-occ/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../ats-occ/occ.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../ats-occ/occ.js", import.meta.url), "utf8");

test("ATS uses every Appendix B recommended color", () => {
  for (const rgb of [
    "rgb(255,255,0)", "rgb(51,255,0)", "rgb(255,0,0)",
    "rgb(255,255,255)", "rgb(33,150,243)", "rgb(224,64,251)",
    "rgb(128,64,64)", "rgb(24,225,255)", "rgb(117,117,117)",
  ]) assert.match(css, new RegExp(rgb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("ATS station field contains Appendix B element layers", () => {
  for (const id of ["trackSegments", "turnouts", "stations", "signals", "trainLayer"])
    assert.match(html, new RegExp(`id="${id}"`));

  assert.match(js, /renderCrossover/);
  assert.match(js, /platform-door/);
  assert.match(js, /class: "train-mode AM"/);
  assert.match(js, /class: "train-arrow"/);
});

test("full-line fit uses the rendered SVG scale directly", () => {
  assert.doesNotMatch(js, /DISPLAY_SCALE/);
  assert.match(js, /BASE_WIDTH \* zoom/);
  assert.match(js, /viewport\.clientHeight/);
});
