/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */


const EventEmitter = require('events');

module.exports = class HeartbeatController extends EventEmitter {

  constructor() {

    super();

    this.frequency = 1;
    this.latency = -1;
    this.starttime = 0;
    this.timeout = 2;
    this.alive = false;
    this.timeoutTimes = 0;
    this.timer = null;
  }


  start() {

    this.stop();
    this.startime = 0;
    this.timeoutTimes = 0;
    this.timer = setTimeout(() => { this.beat(); }, this.frequency*1000);
  }


  stop() {

    clearTimeout(this.timer);
    this.timer = null;
    this.startime = 0;
  }


  beat() {

    if(this.starttime == 0) {

      this.starttime = Date.now();
      super.emit('beat', this.starttime, this.latency);
    } 
    else {

      // No heartbeat received in a while?
      this.latency = Date.now() - this.starttime;

      if(this.latency > (this.timeout*1000)) {
        // Packet not responded on, trying to ship out a
        // new packet instead
        this.starttime = 0;
        this.connected = false;
        this.timeoutTimes += 1;
        super.emit('timeout');
      }
    }
    this.timer = setTimeout(() => { this.beat(); }, this.frequency*1000);
  }


  pulse(data) {

    if (data != this.starttime) return false;
    this.latency = Math.ceil((Date.now() - data) / 2);
    this.starttime = 0;
    this.connected = true;
    this.timeoutTimes = 0;
  }

  isAlive() {
    return this.timeoutTimes < 5;
  }
}