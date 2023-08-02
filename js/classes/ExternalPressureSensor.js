/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events');
const MS5837 = require('../drivers/MS5837');


module.exports = class ExternalPressureSensor extends EventEmitter {

  #sensor;

  constructor(autoRead = true, readInterval = 2000) {

    super();

    // Initialize the sensor
    this.#sensor = new MS5837(1, 0x76);
    this.#sensor.init()
      .then(() => {
        this.emit("init");
        this.read();
      })
      .catch(err => this.emit('initError', err));

    // Auto Read Sensor 
    this.autoRead = autoRead == true;
    this.readInterval = parseInt(readInterval);
    if(this.readInterval < 100) { this.readInterval = 100; }

    // Water density (kg/m^3 convenience)
    this.density = {
      freshwater: 997.0474,
      saltwater: 1023.6
    };

    // Gravity (m/s^2)
    this.gravity = 9.80665;
  }

  read() {

    this.#sensor.readSensor()
      .then(() => {
        this.emit('read');

        if (this.autoRead) {
          setTimeout(() => this.read(), this.readInterval);
        }
      })
      .catch(err => this.emit('readError', err));
  }

  temperature(conversion = "c") {

    return Math.round(this.#sensor.temperature(conversion) * 10) / 10;
  }

  pressure(conversion = "psi") {

    return Math.round(this.#sensor.pressure(conversion) * 10) / 10;
  }

  depth(pressure = this.#sensor.pressure("pa"), density = this.density.saltwater) {

    return Math.round(((pressure-101300)/(density*this.gravity)) * 100) / 100;
  }

}