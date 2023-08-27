/*
 * My custom socket class.
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

const EventEmitter = require('./EventEmitter.js');

module.exports = class Socket extends EventEmitter {

  constructor() {
    super();

    this.ws = null;
    this.callbacks = {};
    this.reconnectTime = 5;
    this.url = null;
  };

  log(data) {
    if (!this.emit("log", data)) {
      console.log(data);
    }
  };

  connect(url) {
    this.url = url;
    this.ws = new WebSocket(url)
    this.ws.onopen = (e) => this.onopen(e);
    this.ws.onclose = (e) => this.onclose(e);
    this.ws.onerror = (e) => this.onerror(e);
    this.ws.onmessage = (e) => this.onmessage(e);
    this.ws.binaryType = 'arraybuffer';
  };

  reconnect() {
    this.log(`Reconnecting to ${this.url}`);
    this.connect(this.url);
  };

  onerror(e) {
    this.log(`Error on socket: ${e}`);
    this.emit('error', e);
  };

  onopen(e) {
    this.log(`Connected to to ${this.url}`);
    this.emit('open', e);
  };

  onclose(e) {
    this.emit('close', e);
    if (this.reconnectTime > 0) {
      setTimeout(() => this.reconnect(), this.reconnectTime * 1000);
      this.log(`Lost connection with socket on ${this.url}, reconnecting in ${this.reconnectTime} seconds.`);
    }
    else {
      this.log(`Lost connection with socket on ${this.url}`);
    }
  };

  onmessage(e) {
    if (typeof e.data == 'string') {
      var event = e.data.split(' ')[0];
      var data = e.data.substr(event.length + 1);
      if (!this.emit(event, data)) {
        this.log('Unknown data: ' + e.data);
      }
    }
    else {
      this.emit('binary', e.data);
    }
  };

  send(data) {
    try { this.ws.send(data); }
    catch (e) { }
  };
}