/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const BME280_SENSOR = require('bme280-sensor')

module.exports = class BME280 {

  constructor() {

    this.eventEmitter = new EventEmitter()
    this.bme280 = new BME280_SENSOR({ i2cBusNo: 1, i2cAddress: 0x77 })
    this.bme280.init()
    .then(() => {
      this.eventEmitter.emit("init")
      this.readSensorData()
    })
    .catch(err => this.eventEmitter.emit('initError', err))

    // Default values = 0
    this.temperature = 0
    this.humidity = 0
    this.pressure = 0

    // Auto Read Sensor 
    this.autoRead = true
    this.readInterval = 5000
  }


  on(event, callback) {

    this.eventEmitter.on(event, callback)
  }


  readSensorData() {

    this.bme280.readSensorData()
    .then((data) => this.parseData(data))
    .catch(err => this.eventEmitter.emit('readError', err))

    if (this.autoRead) setTimeout(() => { this.readSensorData() }, this.readInterval)
  }

  
  parseData(data) {

    this.temperature = data.temperature_C
    this.humidity = data.humidity
    this.pressure = data.pressure_hPa

    this.eventEmitter.emit('read')
  }
}