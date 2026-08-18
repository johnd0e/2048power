function PowerStorageManager() {
  LocalStorageManager.call(this);
  this.bestScoreKey = "powerBestScore";
  this.gameStateKey = "powerGameState";
}

PowerStorageManager.prototype = Object.create(LocalStorageManager.prototype);
PowerStorageManager.prototype.constructor = PowerStorageManager;

window.requestAnimationFrame(function () {
  new PowerGameManager(4, KeyboardInputManager, HTMLActuator, PowerStorageManager);
});
