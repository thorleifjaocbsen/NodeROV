class Socket {

  constructor() {
    this.ws = null;
    this.callbacks = {};
    this.reconnectTime = 5;
    this.ip = null;
    this.port = null;
  };

  log(data) {
    console.log(data);
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
    // Error
  };

  onopen(e) {
    this.log('Connected to ' + this.ip + ':' + this.port)
  };

  onclose(e) {
    if (this.reconnectTime > 0) {
      setTimeout(this.reconnect, this.reconnectTime * 1000);
      this.log('Lost connection with socket on ' + this.ip + ':' + this.port + ', reconnecting in ' + this.reconnectTime + ' seconds.');
    }
    else {
      this.log('Lost connection with socket on ' + this.ip + ':' + this.port);
    }
  };

  onmessage(e) {
    if (typeof e.data == 'string') {
      var cmd = e.data.split(' ')[0];
      var data = e.data.substr(cmd.length + 1);
      if (typeof this.callbacks[cmd] == 'function') {
        this.callbacks[cmd](data);
      }
      else this.log('Unknown data: ' + e.data);

    }
  };

  send(data) {
    try { this.ws.send(data); }
    catch (e) { }
  };

  on(cmd, callback) {
    this.callbacks[cmd] = callback;
  };
}