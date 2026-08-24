const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const css = fs.readFileSync(__dirname + "/../style/main.css", "utf8");
const powerCss = fs.readFileSync(__dirname + "/../style/power.css", "utf8");
const index = fs.readFileSync(__dirname + "/../index.html", "utf8");
const classicApplication = fs.readFileSync(__dirname + "/application.js", "utf8");
const powerPagePath = __dirname + "/../power.html";
assert.ok(fs.existsSync(powerPagePath), "power.html should exist");
const powerPage = fs.readFileSync(powerPagePath, "utf8");
assert.match(powerCss, /\.power-page \.tile-container \{[^}]*width: 470px;[^}]*height: 470px;/s);
assert.match(powerCss, /\.power-mode \.tile-value \{[^}]*transition: transform 450ms/s);
assert.match(powerCss, /\.power-page \.above-game \{[^}]*gap: 5px;/s);
assert.match(powerCss, /\.power-page \.random-menu \{[^}]*z-index: 200;/s);
assert.match(powerCss, /\.power-page \.mode-label \{[^}]*position: absolute;[^}]*top: 43px;/s);
assert.match(powerCss, /\.seed-input \{[^}]*height: 40px;/s);
assert.match(powerCss, /\.seed-input \{[^}]*field-sizing: content;/s);
assert.match(powerCss, /\.game-container\.soft-stalemate/);
assert.match(
  fs.readFileSync(__dirname + "/html_actuator.js", "utf8"),
  /classList\.add\("tile-value"\)/
);
assert.match(fs.readFileSync(__dirname + "/keyboard_input_manager.js", "utf8"), /bindButtonPress\("\.reset-button", this\.restart\)/);
assert.match(fs.readFileSync(__dirname + "/keyboard_input_manager.js", "utf8"), /bindButtonPress\("\.restart-button", this\.restart\)/);
assert.match(fs.readFileSync(__dirname + "/keyboard_input_manager.js", "utf8"), /event\.which === 13/);
assert.match(fs.readFileSync(__dirname + "/keyboard_input_manager.js", "utf8"), /event\.which === 8/);
const inputContext = { document: { querySelector: () => null } };
vm.createContext(inputContext);
vm.runInContext(fs.readFileSync(__dirname + "/keyboard_input_manager.js", "utf8"), inputContext);
const inputManager = vm.runInContext("Object.create(KeyboardInputManager.prototype)", inputContext);
inputManager.eventTouchend = "touchend";
assert.doesNotThrow(() => inputManager.bindButtonPress(".missing-button", function () {}));
assert.match(fs.readFileSync(__dirname + "/power_game_manager.js", "utf8"), /addEventListener\("mouseenter"/);
assert.match(fs.readFileSync(__dirname + "/power_game_manager.js", "utf8"), /event\.ctrlKey/);
assert.match(fs.readFileSync(__dirname + "/power_game_manager.js", "utf8"), /minimumMoves: this\.minimumMoves,\s*mode: "power",\s*over:/);
assert.match(index, /<title>2048<\/title>/);
assert.match(classicApplication, /new GameManager\(4, KeyboardInputManager, HTMLActuator, LocalStorageManager\)/);
assert.doesNotMatch(index, /power_game_manager\.js/);
assert.match(powerPage, /<title>Power — 2048 puzzle<\/title>/);
assert.match(powerPage, /style\/power\.css/);
assert.match(powerPage, /<span class="random-menu">[\s\S]*<span class="mode-label"/);
assert.doesNotMatch(index, /style\/power\.css/);
assert.match(powerPage, /power_application\.js/);
assert.match(powerPage, /No new tiles appear\. Solve the puzzle by merging every tile into one\./);
assert.match(powerPage, /In Super Gravity: equal tiles merge in parallel with cascades;/);
assert.match(powerPage, /in Push to Merge: choose a stack with/);
assert.match(powerPage, /data-mode="gravity"/);
assert.match(powerPage, /data-mode="push"/);
assert.doesNotMatch(powerPage, /stack-controls/);
assert.doesNotMatch(powerCss, /random-menu:hover \.mode-menu/);
assert.match(powerCss, /random-menu\.open \.mode-menu/);
assert.match(fs.readFileSync(__dirname + "/power_application.js", "utf8"), /PowerStorageManager/);
assert.match(fs.readFileSync(__dirname + "/power_application.js", "utf8"), /powerGameState/);
assert.match(
  fs.readFileSync(__dirname + "/power_application.js", "utf8"),
  /PowerHTMLActuator/
);

const context = {
  console,
  document: { querySelector: () => null },
  window: {
    setTimeout: callback => callback(),
    requestAnimationFrame: callback => callback(),
    matchMedia: () => ({ matches: false })
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + "/tile.js", "utf8"), context);
vm.runInContext(fs.readFileSync(__dirname + "/grid.js", "utf8"), context);
vm.runInContext(fs.readFileSync(__dirname + "/html_actuator.js", "utf8"), context);
vm.runInContext(fs.readFileSync(__dirname + "/game_manager.js", "utf8"), context);
vm.runInContext(fs.readFileSync(__dirname + "/power_game_manager.js", "utf8"), context);

const bestDisplayListeners = {};
const bestDisplay = {
  textContent: "7",
  addEventListener: (event, callback) => { bestDisplayListeners[event] = callback; }
};
const scheduledTimers = [];
context.document.querySelector = selector => selector === ".best-container" ? bestDisplay : null;
context.window.setTimeout = (callback, delay) => {
  const timer = { callback, delay, cleared: false };
  scheduledTimers.push(timer);
  return timer;
};
context.window.clearTimeout = timer => { if (timer) timer.cleared = true; };
context.TestInput = function () { this.on = function () {}; };
context.TestActuator = function () {};
context.TestStorage = function () {};
context.originalPowerSetup = vm.runInContext("PowerGameManager.prototype.setup", context);
vm.runInContext("PowerGameManager.prototype.setup = function () {};", context);
const longPressManager = vm.runInContext(
  "new PowerGameManager(4, TestInput, TestActuator, TestStorage)",
  context
);
longPressManager.minimumMoves = 9;
longPressManager.bestMoves = 7;
bestDisplayListeners.touchstart();
scheduledTimers.find(timer => timer.delay === 600).callback();
assert.equal(bestDisplay.textContent, 9, "a long press should reveal the minimum moves");
bestDisplayListeners.touchend();
assert.equal(bestDisplay.textContent, 9, "releasing a long press should not hide the minimum immediately");
bestDisplayListeners.mousemove({ ctrlKey: false });
assert.equal(bestDisplay.textContent, 9, "a synthetic mouse event after a long press should not hide the minimum");
scheduledTimers.find(timer => timer.delay === 1000).callback();
assert.equal(bestDisplay.textContent, 7, "the minimum should be hidden after one second");
const movesDisplayListeners = {};
const movesDisplay = {
  addEventListener: (event, callback) => { movesDisplayListeners[event] = callback; }
};
context.document.querySelector = selector => selector === ".score-container" ? movesDisplay : null;
vm.runInContext("PowerGameManager.prototype.setup = function () {};", context);
vm.runInContext("new PowerGameManager(4, TestInput, TestActuator, TestStorage)", context);
let movesTouchPrevented = false;
movesDisplayListeners.touchstart({ preventDefault() { movesTouchPrevented = true; } });
assert.equal(movesTouchPrevented, true, "a long press on Moves should prevent native text selection");
vm.runInContext("PowerGameManager.prototype.setup = originalPowerSetup;", context);
context.window.setTimeout = callback => callback();
context.window.clearTimeout = function () {};

const helpSwipeListeners = {};
const helpText = {
  addEventListener: (event, callback) => { helpSwipeListeners[event] = callback; }
};
context.document.querySelector = selector => selector === ".game-explanation" ? helpText : null;
const helpSwipeManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
const helpDirections = [];
helpSwipeManager.move = direction => helpDirections.push(direction);
helpSwipeManager.bindHelpSwipe();
const helpSwipeStart = (x, y) => helpSwipeListeners.touchstart({
  touches: [{ clientX: x, clientY: y }]
});
const helpSwipeEnd = (x, y) => helpSwipeListeners.touchend({
  changedTouches: [{ clientX: x, clientY: y }]
});
helpSwipeStart(10, 10);
helpSwipeEnd(30, 11);
helpSwipeStart(30, 10);
helpSwipeEnd(10, 11);
helpSwipeStart(10, 10);
helpSwipeEnd(15, 10);
helpSwipeStart(10, 10);
helpSwipeEnd(11, 40);
assert.deepEqual(helpDirections, [1, 3], "only horizontal swipes on the help text should rotate the Power board");

const manager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
manager.size = 4;
manager.moves = 0;
manager.rotation = 0;
manager.undoStack = [];
manager.storageManager = { setBestScore() {}, setGameState() {} };
manager.actuator = { actuate() { this.calls = (this.calls || 0) + 1; }, continueGame() {} };
manager.grid = new context.Grid(4);
manager.grid.insertTile(new context.Tile({ x: 0, y: 0 }, 2));

const undoGridManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
undoGridManager.size = 4;
undoGridManager.grid = undoGridManager.gridFromBoard([
  [8, 0, 0, 0],
  [2, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0]
]);
const currentUndoGrid = undoGridManager.gridFromBoard([
  [8, 0, 0, 0],
  [0, 2, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0]
]);
undoGridManager.markUndoTiles(currentUndoGrid);
assert.equal(undoGridManager.grid.cellContent({ x: 0, y: 0 }).previousPosition, null,
  "undo should not animate tiles that stayed in place");
assert.equal(undoGridManager.grid.cellContent({ x: 0, y: 1 }).previousPosition.x, 1,
  "undo should animate tiles that changed position");
assert.equal(undoGridManager.grid.cellContent({ x: 0, y: 1 }).previousPosition.y, 1,
  "undo should preserve the previous row for moved tiles");

undoGridManager.grid = undoGridManager.gridFromBoard([
  [2, 2, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0]
]);
undoGridManager.markUndoTiles(undoGridManager.gridFromBoard([
  [4, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0]
]));
assert.ok(undoGridManager.grid.cellContent({ x: 0, y: 0 }).mergedFrom,
  "undo should animate tiles affected by a merge");

manager.move(3);
assert.equal(manager.moves, 1);
assert.equal(manager.rotation, -90);
assert.equal(manager.actuator.calls, 1);
assert.deepEqual(manager.grid.cells[0][0] && {
  x: manager.grid.cells[0][0].x,
  y: manager.grid.cells[0][0].y
}, { x: 0, y: 0 });
assert.equal(manager.addRandomTile(), undefined);

const swipeListeners = {};
const swipeGameContainer = {
  addEventListener: (event, callback) => { swipeListeners[event] = callback; },
  getBoundingClientRect: () => ({ width: 500, height: 500 })
};
const swipeContext = {
  document: {
    addEventListener() {},
    querySelector: () => null,
    getElementsByClassName: () => [swipeGameContainer]
  },
  window: { navigator: { msPointerEnabled: false } }
};
vm.createContext(swipeContext);
vm.runInContext(fs.readFileSync(__dirname + "/keyboard_input_manager.js", "utf8"), swipeContext);
const swipeInput = vm.runInContext("new KeyboardInputManager()", swipeContext);
const swipeDirections = [];
const swipePreviewAngles = [];
const swipePreviewEnds = [];
const swipeStackSelections = [];
swipeInput.on("move", direction => swipeDirections.push(direction));
swipeInput.on("preview", angle => swipePreviewAngles.push(angle));
swipeInput.on("previewEnd", committed => swipePreviewEnds.push(committed));
swipeInput.on("selectStack", column => swipeStackSelections.push(column));
const swipeStart = (x, y) => swipeListeners.touchstart({
  touches: [{ clientX: x, clientY: y }], targetTouches: [{}], preventDefault() {}
});
const swipeMove = (x, y) => swipeListeners.touchmove({
  touches: [{ clientX: x, clientY: y }], preventDefault() {}
});
const swipeEnd = (x, y) => swipeListeners.touchend({
  touches: [], targetTouches: [], changedTouches: [{ clientX: x, clientY: y }]
});
const swipeCancel = () => {
  if (swipeListeners.touchcancel) swipeListeners.touchcancel({
    touches: [], targetTouches: []
  });
};
swipeStart(100, 200);
swipeEnd(100, 100);
swipeStart(100, 100);
swipeEnd(100, 200);
assert.deepEqual(swipeDirections, [1, 3], "vertical swipes should rotate clockwise and counterclockwise");
swipePreviewAngles.length = 0;
swipePreviewEnds.length = 0;
let swipeTime = 1000;
swipeContext.Date = { now: () => swipeTime };
swipeStart(250, 125);
swipeMove(338.38834765, 161.61165235);
assert.ok(Math.abs(swipePreviewAngles[0] - 45) < 0.0001,
  "dragging 45 degrees around the centre should preview a 45 degree rotation");
swipeTime = 1400;
swipeEnd(358.25317547, 187.5);
assert.deepEqual(swipeDirections, [1, 3], "a long swipe below 75 percent should not make a move");
assert.deepEqual(swipePreviewEnds, [false], "an incomplete long swipe should cancel the preview");
swipeTime = 2000;
swipeStart(250, 125);
swipeMove(375, 250);
swipeTime = 2400;
swipeEnd(375, 250);
assert.deepEqual(swipeDirections, [1, 3, 1], "a long swipe over 75 percent should make a move");
assert.deepEqual(swipePreviewEnds, [false, true], "a completed long swipe should commit the preview");
assert.ok(Math.abs(swipePreviewAngles[1] - 90) < 0.0001,
  "preview angles should match the finger's angle around the centre");
swipeTime = 3000;
swipeStart(250, 125);
swipeTime = 3100;
swipeEnd(271.70602221, 126.89903087);
assert.deepEqual(swipeDirections, [1, 3, 1, 1], "a short swipe should keep the existing threshold");
swipeStart(250, 125);
swipeMove(300, 150);
swipeCancel();
assert.deepEqual(swipePreviewEnds, [false, true, true, false],
  "cancelling a swipe should end preview mode so keyboard moves stay animated");
swipeStart(440, 250);
swipeEnd(440, 250);
assert.deepEqual(swipeStackSelections, [3], "a touch tap should select its board column");

const previewGrid = { style: {} };
const previewTiles = { style: {} };
const previewGame = {
  style: { setProperty(name, value) { this[name] = value; } },
  classList: {
    add(name) { this[name] = true; },
    toggle(name, enabled) { this[name] = enabled; }
  }
};
context.document.querySelector = selector => ({
  ".grid-container": previewGrid,
  ".tile-container": previewTiles,
  ".game-container": previewGame
}[selector] || null);
const previewManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
previewManager.rotation = 0;
previewManager.animating = false;
previewManager.won = false;
previewManager.hardStalemate = false;
previewManager.previewRotation(36);
assert.equal(previewGrid.style.transform, "rotate(36deg)", "the Power board should follow the preview angle");
assert.equal(previewGame.style["--power-counter-rotation"], "-36deg", "tile labels should stay upright during preview");
assert.equal(previewGame.classList["swipe-preview"], true, "the preview should disable the rotation transition while dragging");
previewManager.endPreview(false);
assert.equal(previewGrid.style.transform, "rotate(0deg)", "a cancelled preview should return the board to its current rotation");
assert.equal(previewGame.classList["swipe-preview"], false, "the preview transition mode should end when the touch ends");

const movingManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
movingManager.size = 4;
movingManager.moves = 0;
movingManager.rotation = 0;
movingManager.undoStack = [];
movingManager.seed = 1;
movingManager.puzzleKey = "seed-1";
movingManager.initialBoard = [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
movingManager.minimumMoves = 1;
movingManager.won = false;
movingManager.hardStalemate = false;
movingManager.softStalemate = false;
movingManager.storageManager = {
  storage: { getItem: () => null, setItem() {} },
  setGameState() {}
};
movingManager.actuator = { actuate() { this.calls = (this.calls || 0) + 1; }, continueGame() {} };
movingManager.grid = new context.Grid(4);
movingManager.grid.insertTile(new context.Tile({ x: 1, y: 0 }, 2));
movingManager.move(3);
assert.equal(movingManager.actuator.calls, 1);

const bestMovesManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
bestMovesManager.size = 4;
bestMovesManager.randomPuzzle = seed => ({
  board: [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  minimumMoves: 9,
  seed: seed == null ? 2 : seed
});
bestMovesManager.storageManager = {
  storage: {
    getItem: key => ({ "powerBest:seed-2": "7", "powerBest:seed-3": "11" }[key]),
    setItem() {}
  },
  clearGameState() {},
  setGameState() {}
};
bestMovesManager.actuator = { actuate() {}, continueGame() {} };
bestMovesManager.newGame();
assert.equal(bestMovesManager.bestMoves, 7);
bestMovesManager.seedInput = { value: "3" };
bestMovesManager.loadSeed({ type: "change", preventDefault() {} });
assert.equal(bestMovesManager.bestMoves, 11);

const searchManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
const originalMaxMoves = context.PowerGameManager.generatorConfig.maxMoves;
let searchCalls = 0;
context.PowerGameManager.generatorConfig.maxMoves = 2;
searchManager.tileCount = board => board[0][0] === 0 ? 1 : 2;
searchManager.nextBoard = board => {
  searchCalls++;
  assert.ok(searchCalls <= 6);
  return [[board[0][0] + 1]];
};
assert.equal(searchManager.shortestSolution([[1]]), 0);
context.PowerGameManager.generatorConfig.maxMoves = originalMaxMoves;
assert.ok(context.PowerGameManager.generatorConfig.maxMoves < 50);
assert.match(fs.readFileSync(__dirname + "/power_game_manager.js", "utf8"), /this\.softStalemate = !this\.won && this\.shortestSolution/);
assert.match(fs.readFileSync(__dirname + "/power_game_manager.js", "utf8"), /classList\.toggle\("soft-stalemate", this\.softStalemate\)/);
assert.match(fs.readFileSync(__dirname + "/keyboard_input_manager.js", "utf8"), /emit\("selectStack", event\.which - 49\)/);

assert.equal(context.PowerGameManager.parseSeed("g123").mode, "gravity");
assert.equal(context.PowerGameManager.parseSeed("g123").value, 123);
assert.equal(context.PowerGameManager.parseSeed("123", "push").mode, "push");
assert.equal(context.PowerGameManager.parseSeed("123", "push").value, 123);
assert.equal(context.PowerGameManager.formatSeed("classic", 123), "c123");
assert.equal(context.PowerGameManager.formatSeed("gravity", 123), "g123");
assert.equal(context.PowerGameManager.formatSeed("push", 123), "p123");

const mergeManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
mergeManager.size = 4;
assert.equal(JSON.stringify(mergeManager.mergeStack([2, 2, 2, 2])), JSON.stringify([4, 4]));
assert.equal(JSON.stringify(mergeManager.mergeStack([2, 2, 2])), JSON.stringify([4, 2]));
assert.equal(JSON.stringify(mergeManager.resolveMergeRound([
  [2, 0, 2, 0], [2, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0]
], [0, 1, 2, 3])), JSON.stringify([
  [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [4, 0, 4, 0]
]));
assert.equal(JSON.stringify(mergeManager.resolveCascades([
  [0, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0]
])), JSON.stringify([
  [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0]
]));

const pushStalemateBoard = [
  [0, 0, 0, 0],
  [0, 0, 0, 16],
  [0, 4, 2, 32],
  [0, 2, 4, 4]
];
mergeManager.mode = "push";
assert.equal(mergeManager.canMergeEventually(pushStalemateBoard, "push"), true,
  "Push should detect the merge available after rotating the reported board");

function moveBoard(mode, board, direction) {
  var moveManager = vm.runInContext(
    "Object.create(PowerGameManager.prototype)", context
  );
  moveManager.size = 4;
  moveManager.mode = mode;
  moveManager.seed = 1;
  moveManager.puzzleKey = "test-" + mode;
  moveManager.initialBoard = board;
  moveManager.grid = moveManager.gridFromBoard(board);
  moveManager.moves = 0;
  moveManager.rotation = 0;
  moveManager.undoStack = [];
  moveManager.won = false;
  moveManager.softStalemate = false;
  moveManager.hardStalemate = false;
  moveManager.storageManager = {
    storage: { getItem: () => null, setItem() {} },
    setGameState() {}
  };
  moveManager.actuator = { actuate() {}, continueGame() {} };
  moveManager.move(direction);
  return JSON.parse(JSON.stringify(moveManager.boardFromGrid(moveManager.grid)));
}

[
  {
    name: "cascades right after merging into an existing tile",
    mode: "gravity",
    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [4, 0, 2, 2]],
    direction: 1,
    expected: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 8]]
  },
  {
    name: "cascades left through two rounds of four equal tiles",
    mode: "gravity",
    board: [[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    direction: 3,
    expected: [[8, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
  },
  {
    name: "keeps separate pairs after a standard right move",
    mode: "classic",
    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 2, 2, 2]],
    direction: 1,
    expected: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 4, 4]]
  },
  {
    name: "merges equal tiles after a right rotation",
    mode: "push",
    board: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 2, 2, 2]],
    direction: 1,
    expected: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 4, 4]]
  }
].forEach(function (scenario) {
assert.deepEqual(moveBoard(scenario.mode, scenario.board, scenario.direction),
    scenario.expected, scenario.mode + " " + scenario.name);
});

