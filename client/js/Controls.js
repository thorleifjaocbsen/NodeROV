const DEFAULT_GAMEPAD = {
  axes: [0,0,0,0],
  buttons: [],
  timestamp: 0
}
class Controls {  

  constructor() {
    this.gamepad = DEFAULT_GAMEPAD
    this.autoUpdate = true

    this.gpIndex = null
    this.gp = [null,null,null,null]

    this.axes = DEFAULT_GAMEPAD.axes
    this.buttons = DEFAULT_GAMEPAD.buttons
    this.timestamp = DEFAULT_GAMEPAD.timestamp
  }


  isGamepadDetected() {
    return ! (this.gpIndex == null)
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

    if(oldTimestamp == this.timestamp) { return false }
    else {
      return true
    }
  }

  getGamepad() {
    return { axes: this.axes, buttons: this.buttons }
  }
}
