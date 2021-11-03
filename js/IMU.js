/*
 * IMU
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const LSM9DS1 = require('./drivers/LSM9DS1')
 
module.exports = class IMU {

  constructor(options) {

    this.eventEmitter = new EventEmitter()

    this.sensor = new LSM9DS1();

    this.sensor.init()
    
    // Auto Read Sensor 
    this.autoRead = true
    this.readInterval = 200
  }


  on(event, callback) {

    this.eventEmitter.on(event, callback)
  }


  readSensorData() {
    this.sensor.readAll()
    .then((result) => {
      console.log(`Gyro (X: ${result.gyro.x} Y: ${result.gyro.y} Z:${result.gyro.z})`)
      console.log(`Accel(X: ${result.accel.x} Y: ${result.accel.y} Z:${result.accel.z})`)
      console.log(`Mag  (X: ${result.mag.x} Y: ${result.mag.x} Z:${result.mag.x} HEADING:${180 * Math.atan2(result.mag.y, result.mag.x) / Math.PI})\n`)

      this.eventEmitter.emit('read')
      if (this.autoRead) setTimeout(() => { this.readSensorData() }, this.readInterval)
  
  })
  }

  
  parseData(data) {

    this.temperature = data.temperature_C
    this.humidity = data.humidity
    this.pressure = data.pressure_hPa

    this.eventEmitter.emit('read')
  }
}