const modeTransitionBoard = [[2, 2, 2, 2], [0, 0, 0, 0],
  [0, 0, 0, 0], [0, 0, 0, 0]];
assert.equal(JSON.stringify(manager.nextBoardForMode(
  modeTransitionBoard, true, "classic"
)), JSON.stringify([[0, 0, 0, 0], [0, 0, 0, 0],
  [0, 0, 0, 4], [0, 0, 0, 4]]),
  "classic generation must perform one merge round");
assert.equal(JSON.stringify(manager.nextBoardForMode(
  modeTransitionBoard, true, "gravity"
)), JSON.stringify([[0, 0, 0, 0], [0, 0, 0, 0],
  [0, 0, 0, 0], [0, 0, 0, 8]]),
  "gravity generation must perform cascaded merges");
assert.equal(JSON.stringify(manager.nextBoardForMode(
  modeTransitionBoard, true, "push"
)), JSON.stringify([[0, 0, 0, 0], [0, 0, 0, 0],
  [0, 0, 0, 4], [0, 0, 0, 4]]),
  "push generation must merge after a rotation");
assert.equal(manager.canSolveByRotation(modeTransitionBoard, "classic", true), true);
assert.equal(manager.canSolveByRotation(modeTransitionBoard, "gravity", true), true);
assert.equal(manager.canSolveByRotation(modeTransitionBoard, "push", true), true);
assert.equal(manager.isOneWayRotationPuzzle(modeTransitionBoard, "classic"), true);

