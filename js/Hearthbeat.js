/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */
const EventEmitter = require('events')

module.exports = class Heartbeat {

  constructor(client, options) {
    this.eventEmitter = new EventEmitter()

    this.frequency = options && options.frequency || 1;
    this.timeout = options && options.timeout || 2;
    this.latency = -1;
    this.starttime = 0;
    this.connected = false;
    this.offTime = 0;
    this.timer = null;
    this.client = client;

    this.startime = 0;
    this.offTime = 0;
    this.beat();
    this.callbacks = {};
  }

  log(level, message) {
    this.eventEmitter.emit('log', level, message);
  }

  stop() {
    clearTimeout(this.timer);
    this.startime = 0;
    this.connected = false;
  }
 
  beat() {
    if(!this.client) return;
    if(this.starttime == 0) {
      this.starttime = Date.now();
      this.client.send('hb '+this.starttime+' '+this.latency); 
    } else {
      // No heartbeat received in a while?
      this.latency = Date.now() - this.starttime;
      
      if(this.latency > (this.timeout*1000)) { //
        // Packet not responded on, trying to ship out a
        // new packet instead
        this.starttime = 0;
        this.connected = false;
        this.offTime += this.timeout;
        this.log("warn", "HB: No response the last "+this.timeout+" sec, client timeout!");
      }
    }
    this.timer = setTimeout(() => { this.beat() }, this.frequency*1000);
  }

  pulse(data) {
    if(data == this.starttime) {
      this.latency = Math.ceil((Date.now() - data) / 2);
      this.starttime = 0;
      this.connected = true;
      this.log("debug", "HB: Latency: "+this.latency+'ms')
    }
    else {
      this.log("warn", "HB: Last response was not expected. Disregarding it. ("+data+")");
    }
  }

  on(event, callback) {
    this.eventEmitter.on(event, callback)
  }

  
}
