function PowerGameManager(size, InputManager, Actuator, StorageManager) {
  this.size = size;
  this.inputManager = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator = new Actuator;
  this.moves = 0;
  this.bestMoves = 0;
  this.rotation = 0;
  this.seed = 0;
  this.mode = "classic";
  this.undoStack = [];
  this.animating = false;
  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("preview", this.previewRotation.bind(this));
  this.inputManager.on("previewEnd", this.endPreview.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("undo", this.undo.bind(this));
  this.inputManager.on("keepPlaying", function () {});
  this.inputManager.on("selectStack", this.selectStack.bind(this));
  var self = this;

  var random = document.querySelector(".random-button");
  if (random) random.addEventListener("click", this.newGame.bind(this));
  var modeMenu = document.querySelector(".mode-menu");
  if (modeMenu) modeMenu.addEventListener("click", this.selectMode.bind(this));
  var modeMenuButton = document.querySelector(".mode-menu-button");
  if (modeMenuButton) modeMenuButton.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    var parent = modeMenuButton.parentNode;
    if (parent && parent.classList) parent.classList.toggle("open");
  });
  var gameContainer = document.querySelector(".game-container");
  if (gameContainer) gameContainer.addEventListener("click", function (event) {
    if (self.mode !== "push" || !event.target || !event.target.closest) return;
    if (!event.target.closest(".grid-container, .tile-container")) return;
    var bounds = gameContainer.getBoundingClientRect();
    var x = event.clientX - bounds.left;
    var column = Math.floor(x / bounds.width * self.size);
    if (column >= 0 && column < self.size) self.selectStack(column);
  });
  this.seedInput = document.querySelector(".seed-input");
  if (this.seedInput) {
    this.seedInput.addEventListener("change", this.loadSeed.bind(this));
    this.seedInput.addEventListener("keydown", this.loadSeed.bind(this));
  }
  var movesDisplay = document.querySelector(".score-container");
  if (movesDisplay) {
    var undoTimer;
    movesDisplay.addEventListener("touchstart", function (event) {
      event.preventDefault();
      undoTimer = window.setTimeout(function () { self.undo(); }, 600);
    });
    movesDisplay.addEventListener("touchend", function () { window.clearTimeout(undoTimer); });
    movesDisplay.addEventListener("touchcancel", function () { window.clearTimeout(undoTimer); });
  }
  var bestDisplay = document.querySelector(".best-container");
  if (bestDisplay) {
    var bestTimer, bestRestoreTimer, minimumVisible = false, touchMinimumVisible = false;
    var showMinimum = function (fromTouch) {
      window.clearTimeout(bestRestoreTimer);
      minimumVisible = true;
      touchMinimumVisible = !!fromTouch;
      bestDisplay.textContent = self.minimumMoves;
      bestRestoreTimer = window.setTimeout(restoreBest, 1000);
    };
    var restoreBest = function () {
      window.clearTimeout(bestTimer);
      window.clearTimeout(bestRestoreTimer);
      minimumVisible = false;
      touchMinimumVisible = false;
      bestDisplay.textContent = self.bestMoves === null ? "—" : self.bestMoves;
    };
    bestDisplay.addEventListener("touchstart", function () {
      bestTimer = window.setTimeout(function () { showMinimum(true); }, 600);
    });
    var endBestTouch = function () {
      window.clearTimeout(bestTimer);
      if (!minimumVisible) restoreBest();
    };
    bestDisplay.addEventListener("touchend", endBestTouch);
    bestDisplay.addEventListener("touchcancel", endBestTouch);
    bestDisplay.addEventListener("mouseenter", function (event) {
      if (event.ctrlKey) showMinimum(false);
    });
    bestDisplay.addEventListener("mousemove", function (event) {
      if (event.ctrlKey) showMinimum(false);
      else if (!touchMinimumVisible) restoreBest();
    });
    bestDisplay.addEventListener("mouseleave", function () {
      if (!touchMinimumVisible) restoreBest();
    });
  }
  this.bindHelpSwipe();
  this.setup();
}

PowerGameManager.prototype = Object.create(GameManager.prototype);
PowerGameManager.prototype.constructor = PowerGameManager;

PowerGameManager.prototype.bindHelpSwipe = function () {
  var help = document.querySelector(".game-explanation");
  if (!help) return;
  var startX, startY, self = this;
  help.addEventListener("touchstart", function (event) {
    if (event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  });
  help.addEventListener("touchend", function (event) {
    if (startX === undefined || !event.changedTouches.length) return;
    var dx = event.changedTouches[0].clientX - startX;
    var dy = event.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) self.move(dx > 0 ? 1 : 3);
  });
};