const serializedManager = vm.runInContext(
  "Object.create(PowerGameManager.prototype)", context
);
serializedManager.grid = new context.Grid(4);
serializedManager.initialBoard = [[2, 0, 0, 0], [0, 0, 0, 0],
  [0, 0, 0, 0], [0, 0, 0, 0]];
serializedManager.puzzleKey = "seed-c123";
serializedManager.seed = 123;
serializedManager.mode = "classic";
serializedManager.rotation = 0;
serializedManager.moves = 0;
serializedManager.bestMoves = null;
serializedManager.minimumMoves = 9;
serializedManager.won = false;
serializedManager.softStalemate = false;
serializedManager.hardStalemate = false;
assert.equal(Object.prototype.hasOwnProperty.call(
  serializedManager.serialize(), "initialBoard"
), false, "persisted Power state should derive the initial board from its seed");
for (const field of ["bestMoves", "puzzleKey", "seed"]) {
  assert.equal(Object.prototype.hasOwnProperty.call(
    serializedManager.serialize(), field
  ), false, "persisted Power state should derive " + field);
}

const restoredBoard = [[2, 4, 0, 0], [0, 0, 0, 0],
  [0, 0, 0, 0], [0, 0, 0, 0]];
const persistedGrid = new context.Grid(4);
persistedGrid.insertTile(new context.Tile({ x: 0, y: 0 }, 2));
const restoredFromSeed = vm.runInContext(
  "Object.create(PowerGameManager.prototype)", context
);
restoredFromSeed.size = 4;
restoredFromSeed.randomPuzzle = seed => {
  assert.equal(seed, "c123");
  return { board: restoredBoard, minimumMoves: 9, seed: 123, mode: "classic" };
};
restoredFromSeed.storageManager = {
  getGameState: () => ({
    mode: "power",
    grid: persistedGrid.serialize(),
    seedText: "c123",
    seedMode: "classic",
    minimumMoves: 9,
    moves: 1,
    rotation: 0,
    won: false,
    softStalemate: false,
    hardStalemate: false
  }),
  storage: { getItem: () => null },
  setGameState() {}
};
restoredFromSeed.actuator = { actuate() {} };
restoredFromSeed.updateStatus = () => {};
restoredFromSeed.actuate = () => {};
restoredFromSeed.setup();
assert.deepEqual(JSON.parse(JSON.stringify(restoredFromSeed.initialBoard)), restoredBoard,
  "restored Power state should rebuild its initial board from the seed");

