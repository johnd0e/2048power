function PowerGameManager(size, InputManager, Actuator, StorageManager) {
  this.size = size;
  this.inputManager = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator = new Actuator;
  this.moves = 0;
  this.bestMoves = 0;
  this.rotation = 0;
  this.seed = 0;
  this.undoStack = [];
  this.animating = false;
  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("undo", this.undo.bind(this));
  this.inputManager.on("keepPlaying", function () {});

  var random = document.querySelector(".random-button");
  if (random) random.addEventListener("click", this.newGame.bind(this));
  var self = this;
  this.seedInput = document.querySelector(".seed-input");
  if (this.seedInput) {
    this.seedInput.addEventListener("change", this.loadSeed.bind(this));
    this.seedInput.addEventListener("keydown", this.loadSeed.bind(this));
  }
  var movesDisplay = document.querySelector(".score-container");
  if (movesDisplay) {
    var undoTimer;
    movesDisplay.addEventListener("touchstart", function () {
      undoTimer = window.setTimeout(function () { self.undo(); }, 600);
    });
    movesDisplay.addEventListener("touchend", function () { window.clearTimeout(undoTimer); });
    movesDisplay.addEventListener("touchcancel", function () { window.clearTimeout(undoTimer); });
  }
  var bestDisplay = document.querySelector(".best-container");
  if (bestDisplay) {
    var bestTimer;
    var showMinimum = function () { bestDisplay.textContent = self.minimumMoves; };
    var restoreBest = function () {
      window.clearTimeout(bestTimer);
      bestDisplay.textContent = self.bestMoves === null ? "—" : self.bestMoves;
    };
    bestDisplay.addEventListener("touchstart", function () {
      bestTimer = window.setTimeout(showMinimum, 600);
    });
    bestDisplay.addEventListener("touchend", restoreBest);
    bestDisplay.addEventListener("touchcancel", restoreBest);
    bestDisplay.addEventListener("mouseenter", function (event) {
      if (event.ctrlKey) showMinimum();
    });
    bestDisplay.addEventListener("mousemove", function (event) {
      if (event.ctrlKey) showMinimum();
      else restoreBest();
    });
    bestDisplay.addEventListener("mouseleave", restoreBest);
  }
  this.setup();
}

PowerGameManager.prototype = Object.create(GameManager.prototype);
PowerGameManager.prototype.constructor = PowerGameManager;

PowerGameManager.prototype.puzzles = [
  [[8, 2, 4, 0], [4, 0, 16, 0], [2, 0, 4, 0], [16, 0, 8, 0]],
  [[16, 16, 2, 4], [16, 8, 8, 16], [8, 0, 2, 0], [16, 0, 16, 0]],
  [[0, 16, 0, 8], [0, 4, 0, 2], [0, 16, 0, 16], [0, 0, 0, 2]],
  [[0, 4, 2, 16], [0, 0, 4, 2], [0, 0, 2, 16], [0, 0, 16, 2]]
];

PowerGameManager.prototype.solutionLengths = [9, 12, 10, 9];

PowerGameManager.generatorConfig = {
  attempts: 100,
  totals: [64, 128],
  minTiles: 7,
  maxTiles: 12,
  minMoves: 9,
  maxMoves: 12
};

PowerGameManager.prototype.puzzleBoard = function (index) {
  return this.cloneBoard(this.puzzles[index]).reverse();
};

PowerGameManager.prototype.hasFloatingTiles = function (board) {
  for (var y = 0; y < this.size - 1; y++) {
    for (var x = 0; x < this.size; x++) {
      if (board[y][x] && !board[y + 1][x]) return true;
    }
  }
  return false;
};

