/*
 * ROV Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

const EventEmitter = require('events');
const PIDController = require('./PIDController');

module.exports = class RemoteOperatedVehicle extends EventEmitter {

  #environment;

  constructor(options) {
    super()

    this.#environment = {
      iTemperature: 0,
      iPressure: 0,
      iHumidity: 0,

      eTemperature: 0,
      ePressure: 0,
      depth: 0,

      voltage: 0,
      current: 0,
      leak: 0,
      accumulatedMah: 0,

      roll: 0,
      pitch: 0,
      heading: 0,

      cpuTemperature: 0,
      cpuLoad: 0,
      memoryUsed: 0,
      diskUsed: 0,

      gain: 10,  // Default to 10%;
      light: 0,
      camera: 0,

      depthHold: undefined,
      headingHold: undefined
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

    this.depthPID = new PIDController({kP: 3, kI: 0.0002, kD: 0, db: 0, min: -100, max: 100});
    this.headingPID = new PIDController({kP: 3, kI: 0.0002, kD: 0, db: 0, min: -100, max: 100});

  }


  constrain(value, min, max) { return Math.max(Math.min(value, max), min) }
  map(x, in_min, in_max, out_min, out_max) { return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min }
  update(type, value) {
    // Check if old value is different from new value
    if (this.#environment[type] != value) {
      this.#environment[type] = value;
      super.emit("environmentChanged", type, value);

      if (type == 'depth' && this.#environment.depthHold) {
        let thrusterOutput = this.depthPID.update(this.#environment.depthHold, value);
        this.ascend(thrusterOutput);
      }
      else if (type == 'heading' && this.#environment.headingHold) {
        let thrusterOutput = this.headingPID.update(this.#environment.headingHold, value);
        //console.log(`Hold heading: ${this.#environment.headingHold}, newHeading: ${value}, thrusterOutput: ${thrusterOutput}`);
        this.yaw(thrusterOutput);
      }

    }
  }

  getEnviromentData(type) {
    return type ? this.#environment[type] : this.#environment;
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

    // Cancel if not armed
    if (!this.armed) return

    // to keep track of changes
    let changes = false

    // If not armed calculate all to 0, if not get actual control data
    let roll, pitch, yaw, ascend, forward, lateral
    if (!this.armed) [roll, pitch, yaw, ascend, forward, lateral] = [0, 0, 0, 0, 0, 0]
    else ({ roll, pitch, yaw, ascend, forward, lateral } = this.controlData)

    // Loop through each motor to calculate output of it
    for (let id in this.motors) {

      const motor = this.motors[id];

      // Calculate the roll pitch yaw movements
      const rollPitchYaw = roll * motor.rollFactor +
        pitch * motor.pitchFactor +
        yaw * motor.yawFactor;

      // Calculate the linaer movements
      const linear = ascend * motor.ascendFactor +
        forward * motor.forwardFactor +
        lateral * motor.lateralFactor;

      // Calculate the output 
      let output = this.constrain(rollPitchYaw + linear, -100, 100);

      // Adjust output to fit gain
      output = output * this.#environment.gain / 100;

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

  disarm(force = false) {

    if (!this.armed && !force) return
    this.armed = false

    // Set all motors off
    this.calculateThrusterOutput()

    super.emit("disarm")
  }

  toggleArm() {

    if (this.armed) this.disarm()
    else this.arm()
  }

  adjustCamera(modifier) {
    let cameraPercentage = this.#environment.camera + parseInt(modifier);
    cameraPercentage = this.constrain(cameraPercentage, 0, 100);
    this.update('camera', cameraPercentage);
    this.emit("cameraChange", this.#environment.camera);
  }

  centerCamera() {
    this.update("camera", 50);
    this.emit("cameraChange", this.#environment.camera);
  }

  adjustGain(modifier) {
    let gain = this.#environment.gain + parseInt(modifier);
    gain = this.constrain(gain, 0, 100);
    this.update("gain", gain);
    this.emit("gainChange", this.#environment.gain);
  }

  gripperClose(value) { if (value > 0) console.log("Close gripper", value) }
  gripperOpen(value) { if (value > 0) console.log("Open gripper", value) }

  adjustLight(value) {
    let light = this.#environment.light + parseInt(value);
    light = this.constrain(light, 0, 100);
    this.update("light", light);
    this.emit("lightChange", this.#environment.light);
  }

  setLight(value) {
    this.adjustLight(value - this.#environment.light);
  }


  headingHoldToggle() { 
    if (this.#environment.headingHold) {
      this.update("headingHold", undefined);
      this.yaw(0);
    } else {
      this.update("headingHold", this.#environment.heading);
      this.headingPID.reset();
    }
  }

  depthHoldToggle() { 
    if (this.#environment.depthHold) {
      this.update("depthHold", undefined);
      this.ascend(0);
    } else {
      this.update("depthHold", this.#environment.depth);
      this.depthPID.reset();
    }
  }

  trimRollLeft(value) { if (value != 0) console.log("Trim roll left") }
  trimRollRight(value) { if (value != 0) console.log("Trim roll right") }

  // Create setters and getters for all private variables


}