import test from "node:test";
import assert from "node:assert/strict";

import {
  LINE_META,
  STATION_DATA,
  SPEED_ZONE_DATA,
  GRADIENT_ZONE_DATA,
  CURVE_ZONE_DATA,
  SIGNAL_DATA,
  BALISE_DATA,
} from "../js/data/line19.js";
import { getRouteConditions } from "../js/systems/route-model.js";

test("Line 19 keeps project and operating conventions distinct", () => {
  assert.equal(LINE_META.projectLengthM, 22400);
  assert.equal(LINE_META.operatingLengthM, 20900);
  assert.equal(LINE_META.vehicleDesignSpeedKmh, 120);
  assert.equal(LINE_META.operatingMaxSpeedKmh, 100);
  for (const item of Object.values(LINE_META.provenance)) {
    assert.equal(item.confidence, "official");
    assert.match(item.source, /^https:\/\//);
  }
});

test("station order and supplied stopping-point distances remain exact", () => {
  assert.equal(STATION_DATA.length, 10);
  assert.equal(STATION_DATA[0].name, "牡丹园");
  assert.equal(STATION_DATA[0].pos, 0);
  assert.equal(STATION_DATA.at(-1).name, "新宫");
  assert.equal(STATION_DATA.at(-1).pos, 20840);
  const distances = STATION_DATA.slice(1).map((station, index) =>
    station.pos - STATION_DATA[index].pos);
  assert.deepEqual(distances, [920, 2450, 1590, 2710, 2140, 2960, 2680, 2650, 2740]);
  assert.equal(distances.reduce((sum, value) => sum + value, 0), 20840);
});

test("all estimated infrastructure data is explicit and attributed", () => {
  for (const station of STATION_DATA) {
    assert.equal(station.provenance.platform.confidence, "estimated");
    assert.equal(station.provenance.platformLengthM.confidence, "estimated");
  }
  for (const item of [
    ...SPEED_ZONE_DATA,
    ...GRADIENT_ZONE_DATA,
    ...CURVE_ZONE_DATA,
    ...SIGNAL_DATA,
    ...BALISE_DATA,
  ]) {
    assert.equal(item.confidence, "estimated");
    assert.ok(item.source);
  }
});

test("speed zones cover the operating coordinate without gaps or overlap", () => {
  assert.equal(SPEED_ZONE_DATA[0].start, 0);
  assert.equal(SPEED_ZONE_DATA.at(-1).end, LINE_META.operatingLengthM);
  SPEED_ZONE_DATA.forEach((zone, index) => {
    assert.ok(zone.start < zone.end);
    assert.ok(zone.runKmh <= LINE_META.operatingMaxSpeedKmh);
    if (index > 0) assert.equal(zone.start, SPEED_ZONE_DATA[index - 1].end);
  });
  assert.equal(getRouteConditions(500).runKmh, 100);
  assert.equal(getRouteConditions(20850).runKmh, 40);
});
