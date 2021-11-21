/*
 * ROV Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

const EventEmitter = require('events')

module.exports = class RemoteOperatedVehicle {

  constructor(options) {

    this.battery     = { voltage: 0, current: 0, mahUsed: 0 }
    this.attitude    = { roll: 0, pitch: 0, heading: 0 }
    this.environment = {
      internalHumidity: 0,
      internalPressure: 0,
      externalPressure: 0,
      humidity: 0,
      internalTemp: 0,
      externalTemp: 0,
      leak: false
    }

    // uS Overview
    this.minUS  = options && options.hasOwnProperty('minUS') ? options.minUS : 1000
    this.idleUS = options && options.hasOwnProperty('idleUS') ? options.idleUS : 1550;
    this.maxUS  = options && options.hasOwnProperty('maxUS') ? options.maxUS : 2000;

    // Loop through and add all motors for thruster calculations
    this.motors = {}

    if (options && options.hasOwnProperty('motors')) {    

      for (let motor of options.motors) {
        this.motors[motor.id] = { 
          pwmPin: motor.pwmPin, 
          rollFactor: motor.roll,
          pitchFactor: motor.pitch,
          yawFactor: motor.yaw, 
          ascendFactor: motor.ascend, 
          forwardFactor: motor.forward, 
          lateralFactor: motor.lateral 
        }
      }
    }

    this.eventEmitter = new EventEmitter()
    this.armed = false
    this.controlData = {}
  }

  on(event, callback) { this.eventEmitter.on(event, callback) }
  constrain(value, min, max) { return Math.max(Math.min(value, max), min) }
  map(x, in_min, in_max, out_min, out_max) { return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min }


  calculateThrusterOutput() {

    // to keep track of changes
    let changes = false

    // If not armed calculate all to 0, if not get actual control data
    let roll, pitch, yaw, ascend, forward, lateral
    if (!this.armed) [roll, pitch, yaw, ascend, forward, lateral] = [0, 0, 0, 0, 0, 0]
    else ({ roll, pitch, yaw, ascend, forward, lateral } = this.controlData)

    // Loop through each motor to calculate output of it
    for (let id in this.motors) {

      const motor = this.motors[id]

      // Calculate the roll pitch yaw movements
      const rollPitchYaw = roll * motor.rollFactor +
        pitch * motor.pitchFactor +
        yaw * motor.yawFactor

      // Calculate the linaer movements
      const linear = ascend * motor.ascendFactor +
        forward * motor.forwardFactor +
        lateral * motor.lateralFactor

      const output = this.constrain(rollPitchYaw + linear, -1, 1)

      // Tracking changes and storing changes.
      changes = changes || motor.output != output
      motor.output = output
    }

    if(changes == true) {
      this.eventEmitter.emit('thusterOutputChanged', this.getOutputUS())
    }
  }

  getOutputUS() {

    const ouputUS = [];

    for(let id in this.motors) {
      const motor = this.motors[id]
      const pin = motor.pwmPin;
      const motorOutput = motor.output;
      
      let us = this.map(motorOutput, -1, 1, this.minUS, this.maxUS);
      if(motorOutput == 0 || !motorOutput) us = this.idleUS;
     
      us = Math.round(us)

      ouputUS.push({ pin, us })
    }

    return ouputUS;
  }

  controllerInputUpdate(newInput) {

    const lastControlData = this.controlData
    this.controlData = newInput


    // Loop through new controls, if there is a function matching, then run it
    for (const functionName in newInput) {

      // Skip if not pointing to a function name
      if (typeof this[functionName] != "function") continue

      // Process Value to be within requirements
      let value = newInput[functionName]
      const constrainedValue = this.constrain(value, -1, 1)
      if (value != constrainedValue) value = 0

      // Skip if value is not changed since last time
      if (value == lastControlData[functionName]) continue

      // If not run the function with the new value!
      this[functionName](value)
    }
  }

  roll(value) { this.calculateThrusterOutput() }
  pitch(value) { this.calculateThrusterOutput() }
  yaw(value) { this.calculateThrusterOutput() }
  ascend(value) { this.calculateThrusterOutput() }
  forward(value) { this.calculateThrusterOutput() }
  lateral(value) { this.calculateThrusterOutput() }

  arm(value) {

    if (this.armed || value != 0) return
    this.armed = true
    this.eventEmitter.emit("arm")
  }

  disarm(value) {

    if (!this.armed || value != 0) return
    this.armed = false

    // Set all motors off
    this.calculateThrusterOutput()

    this.eventEmitter.emit("disarm")
  }

  toggleArm(value) {

    if (!value) return
    if (this.armed) this.disarm()
    else this.arm()
  }

  cameraTiltUp(value) { if (value != 0) console.log("Tilt camera up", value) }
  cameraTiltDown(value) { if (value != 0) console.log("Tilt camera down") }
  cameraCenter(value) { if (value != 0) console.log("Set camera center") }

  gainIncrease(value) { if (value != 0) console.log("Increment gain by 100") }
  gainDecrease(value) { if (value != 0) console.log("Decrement gain by 100") }

  gripperClose(value) { if (value > 0) console.log("Close gripper", value) }
  gripperOpen(value) { if (value > 0) console.log("Open gripper", value) }

  lightsDimBrighter(value) { if (value != 0) console.log("Brighten lights with X amount") }
  lightsDimDarker(value) { if (value != 0) console.log("Darken lights with X amount") }

  depthHoldEnable(value) { if (value != 0) console.log("Enable depth hold!") }
  depthHoldDisable(value) { if (value != 0) console.log("Disable depth hold!") }
  depthHoldToggle(value) { if (value != 0) console.log("Toggle depth hold!") }

  headingHoldEnable(value) { if (value != 0) console.log("Enable heading hold") }
  headingHoldDisable(value) { if (value != 0) console.log("Disable heading hold") }
  headingHoldToggle(value) { if (value != 0) console.log("Toggle heading hold") }

  trimRollLeft(value) { if (value != 0) console.log("Trim roll left") }
  trimRollRight(value) { if (value != 0) console.log("Trim roll right") }


}