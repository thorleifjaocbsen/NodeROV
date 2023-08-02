/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const BME280_SENSOR = require('bme280-sensor')

module.exports = class InternalPressureSensor extends EventEmitter {

  constructor() {

    super();

    this.bme280 = new BME280_SENSOR({ i2cBusNo: 1, i2cAddress: 0x77 })
    this.bme280.init()
    .then(() => {
      this.emit("init")
      this.readSensorData()
    })
    .catch(err => this.emit('initError', err))

    // Default values = 0
    this.temperature = 0
    this.humidity = 0
    this.pressure = 0
    this.data = false;

    // Auto Read Sensor 
    this.autoRead = true
    this.readInterval = 5000
  }

  readSensorData() {

    this.bme280.readSensorData()
    .then((data) => this.parseData(data))
    .catch(err => this.emit('readError', err))

    if (this.autoRead) setTimeout(() => { this.readSensorData() }, this.readInterval)
  }

  
  parseData(data) {

    // Check if data has changed
    if (this.data != data) {
      this.emit("change");
      this.data = data;
    }

    // Update fields with fresh data
    this.temperature = data.temperature_C
    this.humidity = data.humidity
    this.pressure = data.pressure_hPa

    this.emit('read')
  }

  getHumidity(digits = 0) {
    return this.humidity.toFixed(digits);
  }

  getTemperature(digits = 1) {
    return this.temperature.toFixed(digits);
  }

  getPressure(digits = 0) {
    return this.pressure.toFixed(digits);
  }

}