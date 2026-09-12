import test from "node:test";
import assert from "node:assert/strict";

import { CONST } from "../js/config/constants.js";
import {
  curveResistanceAcceleration,
  dynamicMassKg,
  effectiveBrakeDecel,
  gradientAcceleration,
  maxTractionAcceleration,
  regenerativeBrakeShare,
} from "../js/systems/vehicle-dynamics.js";

test("8A mass and load affect traction and braking", () => {
  assert.equal(dynamicMassKg(0), CONST.EMPTY_MASS_KG);
  assert.equal(dynamicMassKg(1), CONST.EMPTY_MASS_KG + CONST.MAX_PASSENGER_MASS_KG);
  assert.ok(maxTractionAcceleration(20, 1) < maxTractionAcceleration(20, 0));
  assert.ok(effectiveBrakeDecel(1.1, 1) < effectiveBrakeDecel(1.1, 0));
});

test("traction is constant to 40 km/h then fades to the 120 km/h cutoff", () => {
  const at20 = maxTractionAcceleration(20, CONST.DEFAULT_PASSENGER_LOAD_RATIO);
  const at40 = maxTractionAcceleration(40, CONST.DEFAULT_PASSENGER_LOAD_RATIO);
  const at80 = maxTractionAcceleration(80, CONST.DEFAULT_PASSENGER_LOAD_RATIO);
  assert.equal(at20, at40);
  assert.ok(Math.abs(at80 - at40 / 2) < 1e-9);
  assert.equal(maxTractionAcceleration(120, 0), 0);
});

test("grade and curve resistance have physical direction", () => {
  assert.ok(gradientAcceleration(20) < 0);
  assert.ok(gradientAcceleration(-20) > 0);
  assert.ok(curveResistanceAcceleration(300, 10) < 0);
  assert.ok(curveResistanceAcceleration(300, -10) > 0);
  assert.equal(curveResistanceAcceleration(Infinity, 10), 0);
});

test("regenerative braking fades near zero and remains smaller in rapid braking", () => {
  assert.equal(regenerativeBrakeShare(0), 0);
  assert.ok(regenerativeBrakeShare(2) < regenerativeBrakeShare(20));
  assert.ok(regenerativeBrakeShare(20, true) < regenerativeBrakeShare(20, false));
});

