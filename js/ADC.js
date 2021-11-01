/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const ADS1015 = require('ads1015')


const PGA = 4.096 // Power Gain Amplifier  - 4.096 on gain 1
const MAX_RANGE = 2048 // ADS1015 - 2^(12-1) // 12bit, -2048 to 2047


const connection = [1, 0x48, 'i2c-bus']
 
module.exports = class ADC {

  constructor(options) {

    this.eventEmitter = new EventEmitter()

    this.busNo = 1
    this.address = 0x48
    this.provider = 'i2c-bus'

    ADS1015.open(this.busNo, this.address, this. provider)
    .then(ads1015 => {
      this.sensor = ads1015
      this.sensor.gain = 1
      this.readSensorData()
      this.eventEmitter.emit('init')
    })


    this.voltageMultiplier = (options && options.hasOwnProperty('vMultiplier')) ? options.voltageMultiplier : 5.697050938;    
    this.currentMultiplier = (options && options.hasOwnProperty('cMultiplier')) ? options.currentMultiplier : 5.697050938;    

    // Default values = 0
    this.leak = 0
    this.current = 0
    this.voltage = 0

    // Auto Read Sensor 
    this.autoRead = true
    this.readInterval = 1000
  }


  on(event, callback) {

    this.eventEmitter.on(event, callback)
  }


  async readSensorData() {


    this.leak = await this.sensor.measure('0+GND')  / MAX_RANGE * PGA
    this.voltage = (await this.sensor.measure('1+GND') / MAX_RANGE * PGA) * this.voltageMultiplier
    this.current = await this.sensor.measure('2+GND')  / MAX_RANGE * PGA

    this.eventEmitter.emit('read')

    if (this.autoRead) setTimeout(() => { this.readSensorData() }, this.readInterval)
  }

  
  parseData(data) {

    this.temperature = data.temperature_C
    this.humidity = data.humidity
    this.pressure = data.pressure_hPa

    this.eventEmitter.emit('read')
  }
}