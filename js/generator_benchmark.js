const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function summarizeCollisions(samples) {
  const byBoard = new Map();
  for (const sample of samples) {
    const key = JSON.stringify(sample.board);
    const entry = byBoard.get(key) || { board: sample.board, seeds: [] };
    entry.seeds.push(sample.seed);
    byBoard.set(key, entry);
  }
  const groups = Array.from(byBoard.values())
    .filter(entry => entry.seeds.length > 1)
    .map(entry => ({ board: entry.board, seeds: entry.seeds, size: entry.seeds.length }))
    .sort((first, second) => second.size - first.size || first.seeds[0] - second.seeds[0]);
  return {
    uniqueBoards: byBoard.size,
    collidingSeeds: groups.reduce((count, group) => count + group.size, 0),
    duplicateResults: samples.length - byBoard.size,
    groups
  };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1);
  return values.slice().sort((first, second) => first - second)[index];
}

function loadGenerator() {
  const context = {
    console,
    document: { querySelector: () => null },
    window: {
      matchMedia: () => ({ matches: false }),
      setTimeout: callback => callback(),
      clearTimeout() {},
      navigator: {}
    }
  };
  vm.createContext(context);
  for (const filename of ["grid.js", "tile.js", "game_manager.js", "power_game_manager.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, filename), "utf8"), context);
  }
  const manager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
  manager.size = 4;
  return manager;
}

function parseArguments(args) {
  const options = { samples: 1000, seed: 0, mode: "classic", json: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--mode") {
      const value = args[++index];
      if (!["classic", "gravity", "push", "all"].includes(value)) {
        throw new Error("--mode requires classic, gravity, push, or all");
      }
      options.mode = value;
    } else if (argument === "--samples" || argument === "--seed") {
      const value = Number(args[++index]);
      if (!Number.isInteger(value) || value < 0 || (argument === "--samples" && value === 0)) {
        throw new Error(argument + " requires a positive integer");
      }
      options[argument.slice(2)] = value;
    } else {
      throw new Error("Unknown argument: " + argument);
    }
  }
  return options;
}

function countTiles(board) {
  return board.reduce((count, row) => count + row.filter(Boolean).length, 0);
}

