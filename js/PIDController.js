/*
 * PID Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Some code are based on code from ArduSub Project
 * https://github.com/bluerobotics/ardusub/blob/master/libraries/AP_Motors/AP_Motors6DOF.cpp
 */

module.exports = class PIDController {

  constructor(options) {

    this.kP = options.kP
    this.kI = options.kI
    this.kD = options.kD
    this.db = options.deadband
    this.max = options.max
    this.min = options.min
    this.lastError = 0
    this.integral = 0
    this.output = 0
    this.lastUpdate = 0
  }


  reset() {

    this.lastError = 0;
    this.integral = 0;
    this.lastUpdate = Date.now();
    return this.output = 0;
  }

  // Calculate output based on setPoint vs actuallly measured value (pV)
  update(setPoint, processVariable) {

    const now = Date.now();
    const timeDiff = now - this.lastUpdate;

    /* Compute error variables */
    const error = setPoint - processVariable;
    this.integral += error * timeDiff;
    const derivative = (error - this.lastError) / timeDiff;

    this.output = (this.kP * error) + (this.kI * pid.integral) + (this.kD * derivative);

    this.lastError = error;
    this.lastUpdate = now;

    if (this.output > this.max) this.output = this.max;
    if (this.output < this.min) this.output = this.min;

    if (this.lastUpdate == 0) return 0;
    return this.output;
  }

}