const classicBoard = manager.randomPuzzle("c1234").board;
const gravityBoard = manager.randomPuzzle("g1234").board;
const pushBoard = manager.randomPuzzle("p1234").board;
assert.notDeepEqual(classicBoard, gravityBoard);
assert.notDeepEqual(classicBoard, pushBoard);
assert.notDeepEqual(gravityBoard, pushBoard);
assert.deepEqual(manager.randomPuzzle("g1234"), manager.randomPuzzle("g1234"));

manager.mode = "push";
manager.grid = manager.gridFromBoard(pushBoard);
manager.won = false;
manager.hardStalemate = false;
manager.updateStatus();
assert.equal(manager.hardStalemate, false,
  "a generated Push puzzle must not be marked unsolvable before a move");
assert.equal(typeof manager.fallGrid, "function");
assert.equal(typeof manager.mergeGrid, "function");
assert.equal(context.PowerGameManager.gravityTiming.collapseDelay, 200);
assert.equal(context.PowerGameManager.gravityTiming.cascadeDelay, undefined);

const mergeGridManager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
mergeGridManager.size = 4;
mergeGridManager.grid = new context.Grid(4);
mergeGridManager.grid.insertTile(new context.Tile({ x: 0, y: 2 }, 2));
mergeGridManager.grid.insertTile(new context.Tile({ x: 0, y: 3 }, 2));
assert.equal(mergeGridManager.mergeGrid(2), true);
assert.equal(mergeGridManager.grid.cells[0][3].mergedFrom.length, 2,
  "gravity merge must retain the two source tiles for animation");

