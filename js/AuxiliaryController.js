/*
 * Auxiliary Controller Class
 * Author: Thorleif Jacobsen
 * Credits: Some code are based on code from ArduSub Project
 * https://github.com/bluerobotics/ardusub/blob/master/libraries/AP_Motors/AP_Motors6DOF.cpp
 */

const EventEmitter = require('events')

module.exports = class AuxiliaryController {

  constructor(options) {

    this.eventEmitter = new EventEmitter()

    let default_values = {
      minUS: 1000,
      idleUS: 1500,
      maxUS: 2000,
      devices: []
    }

    options = {...default_values, ...options};

    this.devices = options.devices
    this.devices.forEach(device => { device.us = device.idleUS });
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

  getDevice(id) {

    return this.devices.filter( device => { return device.id == id } )[0] || false
  }

  calculateOutput(deviceId, input) {
    
    // Get device
    const device = this.getDevice(deviceId)
    if(!device) return false

    // Constrain input between 0 and 1, if over default to 0
    let constraintInput = this.constrain(input, -1, 1)
    if(constraintInput != input) { input = 0 }

    // Calculate US
    device.us = this.map(input, -1, 1, device.minUS, device.maxUS)
    
    // Emit event for change
    this.eventEmitter.emit('deviceOutputChange', device)    
  }
}