PowerGameManager.prototype.randomPuzzle = function (seed) {
  var config = PowerGameManager.generatorConfig;
  seed = seed == null ? Math.floor(Math.random() * 0x100000000) : Number(seed) >>> 0;
  var state = seed;
  var random = function () {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (var attempt = 0; attempt < config.attempts; attempt++) {
    var total = config.totals[Math.floor(random() * config.totals.length)];
    var count = config.minTiles + Math.floor(random() * (config.maxTiles - config.minTiles + 1));
    var values = [total];
    while (values.length < count) {
      var choices = [];
      for (var i = 0; i < values.length; i++) {
        if (values[i] > 2) choices.push(i);
      }
      var index = choices[Math.floor(random() * choices.length)];
      var value = values[index] / 2;
      values.splice(index, 1, value, value);
    }
    var heights = [0, 0, 0, 0];
    for (var tileIndex = 0; tileIndex < count; tileIndex++) {
      var columns = [];
      for (var column = 0; column < this.size; column++) {
        if (heights[column] < this.size) columns.push(column);
      }
      heights[columns[Math.floor(random() * columns.length)]]++;
    }
    var cells = [];
    for (var columnIndex = 0; columnIndex < this.size; columnIndex++) {
      for (var row = this.size - heights[columnIndex]; row < this.size; row++) {
        cells.push(row * this.size + columnIndex);
      }
    }
    for (var last = cells.length - 1; last > 0; last--) {
      var swap = Math.floor(random() * (last + 1));
      var temp = cells[last];
      cells[last] = cells[swap];
      cells[swap] = temp;
    }
    var board = [];
    for (var y = 0; y < this.size; y++) board[y] = [0, 0, 0, 0];
    values.forEach(function (tile, position) {
      board[Math.floor(cells[position] / this.size)][cells[position] % this.size] = tile;
    }, this);
    if (this.hasFloatingTiles(board)) continue;
    var minimumMoves = this.shortestSolution(board);
    if (minimumMoves >= config.minMoves && minimumMoves <= config.maxMoves) {
      return { board: board, minimumMoves: minimumMoves, seed: seed };
    }
  }
  var fallback = seed % this.puzzles.length;
  return { board: this.puzzleBoard(fallback), minimumMoves: this.solutionLengths[fallback], seed: seed };
};

PowerGameManager.prototype.cloneBoard = function (board) {
  return board.map(function (row) { return row.slice(); });
};

PowerGameManager.prototype.gridFromBoard = function (board) {
  var grid = new Grid(this.size);
  for (var y = 0; y < this.size; y++) {
    for (var x = 0; x < this.size; x++) {
      if (board[y][x]) grid.insertTile(new Tile({ x: x, y: y }, board[y][x]));
    }
  }
  return grid;
};

PowerGameManager.prototype.boardFromGrid = function (grid) {
  var board = [];
  for (var y = 0; y < this.size; y++) {
    board[y] = [];
    for (var x = 0; x < this.size; x++) {
      var tile = grid.cellContent({ x: x, y: y });
      board[y][x] = tile ? tile.value : 0;
    }
  }
  return board;
};

PowerGameManager.prototype.setup = function () {
  var state = this.storageManager.getGameState(), board, puzzleIndex;
  this.undoStack = [];
  var hasSavedTiles = state && state.grid && state.grid.cells &&
    state.grid.cells.some(function (column) {
      return column.some(Boolean);
    });
  if (state && state.mode === "power" && hasSavedTiles && !state.won && !state.hardStalemate) {
    this.grid = new Grid(state.grid.size, state.grid.cells);
    this.initialBoard = state.initialBoard;
    this.seed = state.seed == null ? Math.floor(Date.now() / 86400000) : state.seed;
    this.puzzleKey = state.puzzleKey || "day-" + Math.floor(Date.now() / 86400000);
    this.rotation = state.rotation || 0;
    this.moves = state.moves || 0;
    this.minimumMoves = state.minimumMoves == null ? this.shortestSolution(this.initialBoard) : state.minimumMoves;
    this.bestMoves = this.getPuzzleBest();
    this.won = !!state.won;
    this.hardStalemate = !!state.hardStalemate;
    this.softStalemate = !!state.softStalemate;
  } else {
    if (state && state.mode === "power") this.storageManager.clearGameState();
    this.seed = Math.floor(Date.now() / 86400000);
    var puzzle = this.randomPuzzle(this.seed);
    this.puzzleKey = "seed-" + this.seed;
    board = puzzle.board;
    this.initialBoard = board;
    this.grid = this.gridFromBoard(board);
    this.moves = 0;
    this.minimumMoves = puzzle.minimumMoves;
    this.bestMoves = this.getPuzzleBest();
    this.won = false;
    this.hardStalemate = false;
    this.softStalemate = false;
  }
  this.animating = false;
  this.updateStatus();
  this.actuate();
};

PowerGameManager.prototype.numberOrZero = function (value) {
  value = Number(value);
  return isFinite(value) ? value : 0;
};

PowerGameManager.prototype.bestKey = function () {
  return "powerBest:" + this.puzzleKey;
};

PowerGameManager.prototype.getPuzzleBest = function () {
  var value = this.storageManager.storage.getItem(this.bestKey());
  return value === null || value === undefined ? null : this.numberOrZero(value);
};

PowerGameManager.prototype.restart = function (event) {
  if (event) event.preventDefault();
  this.storageManager.clearGameState();
  this.grid = this.gridFromBoard(this.initialBoard);
  this.moves = 0;
  this.won = false;
  this.hardStalemate = false;
  this.softStalemate = false;
  this.rotation = 0;
  this.undoStack = [];
  this.animating = false;
  this.updateStatus();
  this.actuator.continueGame();
  this.actuate();
};

PowerGameManager.prototype.newGame = function (event) {
  if (event) event.preventDefault();
  var puzzle = this.randomPuzzle();
  var board = puzzle.board;
  this.seed = puzzle.seed;
  this.puzzleKey = "seed-" + this.seed;
  this.bestMoves = this.getPuzzleBest();
  this.initialBoard = board;
  this.grid = this.gridFromBoard(board);
  this.moves = 0;
  this.minimumMoves = puzzle.minimumMoves;
  this.won = false;
  this.hardStalemate = false;
  this.softStalemate = false;
  this.rotation = 0;
  this.undoStack = [];
  this.animating = false;
  this.updateStatus();
  this.storageManager.clearGameState();
  this.actuator.continueGame();
  this.actuate();
};

PowerGameManager.prototype.loadSeed = function (event) {
  if (event && event.type === "keydown" && event.which !== 13) return;
  if (event) event.preventDefault();
  var seed = Number(this.seedInput.value);
  if (!isFinite(seed)) return;
  seed = (seed >>> 0);
  var puzzle = this.randomPuzzle(seed);
  this.seed = puzzle.seed;
  this.puzzleKey = "seed-" + this.seed;
  this.bestMoves = this.getPuzzleBest();
  this.initialBoard = puzzle.board;
  this.grid = this.gridFromBoard(puzzle.board);
  this.minimumMoves = puzzle.minimumMoves;
  this.moves = 0;
  this.rotation = 0;
  this.undoStack = [];
  this.won = false;
  this.softStalemate = false;
  this.hardStalemate = false;
  this.updateStatus();
  this.storageManager.clearGameState();
  this.actuator.continueGame();
  this.actuate();
};

PowerGameManager.prototype.snapshot = function () {
  return {
    grid: this.grid.serialize(),
    initialBoard: this.initialBoard,
    puzzleKey: this.puzzleKey,
    seed: this.seed,
    minimumMoves: this.minimumMoves,
    moves: this.moves,
    rotation: this.rotation,
    won: this.won,
    softStalemate: this.softStalemate,
    hardStalemate: this.hardStalemate
  };
};

PowerGameManager.prototype.undo = function () {
  if (this.animating || !this.undoStack.length) return;
  var state = this.undoStack.pop();
  this.grid = new Grid(state.grid.size, state.grid.cells);
  this.initialBoard = state.initialBoard;
  this.puzzleKey = state.puzzleKey;
  this.seed = state.seed;
  this.minimumMoves = state.minimumMoves;
  this.moves = state.moves;
  this.rotation = state.rotation;
  this.won = state.won;
  this.softStalemate = state.softStalemate;
  this.hardStalemate = state.hardStalemate;
  this.updateStatus();
  this.actuator.continueGame();
  this.actuate();
};

PowerGameManager.prototype.isGameTerminated = function () {
  return this.won || this.hardStalemate;
};

PowerGameManager.prototype.addRandomTile = function () {};
PowerGameManager.prototype.movesAvailable = function () { return true; };

PowerGameManager.prototype.move = function (direction) {
  if ((direction !== 1 && direction !== 3) || this.isGameTerminated() || this.animating) return;
  this.undoStack.push(this.snapshot());
  var clockwise = direction === 1;
  this.moves++;
  this.rotation += clockwise ? 90 : -90;
  this.applyRotation();
  this.animating = true;
  var self = this;
  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var orientation = ((this.rotation % 360) + 360) % 360;
  var gravityDirection = { 0: 2, 90: 1, 180: 0, 270: 3 }[orientation];
  window.setTimeout(function () {
    GameManager.prototype.move.call(self, gravityDirection, true);
    self.updateStatus();
    self.actuate();
    self.animating = false;
  }, reducedMotion ? 0 : 450);
};

PowerGameManager.prototype.tileCount = function (board) {
  return board.reduce(function (count, row) {
    return count + row.filter(Boolean).length;
  }, 0);
};

PowerGameManager.prototype.rotateBoard = function (board, clockwise) {
  var size = this.size;
  return board.map(function (_, y) {
    return board.map(function (_, x) {
      return clockwise ? board[size - 1 - x][y] : board[x][size - 1 - y];
    });
  });
};

PowerGameManager.prototype.settleBoard = function (source) {
  var board = this.cloneBoard(source), changed = true, size = this.size;
  while (changed) {
    var next = this.cloneBoard(board);
    changed = false;
    for (var offset = 1; offset < size; offset++) {
      for (var x = 0; x < size; x++) {
        for (var y = size - offset; y < size && next[y][x] === 0; y++) {
          if (next[y - 1][x]) {
            next[y][x] = next[y - 1][x];
            next[y - 1][x] = 0;
            changed = true;
          }
        }
        if (next[size - offset][x] && next[size - offset - 1][x] === next[size - offset][x]) {
          next[size - offset][x] *= 2;
          next[size - offset - 1][x] = 0;
          changed = true;
        }
      }
    }
    board = next;
  }
  return board;
};

PowerGameManager.prototype.nextBoard = function (board, clockwise) {
  return this.settleBoard(this.rotateBoard(board, clockwise));
};

PowerGameManager.prototype.shortestSolution = function (start) {
  var queue = [{ board: start, distance: 0 }], seen = {};
  var maxMoves = PowerGameManager.generatorConfig.maxMoves;
  seen[JSON.stringify(start)] = true;
  for (var i = 0; i < queue.length; i++) {
    var current = queue[i];
    if (this.tileCount(current.board) === 1) return current.distance;
    if (current.distance >= maxMoves) continue;
    for (var side = 0; side < 2; side++) {
      var next = this.nextBoard(current.board, !!side), key = JSON.stringify(next);
      if (!seen[key]) {
        seen[key] = true;
        queue.push({ board: next, distance: current.distance + 1 });
      }
    }
  }
  return 0;
};

PowerGameManager.prototype.canMergeEventually = function (start) {
  var queue = [{ board: start, distance: 0 }], seen = {};
  var maxMoves = PowerGameManager.generatorConfig.maxMoves;
  seen[JSON.stringify(start)] = true;
  for (var i = 0; i < queue.length; i++) {
    var current = queue[i];
    if (current.distance >= maxMoves) continue;
    for (var side = 0; side < 2; side++) {
      var next = this.nextBoard(current.board, !!side), key = JSON.stringify(next);
      if (this.tileCount(next) < this.tileCount(current.board)) return true;
      if (!seen[key]) {
        seen[key] = true;
        queue.push({ board: next, distance: current.distance + 1 });
      }
    }
  }
  return false;
};

PowerGameManager.prototype.updateStatus = function () {
  var board = this.boardFromGrid(this.grid);
  var turns = (((this.rotation || 0) % 360) + 360) % 360 / 90;
  while (turns--) board = this.rotateBoard(board, true);
  this.won = this.tileCount(board) === 1;
  this.softStalemate = !this.won && this.shortestSolution(board) === 0;
  this.hardStalemate = !this.won && !this.canMergeEventually(board);
};

PowerGameManager.prototype.serialize = function () {
  return {
    mode: "power",
    grid: this.grid.serialize(),
    initialBoard: this.initialBoard,
    puzzleKey: this.puzzleKey,
    seed: this.seed,
    rotation: this.rotation,
    moves: this.moves,
    bestMoves: this.bestMoves,
    minimumMoves: this.minimumMoves,
    won: this.won,
    softStalemate: this.softStalemate,
    hardStalemate: this.hardStalemate
  };
};

PowerGameManager.prototype.actuate = function () {
  if (this.won && (this.bestMoves === null || this.moves < this.bestMoves)) {
    this.bestMoves = this.moves;
    this.storageManager.storage.setItem(this.bestKey(), this.bestMoves);
  }
  this.storageManager.setGameState(this.serialize());
  this.actuator.actuate(this.grid, {
    score: this.moves,
    bestScore: this.bestMoves === null ? "—" : this.bestMoves,
    minimumMoves: this.minimumMoves,
    mode: "power",
    over: this.hardStalemate,
    won: this.won,
    terminated: this.isGameTerminated()
  });
  if (this.seedInput) this.seedInput.value = this.seed;
  this.applyRotation();
  var game = document.querySelector(".game-container");
  if (game) game.classList.toggle("soft-stalemate", this.softStalemate);
};

PowerGameManager.prototype.applyRotation = function () {
  var angle = this.rotation + "deg", counter = (-this.rotation) + "deg";
  var grid = document.querySelector(".grid-container");
  var tiles = document.querySelector(".tile-container");
  var game = document.querySelector(".game-container");
  if (grid) grid.style.transform = "rotate(" + angle + ")";
  if (tiles) tiles.style.transform = "rotate(" + angle + ")";
  if (game) {
    game.classList.add("power-mode");
    game.style.setProperty("--power-counter-rotation", counter);
  }
};
