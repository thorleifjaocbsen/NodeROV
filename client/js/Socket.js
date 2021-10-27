/*
 * HudBlock Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */


class Socket {


  constructor(host, port) {

    this.host = host
    this.port = port
    this.connect(host, port)
    this.callbacks = {}
  }


  on(event, cb) {

    if (!this.callbacks[event]) this.callbacks[event] = []
    this.callbacks[event].push(cb)
  }


  emit(event, data) {

    let cbs = this.callbacks[event]
    if (cbs) cbs.forEach(cb => cb(data))
  }


  connect(host, port) {

    this.ws = new WebSocket(`ws://${host}:${port}`)
    this.ws.onopen = (e) => this.emit('open', e)
    this.ws.onclose = (e) => this.emit("close", e)
    this.ws.onerror = (e) => this.emit('error', e)
    this.ws.onmessage = (e) => this.emit('message', e.data)
    this.ws.binaryType = 'arraybuffer'
  }

  reconnect() {

    this.connect(this.host, this.port)
  }

  send(data) {

    try {

      this.ws.send(data)
      return true
    }
    catch (e) {

      return false
    }
  }
}