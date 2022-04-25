/*
  Created by TJWeb 2017 
  www.tjweb.no 
  thorleif@tjweb.no
  
  Datasheet: http://www.mouser.com/ds/2/418/MS5837-30BA-736494.pdf
  Model: MS5837 30BA
*/

const i2cbus = require('i2c-bus');

const ADC_READ = 0x00;
const CONVERT_D1_256 = 0x40;
const CONVERT_D2_256 = 0x50;
const RESET = 0x1E;
const PROM_READ = 0xA0;

// Oversampling options
const OSR_256 = 0;
const OSR_512 = 1;
const OSR_1024 = 2;
const OSR_2048 = 3;
const OSR_4096 = 4;
const OSR_8192 = 5;

module.exports = class MS5837 {

  #pressure;
  #temperature;
  #D1;
  #D2;
  #C;

  constructor(device, address) {

    this.address = (typeof address !== 'undefined') ? address : 0x76;
    this.device = (typeof device !== 'undefined') ? device : 1;

    this.#pressure = 0;
    this.#temperature = 0;
    this.#D1 = 0;
    this.#D2 = 0;
    this.#C = [];

    this.i2c = null;
  }

  init() {

    return new Promise((resolve, reject) => {
      i2cbus.openPromisified(this.device)
        .then(i2c => {
          this.i2c = i2c;
          this.i2c.sendByte(this.address, RESET)
            .then(() => new Promise((resolve) => setTimeout(resolve, 10)))
            .then(() => this.readCalibration())
            .then(() => {
              if (this.validateCRC()) resolve();
              else reject();
            })
            .catch(err => reject(err));
        }).catch(err => reject(err));
    });
  }

  readCalibration() {

    const promises = [];
    // Read calibration values and CRC
    for (let i = 0; i <= 6; i++) {
      let promise = this.i2c.readWord(this.address, PROM_READ + i * 2)
        .then(d => this.#C[i] = ((d & 0xFF) << 8) | (d >> 8)); // SMBus is little-endian for word transfers, we need to swap MSB and LSB
      promises.push(promise);
    }

    return Promise.all(promises);
  }


  validateCRC() {

    const crcRead = this.#C[0] >> 12;
    const crcCalculated = this.crc4(this.#C);
    return crcCalculated == crcRead;
  }

  readADC() {

    return new Promise((resolve, reject) => {
      // Read ADC values
      const ADC = Buffer.alloc(3);
      this.i2c.readI2cBlock(this.address, ADC_READ, 3, ADC)
        .then(() => { resolve(ADC[0] << 16 | ADC[1] << 8 | ADC[2]); })
        .catch(err => { reject(err); })
    })
  }


  readSensor(oversampling = OSR_8192) {
    return new Promise((resolve, reject) => {

      if (this.isReading) reject();
      this.isReading = true;

      this.requestConversion(CONVERT_D1_256, oversampling)
        .then(value => {
          this.#D1 = value;
          return this.requestConversion(CONVERT_D2_256, oversampling);
        })
        .then(value => {
          this.#D2 = value;
          this.calculate();
          this.isReading = false;
          resolve();
        })
        .catch(err => reject(err));
    });
  }

  requestConversion(command, oversampling = OSR_8192) {
    return new Promise((resolve, reject) => {

      if (oversampling < OSR_256 || oversampling > OSR_8192) reject();

      // Maximum conversion time increases linearly with oversampling
      // max time (seconds) ~= 2.2e-6(x) where x = OSR = (2^8, 2^9, ..., 2^13)
      // We use 2.5e-6 for some overhead
      const sleepTime = parseInt(2.5e-6 * 2 ** (8 + oversampling) * 1000);
      let start = new Date();
      this.i2c.sendByte(this.address, command + (2 * oversampling))
        .then(() => new Promise((resolve) => setTimeout(resolve, sleepTime)))
        .then(() => this.readADC())
        .then((value) => resolve(value))
        .catch(err => reject(err))
    });

  }

  calculate() {

    let dT = this.#D2 - this.#C[5] * 256;
    let TEMP = 2000 + dT * this.#C[6] / 8388608;

    let OFF = this.#C[2] * 65536 + (this.#C[4] * dT) / 128;
    let SENS = this.#C[1] * 32768 + (this.#C[3] * dT) / 256;

    let P = (this.#D1 * SENS / 2097152 - OFF) / 8192;

    //Second order compensation for super accuracy
    let Ti, OFFi, SENSi;

    if ((TEMP / 100) < 20) {         //Low temp
      Ti = 3 * Math.pow(dT, 2) / Math.pow(2, 33);
      OFFi = 3 * Math.pow(TEMP - 2000, 2) / Math.pow(2, 1);
      SENSi = 5 * Math.pow(TEMP - 2000, 2) / Math.pow(2, 3);
    }
    if ((TEMP / 100) < -15) {    //Very low temp
      OFFi = OFFi + 7 * Math.pow(TEMP + 1500, 2);
      SENSi = SENSi + 4 * Math.pow(TEMP - 1500, 2);
    }
    else if ((TEMP / 100) >= 20) {    //High temp
      Ti = 2 * Math.pow(dT, 2) / Math.pow(2, 37);
      OFFi = 1 * Math.pow(TEMP - 2000, 2) / Math.pow(2, 4);
      SENSi = 0;
    }

    var OFF2 = OFF - OFFi;
    var SENS2 = SENS - SENSi;
    var TEMP2 = (TEMP - Ti);
    var P2 = (((this.#D1 * SENS2) / 2097152 - OFF2) / 8192) / 10;

    this.#pressure = P2; // mBar
    this.#temperature = TEMP2; // Celcius

  }

  pressure(conversion = "mbar") {
    switch (conversion.toLowerCase()) {
      case "pa":
        return this.#pressure * 100;
      case "hpa":
        return this.#pressure * 1;
      case "kpa":
        return this.#pressure * 0.1;
      case "mbar":
        return this.#pressure * 1;
      case "bar":
        return this.#pressure * 0.001;
      case "atm":
        return this.#pressure * 0.000986923;
      case "torr":
        return this.#pressure * 0.750062;
      case "psi":
        return this.#pressure * 0.014503773773022;
      default:
        return false;
    }
  }

  temperature(conversion = "c") {
    const degC = this.#temperature / 100;
    if (conversion.toLocaleLowerCase() == "f") { return degC * 1.8 + 32; }
    else if (conversion.toLocaleLowerCase() == "c") { return degC; }
    else { return false; }
  }

  crc4(n_prom) {
    var n_rem = 0;
    n_prom[0] = n_prom[0] & 0x0FFF;
    n_prom[7] = 0;
    for (var i = 0; i < 16; i++) {
      if (i % 2 == 1) { n_rem ^= n_prom[i >> 1] & 0x00FF; }
      else { n_rem ^= n_prom[i >> 1] >> 8; }
      for (var n_bit = 8; n_bit > 0; n_bit--) {
        if (n_rem & 0x8000) { n_rem = (n_rem << 1) ^ 0x3000; }
        else { n_rem = (n_rem << 1); }
      }
    }
    n_rem = ((n_rem >> 12) & 0x000F);
    return n_rem ^ 0x00;
  }
}