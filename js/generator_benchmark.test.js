const assert = require("node:assert/strict");
const { summarizeCollisions, summarizeTileComposition } = require("./generator_benchmark");

const report = summarizeCollisions([
  { seed: 10, board: [[2]] },
  { seed: 11, board: [[4]] },
  { seed: 12, board: [[2]] }
]);

assert.equal(report.uniqueBoards, 2);
assert.equal(report.collidingSeeds, 2);
assert.deepEqual(report.groups, [{ board: [[2]], seeds: [10, 12], size: 2 }]);

const composition = summarizeTileComposition([
  [[2, 4], [0, 2]],
  [[4, 4], [0, 0]]
]);

assert.deepEqual(composition.valueCounts, { 2: 2, 4: 3 });
assert.deepEqual(composition.compositions, [
  { tiles: { 2: 2, 4: 1 }, count: 1 },
  { tiles: { 4: 2 }, count: 1 }
]);

console.log("Generator benchmark test passed.");
