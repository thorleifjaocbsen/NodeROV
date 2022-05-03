/*
 * IMU
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const LSM9DS1 = require('../drivers/LSM9DS1')

module.exports = class InertialMeasurementUnit extends EventEmitter {

  #sensor;

  constructor(options) {

    super();

    this.theta = {
      measured: 0,
      filtered: 0
    }

    this.phi = {
      measured: 0,
      filtered: 0
    }

    this.psi = {
      measured: 0,
      filtered: 0
    }

    this.roll = 0
    this.pitch = 0
    this.heading = 0
    this.temperature = 0;
  }

  init(autoRead = true, readInterval = 100) {

    // Auto Read Sensor 
    this.autoRead = autoRead;
    this.readInterval = readInterval;
    this.#sensor = new LSM9DS1();

    return this.#sensor.init().then(() => {
      super.emit('init');
      if (autoRead) this.readSensorData();
    }).catch((err) => {
      super.emit('initError', err);
      console.log("error");
      throw err;
    });
  }

  readSensorData() {

    return Promise.all([
      this.#sensor.readAccel(),
      this.#sensor.readMag(),
      this.#sensor.readGyro()
    ])
      .then(() => {
        this.parseData();
      })
      .catch((err) => {
        super.emit("readError");
        throw err;
      })
      .finally(() => {
        if (this.autoRead) {
          setTimeout(() => this.readSensorData(), this.readInterval);
        }
      });
  }


  calibrateLevel() {
    //this.calibration.roll = this.roll;
    //this.calibration.pitch = this.pitch;
    //this.#sensor.calibrate();
  }


  parseData() {

    // Calculate roll and pitch
    const Xa = this.#sensor.accel.x
    const Ya = this.#sensor.accel.y
    const Za = this.#sensor.accel.z
    const Xm = this.#sensor.mag.x
    const Ym = this.#sensor.mag.y
    const Zm = this.#sensor.mag.z

    let Phi, Theta, Psi, Xh, Yh

    // roll: Rotation around the X-axis. -180 <= roll <= 180
    // a positive roll angle is defined to be a clockwise rotation about the positive X-axis
    //
    //                    y
    //      roll = atan2(---)
    //                    z
    //
    // where:  y, z are returned value from accelerometer sensor
    Phi = Math.atan2(Ya, Za)

    // pitch: Rotation around the Y-axis. -180 <= roll <= 180
    // a positive pitch angle is defined to be a clockwise rotation about the positive Y-axis
    //
    //                                 -x
    //      pitch = atan(-------------------------------)
    //                    y * sin(roll) + z * cos(roll)
    //
    // where:  x, y, z are returned value from accelerometer sensor
    var tmp = Ya * Math.sin(Phi) + Za * Math.cos(Phi)
    if (tmp == 0) Theta = Xa > 0 ? (Math.PI / 2) : (-Math.PI / 2)
    else Theta = Math.atan(-Xa / tmp)

    // heading: Rotation around the Z-axis. -180 <= roll <= 180
    // a positive heading angle is defined to be a clockwise rotation about the positive Z-axis
    //
    //                                       z * sin(roll) - y * cos(roll)                           < Yh
    //   heading = atan(--------------------------------------------------------------------------)
    //                    x * cos(pitch) + y * sin(pitch) * sin(roll) + z * sin(pitch) * cos(roll))  < Xh
    //
    // where:  x, y, z are returned value from magnetometer sensor
    Yh = Zm * Math.sin(Phi) - Ym * Math.cos(Phi)
    Xh = Xm * Math.cos(Theta) +
      Ym * Math.sin(Theta) * Math.sin(Phi) +
      Zm * Math.sin(Theta) * Math.cos(Phi)
    Psi = Math.atan2(-Yh, Xh)

    // Convert angular data to degree
    Phi = Phi * 180 / Math.PI
    Theta = Theta * 180 / Math.PI
    Psi = Psi * 180 / Math.PI
    if (Psi < 0) Psi += 360

    this.phi.measured   = Phi;
    this.theta.measured = Theta
    this.psi.measured   = Psi;

    // Low pass filter, 95% old and 5% new data
    this.phi.filtered = (this.phi.filtered * .95) + (this.phi.measured * .05)
    this.theta.filtered = (this.theta.filtered * .95) + (this.theta.measured * .05)
    this.psi.filtered = (this.psi.filtered * .95) + (this.psi.measured * .05)

    super.emit('read')
  }


  getRoll(decimals = 2) {
    return this.phi.filtered.toFixed(decimals);
  }

  getPitch(decimals = 2) {
    return this.theta.filtered.toFixed(decimals);
  }

  getHeading(decimals = 2) {
    return this.psi.filtered.toFixed(decimals);
  }

}