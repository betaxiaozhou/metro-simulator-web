import test from "node:test";
import assert from "node:assert/strict";

import { train } from "../js/systems/vehicle-state.js?v=line19-realism-2";
import {
  calcATPLimit,
  calcEBILimit,
  calcFsbTriggerKmh,
  getZoneLimit,
  modeMaxKmh,
  zoneSupervisedKmh,
} from "../js/systems/signaling-atp.js?v=line19-realism-2";

test("RM remains 25 km/h and all other modes remain under the operating cap", () => {
  const savedMode = train.mode;
  train.mode = "RM";
  assert.equal(modeMaxKmh(), 25);
  train.mode = "FAM";
  assert.equal(modeMaxKmh(), 100);
  assert.ok(getZoneLimit(500) <= 100);
  assert.ok(calcATPLimit(500) <= 100);
  assert.ok(calcFsbTriggerKmh(500) <= 100);
  assert.ok(calcEBILimit(500) <= 100);
  train.mode = savedMode;
});

test("ATP supervision values never exceed the editable absolute limit", () => {
  const saved = { mode: train.mode, nextStationIdx: train.nextStationIdx, doorClosed: train.doorClosed };
  train.mode = "FAM";
  train.nextStationIdx = 1;
  train.doorClosed = true;
  for (const p of [0, 200, 500, 700, 900]) {
    const absolute = zoneSupervisedKmh(p);
    assert.ok(calcATPLimit(p) <= absolute);
    assert.ok(calcFsbTriggerKmh(p) <= absolute);
    assert.ok(calcEBILimit(p) <= absolute);
  }
  Object.assign(train, saved);
});

test("open doors reduce the EBI baseline to zero", () => {
  const saved = train.doorClosed;
  train.doorClosed = false;
  assert.equal(calcEBILimit(500), 0);
  train.doorClosed = saved;
});
