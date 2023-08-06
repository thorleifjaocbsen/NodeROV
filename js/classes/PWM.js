const EventEmitter = require('stream');

var i2cBus = require("i2c-bus");
var Pca9685Driver = require("pca9685").Pca9685Driver;



module.exports = class PWM extends EventEmitter {

    #pwm;
    #initialized = false;
    #options = {
        i2c: i2cBus.openSync(1),
        address: 0x40,
        frequency: 50,
        debug: false
    }
    constructor() {
        super();
    }

    init() {
        return new Promise((resolve, reject) => {
            this.#pwm = new Pca9685Driver(this.#options, (err) => {
                if (err) {
                    this.emit("initError", "Error initializing PCA9685, " + err);
                    reject(err);
                    return;
                }
                this.#initialized = true;
                this.emit("init");
                resolve();
            });
        });
    }

    setAllPWM(pulseLength) {
        for (let channel = 0; channel < 16; channel++) {
            this.setPwm(channel, pulseLength);
        }
    }
    turnOffPWM() {
        // Turn on all 10 channels 0-9) loop
        for (let channel = 0; channel < 16; channel++) {
            this.#pwm.channelOff(channel);
        }
    }
    setPWM(channel, pulseLength) {
        return new Promise((resolve, reject) => {

            // Ensure pulseLength is between 1100 and 1900 
            if (pulseLength < 1100) pulseLength = 1100;
            if (pulseLength > 1900) pulseLength = 1900;

            // Check if channels is 6 or lower, if so return
            //if (channel <= 5) return Promise.reject("Not allowed");
            try {
                this.#pwm.setPulseLength(channel, pulseLength);
                resolve();
            } catch(e) {
                reject(e);
            }
        });
    }
}