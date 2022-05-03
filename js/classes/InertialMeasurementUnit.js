/*
 * IMU
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const LSM9DS1 = require('../drivers/LSM9DS1')

module.exports = class InertialMeasurementUnit extends EventEmitter {

  #sensor;
  lastGyroRead;

  constructor(options) {

    super();

    this.theta = {
      accMeasured: 0,
      gyrMeasured: 0,
      filtered: 0
    }

    this.phi = {
      accMeasured: 0,
      gyrMeasured: 0,
      filtered: 0
    }

    this.psi = {
      accMeasured: 0,
      gyrMeasured: 0,
      filtered: 0
    }

    this.temperature = 0;
    this.lastGyroRead = 0;
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

    this.#sensor.readAccel()
      .catch((err) => { super.emit('readError', err); })
      .then(() => this.#sensor.readMag())
      .catch((err) => { super.emit('readError', err); })
      .then(() => this.#sensor.readTemp())
      .catch((err) => { super.emit('readError', err); })
      .then(() => this.#sensor.readGyro()) // Reading gyro last to get most accurate timing on when it was last read.
      .catch((err) => { super.emit('readError', err); })
      .then(() => this.parseData())
      .catch((err) => { super.emit('readError', err); })
      .finally(() => {
        if (this.autoRead) {
          setTimeout(() => this.readSensorData(), this.readInterval);
        }
      });
  }

  calibrateAccelGyroBias() {

    return this.#sensor.calibrate()
      .then(() => { 

        this.phi.gyrMeasured = 0;
        this.theta.gyrMeasured = 0;
        this.psi.gyrMeasured = 0;
      
      })
      .catch((err) => { console.log(`Calibration error: ${err}`); })
  }

  parseData() {

    // Calculate roll and pitch heading
    const Xa = this.#sensor.accel.x
    const Ya = this.#sensor.accel.y
    const Za = this.#sensor.accel.z
    const Xm = this.#sensor.mag.x
    const Ym = this.#sensor.mag.y
    const Zm = this.#sensor.mag.z
    const Xg = this.#sensor.gyro.x *-1 // TODO: Find out why this is needed
    const Yg = this.#sensor.gyro.y *-1 // TODO: Find out why this is needed
    const Zg = this.#sensor.gyro.z

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

    this.phi.accMeasured = Phi;
    this.theta.accMeasured = Theta
    this.psi.accMeasured = Psi;

    // Calculate Phi and Theta and PSI from Gyro
    let currentTime = Date.now() / 1000;
    let dt = currentTime - this.lastGyroRead;
    this.lastGyroRead = currentTime;

    this.phi.gyrMeasured = this.phi.gyrMeasured + Xg * dt;
    this.theta.gyrMeasured = this.theta.gyrMeasured + Yg * dt;
    this.psi.gyrMeasured = this.psi.gyrMeasured + Zg * dt;

    //console.log(Xg.toFixed(2), Yg.toFixed(2), Zg.toFixed(2), Xa.toFixed(2), Ya.toFixed(2), Za.toFixed(2));
    //console.log(this.phi.accMeasured.toFixed(2), this.theta.accMeasured.toFixed(2), this.psi.accMeasured.toFixed(2), Xg.toFixed(2), Yg.toFixed(2), Zg.toFixed(2));

    // Low pass filter, 95% old and 5% new data - Accel only.
    // this.phi.filtered = (this.phi.filtered * .95) + (this.phi.accMeasured * .05)
    // this.theta.filtered = (this.theta.filtered * .95) + (this.theta.accMeasured * .05)
    // this.psi.filtered = (this.psi.filtered * .95) + (this.psi.accMeasured * .05)

    // Two complements filter, 95% gyro, 5% acc
    this.phi.filtered = (this.phi.filtered + Xg * dt) * .95 + (this.phi.accMeasured * .05)
    this.theta.filtered = (this.theta.filtered + Yg * dt) * .95 + (this.theta.accMeasured * .05)
    this.psi.filtered = (this.psi.filtered + Zg * dt) * .95 + (this.psi.accMeasured * .05)

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