PowerGameManager.generatorConfig = {
  attempts: 100,
  totals: [64, 128],
  minTiles: 7,
  maxTiles: 12,
  minMoves: 9,
  maxMoves: 12
};

PowerGameManager.gravityTiming = {
  collapseDelay: 200
};

PowerGameManager.modes = {
  classic: { prefix: "c", label: "Classic", salt: 0 },
  gravity: { prefix: "g", label: "Super Gravity", salt: 0x9e3779b9 },
  push: { prefix: "p", label: "Push to Merge", salt: 0x243f6a88 }
};

PowerGameManager.parseSeed = function (input, fallbackMode) {
  var value = String(input == null ? "" : input).trim().toLowerCase();
  var mode = fallbackMode || "classic", prefix;
  if (/^[cgp]/.test(value)) {
    prefix = value.charAt(0);
    mode = prefix === "g" ? "gravity" : prefix === "p" ? "push" : "classic";
    value = value.slice(1);
  }
  if (!/^\d+(?:\.0+)?$/.test(value) || !isFinite(Number(value))) return null;
  return { mode: mode, value: Number(value) >>> 0 };
};

PowerGameManager.formatSeed = function (mode, value) {
  return (PowerGameManager.modes[mode] || PowerGameManager.modes.classic).prefix +
    (Number(value) >>> 0);
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
  var parsed = seed == null ? { mode: this.mode || "classic", value: Math.floor(Math.random() * 0x100000000) } :
    PowerGameManager.parseSeed(seed, this.mode || "classic");
  if (!parsed) return null;
  var mode = parsed.mode, seedValue = parsed.value;
  var state = (seedValue ^ PowerGameManager.modes[mode].salt) >>> 0;
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
    if (mode === "gravity") board = this.resolveCascades(board);
    if (this.tileCount(board) < config.minTiles || this.tileCount(board) > config.maxTiles) continue;
    if (this.isOneWayRotationPuzzle(board, mode)) continue;
    var minimumMoves = this.shortestSolutionForMode(board, mode);
    if (minimumMoves >= config.minMoves && minimumMoves <= config.maxMoves) {
      return { board: board, minimumMoves: minimumMoves, seed: seedValue, mode: mode };
    }
  }
  return null;
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
    this.mode = PowerGameManager.modes[state.seedMode] ? state.seedMode : "classic";
    var restoredSeed = PowerGameManager.parseSeed(state.seedText || state.seed, this.mode);
    this.seed = restoredSeed ? restoredSeed.value : Math.floor(Date.now() / 86400000);
    this.mode = restoredSeed ? restoredSeed.mode : this.mode;
    var restoredPuzzle = this.randomPuzzle(state.seedText || state.seed);
    this.initialBoard = restoredPuzzle ? restoredPuzzle.board : state.initialBoard;
    this.puzzleKey = "seed-" + this.seedText();
    this.rotation = state.rotation || 0;
    this.moves = state.moves || 0;
    this.minimumMoves = state.minimumMoves == null ? this.shortestSolution(this.initialBoard) : state.minimumMoves;
    this.bestMoves = this.getPuzzleBest();
    this.won = !!state.won;
    this.hardStalemate = !!state.hardStalemate;
    this.softStalemate = !!state.softStalemate;
  } else {
    if (state && state.mode === "power") this.storageManager.clearGameState();
    this.mode = "classic";
    this.seed = Math.floor(Date.now() / 86400000);
    var puzzle = this.randomPuzzle(this.seed);
    if (!puzzle) throw new Error("Unable to generate a Power puzzle");
    this.puzzleKey = "seed-" + this.seedText();
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
  if (!puzzle) return;
  var board = puzzle.board;
  this.seed = puzzle.seed;
  this.mode = puzzle.mode || this.mode || "classic";
  this.puzzleKey = "seed-" + (puzzle.mode ? this.seedText() : this.seed);
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
  var parsed = PowerGameManager.parseSeed(this.seedInput.value, this.mode);
  if (!parsed) return;
  var puzzle = this.randomPuzzle(this.seedInput.value);
  if (!puzzle) return;
  this.seed = puzzle.seed;
  this.mode = puzzle.mode || this.mode || "classic";
  this.puzzleKey = "seed-" + (puzzle.mode ? this.seedText() : this.seed);
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
    seedText: this.seedText(),
    seedMode: this.mode,
    minimumMoves: this.minimumMoves,
    moves: this.moves,
    rotation: this.rotation,
    won: this.won,
    softStalemate: this.softStalemate,
    hardStalemate: this.hardStalemate
  };
};

