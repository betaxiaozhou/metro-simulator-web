import test from "node:test";
import assert from "node:assert/strict";

test("FAM completes Mudanyuan to Xingong without an uncommanded EB", async (t) => {
  const savedDocument = globalThis.document;
  const savedSetTimeout = globalThis.setTimeout;
  globalThis.document = { getElementById: () => null };
  globalThis.setTimeout = () => 0;

  try {
    const [{ CONST }, { STATIONS }, { train }, { physicsTick }] = await Promise.all([
      import("../js/config/constants.js?v=line19-realism-2"),
      import("../js/systems/route-model.js?v=line19-realism-2"),
      import("../js/systems/vehicle-state.js?v=line19-realism-2"),
      import("../js/systems/physics-engine.js?v=line19-realism-2"),
    ]);

    Object.assign(train, {
      pos: STATIONS[0].pos,
      vel: 0,
      acc: 0,
      lever: 0,
      direction: "F",
      keyOn: true,
      mode: "FAM",
      atpActive: true,
      atoReady: true,
      atoRunning: true,
      atpSbActive: false,
      ebActive: false,
      ebReason: "",
      doorClosed: true,
      doorLeftOpen: false,
      doorRightOpen: false,
      zeroSpeed: true,
      nextStationIdx: 1,
      dwelling: false,
      passengerLoadRatio: CONST.DEFAULT_PASSENGER_LOAD_RATIO,
      _cmdAccLag: 0,
      _atoAccPrev: 0,
      atoJogAttempts: 0,
      atoJogActive: false,
      atoJogExhausted: false,
      atoOverrunPending: false,
      skipStation: false,
      holdAtStation: false,
      doorMode: "AA",
    });

    let simulatedSeconds = 0;
    const stops = [];
    const maxTicks = 30 * 60 * 40;

    for (let tick = 0; tick < maxTicks && train.nextStationIdx < STATIONS.length; tick++) {
      physicsTick(CONST.G_DT);
      simulatedSeconds += CONST.G_DT;
      assert.equal(train.ebActive, false, train.ebReason || `unexpected EB at ${train.pos.toFixed(1)} m`);

      if (train.dwelling) {
        const station = STATIONS[train.nextStationIdx];
        stops.push({ name: station.name, errorM: train.pos - station.pos });
        simulatedSeconds += CONST.STATION_AA_AUTOCLOSE_DWELL_S;
        train.dwelling = false;
        train.nextStationIdx += 1;
        train.atoReady = true;
        train.atoRunning = train.nextStationIdx < STATIONS.length;
        train.autoDoorReleased = false;
        train.doorAtpLeft = false;
        train.doorAtpRight = false;
        train._cmdAccLag = 0;
        train._atoAccPrev = 0;
        train.atoJogAttempts = 0;
        train.atoJogActive = false;
      }
    }

    assert.equal(train.nextStationIdx, STATIONS.length, "FAM did not reach Xingong");
    assert.equal(stops.length, STATIONS.length - 1);
    for (const stop of stops) {
      assert.ok(Math.abs(stop.errorM) <= CONST.STOP_TOLERANCE,
        `${stop.name} stop error ${(stop.errorM * 100).toFixed(1)} cm`);
    }
    assert.ok(simulatedSeconds >= 27 * 60 && simulatedSeconds <= 33 * 60,
      `full run ${(simulatedSeconds / 60).toFixed(2)} min is outside 27–33 min`);
    t.diagnostic(`full run ${(simulatedSeconds / 60).toFixed(2)} min; max stop error ${Math.max(...stops.map((stop) => Math.abs(stop.errorM) * 100)).toFixed(1)} cm`);
  } finally {
    globalThis.document = savedDocument;
    globalThis.setTimeout = savedSetTimeout;
  }
});
