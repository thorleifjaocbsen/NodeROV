/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */


const EventEmitter = require('events')

module.exports = class HeartbeatController {

  constructor() {

    this.eventEmitter = new EventEmitter()
    this.frequency = 1
    this.latency = -1
    this.starttime = 0
    this.timeout = 2
    this.alive = false
    this.offTime = 0
    this.timer = null
  }

  on(event, callback) {

    this.eventEmitter.on(event, callback)
  }

  removeListener(event, callback) {

    this.eventEmitter.removeListener(event, callback)
  }

  start() {

    this.stop()
    this.startime = 0
    this.offTime = 0
    this.timer = setTimeout(() => { this.beat() }, this.frequency*1000)

  }

  stop() {

    clearTimeout(this.timer)
    this.timer = null
    this.startime = 0
  }

  beat() {

    if(this.starttime == 0) {

      this.starttime = Date.now()
      this.eventEmitter.emit('beat', this.starttime, this.latency)
    } 
    else {

      // No heartbeat received in a while?
      this.latency = Date.now() - this.starttime

      if(this.latency > (this.timeout*1000)) { //
        // Packet not responded on, trying to ship out a
        // new packet instead
        this.starttime = 0
        this.connected = false
        this.offTime += this.timeout
        this.eventEmitter.emit('timeout')
      }
    }
    this.timeout = setTimeout(() => { this.beat() }, this.frequency*1000)
  }

  pulse(data) {
    if (data != this.starttime) return false
    this.latency = Math.ceil((Date.now() - data) / 2)
    this.starttime = 0
    this.connected = true
  }

  isAlive() {
    return this.alive
  }
}