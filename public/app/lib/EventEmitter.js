/*
 * Small, Simple, EventEmitter
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

module.exports = class EventEmitter {

    constructor() {
        this.callbacks = {}
    }

    on(event, cb) {
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(cb)
        return true;
    }

    emit(event, data) {
        const callbacks = this.callbacks[event]
        if (callbacks) {
            callbacks.forEach(cb => cb(data))
        }
        return true;
    }
}