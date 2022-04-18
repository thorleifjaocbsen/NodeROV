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

    // Water density (kg/m^3 convenience)
    this.density = {
      freshwater: 997,
      saltwater: 1029
    };

    // Initialize the sensor
    this.#sensor = new MS5837(1, 0x76);
    this.#sensor.init()
      .then(() => {
        super.emit("init");
        this.read();
      })
      .catch(err => super.emit('initError', err));

    // Auto Read Sensor 
    this.autoRead = autoRead == true;
    this.readInterval = parseInt(readInterval);
    if(this.readInterval < 500) { this.readInterval = 5000; }
  }

  read() {
    this.#sensor.readSensor()
      .then(() => {
        super.emit('read');
        if (this.autoRead) {
          setTimeout(() => this.read(), this.readInterval);
        }
      })
      .catch(err => super.emit('readError', err));
  }

  temperature(conversion = "c") {
    return this.#sensor.temperature(conversion).toFixed(1);
  }

  pressure(conversion = "psi") {
    return this.#sensor.pressure(conversion).toFixed(2);
  }

  depth(density = this.density.saltwater) {
    // Pressure in pa
    const pressure = this.#sensor.pressure("pa");

    // Depth relative to MSL pressure in given fluid density
    const depth = (pressure - 101300) / (density * 9.80665);
    return depth.toFixed(2);
  }

}