PowerGameManager.prototype.markUndoTiles = function (previousGrid) {
  var matched = [];
  var currentTiles = [];

  previousGrid.eachCell(function (x, y, tile) {
    if (tile) currentTiles.push({ tile: tile, x: x, y: y });
  });

  this.grid.eachCell(function (x, y, tile) {
    if (!tile) return;
    for (var i = 0; i < currentTiles.length; i++) {
      var current = currentTiles[i];
      if (!matched[i] && current.x === x && current.y === y &&
          current.tile.value === tile.value) {
        matched[i] = true;
        return;
      }
    }
  });

  this.grid.eachCell(function (x, y, tile) {
    if (!tile) return;
    for (var i = 0; i < currentTiles.length; i++) {
      var current = currentTiles[i];
      if (!matched[i] && current.tile.value === tile.value) {
        matched[i] = true;
        tile.previousPosition = { x: current.x, y: current.y };
        return;
      }
    }
    tile.mergedFrom = [];
  });
};

PowerGameManager.prototype.undo = function () {
  if (this.animating || !this.undoStack.length) return;
  var previousGrid = this.grid;
  var state = this.undoStack.pop();
  this.grid = new Grid(state.grid.size, state.grid.cells);
  this.markUndoTiles(previousGrid);
  this.initialBoard = state.initialBoard;
  this.puzzleKey = state.puzzleKey;
  this.seed = state.seed;
  this.mode = state.seedMode || "classic";
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

PowerGameManager.prototype.seedText = function () {
  return PowerGameManager.formatSeed(this.mode || "classic", this.seed);
};

PowerGameManager.prototype.selectMode = function (event) {
  var target = event.target && event.target.closest ? event.target.closest("[data-mode]") : null;
  if (!target) return;
  event.preventDefault();
  var mode = target.getAttribute("data-mode");
  if (!PowerGameManager.modes[mode]) return;
  var menu = document.querySelector(".random-menu");
  if (menu && menu.classList) menu.classList.remove("open");
  this.mode = mode;
  this.newGame();
};

PowerGameManager.prototype.selectStack = function (column) {
  column = Number(column);
  if (this.mode !== "push" || this.animating || this.isGameTerminated() ||
      column < 0 || column >= this.size) return;
  this.undoStack.push(this.snapshot());
  var turns = this.displayTurns();
  var direction = { 0: 2, 1: 1, 2: 0, 3: 3 }[turns];
  var selection = direction === 0 || direction === 2 ?
    { axis: "column", index: turns === 2 ? this.size - 1 - column : column } :
    { axis: "row", index: turns === 1 ? this.size - 1 - column : column };
  this.mergeGrid(direction, selection);
  this.moves++;
  this.updateStatus();
  this.actuate();
};

PowerGameManager.prototype.displayTurns = function () {
  return (((this.rotation || 0) % 360) + 360) % 360 / 90;
};

PowerGameManager.prototype.fallGrid = function (direction) {
  var self = this, vector = this.getVector(direction), moved = false;
  var traversals = this.buildTraversals(vector);
  this.prepareTiles();
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      var cell = { x: x, y: y }, tile = self.grid.cellContent(cell);
      if (!tile) return;
      var positions = self.findFarthestPosition(cell, vector);
      if (!self.positionsEqual(cell, positions.farthest)) {
        self.moveTile(tile, positions.farthest);
        moved = true;
      }
    });
  });
  return moved;
};

PowerGameManager.prototype.mergeGrid = function (direction, selection) {
  var self = this, vector = this.getVector(direction), mergedAny = false;
  var traversals = this.buildTraversals(vector);
  this.prepareTiles();
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      var cell = { x: x, y: y }, tile = self.grid.cellContent(cell);
      if (!tile) return;
      if (selection && ((selection.axis === "column" && x !== selection.index) ||
          (selection.axis === "row" && y !== selection.index))) return;
      var positions = self.findFarthestPosition(cell, vector);
      var next = self.grid.cellContent(positions.next);
      if (next && next.value === tile.value && !next.mergedFrom) {
        var merged = new Tile(positions.next, tile.value * 2);
        merged.mergedFrom = [tile, next];
        self.grid.insertTile(merged);
        self.grid.removeTile(tile);
        tile.updatePosition(positions.next);
        mergedAny = true;
      } else if (!self.positionsEqual(cell, positions.farthest)) {
        self.moveTile(tile, positions.farthest);
      }
    });
  });
  return mergedAny;
};

