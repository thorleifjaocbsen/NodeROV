const DEFAULT_GAMEPAD = {
  axes: [0,0,0,0],
  buttons: [],
  timestamp: 0
}
class Controls {  

  constructor() {
    this.lastUpdate = 0
    this.gamepad = DEFAULT_GAMEPAD
    this.autoUpdate = true
    this.updateInterval = 1
    this.buttons = []

    this.update()
  }

  update() {

    try { 
      const gp = navigator.getGamepads()[0]
      if (gp) { this.gamepad = gp }
    }
    catch (e) { 
      this.gamepad = DEFAULT_GAMEPAD 
    }
    if (this.autoUpdate) setTimeout(() => { this.update() }, this.updateInterval)
  }

  getControls() { 

    if (this.lastUpdate != this.gamepad.timestamp) {
      this.lastUpdate = this.gamepad.timestamp

      for (let i = 0; i<this.gamepad.buttons.length; i++) {
        this.buttons[i] = this.gamepad.buttons[i].pressed
      }
    }
    return {
      axes: this.gamepad.axes,
      buttons: this.buttons
    }
  }
}
