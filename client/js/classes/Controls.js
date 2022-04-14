const DEFAULT_GAMEPAD = {
  axes: [0, 0, 0, 0],
  buttons: [],
  timestamp: 0
}
export default class Controls {

  constructor() {
    this.gamepad = DEFAULT_GAMEPAD
    this.autoUpdate = true

    this.gpIndex = null
    this.gp = navigator.getGamepads();

    this.axes = DEFAULT_GAMEPAD.axes
    this.buttons = DEFAULT_GAMEPAD.buttons
    this.timestamp = DEFAULT_GAMEPAD.timestamp
  }


  isGamepadDetected() {
    return !(this.gpIndex == null)
  }

  detectPressedGamepad() {
    const gp = navigator.getGamepads()

    for (var i = 0; i < gp.length; i++) {

      if (this.gp[i] != gp[i]) {
        this.gp = gp
        this.gpIndex = i
        return gp[i]
      }
    }

    return false
  }

  disconnectGamepad() {
    this.gpIndex = null
    this.gp = navigator.getGamepads()
  }

  inputChanged() {
    const oldTimestamp = this.timestamp
    try {
      const gp = navigator.getGamepads()[this.gpIndex]
      this.axes = gp.axes
      gp.buttons.forEach((elem, index) => {
        this.buttons[index] = elem.pressed
      })
      this.timestamp = gp.timestamp
    }
    catch (e) {
      this.axes = DEFAULT_GAMEPAD.axes
      this.buttons = DEFAULT_GAMEPAD.buttons
      this.timestamp = DEFAULT_GAMEPAD.timestamp
      this.disconnectGamepad()
    }

    return this.timestamp != oldTimestamp;
  }

  getGamepad() {
    const gp = navigator.getGamepads()[this.gpIndex];
    return {
      "roll": 0,
      "pitch": 0,
      "yaw": gp.axes[2],
      "ascend": gp.axes[3],
      "forward": gp.axes[1],
      "lateral": gp.axes[0],
      "arm": gp.buttons[9].value,
      "disarm": gp.buttons[8].value,
      "toggleArm": 0,
      "cameraTiltUp": gp.buttons[5].value,
      "cameraTiltDown": gp.buttons[4].value,
      "cameraCenter": gp.buttons[10].value,
      "gainIncrease": gp.buttons[12].value,
      "gainDecrease": gp.buttons[13].value,
      "gripperClose": gp.buttons[6].value,
      "gripperOpen": gp.buttons[7].value,
      "lightsDimBrighter": gp.buttons[15].value,
      "lightsDimDarker": gp.buttons[14].value,
      "depthHoldEnable": 0,
      "depthHoldDisable": 0,
      "depthHoldToggle": gp.buttons[2].value,
      "headingHoldEnable": 0,
      "headingHoldDisable": 0,
      "headingHoldToggle": gp.buttons[3].value,
      "trimRollLeft": 0,
      "trimRollRight": 0
    }
  }
}
