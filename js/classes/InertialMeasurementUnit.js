/*
 * IMU
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const LSM9DS1 = require('../drivers/LSM9DS1')

module.exports = class InertialMeasurementUnit extends EventEmitter {

  #sensor;
  lastGyroRead;
  skip = 0;

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

    this.temperature = 0;
    this.lastGyroRead = 0;
  }

  init(autoRead = true, readInterval = 100) {

    // Auto Read Sensor 
    this.autoRead = autoRead;
    this.readInterval = readInterval;
    this.#sensor = new LSM9DS1();

    return this.#sensor.init().then(() => {
      this.emit('init');
      if (autoRead) this.readSensorData();
    }).catch((err) => {
      this.emit('initError', err);
      console.log("error");
      throw err;
    });
  }

  readSensorData() {

    return Promise.all([
      this.#sensor.readAccel(),
      this.#sensor.readMag(),
      this.#sensor.readTemp(),
      this.#sensor.readGyro() // Reading gyro last to get most accurate timing on when it was last read.
    ])
    .catch((err) => { 
      if(err == "Calibration in progress") return;
      this.emit('readError', err); 
    })
    .then(() => this.parseData())
    .catch((err) => { this.emit('readError', err); })
    .finally(() => {
      if (this.autoRead) {
        setTimeout(() => this.readSensorData(), this.readInterval);
      }
    });
  }

  calibrateAccelGyroBias() {

    return this.#sensor.calibrateAccelGyroBias()
      .then(() => { return true; })
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

    const Xa = this.#sensor.accel.x * -1;
    const Ya = this.#sensor.accel.z * -1;
    const Za = this.#sensor.accel.y * -1;
    const Xm = this.#sensor.mag.x * -1; // Positive X shoud be pointing backwards on the PCB
    const Ym = this.#sensor.mag.z * -1 ; // Positive Y should be pointing to the left on the PCB
    const Zm = this.#sensor.mag.x * -1;
    const Xg = this.#sensor.gyro.x * -1;
    const Yg = this.#sensor.gyro.z * -1;
    const Zg = this.#sensor.gyro.y * -1;
    
    this.skip ++;


    let Phi, Theta, Psi, Xh, Yh

    // roll: Rotation around the X-axis. -180 <= roll <= 180
    // a positive roll angle is defined to be a clockwise rotation about the positive X-axis
    //
    //                    Y
    //      roll = atan2(---)
    //                    z
    //
    // where:  y, z are returned value from accelerometer sensor
    Phi = Math.atan2(Ya, Za); // In radian

    // pitch: Rotation around the Y-axis. -180 <= roll <= 180
    // a positive pitch angle is defined to be a clockwise rotation about the positive Y-axis
    //
    //                                 -x
    //      pitch = atan(-------------------------------)
    //                    y * sin(roll) + z * cos(roll)
    //
    // where:  x, y, z are returned value from accelerometer sensor
    let tmp = Ya * Math.sin(Phi) + Za * Math.cos(Phi)
    if (tmp == 0) Theta = Xa > 0 ? (Math.PI / 2) : (-Math.PI / 2)
    else Theta = Math.atan(Xa / tmp)

    // https://youtu.be/wzjQ8L090s0?t=673 - Have no idea what this magic is but it works much better than the old crap.
    // Xh = Xm * Math.cos(Theta) - Ym * Math.sin(Phi) * Math.sin(Theta) + Zm * Math.cos(Phi) * Math.sin(Theta)
    // Yh = Ym * Math.cos(Phi) + Zm * Math.sin(Phi)
    // Psi = Math.atan2(Yh, Xh)
    Psi = Math.atan2(Ym, Xm);


    // Convert radian data to degree (-180 / 180)
    Phi = Phi * (180 / Math.PI);
    Theta = Theta * (180 / Math.PI);
    Psi = Psi * (180 / Math.PI);
    if(Psi < 0) Psi = Psi + 360;
    
    // if (this.skip == 50) {
      // console.log(Psi, Xg.toFixed(3), Yg.toFixed(3), Zg.toFixed(3));

      // this.skip = 0;
    // }

    this.phi.measured = Phi;
    this.theta.measured = Theta
    this.psi.measured = Psi;

    // Calculate Phi and Theta and Psi from Gyro
    let currentTime = Date.now() / 1000;
    let dt = currentTime - this.lastGyroRead;
    this.lastGyroRead = currentTime;

    // Low pass filter, 95% old and 5% new data - Accel only.
    // this.phi.filtered = (this.phi.filtered * .95) + (this.phi.accMeasured * .05)
    // this.theta.filtered = (this.theta.filtered * .95) + (this.theta.accMeasured * .05)
    this.psi.filtered = (this.psi.filtered * .95) + (this.psi.measured * .05)

    // Two complements filter, 95% gyro, 5% acc (gives best response)
    // accels is prone to noise, so we use gyros to correct for it
    // gyros is prone to drift, so we use accels to correct for it.
    // Win win :)   
 
    this.phi.filtered = (this.phi.filtered + Xg * dt) * .95 + (this.phi.measured * .05)
    this.theta.filtered = (this.theta.filtered + Yg * dt) * .95 + (this.theta.measured * .05)
    //this.psi.filtered = (this.psi.filtered + -Zg * dt) * .95 + (this.psi.measured * .05)

    // this.phi.filtered = this.phi.measured;
    // this.theta.filtered = this.theta.measured;
    // this.psi.filtered = this.psi.measured;
    

    this.emit('read')
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