const gravityDispatch = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
gravityDispatch.mode = "gravity";
gravityDispatch.moves = 0;
gravityDispatch.rotation = 0;
gravityDispatch.won = false;
gravityDispatch.hardStalemate = false;
gravityDispatch.animating = false;
gravityDispatch.undoStack = [];
gravityDispatch.snapshot = () => ({});
gravityDispatch.applyRotation = () => {};
gravityDispatch.runGravityStages = direction => { gravityDispatch.stageDirection = direction; };
gravityDispatch.move(3);
assert.equal(gravityDispatch.stageDirection, 3,
  "Gravity moves must dispatch to staged animation");

const gravityMove = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
gravityMove.size = 4;
gravityMove.mode = "gravity";
gravityMove.seed = 1;
gravityMove.puzzleKey = "seed-g1";
gravityMove.initialBoard = gravityBoard;
gravityMove.grid = gravityMove.gridFromBoard(gravityBoard);
gravityMove.moves = 0;
gravityMove.rotation = 0;
gravityMove.undoStack = [];
gravityMove.won = false;
gravityMove.softStalemate = false;
gravityMove.hardStalemate = false;
gravityMove.storageManager = {
  storage: { getItem: () => null, setItem() {} },
  setGameState() {}
};
gravityMove.actuator = { actuate() {}, continueGame() {} };
gravityMove.move(1);
assert.equal(gravityMove.animating, false, "Gravity animation must finish");
assert.equal(gravityMove.hardStalemate, false, "Gravity must remain playable after a move");
gravityMove.move(3);
assert.equal(gravityMove.moves, 2, "Gravity arrows must remain usable after the first move");

