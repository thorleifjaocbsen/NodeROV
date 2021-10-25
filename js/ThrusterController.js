/*
 * Thruster Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Some code are based on code from ArduSub Project
 * https://github.com/bluerobotics/ardusub/blob/master/libraries/AP_Motors/AP_Motors6DOF.cpp
 */

const EventEmitter = require('events')
const DEFAULT_CONTROL_INPUT = { roll: 0, pitch: 0, yaw: 0, climb: 0, forward: 0, lateral: 0 }

module.exports = class ThrusterController {

  constructor(options) {
    this.eventEmitter = new EventEmitter()
    let default_values = {
      minUS: 1000,
      idleUS: 1500,
      maxUS: 2000,
      motors: []
    }

    options = {...default_values, ...options};

    this.motors = []
    
    this.minUS = options.minUS;
    this.idleUS = options.idleUS;
    this.maxUS = options.maxUS;

    for(let motor of options.motors) {
      this.addMotor(...motor)
    }

    this.calculateOutput()
  }

  on(event, callback) {
    this.eventEmitter.on(event, callback)
  }

  constrain(value, min, max) {
    return Math.max(Math.min(value, max), min)
  }


  map( x,  in_min,  in_max,  out_min,  out_max){
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  } 


  calculateOutput(input) {

    // Ensure that if any is missing they default to 0 (center).
    input = {...DEFAULT_CONTROL_INPUT, ...input};

    // If values are beyond the constraint then we set them to 0.
    for (const i in input) {
      let constraintInput = this.constrain(input[i], -1, 1);
      if(constraintInput != input[i]) {
        input[i] = 0;
      }
    }
    
    for (let motor of this.motors) {

      // Calculate the roll pitch yaw movements
      const rollPitchYaw = input.roll  * motor.rollFactor +
                           input.pitch * motor.pitchFactor +
                           input.yaw   * motor.yawFactor;

      // Calculate the linaer movements
      const linear = input.climb   * motor.climbFactor +
                     input.forward * motor.forwardFactor +
                     input.lateral * motor.lateralFactor;

      const output = rollPitchYaw + linear;
      motor.output = this.constrain(output, -1, 1);
    }

    this.eventEmitter.emit("thrusterOutputChange", this.getOutputUS())

  }


  getOutputUS() {

    const ouputUS = [];

    for(let motor of this.motors) {
      const pin = motor.pwmPin;
      const motorOutput = motor.output;
      
      let us = this.map(motorOutput, -1, 1, this.minUS, this.maxUS);
      if(motorOutput == 0 || !motorOutput) us = this.idleUS;

      ouputUS.push({ pin, us })
    }

    return ouputUS;
  }


  addMotor(pwmPin, rollFactor, pitchFactor, yawFactor, climbFactor, forwardFactor, lateralFactor, testingOrder) {
    this.motors.push({ pwmPin, rollFactor, pitchFactor, yawFactor, climbFactor, forwardFactor, lateralFactor, testingOrder })
  }

}