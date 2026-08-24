function PowerStorageManager() {
  LocalStorageManager.call(this);
  this.bestScoreKey = "powerBestScore";
  this.gameStateKey = "powerGameState";
}

PowerStorageManager.prototype = Object.create(LocalStorageManager.prototype);
PowerStorageManager.prototype.constructor = PowerStorageManager;

function PowerHTMLActuator() {
  HTMLActuator.call(this);
}

PowerHTMLActuator.prototype = Object.create(HTMLActuator.prototype);
PowerHTMLActuator.prototype.constructor = PowerHTMLActuator;

PowerHTMLActuator.prototype.message = function (won, moves, minimumMoves, mode) {
  HTMLActuator.prototype.message.call(this, won, moves, minimumMoves, mode);

  if (won && minimumMoves != null && moves !== minimumMoves) {
    var message = this.messageContainer.getElementsByTagName("p")[0];
    var detail = document.createElement("span");

    message.textContent = "Puzzle solved";
    detail.className = "power-move-detail";
    detail.textContent = "in " + moves + " moves";
    message.appendChild(detail);
  }
};

window.requestAnimationFrame(function () {
  new PowerGameManager(4, KeyboardInputManager, PowerHTMLActuator, PowerStorageManager);
});
