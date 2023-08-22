/*
 * ROV Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

const EventEmitter = require('events');
const PIDController = require('./PIDController');
const { log } = require('console');

module.exports = class RemoteOperatedVehicle extends EventEmitter {

  #data;

  constructor(options) {
    super()

    this.#data = {
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
      turns: 0,

      cpuTemperature: 0,
      cpuLoad: 0,
      memoryUsed: 0,
      diskUsed: 0,

      gain: 10,  // Default to 10%;
      light: 0,
      camera: 0,

      depthHold: {
        setPoint: false,
        ...options.depthHoldPID
      },

      headingHold: {
        setPoint: false,
        ...options.headingHoldPID
      },

      armed: false
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

    this.controlData = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      ascend: 0,
      forward: 0,
      lateral: 0
    }

    this.depthPID = new PIDController({
      kP: options.depthHoldPID.p,
      kI: options.depthHoldPID.i,
      kD: options.depthHoldPID.d,
      db: 0,
      min: -100,
      max: 100
    });

    this.headingPID = new PIDController({
      kP: options.headingHoldPID.p,
      kI: options.headingHoldPID.i,
      kD: options.headingHoldPID.d,
      db: 0,
      min: -100,
      max: 100
    });

  }

  // Helper functions
  constrain(value, min, max) { return Math.max(Math.min(value, max), min) }
  map(x, in_min, in_max, out_min, out_max) { return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min }

  update(type, value) {
    const propertyPath = type.split('.'); // Split the type string by dot
    let currentData = this.#data;

    for (const property of propertyPath) {
      if (currentData.hasOwnProperty(property)) {
        if (propertyPath.indexOf(property) === propertyPath.length - 1) {
          
          // Check if old value is different from new value
          if (currentData[property] !== value) {
            currentData[property] = value;
            this.emit("dataChanged", propertyPath[0], this.#data[propertyPath[0]]);
            
            // Update PID controller if depth is changed and depthhold is on.
            if (property === 'depth' && currentData.depthHold.setPoint) {
              // Calculate new thruster output and set it
              let thrusterOutput = this.depthPID.update(currentData.depthHold.setPoint, value);
              this.ascend(thrusterOutput);
            }
            // Update PID controller if heading is changed and heading hold is on.
            else if (property === 'heading' && currentData.headingHold.setPoint) {
              // Calculate new thruster output and set it
              let thrusterOutput = this.headingPID.update(currentData.headingHold.setPoint, value);
              this.yaw(thrusterOutput);
            }


            if (type == 'heading') {
              // Turn Calculator - Thanks to IaTsI for helping me.
              // let diff = Math.abs(oH-nH);
              // if(diff > 180 && oH > nH) { rov.heading.turns ++; }
              // if(diff > 180 && nH > oH) { rov.heading.turns --; }
              // // End of Fun! :/

              let diff = Math.abs(this.#data.heading - value);
              if (diff > 180 && this.#data.heading > value) { this.#data.turns++; }
              if (diff > 180 && value > this.#data.heading) { this.#data.turns--; }

            }
          }
        } else {
          currentData = currentData[property]; // Traverse deeper into the data object
        }
      }
    }
  }

  getROVData(type) {
    return type ? this.#data[type] : this.#data;
  }

  calculateThrusterOutput(force = false) {

    // Cancel if not armed
    if (!this.#data.armed && !force) return

    // to keep track of changes
    let changes = false

    // If not armed calculate all to 0, if not get actual control data
    let roll, pitch, yaw, ascend, forward, lateral
    if (!this.#data.armed) [roll, pitch, yaw, ascend, forward, lateral] = [0, 0, 0, 0, 0, 0]
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
      output = output * this.#data.gain / 100;

      // Tracking changes and storing changes.
      changes = changes || motor.output != output
      motor.output = output
    }

    if (changes == true) {
      this.emit('thusterOutputChanged', this.getOutputUS())
    }
  }

  getOutputUS() {

    const ouputUS = [];

    for (let id in this.motors) {
      const motor = this.motors[id]
      const pin = motor.pwmPin;
      const motorOutput = motor.output;

      let us = this.idleUS;
      if (motorOutput > 0) {
        us = this.map(motorOutput, 0, 100, this.idleUS, this.maxUS);
      } else {
        us = this.map(motorOutput, -100, 0, this.minUS, this.idleUS);
      }
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

    if (this.#data.armed) return
    this.update("armed", true);
    this.emit("arm")
  }

  disarm(force = false) {

    if (!this.#data.armed && !force) return
    this.update("armed", false);

    // Disable heading / depth hold
    this.depthHoldOff();
    this.headingHoldOff();

    // Set all motors off
    this.calculateThrusterOutput(true)

    this.emit("disarm")
  }

  toggleArm() {

    if (this.#data.armed) this.disarm()
    else this.arm()
  }

  adjustCamera(modifier) {
    let cameraPercentage = this.#data.camera + parseInt(modifier);
    cameraPercentage = this.constrain(cameraPercentage, 0, 100);
    this.update('camera', cameraPercentage);
    this.emit("cameraChange", this.#data.camera);
  }

  centerCamera() {
    this.update("camera", 50);
    this.emit("cameraChange", this.#data.camera);
  }

  adjustGain(modifier) {
    let gain = this.#data.gain + parseInt(modifier);
    this.setGain(gain)
  }

  setGain(gain) {
    gain = this.constrain(gain, 0, 100);
    this.update("gain", gain);
    this.emit("gainChange", this.#data.gain);
  }

  gripperState(value) {
    this.emit('gripperChange', value);
  }

  adjustLight(value) {
    let light = this.#data.light + parseInt(value);
    light = this.constrain(light, 0, 100);
    this.update("light", light);
    this.emit("lightChange", this.#data.light);
  }

  setLight(value) {
    this.adjustLight(value - this.#data.light);
  }

  headingHoldOn() {
    if (!this.#data.armed) throw "Cannot enable heading hold on unarmed ROV";
    this.update("headingHold.setPoint", this.#data.heading);
    this.headingPID.reset();
  }

  headingHoldOff() {
    this.update("headingHold.setPoint", false);
    this.yaw(0);
  }

  headingHoldToggle() {
    if (!this.#data.headingHold.setPoint) {
      this.headingHoldOn();
    } else {
      this.headingHoldOff();
    }
  }

  depthHoldOn() {
    if (!this.#data.armed) throw "Cannot enable depth hold on unarmed ROV";
    this.update("depthHold.setPoint", this.#data.depth);
    this.headingPID.reset();
  }

  depthHoldOff() {
    this.update("depthHold.setPoint", false);
    this.ascend(0);
  }

  depthHoldToggle() {
    if (!this.#data.depthHold.setPoint) {
      this.depthHoldOn();
    } else {
      this.depthHoldOff();
    }
  }

  trimRollLeft(value) { if (value != 0) console.log("Trim roll left") }
  trimRollRight(value) { if (value != 0) console.log("Trim roll right") }

}