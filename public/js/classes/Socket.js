/*
 * HudBlock Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */


export default class Socket {

  constructor() {
    this.ws = null;
    this.callbacks = {};
    this.reconnectTime = 5;
    this.ip = null;
    this.port = null;
  };

  log(data) {
    if(!this.emit("log", data)) {
      console.log(data);
    }
  };

  connect(ip, port) {
    this.ip = ip;
    this.port = port;
    this.ws = new WebSocket('wss://' + ip + ':' + port)
    this.ws.onopen = (e) => this.onopen(e);
    this.ws.onclose = (e) => this.onclose(e);
    this.ws.onerror = (e) => this.onerror(e);
    this.ws.onmessage = (e) => this.onmessage(e);
    this.ws.binaryType = 'arraybuffer';
  };

  reconnect() {
    this.log('Reconnecting to ' + this.ip + ':' + this.port)
    this.connect(this.ip, this.port);
  };

  onerror(e) {
    this.log("Error on socket: " + e);
  };

  onopen(e) {
    this.log('Connected to ' + this.ip + ':' + this.port)
  };

  onclose(e) {
    if (this.reconnectTime > 0) {
      setTimeout(() => this.reconnect(), this.reconnectTime * 1000);
      this.log('Lost connection with socket on ' + this.ip + ':' + this.port + ', reconnecting in ' + this.reconnectTime + ' seconds.');
    }
    else {
      this.log('Lost connection with socket on ' + this.ip + ':' + this.port);
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
  };

  send(data) {
    try { this.ws.send(data); }
    catch (e) { }
  };

  on(event, callback) {
    this.callbacks[event] = callback;
  };

  emit(event, data) {
    if (typeof this.callbacks[event] == 'function') {
      this.callbacks[event](data);
      return true;
    }
    return false;
  }
}