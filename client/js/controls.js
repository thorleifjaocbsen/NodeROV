
Controls = function () {
  var self = {
    gp: null,

    forward: 0, // [-100,+100] Forward and reverse
    strafe: 0, // [-100,+100] Left and Right
    yaw: 0, // [-100,+100] Turn left, Turn right
    climb: 0, // [-100,+100] Up and down

    map: {
      gainUp: 12,
      gainDown: 13,
      lightsUp: 15,
      lightsDown: 14,
      cameraUp: 5,
      cameraDown: 7,
      fullscreen: 1,
      depthhold: 0,
      gripClose: 6,
      gripOpen: 4,
      arm: 9,
      disarm: 8,
    },

    callbacks: {},
    debounce: {},
    repeatInterval: {},
    repeatIntervalTimer: {},

    lastUpdate: 0,
    changedSinceReturn: false,
    warned: false,
  }

  self.init = function () {
    window.addEventListener("keydown", controls.keyDown);
    window.addEventListener("keyup", controls.keyUp);
  }

  self.checkGamepad = function () {
    try { self.gp = navigator.getGamepads()[0]; return self.gp.connected; }
    catch (err) { return false; }
  }

  self.update = function () {
    if (!self.checkGamepad()) return false;

    if (self.lastUpdate == self.gp.timestamp) return false;
    self.lastUpdate = self.gp.timestamp;
    self.changedSinceReturn = true;

    self.forward = Math.round(self.gp.axes[1] * 100);
    self.strafe = -1 * Math.round(self.gp.axes[0] * 100);
    self.yaw = -1 * Math.round(self.gp.axes[2] * 100);
    self.climb = Math.round(self.gp.axes[3] * 100);

    // Deadband
    if (Math.abs(self.forward) < 5) self.forward = 0;
    if (Math.abs(self.strafe) < 5) self.strafe = 0;
    if (Math.abs(self.yaw) < 5) self.yaw = 0;
    if (Math.abs(self.climb) < 5) self.climb = 0;

    for (var btn in self.gp.buttons) {
      if (self.gp.buttons[btn].pressed && !self.debounce[btn] && typeof self.callbacks[btn] == "function") {
        self.callbacks[btn]();
        self.debounce[btn] = true;
        if (self.repeatInterval[btn] > 0) {
          self.repeatIntervalTimer[btn] = setInterval(self.callbacks[btn], self.repeatInterval[btn]);
        }
      }
      else {
        self.debounce[btn] = false;
        clearInterval(self.repeatIntervalTimer[btn]);
      }
    }

  }

  self.onPress = function (btn, callback, bounceDelete) {
    if (isNaN(bounceDelete)) bounceDelete = 0;
    bounceDelete = parseInt(bounceDelete);
    self.callbacks[btn] = callback;
    self.repeatInterval[btn] = bounceDelete;
  }

  self.keyDown = function (e) {
    console.log("Key down: %d", e.keyCode);
  }

  self.keyUp = function (e) {
    console.log("Key up: %d", e.keyCode);
  }

  self.returnObject = function () {
    var ret = {};
    for (var i in self) {
      let t = typeof self[i];
      if (t !== "function" && t != "object") {
        ret[i] = self[i];
      }
    }
    self.changedSinceReturn = false;
    return ret;
  }

  return self;
}