const pushMergeGrid = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
pushMergeGrid.size = 4;
pushMergeGrid.grid = new context.Grid(4);
pushMergeGrid.grid.insertTile(new context.Tile({ x: 0, y: 2 }, 2));
pushMergeGrid.grid.insertTile(new context.Tile({ x: 0, y: 3 }, 2));
assert.equal(pushMergeGrid.mergeGrid(2, { axis: "column", index: 0 }), true);
assert.equal(pushMergeGrid.grid.cells[0][3].mergedFrom.length, 2,
  "Push merges must retain source tiles for animation");

const pushSelection = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
pushSelection.size = 4;
pushSelection.mode = "push";
pushSelection.rotation = 0;
pushSelection.moves = 0;
pushSelection.won = false;
pushSelection.hardStalemate = false;
pushSelection.animating = false;
pushSelection.undoStack = [];
pushSelection.snapshot = () => ({});
pushSelection.updateStatus = () => {};
pushSelection.actuate = () => {};
pushSelection.grid = new context.Grid(4);
pushSelection.grid.insertTile(new context.Tile({ x: 0, y: 2 }, 2));
pushSelection.grid.insertTile(new context.Tile({ x: 0, y: 3 }, 2));
pushSelection.selectStack(0);
assert.equal(pushSelection.grid.cells[0][3].mergedFrom.length, 2,
  "Push selection must use the animated merge path");

