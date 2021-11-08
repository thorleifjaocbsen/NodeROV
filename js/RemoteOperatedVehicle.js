/*
 * ROV Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

const EventEmitter = require('events')
const DEFAULT_CONTROL_INPUT = { roll: 0, pitch: 0, yaw: 0, climb: 0, forward: 0, lateral: 0 }

module.exports = class RemoteOperatedVehicle {
  constructor(config) {

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

  arm() {
    if (this.armed) return
    this.armed = true
    this.eventEmitter.emit("arm")
  }


  disarm() {
    if (!this.armed) return
    this.setControlInput(DEFAULT_CONTROL_INPUT)
    this.armed = false
    this.eventEmitter.emit("disarm")
  }

  toggleArm() {
    if (this.armed) this.disarm()
    else this.arm()
  }

  setControlInput(newInput) {
    if (!this.armed) return false
    this.controlInput = { ...DEFAULT_CONTROL_INPUT, ...newInput }
    this.eventEmitter.emit("controlInputChange", newInput)
  }

}