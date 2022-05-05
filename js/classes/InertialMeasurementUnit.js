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

    return this.#sensor.calibrateAccelGyroBias()
      .then(() => { 

        this.phi.gyrMeasured = 0;
        this.theta.gyrMeasured = 0;
        this.psi.gyrMeasured = 0;
      
      })
      .catch((err) => { console.log(`Calibration error: ${err}`); })
  }

  calibrateMagnometerBias(axis="x") {

    return this.#sensor.calibrateMagnometerBias(axis)
  }

  parseData() {

    // Calculate roll and pitch heading
    // accel is G's
    // gyro is Degrees Pr Second
    // magno is Gauss 
    const Xa = this.#sensor.accel.x 
    const Ya = this.#sensor.accel.y
    const Za = this.#sensor.accel.z
    const Xm = this.#sensor.mag.y
    const Ym = this.#sensor.mag.x
    const Zm = this.#sensor.mag.z
    const Xg = this.#sensor.gyro.x // TODO: Find out why this is needed
    const Yg = this.#sensor.gyro.y // TODO: Find out why this is needed
    const Zg = this.#sensor.gyro.z // TODO: Find out why this is needed

    let Phi, Theta, Psi, Xh, Yh

    // roll: Rotation around the X-axis. -180 <= roll <= 180
    // a positive roll angle is defined to be a clockwise rotation about the positive X-axis
    //
    //                    Y
    //      roll = atan2(---)
    //                    z
    //
    // where:  y, z are returned value from accelerometer sensor
    Phi = Math.atan2(-Ya, Za); // In radian

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
    else Theta = Math.atan(Xa / tmp)


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
    Psi = Math.atan2(Yh, Xh)


    // Convert radian data to degree (-180 / 180)
    Phi = Phi * (180 / Math.PI);
    Theta = Theta * (180 / Math.PI);
    Psi = Psi * (180 / Math.PI);
    

    // Convert PSI radian to 360 degree
    Psi = Math.atan2(-Xm, -Ym) * (180 / Math.PI);
    if(Psi < 0) Psi = Psi + 360;
    // console.log(Psi, Xm, Ym);
    // console.log(Psi.toFixed(2), Xm.toFixed(2), Ym.toFixed(2), Zm.toFixed(2));

    this.phi.accMeasured = Phi;
    this.theta.accMeasured = Theta
    this.psi.accMeasured = Psi;

    // Calculate Phi and Theta and Psi from Gyro
    let currentTime = Date.now() / 1000;
    let dt = currentTime - this.lastGyroRead;
    this.lastGyroRead = currentTime;

    // Low pass filter, 95% old and 5% new data - Accel only.
    // this.phi.filtered = (this.phi.filtered * .95) + (this.phi.accMeasured * .05)
    // this.theta.filtered = (this.theta.filtered * .95) + (this.theta.accMeasured * .05)
    // this.psi.filtered = (this.psi.filtered * .95) + (this.psi.accMeasured * .05)

    // Two complements filter, 95% gyro, 5% acc (gives best response)
    // accels is prone to noise, so we use gyros to correct for it
    // gyros is prone to drift, so we use accels to correct for it.
    // Win win :)   

    this.phi.filtered = (this.phi.filtered + Xg * dt) * .95 + (this.phi.accMeasured * .05)
    this.theta.filtered = (this.theta.filtered + Yg * dt) * .95 + (this.theta.accMeasured * .05)
    this.psi.filtered = (this.psi.filtered + -Zg * dt) * .95 + (this.psi.accMeasured * .05)

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