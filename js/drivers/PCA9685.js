const i2cbus = require('i2c-bus');

module.exports = class PCA9685 {

  #sensor;
  #frequency = 50;
  #address = 0x40;
  #device = 1;
  #initialized = false;

  constructor(address, device) {
    if (address) this.#address = address;
    if (device) this.#device = device;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setFrequency(frequency) {

    return new Promise((resolve, reject) => {
      if (this.#sensor) reject("Already initialized");
      else {
        this.#frequency = frequency;
        resolve();
      }
    });
  }

  // Initializer, needs to be run after changing frequency
  init() {

    // Calculate prescaler based on frequency 
    const prescaler = Math.round(25000000 / (4096 * this.#frequency)) - 1;

    return i2cbus.openPromisified(this.#device)
      .then((i2c) => { this.#sensor = i2c; })
      .catch((err) => { throw `Could not open i2c bus: ${err}`; })
      // Restart pwm chip
      .then(() => this.send(0x00, 0x01)) // MODE1 -> SLEEP
      .catch((err) => { throw `Could not set mode1 to SLEEP: ${err}`; })
      .then(() => this.send(0x0, 0x01)) // MODE1 -> SLEEP
      .catch((err) => { throw `Could not set mode1 to SLEEP: ${err}`; })

      // Set all PWM to 0
      .then(() => this.setAllPWM(0))
      .catch((err) => { throw `Could not set all pwm signals to 0: ${err}`; })
      // Set all outputs to use a totem pole structure.
      .then(() => this.send(0x01, 0x04)) // MODE2 -> OUTDRV 
      .catch((err) => { throw `Could not set mode2 to OUTDRV: ${err}`; })
      // Set it to respond on call on all i2c busses and sleep (Oscillator off) 
      .then(() => this.send(0x00, 0x11)) // MODE1 -> ALLCALL, SLEEP
      // Sleep 1ms so the oscillator can calm down
      .then(() => this.sleep(1))
      // Set the prescale to precalculated scale
      .then(() => this.send(0xFE, prescaler)) // PRE_SCALE -> pre-calculated
      .catch((err) => { throw `Could not set prescaler: ${err}`; })
      // Disable sleep so it can start up the oscillator again 
      .then(() => this.send(0x00, 0x01)) // MODE1 -> ALLCALL
      .catch((err) => { throw `Could not set mode1 to ALLCALL: ${err}`; })
      // Sleep 1ms so the oscillator can start up
      .then(() => this.sleep(1))
      .then(() => { this.#initialized = true; })
  }

  turnOffPWM() {
    return this.send(0xFD, 0x10)
  }

  // Usage: setPWM(channel, microsecounds);
  setPWM(no, us) {
    // Check if initialized:
    return false
    if (!this.#initialized) { return Promise.reject(); }

    if (no == 9) { us = 1550; }
    if (no > -1 && no < 6) { us = 1550; }

    const steps = this.usToSteps(us);
    // 0x06 -> 0x09 (LED0_ON_L,LED0_ON_H,LED0_OFF_L,LED0_OFF_H)
    // The 4*NO changes it so it inclines depending on NO up to 15.    

    // Steps are maxmimum between 0 and 4096
    // no is between 0 and 15 
    if (steps < 0 || steps > 4096) { return Promise.reject(); }
    if (no < 0 || no > 15) { return Promise.reject(); }

    return Promise.all([
      this.send(0x06 + 4 * no, 0x00), // Lets write the start high to step 0
      this.send(0x07 + 4 * no, 0x00),
      this.send(0x08 + 4 * no, steps & 0xFF), // Then write the end high to steps calculated from usToSteps
      this.send(0x09 + 4 * no, steps >> 8)
    ]);
  }

  // Usage: setAllPWM(microsecounds);
  setAllPWM(us) {
    // Check if initialized:
    if (!this.#initialized) { return Promise.reject(); }

    const steps = this.usToSteps(us);

    // Steps are maxmimum between 0 and 4096
    if (steps < 0 || steps > 4095) { return Promise.reject(); }

    // 0xFA -> 0xFD (ALL_LED_ON_L,ALL_LED_ON_H,ALL_LED_OFF_L,ALL_LED_OFF_H)
    return Promise.all([
      this.send(0xFA, 0x00), // Lets write the start high to step 0
      this.send(0xFB, 0x00),
      this.send(0xFC, steps & 0xFF), // Then write the end high to steps calculated from usToSteps
      this.send(0xFD, steps >> 8)
    ]);
  }

  // Calculate how many steps an specific µS can be
  usToSteps(us) {
    // E.g. 50hz cycle = 1000000µS / 50hz = 20 000µS pr cycle.
    const MicrosecoundPerCycle = 1000000 / 50;
    // Then get how many µS we get pr step by dividing steps on µS pr cycle
    const stepsPerMicrosecound = 4095 / MicrosecoundPerCycle;
    // Then return µS wanted times steps we get per µS
    return Math.round(us * stepsPerMicrosecound)
  }

  send(command, byte) {
    return this.#sensor.writeByte(this.#address, command, byte);
  }

}

