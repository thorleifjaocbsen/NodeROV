export default class Controls {

  constructor() {

    this.gp = null;
    this.forward = 0; // [-100,+100] Forward and reverse
    this.backward = 0; // [-100,+100] Left and Right
    this.yaw = 0; // [-100,+100] Turn left, Turn right
    this.climb = 0; // [-100,+100] Up and down

    this.map = {
      "roll": false,
      "pitch": false,
      "yaw": false,
      "ascend": false,
      "forward": false,
      "lateral": false,
      "arm": 9,
      "disarm": 8,
      "toggleArm": false,
      "cameraTiltUp": 4,
      "cameraTiltDown": 5,
      "cameraCenter": false,
      "gainIncrease": 12,
      "gainDecrease": 13,
      "gripperClose": 6,
      "gripperOpen": 7,
      "lightsDimBrighter": 15,
      "lightsDimDarker": 14,
      "depthHoldEnable": false,
      "depthHoldDisable": false,
      "depthHoldToggle": 0,
      "headingHoldEnable": "kb72",
      "headingHoldDisable": "kb74",
      "headingHoldToggle": 2,
      "trimRollLeft": false,
      "trimRollRight": false,
      "fullscreen": 1,
    };
    this.callbacks = {};
    this.debounce = {};
    this.repeatInterval = {};
    this.repeatIntervalTimer = {};

    this.lastUpdate = 0;
    this.changedSinceReturn = false;
    this.warned = false;

    document.addEventListener("keydown", (e) => this.keyDown(e));
    document.addEventListener("keyup", (e) => this.keyUp(e));
  }

  checkGamepad() {
    try {
      this.gp = navigator.getGamepads()[0];
      return this.gp.connected;
    } catch (err) {
      return false;
    }
  }

  update() {
    if (!this.checkGamepad()) return false;

    if (this.lastUpdate == this.gp.timestamp) return false;
    this.lastUpdate = this.gp.timestamp;
    this.changedSinceReturn = true;

    this.forward = Math.round(this.gp.axes[1] * 100);
    this.strafe = -1 * Math.round(this.gp.axes[0] * 100);
    this.yaw = -1 * Math.round(this.gp.axes[2] * 100);
    this.climb = Math.round(this.gp.axes[3] * 100);

    // Deadband
    if (Math.abs(this.forward) < 5) this.forward = 0;
    if (Math.abs(this.strafe) < 5) this.strafe = 0;
    if (Math.abs(this.yaw) < 5) this.yaw = 0;
    if (Math.abs(this.climb) < 5) this.climb = 0;

    for (const btn in this.gp.buttons) {
      if (this.gp.buttons[btn].pressed && !this.debounce[btn] && typeof this.callbacks[btn] == "function") {
        this.callbacks[btn](this.gp.buttons[btn].value);
        this.debounce[btn] = true;

        if (this.repeatInterval[btn] > 0) {

          this.repeatIntervalTimer[btn] = setInterval(() => { this.callbacks[btn](this.gp.buttons[btn].value); }, this.repeatInterval[btn]);
        }
      }
      if (!this.gp.buttons[btn].pressed && this.debounce[btn]) {
        this.debounce[btn] = false;
        if (this.repeatInterval[btn] > 0) {
          clearInterval(this.repeatIntervalTimer[btn]);
        }
      }
    }

  }

  onPress(btn, callback, bounceDelete) {
    if (isNaN(bounceDelete)) bounceDelete = 0;
    bounceDelete = parseInt(bounceDelete);
    this.callbacks[btn] = callback;
    this.repeatInterval[btn] = bounceDelete;
  }

  keyDown(e) {
    const btn = "kb" + e.keyCode;

    if (!this.debounce[btn] && typeof this.callbacks[btn] == "function") {

      this.callbacks[btn]();
      this.debounce[btn] = true;

      if (this.repeatInterval[btn] > 0) {
        this.repeatIntervalTimer[btn] = setInterval(this.callbacks[btn], this.repeatInterval[btn]);
      }
    }
  }

  keyUp(e) {
    const btn = "kb" + e.keyCode;

    if (this.debounce[btn]) {
      this.debounce[btn] = false;

      if (this.repeatInterval[btn] > 0) {
        clearInterval(this.repeatIntervalTimer[btn]);
      }
    }
  }
}