const screenshotBoard = [[32, 0, 0, 0], [64, 0, 0, 0], [8, 16, 0, 0], [4, 4, 0, 0]];
manager.rotation = 0;
manager.grid = manager.gridFromBoard(screenshotBoard);
manager.updateStatus();
assert.equal(manager.softStalemate, true);
manager.rotation = 90;
manager.grid = manager.gridFromBoard(manager.rotateBoard(screenshotBoard, false));
manager.updateStatus();
assert.equal(manager.softStalemate, true);
manager.storageManager = { setGameState() {} };
manager.actuator = { actuate() {}, continueGame() {} };
manager.actuate = function () {};
manager.undoStack = [{
  grid: manager.grid.serialize(),
  initialBoard: screenshotBoard,
  puzzleKey: "seed-screenshot",
  seed: 1,
  minimumMoves: 9,
  moves: 17,
  rotation: 90,
  won: false,
  softStalemate: false,
  hardStalemate: false
}];
manager.undo();
assert.equal(manager.moves, 17);
assert.equal(manager.softStalemate, true);

assert.deepEqual(manager.randomPuzzle(1234), manager.randomPuzzle(1234));
manager.undoStack = [{
  grid: new context.Grid(4).serialize(),
  initialBoard: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  puzzleKey: "seed-1234",
  seed: 1234,
  minimumMoves: 9,
  moves: 0,
  rotation: 0,
  won: false,
  softStalemate: false,
  hardStalemate: false
}];
manager.moves = 1;
manager.undo();
assert.equal(manager.moves, 0);
assert.equal(manager.seed, 1234);

