/*
 * ROV Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

// Button
/*
Every time I press an button the action is sent with "pressed" true
When I release it is sent again with "pressed" false
For repeated actions it will send the same command multiple times every X millisecond



*/

const EventEmitter = require('events')
const DEFAULT_CONTROL_INPUT = { axes: [0,0,0,0], buttons: [] }

module.exports = class RemoteOperatedVehicle {
  constructor(config) {

    // Button actions:
    // Repeat: Function is repeated every X ms
    // Momentary: Function resets once the button is released
    
    this.controlMapping = {
      axes: {
        "0": "forward",
        "1": "lateral",
        "2": "climb",
        "3": "yaw"
      },
      buttons: {
        "0": ["arm", false],
        "1": ["disarm", false],
        "2": ["cameraTiltUp", true],
        "3": ["cameraTiltDown", true],
        "4": ["cameraCenter", false],
        "5": ["gainIncrease", false],
        "6": ["gainDecrease", false],
        "7": ["lightsDimBrighter", true],
        "8": ["lightsDimDarker", true],
        "9": ["depthHoldToggle", false],
        "10": ["headingHoldToggle", false],
        "11": ["gripperClose", false],
        "12": ["gripperOpen", false],
      }
    }

    // 

    this.environment = {
      internalHumidity: 0,
      internalPressure: 0,
      externalPressure: 0,
      humidity: 0,
      internalTemp: 0,
      externalTemp: 0,
      leak: false
    }
    this.battery = {
      voltage: 0,
      current: 0,
      mahUsed: 0
    }

    this.attitude = {
      roll: 0,
      pitch: 0,
      heading: 0
    }

    this.eventEmitter = new EventEmitter()
    this.armed = false
    this.controlInput = this.DEFAULT_CONTROL_INPUT
  }

  on(event, callback) {
    this.eventEmitter.on(event, callback)
  }

  controllerInputUpdate(newInput) {
    this.controlInput = { ...DEFAULT_CONTROL_INPUT, ...newInput }
   
    // Go through all buttons to see if anyone is pressed
    for (const buttonId in this.controlInput.buttons) {
      const pressed = this.controlInput.buttons[buttonId].pressed
      const mappedFunction = this.controlMapping.buttons[buttonId][0]
      const repeat = this.controlMapping.buttons[buttonId][1]

      // If not repeat just fire of that function
      if(repeat == false) this[mappedFunction](pressed)

      console.log(`Pressing ${mappedFunction[0]} - Repeat: ${mappedFunction[1]}`)
    }

    // Go through axis to calculate thruster output
    // this.controll

    this.eventEmitter.emit("controlInputChange", newInput)
  }




  arm(pressed) {

    if (this.armed || !pressed) return
    this.armed = true
    this.eventEmitter.emit("arm")
  }

  disarm(pressed) {

    if (!this.armed || !pressed) return
    this.armed = false
    this.eventEmitter.emit("disarm")
  }

  toggleArm(pressed) {
    
    if (!pressed) return
    if (this.armed) this.disarm()
    else this.arm()
  }

  cameraTiltUp(pressed) { if (pressed) console.log("Tilt camera up") }
  cameraTiltDown(pressed) { if (pressed) console.log("Tilt camera down") }
  cameraCenter(pressed) { if (pressed) console.log("Set camera center") }

  gainIncrease(pressed) { if (pressed) console.log("Increment gain by 100") }
  gainDecrease(pressed) { if (pressed) console.log("Decrement gain by 100") }

  gripperClose(pressed) {
    if(pressed == true) { console.log("Close gripper") }
    else { console.log("Stop moving gripper!!") }
  }
  gripperOpen(pressed) {
    if(pressed == true) { console.log("Open gripper") }
    else { console.log("Stop moving gripper!!") }
  }

  lightsDimBrighter(pressed) { if (pressed) console.log("Brighten lights with X amount") }
  lightsDimDarker(pressed) { if (pressed) console.log("Darken lights with X amount") }

  depthHoldEnable(pressed) { if (pressed) console.log("Enable depth hold!") }
  depthHoldDisable(pressed) { if (pressed) console.log("Disable depth hold!") }
  depthHoldToggle(pressed) { if (pressed) console.log("Toggle depth hold!") }

  headingHoldEnable(pressed) { if (pressed) console.log("Enable heading hold") }
  headingHoldDisable(pressed) { if (pressed) console.log("Disable heading hold") }
  headingHoldToggle(pressed) { if (pressed) console.log("Toggle heading hold") }

  trimRollLeft(pressed) { if (pressed) console.log("Trim roll left") }
  trimRollRight(pressed) { if (pressed) console.log("Trim roll right") }


}