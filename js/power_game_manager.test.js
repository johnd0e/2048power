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
assert.doesNotMatch(index, /style\/power\.css/);
assert.match(powerPage, /power_application\.js/);
assert.match(fs.readFileSync(__dirname + "/power_application.js", "utf8"), /PowerStorageManager/);
assert.match(fs.readFileSync(__dirname + "/power_application.js", "utf8"), /powerGameState/);

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

const manager = vm.runInContext("Object.create(PowerGameManager.prototype)", context);
manager.size = 4;
manager.moves = 0;
manager.rotation = 0;
manager.undoStack = [];
manager.storageManager = { setBestScore() {}, setGameState() {} };
manager.actuator = { actuate() { this.calls = (this.calls || 0) + 1; }, continueGame() {} };
manager.grid = new context.Grid(4);
manager.grid.insertTile(new context.Tile({ x: 0, y: 0 }, 2));

manager.move(3);
assert.equal(manager.moves, 1);
assert.equal(manager.rotation, -90);
assert.equal(manager.actuator.calls, 1);
assert.deepEqual(manager.grid.cells[0][0] && {
  x: manager.grid.cells[0][0].x,
  y: manager.grid.cells[0][0].y
}, { x: 0, y: 0 });
assert.equal(manager.addRandomTile(), undefined);

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

const loadedBoard = manager.puzzleBoard(3);
for (let row = 0; row < 3; row++) {
  for (let column = 0; column < 4; column++) {
    assert.equal(Boolean(loadedBoard[row][column] && !loadedBoard[row + 1][column]), false);
  }
}

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
