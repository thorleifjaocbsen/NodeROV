/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const ADS1015 = require('ads1015')

const PGA = 4.096; // Power Gain Amplifier  - 4.096 on gain 1
const MAX_RANGE = 2048; // ADS1015 - 2^(12-1) // 12bit, -2048 to 2047
module.exports = class AnalogDigitalConverter extends EventEmitter {


  constructor(options) {

    super();

    this.busNo = 1;
    this.address = 0x48;
    this.provider = 'i2c-bus';

    ADS1015.open(this.busNo, this.address, this.provider)
      .then(ads1015 => {
        this.sensor = ads1015
        this.sensor.gain = 1
        this.readSensorData()
        this.emit('init')
      })
      .catch(err => { this.emit('initError', err) });

    this.voltageDividor = (options && options.hasOwnProperty('voltageDividor')) ? options.voltageDividor : 0.176029962546816;
    this.currentMultiplier = (options && options.hasOwnProperty('currentMultiplier')) ? options.currentMultiplier : 35.714285714285715;

    // Default values = 0
    this.data = {
      a0: 0,
      a1: 0,
      a2: 0
    };

    // Auto Read Sensor 
    this.autoRead = true;
    this.readInterval = 10;
    this.lastRead = null;
    this.lastMAH = null;
    this.accumulatedCurrent = 0;
  }


  async readSensorData() {

    try {
      this.data.a0 = (await this.sensor.measure('0+GND') / MAX_RANGE * PGA); // Current
      this.data.a1 = (await this.sensor.measure('1+GND') / MAX_RANGE * PGA); // Voltage
      this.data.a2 = (await this.sensor.measure('2+GND') / MAX_RANGE * PGA); // Leak
    }
    catch (e) {
      this.emit("readError", e);
    }

    this.calculateAccumulatedMah();

    this.emit('read');

    if (this.autoRead) setTimeout(() => { this.readSensorData() }, this.readInterval);
  }


  getCurrent(digits = 2) {

    digits = 10 ** digits
    return Math.round((this.data.a0 * this.currentMultiplier) * digits) / digits;
  }


  getCurrentInMah() {

    return this.getCurrent() * 1000;
  }


  getVoltage(digits = 1) {

    digits = 10 ** digits
    return Math.round((this.data.a1 / this.voltageDividor) * digits) / digits;
  }


  getLeak() {

    return this.data.a2 > 1;
  }


  getAccumulatedMah() {

    return Math.round(this.accumulatedCurrent);
  }

  resetAccumulatedMah() {
    
    this.accumulatedCurrent = 0;
    this.emit('read');
  }


  calculateAccumulatedMah() {

    if (this.lastRead == null) {
      this.lastRead = Date.now();
      this.lastMAH = this.getCurrentInMah();
      this.accumulatedCurrent = 0;
      return;
    }

    const duration = Date.now() - this.lastRead;
    this.accumulatedCurrent += (this.lastMAH / 3600000) * duration;
    this.lastRead = Date.now();
    this.lastMAH = this.getCurrentInMah();
  }



}