const randomBoards = new Set();
for (let index = 0; index < 100; index++) {
  const puzzle = manager.randomPuzzle();
  randomBoards.add(JSON.stringify(puzzle.board));
  assert.ok(puzzle.minimumMoves >= 9 && puzzle.minimumMoves <= 12);
}
assert.ok(randomBoards.size > 4);
const originalAttempts = context.PowerGameManager.generatorConfig.attempts;
context.PowerGameManager.generatorConfig.attempts = 0;
assert.equal(manager.randomPuzzle("c123"), null,
  "generator must reject seeds without a valid candidate");
context.PowerGameManager.generatorConfig.attempts = originalAttempts;

const messageText = { textContent: "" };
const messageClasses = new Set();
const messageActuator = Object.create(context.HTMLActuator.prototype);
messageActuator.messageContainer = {
  classList: {
    add: value => messageClasses.add(value),
    remove: value => messageClasses.delete(value),
    toggle: (value, enabled) => enabled ? messageClasses.add(value) : messageClasses.delete(value)
  },
  getElementsByTagName: () => [messageText]
};
messageActuator.message(true, 9, 9);
assert.equal(messageText.textContent, "Puzzle solved in the minimum number of moves!");
assert.equal(messageClasses.has("optimal-win"), true);
messageActuator.message(true, 10, 9);
assert.equal(messageText.textContent, "Puzzle solved in 10 moves");
assert.equal(messageClasses.has("optimal-win"), false);

const terminalState = won => ({
  mode: "power",
  grid: { size: 4, cells: new context.Grid(4).serialize().cells },
  initialBoard: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  won,
  hardStalemate: !won,
  softStalemate: false,
  moves: 3,
  rotation: 90
});

for (const won of [true, false]) {
  const restored = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
  let cleared = false;
  restored.size = 4;
  restored.storageManager = {
    getGameState: () => terminalState(won),
    clearGameState: () => { cleared = true; },
    storage: { getItem: () => null },
    setGameState() {}
  };
  restored.actuator = { actuate() {}, continueGame() {} };
  restored.actuate = function () {};
  restored.setup();
  assert.equal(cleared, true);
  assert.equal(restored.won, false);
  assert.equal(restored.hardStalemate, false);
  assert.equal(restored.moves, 0);
}

const empty = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
let emptyCleared = false;
empty.size = 4;
empty.storageManager = {
  getGameState: () => ({
    mode: "power",
    grid: { size: 4, cells: new context.Grid(4).serialize().cells },
    initialBoard: [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    won: false,
    hardStalemate: false,
    moves: 0
  }),
  clearGameState: () => { emptyCleared = true; },
  storage: { getItem: () => null },
  setGameState() {}
};
empty.actuator = { actuate() {}, continueGame() {} };
empty.actuate = function () {};
empty.setup();
assert.equal(emptyCleared, true);
assert.ok(empty.tileCount(empty.boardFromGrid(empty.grid)) > 0);

console.log("PowerGameManager smoke test passed.");