PowerGameManager.prototype.hasMergeInDirection = function (direction) {
  var self = this, vector = this.getVector(direction), found = false;
  this.grid.eachCell(function (x, y, tile) {
    if (found || !tile) return;
    var other = self.grid.cellContent({ x: x + vector.x, y: y + vector.y });
    if (other && other.value === tile.value) found = true;
  });
  return found;
};

PowerGameManager.prototype.runGravityStages = function (direction) {
  var self = this;
  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var collapseDelay = reducedMotion ? 0 : PowerGameManager.gravityTiming.collapseDelay;
  var finish = function () {
    self.updateStatus();
    self.actuate();
    self.animating = false;
  };
  var stage = function () {
    self.fallGrid(direction);
    self.softStalemate = false;
    self.hardStalemate = false;
    self.actuate();
    window.setTimeout(function () {
      var merged = self.mergeGrid(direction);
      self.softStalemate = false;
      self.hardStalemate = false;
      self.actuate();
      if (merged && self.hasMergeInDirection(direction)) {
        window.setTimeout(stage, collapseDelay);
      } else {
        finish();
      }
    }, collapseDelay);
  };
  stage();
};

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
    if (self.mode === "gravity") {
      self.runGravityStages(gravityDirection);
    } else if (self.mode === "push") {
      self.fallGrid(gravityDirection);
      self.mergeGrid(gravityDirection);
      self.softStalemate = false;
      self.hardStalemate = false;
      self.actuate();
      self.updateStatus();
      self.actuate();
      self.animating = false;
    } else {
      GameManager.prototype.move.call(self, gravityDirection, true);
      self.updateStatus();
      self.actuate();
      self.animating = false;
    }
  }, reducedMotion ? 0 : 450);
};

PowerGameManager.prototype.previewRotation = function (angle) {
  if (this.isGameTerminated() || this.animating) return;
  this.applyRotation(this.rotation + angle, true);
};

PowerGameManager.prototype.endPreview = function (completed) {
  var game = document.querySelector(".game-container");
  if (game) game.classList.toggle("swipe-preview", false);
  if (!completed) this.applyRotation();
};

PowerGameManager.prototype.tileCount = function (board) {
  return board.reduce(function (count, row) {
    return count + row.filter(Boolean).length;
  }, 0);
};

PowerGameManager.prototype.fallBoard = function (source) {
  return source[0].map(function (_, x) {
    var values = source.map(function (row) { return row[x]; }).filter(Boolean);
    var column = [0, 0, 0, 0];
    values.forEach(function (value, index) {
      column[source.length - values.length + index] = value;
    });
    return column;
  }).reduce(function (rows, column) {
    column.forEach(function (value, y) { rows[y].push(value); });
    return rows;
  }, [[], [], [], []]);
};

PowerGameManager.prototype.mergeStack = function (values) {
  var merged = [];
  for (var i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      merged.push(values[i] * 2);
      i++;
    } else merged.push(values[i]);
  }
  return merged;
};

PowerGameManager.prototype.resolveMergeRound = function (source, columns) {
  var board = this.cloneBoard(source), selected = columns || [];
  selected.forEach(function (x) {
    var values = [];
    for (var y = this.size - 1; y >= 0; y--) if (board[y][x]) values.push(board[y][x]);
    var merged = this.mergeStack(values);
    for (var row = 0; row < this.size; row++) board[row][x] = 0;
    merged.forEach(function (value, index) { board[this.size - 1 - index][x] = value; }, this);
  }, this);
  return board;
};

PowerGameManager.prototype.resolveCascades = function (source) {
  var board = this.cloneBoard(source), changed = true;
  while (changed) {
    var next = this.resolveMergeRound(board, [0, 1, 2, 3]);
    changed = JSON.stringify(next) !== JSON.stringify(board);
    board = next;
  }
  return board;
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
  return this.resolveCascades(this.fallBoard(source));
};

PowerGameManager.prototype.nextBoard = function (board, clockwise) {
  var fallen = this.fallBoard(this.rotateBoard(board, clockwise));
  return this.resolveMergeRound(fallen, [0, 1, 2, 3]);
};

PowerGameManager.prototype.nextBoardForMode = function (board, clockwise, mode) {
  if (mode === "gravity") {
    return this.resolveCascades(this.fallBoard(this.rotateBoard(board, clockwise)));
  }
  if (mode === "push") {
    return this.resolveMergeRound(this.fallBoard(this.rotateBoard(board, clockwise)),
      [0, 1, 2, 3]);
  }
  return this.nextBoard(board, clockwise);
};

