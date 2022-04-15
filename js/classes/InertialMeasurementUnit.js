/*
 * IMU
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const LSM9DS1 = require('lsm9ds1-sensor')
 
module.exports = class InertialMeasurementUnit {

  constructor(options) {

    this.eventEmitter = new EventEmitter()

    this.sensor = new LSM9DS1();

    this.sensor.init().then(() => {
      this.eventEmitter.emit('init')
      this.readSensorData()
    })

    this.roll = 0
    this.pitch = 0
    this.heading = 0
    
    // Auto Read Sensor 
    this.autoRead = true
    this.readInterval = 200
  }


  on(event, callback) {

    this.eventEmitter.on(event, callback)
  }


  readSensorData() {
    this.sensor.readAccel()
    this.sensor.readGyro()
    this.sensor.readMag()
    this.parseData() 

    if (this.autoRead) setTimeout(() => { this.readSensorData() }, this.readInterval)
  }

  
  parseData() {

    // Calculate roll and pitch
    const Xa = this.sensor.accel.x
    const Ya = this.sensor.accel.y
    const Za = this.sensor.accel.z
    const Xm = this.sensor.mag.x
    const Ym = this.sensor.mag.y
    const Zm = this.sensor.mag.z
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
    var tmp =      Ya * Math.sin(Phi) + Za * Math.cos(Phi)
    if (tmp == 0)  Theta = Xa > 0 ? (Math.PI / 2) : (-Math.PI / 2)
    else           Theta = Math.atan(-Xa / tmp)

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
    Phi   = Phi   * 180 / Math.PI
    Theta = Theta * 180 / Math.PI
    Psi   = Psi   * 180 / Math.PI
    if(Psi < 0) Psi += 360

    this.roll    = Phi.toFixed(2)
    this.pitch   = Theta.toFixed(2)
    this.heading = Psi.toFixed(2)

    this.eventEmitter.emit('read')
  }
}