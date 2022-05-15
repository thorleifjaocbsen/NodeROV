export default class Controls {

  constructor() {

    this.gp = null;

    this.callbacks = {};
    this.debounce = {};
    this.repeatInterval = {};
    this.repeatIntervalTimer = {};

    this.lastUpdate = 0;

    this.axis = [];
    this.buttons = [];
    this.keyboard = [];

    document.addEventListener("keydown", (e) => this.keyDown(e));
    document.addEventListener("keyup", (e) => this.keyUp(e));


    fetch("/controls.json")
      .then(res => res.json())
      .then(json => { this.controls = json; })
      .catch(err => console.error(err));

  }

  checkGamepad() {
    try {
      this.gp = navigator.getGamepads()[0];
      return this.gp.connected;
    } catch (err) {
      return false;
    }
  }

  change(btn, value) {
    // Verify that this is a configured button
    if (!this.controls[btn]) { return false; }

    console.log("Controls: " + btn + ": " + value);

    // Check if this points to another button instead
    if (typeof this.controls[btn].forward === "string") {
      if (this.controls[btn].invert) { value = -1 * value; }
      this.change(this.controls[btn].forward, value);
      return true;
    }

    let { name, func, type, step, invert } = this.controls[btn];
    const pressed = Math.abs(value) > 0;


    // If invert, lets do it!
    if(invert) { value = -1 * value; }
    if (value < 1 && type == "step") step = -1 * step;


    // Verify that callback exists for this function
    const cb = this.callbacks[func];
    if (typeof cb != "function") { return false; }

    if (pressed) {

      // If type is step, change value by step
      if (type == "step") { value = step; }

      // Call the callback
      cb(value);

      if (this.repeatInterval[func] > 0) {
        this.repeatIntervalTimer[func] = setInterval(() => { cb(value); }, this.repeatInterval[func]);
      }
    } else if (!pressed) {

      // Remove interval if set
      if (this.repeatInterval[func] > 0) clearInterval(this.repeatIntervalTimer[func]);

      // If analogue we need to send the 0 value to the callback
      if (type == "analogue") { cb(0); }
    }
  }

  update() {

    // Request this to be re-run
    requestAnimationFrame(() => this.update());

    if (!this.checkGamepad()) return false;

    if (this.lastUpdate == this.gp.timestamp) return false;
    this.lastUpdate = this.gp.timestamp;

    // Loop through axis
    for (let i = 0; i < this.gp.axes.length; i++) {
      let axisValue = Math.round(this.gp.axes[i] * 100);

      if (Math.abs(axisValue) < 5) axisValue = 0; // Deadband

      if (this.axis[i] != axisValue) {
        this.axis[i] = axisValue;
        this.change(`a${i}`, axisValue);
      }
    }

    // Loop through buttons
    for (let i = 0; i < this.gp.buttons.length; i++) {
      const buttonValue = Math.round(this.gp.buttons[i].value * 100);
      if (this.buttons[i] != buttonValue) {
        this.buttons[i] = buttonValue;
        this.change(`b${i}`, buttonValue);
      }
    }
  }

  onPress(btn, callback, bounceDelete) {
    if (isNaN(bounceDelete)) bounceDelete = 0;
    bounceDelete = parseInt(bounceDelete);
    this.callbacks[btn] = callback;
    this.repeatInterval[btn] = bounceDelete;
  }

  keyDown(e) {
    
    if(this.keyboard[e.keyCode] != e.keyCode && !this.debounce[e.keyCode]) {
      this.keyboard[e.keyCode] = 100;
      this.debounce[e.keyCode] = true;
      this.change(`k${e.keyCode}`, 100);
    }
  }

  keyUp(e) {

    if(this.keyboard[e.keyCode] != e.keyCode) {
      this.keyboard[e.keyCode] = 0;
      this.debounce[e.keyCode] = false;
      this.change(`k${e.keyCode}`, 0);
    }
  }
}