import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vobc = readFileSync(new URL("../vobc-dmi/index.html", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../js/ui/dmi-bridge.js", import.meta.url), "utf8");

test("VOBC accepts control messages only from its same-origin parent", () => {
  assert.match(vobc, /e\.origin\s*!==\s*window\.location\.origin/);
  assert.match(vobc, /e\.source\s*!==\s*window\.parent/);
});

test("Zone 25 message text never reaches an HTML parser", () => {
  assert.match(vobc, /getElementById\('z25-html'\)\.textContent\s*=\s*z25/);
  assert.doesNotMatch(vobc, /getElementById\('z25-html'\)\.innerHTML\s*=\s*z25/);
});

test("the parent sends raw text to an exact web origin", () => {
  assert.match(bridge, /"c-z25":\s*String\(lastMmiMsg\)/);
  assert.match(bridge, /const targetOrigin\s*=\s*window\.location\.origin/);
  assert.doesNotMatch(bridge, /postMessage\([\s\S]{0,120},\s*"\*"/);
});
