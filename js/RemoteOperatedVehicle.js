/*
 * ROV Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

const EventEmitter = require('events');
const PIDController = require('./PIDController');

const DEFAULT_CONTROL_INPUT = { roll: 0, pitch: 0, yaw: 0, climb: 0, forward: 0, lateral: 0 };

module.exports = class RemoteOperatedVehicle extends EventEmitter {
  constructor(config) {
    super();
    this.armed = false
    this.controlInput = this.DEFAULT_CONTROL_INPUT
    this.depth = {
      hold: false,
      wanted: 0,
      PID: new PIDController()
    }
    this.heading = {
      hold: false,
      current: 0,
      wanted: 0,
      PID: false,
      turns: 0,
      totalHeading: 0
    }
    this.roll = 0
    this.pitch = 0
    this.gain = 100
  }

  arm() {
    if (this.armed) return
    this.armed = true
    super.emit("arm")
  }


  disarm() {
    if (!this.armed) return
    this.setControlInput(DEFAULT_CONTROL_INPUT)
    this.armed = false
    super.emit("disarm")
  }

  toggleArm() {
    if (this.armed) this.disarm()
    else this.arm()
  }

  setControlInput(newInput) {
    if (!this.armed) return false
    this.controlInput = {...DEFAULT_CONTROL_INPUT, ...newInput}
    super.emit("controlInputChange", newInput)
  }
  
}