function frequency(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function summarizeTileComposition(boards) {
  const valueCounts = {};
  const compositions = new Map();
  for (const board of boards) {
    const tiles = {};
    for (const value of board.flat()) {
      if (!value) continue;
      valueCounts[value] = (valueCounts[value] || 0) + 1;
      tiles[value] = (tiles[value] || 0) + 1;
    }
    const key = JSON.stringify(tiles);
    const composition = compositions.get(key) || { tiles, count: 0 };
    composition.count++;
    compositions.set(key, composition);
  }
  return {
    valueCounts,
    compositions: Array.from(compositions.values())
      .sort((first, second) => second.count - first.count ||
        JSON.stringify(first.tiles).localeCompare(JSON.stringify(second.tiles)))
  };
}

function analyzeGenerator(options) {
  const manager = loadGenerator();
  manager.mode = options.mode || "classic";
  const config = manager.constructor.generatorConfig;
  const samples = [], durations = [], moves = [], tileCounts = [], totals = [];
  let solverCalls = 0, rejectedResults = 0, invalidResults = 0;
  const shortestSolution = manager.shortestSolution;
  manager.shortestSolution = function (board) {
    solverCalls++;
    return shortestSolution.call(this, board);
  };

  const startedAt = performance.now();
  for (let index = 0; index < options.samples; index++) {
    const seed = (options.seed + index) >>> 0;
    const startedSampleAt = performance.now();
    const puzzle = manager.randomPuzzle(PowerSeed(manager.mode, seed));
    durations.push(performance.now() - startedSampleAt);
    if (!puzzle) {
      rejectedResults++;
      continue;
    }
    const tiles = countTiles(puzzle.board);
    const total = puzzle.board.flat().reduce((sum, value) => sum + value, 0);
    const hasFloatingTiles = manager.hasFloatingTiles(puzzle.board);
    if (puzzle.minimumMoves < config.minMoves || puzzle.minimumMoves > config.maxMoves ||
        tiles < config.minTiles || tiles > config.maxTiles || hasFloatingTiles) {
      invalidResults++;
    }
    samples.push({ seed, board: puzzle.board });
    moves.push(puzzle.minimumMoves);
    tileCounts.push(tiles);
    totals.push(total);
  }
  const elapsedMs = performance.now() - startedAt;
  const collisions = summarizeCollisions(samples);
  const tileComposition = summarizeTileComposition(samples.map(sample => sample.board));
  return {
    mode: manager.mode,
    samples: options.samples,
    seedRange: [options.seed, (options.seed + options.samples - 1) >>> 0],
    elapsedMs,
    millisecondsPerPuzzle: elapsedMs / options.samples,
    latencyMs: { p50: percentile(durations, 0.5), p95: percentile(durations, 0.95), max: Math.max(...durations) },
    solverCalls,
    solverCallsPerPuzzle: solverCalls / options.samples,
    rejectedResults,
    invalidResults,
    collisions,
    distributions: {
      minimumMoves: frequency(moves),
      tileCount: frequency(tileCounts),
      total: frequency(totals),
      tileValues: tileComposition.valueCounts
    },
    tileCompositions: tileComposition.compositions
  };
}

function PowerSeed(mode, seed) {
  return managerModePrefix(mode) + seed;
}

function managerModePrefix(mode) {
  return mode === "gravity" ? "g" : mode === "push" ? "p" : "c";
}

function formatReport(report) {
  if (Array.isArray(report)) return report.map(formatReport).join("\n\n");
  const milliseconds = value => value.toFixed(2);
  const lines = [
    "Generator benchmark (" + report.mode + ")",
    "Samples: " + report.samples + " (seeds " + report.seedRange[0] + ".." + report.seedRange[1] + ")",
    "Time: " + milliseconds(report.elapsedMs) + " ms total, " + milliseconds(report.millisecondsPerPuzzle) + " ms/puzzle",
    "Latency: p50 " + milliseconds(report.latencyMs.p50) + " ms, p95 " + milliseconds(report.latencyMs.p95) + " ms, max " + milliseconds(report.latencyMs.max) + " ms",
    "Solver calls: " + report.solverCalls + " (" + report.solverCallsPerPuzzle.toFixed(2) + "/puzzle)",
    "Rejected results: " + report.rejectedResults,
    "Invalid results: " + report.invalidResults,
    "Unique boards: " + report.collisions.uniqueBoards + "/" + report.samples,
    "Collision groups: " + report.collisions.groups.length + ", seeds in groups: " + report.collisions.collidingSeeds + ", duplicate results: " + report.collisions.duplicateResults,
    "Solution minimum moves: " + JSON.stringify(report.distributions.minimumMoves),
    "Tile count: " + JSON.stringify(report.distributions.tileCount),
    "Total: " + JSON.stringify(report.distributions.total),
    "Tile values: " + JSON.stringify(report.distributions.tileValues)
  ];
  for (const group of report.collisions.groups.slice(0, 10)) {
    lines.push("Collision (" + group.size + "): seeds " + group.seeds.join(", ") +
      "; board " + JSON.stringify(group.board));
  }
  if (report.collisions.groups.length > 10) lines.push("Collision groups omitted: " + (report.collisions.groups.length - 10));
  for (const composition of report.tileCompositions.slice(0, 10)) {
    lines.push("Tile composition (" + composition.count + "): " + JSON.stringify(composition.tiles));
  }
  if (report.tileCompositions.length > 10) lines.push("Tile compositions omitted: " + (report.tileCompositions.length - 10));
  return lines.join("\n");
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report = options.mode === "all"
      ? ["classic", "gravity", "push"].map(mode => analyzeGenerator({ ...options, mode }))
      : analyzeGenerator(options);
    console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  analyzeGenerator,
  loadGenerator,
  managerModePrefix,
  parseArguments,
  summarizeCollisions,
  summarizeTileComposition
};
