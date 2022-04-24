/*
 * ROV Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

const EventEmitter = require('events')

module.exports = class RemoteOperatedVehicle extends EventEmitter {

  #enviroment; 

  constructor(options) {
    super()

    this.#enviroment = {
      iTemperature: 0,
      iPressure: 0,
      iHumidity: 0,
    
      eTemperature: 0,
      ePressure: 0,
    
      leak: 0,
    
      voltage: 0,
      current: 0,
      accumulatedMah: 0,
    
      roll: 0,
      pitch: 0,
      heading: 0,

      cpuTemperature: 0,
      cpuLoad: 0,
      memoryUsed: 0,
      diskUsed: 0    
    };

    // uS Overview
    this.minUS = options && options.hasOwnProperty('minUS') ? options.minUS : 1000
    this.idleUS = options && options.hasOwnProperty('idleUS') ? options.idleUS : 1550;
    this.maxUS = options && options.hasOwnProperty('maxUS') ? options.maxUS : 2000;

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

    this.armed = false
    this.controlData = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      ascend: 0,
      forward: 0,
      lateral: 0
    }
  }


  constrain(value, min, max) { return Math.max(Math.min(value, max), min) }
  map(x, in_min, in_max, out_min, out_max) { return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min }
  update(type, value) {
    // Check if old value is different from new value
    if (this.#enviroment[type] != value) {
      this.#enviroment[type] = value;
      super.emit("environmentChanged", type, value)
    }
  }

  getEnviromentData(type) {
    return type ? this.#enviroment[type] : this.#enviroment;
  }


  // Generate telemetry data
  getTelemetry() {
    const motors = [];

    for (let id in this.motors) {
      motors.push(this.motors[id].output * 100);
    };

    return {
      battery: this.battery,
      attitude: this.attitude,
      environment: this.environment,
      motors
    }
  }

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

      const output = this.constrain(rollPitchYaw + linear, -100, 100)

      // Tracking changes and storing changes.
      changes = changes || motor.output != output
      motor.output = output
    }

    if (changes == true) {
      super.emit('thusterOutputChanged', this.getOutputUS())
    }
  }

  getOutputUS() {

    const ouputUS = [];

    for (let id in this.motors) {
      const motor = this.motors[id]
      const pin = motor.pwmPin;
      const motorOutput = motor.output;

      let us = this.map(motorOutput, -100, 100, this.minUS, this.maxUS);
      if (motorOutput == 0 || !motorOutput) us = this.idleUS;

      us = Math.round(us)

      ouputUS.push({ pin, us, percentage: motorOutput })
    }

    return ouputUS;
  }

  command(command, value) {

    // Verify that it is a function
    if (typeof this[command] !== 'function') return;

    const constrainedValue = this.constrain(value, -100, 100);
    if (value != constrainedValue) value = 0;

    // If not run the function with the new value!
    this[command](value);
  }

  roll(value) { this.controlData.roll = value; this.calculateThrusterOutput() }
  pitch(value) { this.controlData.pitch = value; this.calculateThrusterOutput() }
  yaw(value) { this.controlData.yaw = value; this.calculateThrusterOutput() }
  ascend(value) { this.controlData.ascend = value; this.calculateThrusterOutput() }
  forward(value) { this.controlData.forward = value; this.calculateThrusterOutput() }
  lateral(value) { this.controlData.lateral = value; this.calculateThrusterOutput() }

  arm() {

    if (this.armed) return
    this.armed = true
    super.emit("arm")
  }

  disarm() {

    if (!this.armed) return
    this.armed = false

    // Set all motors off
    this.calculateThrusterOutput()

    super.emit("disarm")
  }

  toggleArm() {

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

  // Create setters and getters for all private variables
  

}