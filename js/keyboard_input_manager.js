function KeyboardInputManager() {
  this.events = {};

  if (window.navigator.msPointerEnabled) {
    //Internet Explorer 10 style
    this.eventTouchstart    = "MSPointerDown";
    this.eventTouchmove     = "MSPointerMove";
    this.eventTouchend      = "MSPointerUp";
  } else {
    this.eventTouchstart    = "touchstart";
    this.eventTouchmove     = "touchmove";
    this.eventTouchend      = "touchend";
  }

  this.listen();
}

KeyboardInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;

  var map = {
    38: 0, // Up
    39: 1, // Right
    40: 2, // Down
    37: 3, // Left
    75: 0, // Vim up
    76: 1, // Vim right
    74: 2, // Vim down
    72: 3, // Vim left
    87: 0, // W
    68: 1, // D
    83: 2, // S
    65: 3  // A
  };

  // Respond to direction keys
  document.addEventListener("keydown", function (event) {
    var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
                    event.shiftKey;
    var mapped    = map[event.which];

    if (!modifiers) {
      if (mapped !== undefined) {
        event.preventDefault();
        self.emit("move", mapped);
      }
    }

    // R key restarts the game
    if (!modifiers && (event.which === 82 || event.which === 13)) {
      self.restart.call(self, event);
    }
    if (!modifiers && event.which === 8) {
      event.preventDefault();
      self.emit("undo");
    }
  });

  // Respond to button presses
  this.bindButtonPress(".retry-button", this.restart);
  this.bindButtonPress(".restart-button", this.restart);
  this.bindButtonPress(".reset-button", this.restart);
  this.bindButtonPress(".keep-playing-button", this.keepPlaying);

  // Respond to swipe events
  var touchStartClientX, touchStartClientY, touchStartTime, touchStartAngle;
  var gameContainer = document.getElementsByClassName("game-container")[0];

  var touchAngle = function (clientX, clientY) {
    var bounds = gameContainer.getBoundingClientRect();
    var x = clientX - (bounds.left || 0) - bounds.width / 2;
    var y = clientY - (bounds.top || 0) - bounds.height / 2;
    return Math.sqrt(x * x + y * y) < 10 ? null : Math.atan2(y, x) * 180 / Math.PI;
  };

  var rotationAngle = function (clientX, clientY) {
    var currentAngle = touchAngle(clientX, clientY);
    if (touchStartAngle === null && currentAngle !== null) touchStartAngle = currentAngle;
    if (touchStartAngle === null || currentAngle === null) return 0;
    var angle = currentAngle - touchStartAngle;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    return Math.max(-90, Math.min(90, angle));
  };

  gameContainer.addEventListener(this.eventTouchstart, function (event) {
    if ((!window.navigator.msPointerEnabled && event.touches.length > 1) ||
        event.targetTouches.length > 1) {
      return; // Ignore if touching with more than 1 finger
    }

    if (window.navigator.msPointerEnabled) {
      touchStartClientX = event.pageX;
      touchStartClientY = event.pageY;
    } else {
      touchStartClientX = event.touches[0].clientX;
      touchStartClientY = event.touches[0].clientY;
    }
    touchStartTime = Date.now();
    touchStartAngle = touchAngle(touchStartClientX, touchStartClientY);

    event.preventDefault();
  });

  gameContainer.addEventListener(this.eventTouchmove, function (event) {
    var touchClientX, touchClientY;
    if (window.navigator.msPointerEnabled) {
      touchClientX = event.pageX;
      touchClientY = event.pageY;
    } else {
      touchClientX = event.touches[0].clientX;
      touchClientY = event.touches[0].clientY;
    }
    var angle = rotationAngle(touchClientX, touchClientY);
    if (angle) self.emit("preview", angle);
    event.preventDefault();
  });

  gameContainer.addEventListener(this.eventTouchend, function (event) {
    if ((!window.navigator.msPointerEnabled && event.touches.length > 0) ||
        event.targetTouches.length > 0) {
      return; // Ignore if still touching with one or more fingers
    }

    var touchEndClientX, touchEndClientY;

    if (window.navigator.msPointerEnabled) {
      touchEndClientX = event.pageX;
      touchEndClientY = event.pageY;
    } else {
      touchEndClientX = event.changedTouches[0].clientX;
      touchEndClientY = event.changedTouches[0].clientY;
    }

    var dx = touchEndClientX - touchStartClientX;
    var absDx = Math.abs(dx);

    var dy = touchEndClientY - touchStartClientY;
    var absDy = Math.abs(dy);
    var distance = Math.max(absDx, absDy);
    var angle = rotationAngle(touchEndClientX, touchEndClientY);
    var quickSwipe = Date.now() - touchStartTime < 300;
    var completed = quickSwipe ? distance > 10 : Math.abs(angle) > 67.5;

    self.emit("previewEnd", completed);
    if (completed) {
      // (right : left) : (down : up)
      self.emit("move", angle ? (angle > 0 ? 1 : 3) :
        (absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 3 : 1)));
    }
  });
};

KeyboardInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};

KeyboardInputManager.prototype.keepPlaying = function (event) {
  event.preventDefault();
  this.emit("keepPlaying");
};

KeyboardInputManager.prototype.bindButtonPress = function (selector, fn) {
  var button = document.querySelector(selector);
  if (!button) return;
  button.addEventListener("click", fn.bind(this));
  button.addEventListener(this.eventTouchend, fn.bind(this));
};