PowerGameManager.prototype.shortestSolutionForMode = function (start, mode) {
  if (mode !== "push") {
    var original = this.mode;
    this.mode = mode;
    var result = this.shortestSolution(start);
    this.mode = original;
    return result;
  }
  var queue = [{ board: start, distance: 0 }], seen = {};
  var maxMoves = PowerGameManager.generatorConfig.maxMoves;
  seen[JSON.stringify(start)] = true;
  for (var i = 0; i < queue.length; i++) {
    var current = queue[i];
    if (this.tileCount(current.board) === 1) return current.distance;
    if (current.distance >= maxMoves) continue;
    var moves = [this.nextBoardForMode(current.board, true, mode),
      this.nextBoardForMode(current.board, false, mode)];
    for (var column = 0; column < this.size; column++) {
      moves.push(this.resolveMergeRound(current.board, [column]));
    }
    for (var m = 0; m < moves.length; m++) {
      var key = JSON.stringify(moves[m]);
      if (!seen[key]) {
        seen[key] = true;
        queue.push({ board: moves[m], distance: current.distance + 1 });
      }
    }
    if (queue.length > 5000) break;
  }
  return 0;
};

PowerGameManager.prototype.canSolveByRotation = function (start, mode, clockwise) {
  var board = this.cloneBoard(start), seen = {};
  var maxMoves = PowerGameManager.generatorConfig.maxMoves;
  for (var distance = 0; distance <= maxMoves; distance++) {
    if (this.tileCount(board) === 1) return true;
    var key = JSON.stringify(board);
    if (seen[key]) return false;
    seen[key] = true;
    board = this.nextBoardForMode(board, clockwise, mode);
  }
  return this.tileCount(board) === 1;
};

PowerGameManager.prototype.isOneWayRotationPuzzle = function (start, mode) {
  return this.canSolveByRotation(start, mode, true) ||
    this.canSolveByRotation(start, mode, false);
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
      var next = this.nextBoardForMode(current.board, !!side, this.mode || "classic"), key = JSON.stringify(next);
      if (!seen[key]) {
        seen[key] = true;
        queue.push({ board: next, distance: current.distance + 1 });
      }
    }
  }
  return 0;
};

PowerGameManager.prototype.canMergeEventually = function (start, mode) {
  var queue = [{ board: start, distance: 0 }], seen = {};
  var maxMoves = PowerGameManager.generatorConfig.maxMoves;
  mode = mode || this.mode || "classic";
  seen[JSON.stringify(start)] = true;
  for (var i = 0; i < queue.length; i++) {
    var current = queue[i];
    if (current.distance >= maxMoves) continue;
    var moves = [];
    for (var side = 0; side < 2; side++) {
      moves.push(this.nextBoardForMode(current.board, !!side, mode));
    }
    if (mode === "push") {
      for (var column = 0; column < this.size; column++) {
        moves.push(this.resolveMergeRound(current.board, [column]));
      }
    }
    for (var move = 0; move < moves.length; move++) {
      var next = moves[move], key = JSON.stringify(next);
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
  this.softStalemate = !this.won && this.shortestSolutionForMode(board, this.mode || "classic") === 0;
  this.hardStalemate = !this.won && !this.canMergeEventually(board, this.mode || "classic");
};

PowerGameManager.prototype.serialize = function () {
  return {
    mode: "power",
    grid: this.grid.serialize(),
    seedText: this.seedText(),
    rotation: this.rotation,
    moves: this.moves,
    minimumMoves: this.minimumMoves,
    seedMode: this.mode,
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
  if (this.seedInput) this.seedInput.value = this.seedText();
  var modeLabel = document.querySelector(".mode-label");
  if (modeLabel) modeLabel.textContent = PowerGameManager.modes[this.mode].label;
  var game = document.querySelector(".game-container");
  if (game) {
    game.classList.toggle("mode-push", this.mode === "push");
    if (game.setAttribute) game.setAttribute("data-mode", this.mode);
  }
  this.applyRotation();
  if (game) game.classList.toggle("soft-stalemate", this.softStalemate);
};

PowerGameManager.prototype.applyRotation = function (displayRotation, preview) {
  displayRotation = displayRotation == null ? this.rotation : displayRotation;
  var angle = displayRotation + "deg", counter = (-displayRotation) + "deg";
  var grid = document.querySelector(".grid-container");
  var tiles = document.querySelector(".tile-container");
  var game = document.querySelector(".game-container");
  if (grid) grid.style.transform = "rotate(" + angle + ")";
  if (tiles) tiles.style.transform = "rotate(" + angle + ")";
  if (game) {
    game.classList.add("power-mode");
    game.classList.toggle("swipe-preview", !!preview);
    game.style.setProperty("--power-counter-rotation", counter);
  }
};
