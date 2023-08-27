(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = class Controls {

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
      if (this.change(`k${e.keyCode}`, 100)) e.preventDefault();
    }
  }

  keyUp(e) {

    if(this.keyboard[e.keyCode] != e.keyCode) {
      this.keyboard[e.keyCode] = 0;
      this.debounce[e.keyCode] = false;
      if (this.change(`k${e.keyCode}`, 0)) e.preventDefault();
    }
  }
}
},{}],2:[function(require,module,exports){
/*
 * Dashboard Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

module.exports = class Dashboard {

  constructor(canvas) {

    this.canvas = canvas

    this.normalColor = 'rgba(255,255,255,1)'
    this.warningColor = 'rgba(231,96,98,1)'
    this.scales = []

    this.setScale(0, "PRESSURE", 0, 160, 30)
    this.setScale(1, "DEPTH", 0, 100, 30)
    this.setScale(2, "TEMPERATURE", 0, 30, 0)
    this.setScale(3, "VOLTAGE", 0, 16.8, -6.8)
    this.setScale(4, "CURRENT", 0, 90, 10)
    this.setScale(5, "MAH USED", 0, 5500, 1000)

    this.thrusters = []

    this.setThruster(3, 0, 0, 0, 45) // Top left
    this.setThruster(0, 0, 100, 0, 315) // Top right
    this.setThruster(4, 0, 20, 100, 180) // Middle left
    this.setThruster(1, 0, 80, 100, 0) // Middle right
    this.setThruster(5, 0, 0, 200, 135+180) // Bottom left
    this.setThruster(2, 0, 100, 200, 225+180) // Bottom right
  }

  setScale(scale, desc, value, maxValue, warningDiff) {

    const diff = (maxValue - value) * Math.sign(warningDiff)
    const color = diff < warningDiff ? this.warningColor : this.normalColor
    const percentage = Math.round(value / maxValue * 100)

    this.scales[scale] = { desc, value, maxValue, percentage, color }
  }

  setThruster(number, value, offsetX = false, offsetY = false, rotation = false) {
    let defValues = { value: 0, offsetX: 0, offsetY: 0, rotation: 0 }

    if (this.thrusters[number]) {

      defValues = {...defValues, ...this.thrusters[number]}
    }

    const newValues = {}
    newValues.value = parseInt(value)
    
    if(offsetX != false) newValues.offsetX = parseInt(offsetX)
    if(offsetY != false) newValues.offsetY = parseInt(offsetY)
    if(rotation != false) newValues.rotation = parseInt(rotation)

    this.thrusters[number] = {...defValues, ...newValues}

  }

  draw() {

    const width = this.canvas.width
    const height = this.canvas.height
    const ctx = this.canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "rgba(255,255,255,.2)"
    ctx.fillRect(200, 0, 1, height)
    ctx.strokeStyle = "rgba(255,255,255,.2)"
    ctx.lineWidth = 3

    var x = 50
    var y = height / 2 - 100
    var w = 100
    var h = 200
    var r = 10
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.stroke()

    this.thrusters.forEach(thruster => {
      this.drawThruster(x + thruster.offsetX, y + thruster.offsetY, thruster.value, thruster.rotation)
    })

    const grid = ((width - 200) / 6)
    const height1 = (height / 4) + 20
    const height2 = height / 4 * 3

    this.drawScale(200 + grid * 1, height1, this.scales[0].desc, this.scales[0].percentage, this.scales[0].color, this.scales[0].value)
    this.drawScale(200 + grid * 3, height1, this.scales[1].desc, this.scales[1].percentage, this.scales[1].color, this.scales[1].value)
    this.drawScale(200 + grid * 5, height1, this.scales[2].desc, this.scales[2].percentage, this.scales[2].color, this.scales[2].value)

    this.drawScale(200 + grid * 1, height2, this.scales[3].desc, this.scales[3].percentage, this.scales[3].color, this.scales[3].value)
    this.drawScale(200 + grid * 3, height2, this.scales[4].desc, this.scales[4].percentage, this.scales[4].color, this.scales[4].value)
    this.drawScale(200 + grid * 5, height2, this.scales[5].desc, this.scales[5].percentage, this.scales[5].color, this.scales[5].value)

  }


  drawScale(x, y, title, percentage, color, value) {

    const ctx = this.canvas.getContext('2d')

    ctx.save()
    ctx.translate(x, y)

    if (!value) value = percentage

    ctx.font = "bold 20px Open Sans"
    ctx.textAlign = "center"
    ctx.fillStyle = color
    ctx.fillText(value, 0, 7)

    ctx.font = "bold 12px Open Sans"
    ctx.textAlign = "center"
    ctx.fillStyle = color
    ctx.fillText(title, 0, -55)

    ctx.beginPath()
    ctx.arc(0, 0, 40, 0, 2 * Math.PI, false)
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.stroke()
    ctx.closePath()
    if (percentage > 0) {
      var pos = -0.4999 + (1.999 / 100 * percentage)
      // -0.4999 to 1.4999
      ctx.beginPath()
      ctx.arc(0, 0, 40, 1.5 * Math.PI, pos * Math.PI, false)
      ctx.lineWidth = 6.5
      ctx.strokeStyle = color
      ctx.stroke()
      ctx.closePath()
    }
    ctx.restore()
  }


  drawThruster(x, y, percentage, direction) {

    const ctx = this.canvas.getContext('2d')

    ctx.save()
    ctx.translate(x, y)
    ctx.beginPath()
    ctx.arc(0, 0, 15, 0, 2 * Math.PI, false)
    ctx.fillStyle = 'rgba(255,255,255,.2)'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,1)'
    ctx.stroke()
    ctx.closePath()

    if (percentage != 0) {
      var pos = -0.4999 + (1.999 / 100 * Math.abs(percentage))
      // -0.4999 to 1.4999
      ctx.beginPath()
      ctx.arc(0, 0, 15, 1.5 * Math.PI, pos * Math.PI, false)
      ctx.lineWidth = 3.5
      ctx.strokeStyle = 'rgba(231,96,98,1)'
      ctx.stroke()
      ctx.closePath()

      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255,255,255,1)'
      ctx.fillStyle = 'rgba(255,255,255,1)'

      if (percentage < 0) {
        direction += 180
      }

      // Arrow
      ctx.rotate(direction * 0.0174532925)
      ctx.translate(0, -10)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(4, 6)
      ctx.lineTo(1.5, 6)
      ctx.lineTo(1.5, 10)
      ctx.lineTo(-1.5, 10)
      ctx.lineTo(-1.5, 6)
      ctx.lineTo(-4, 6)
      ctx.closePath()
      ctx.fill()

      // Two lines
      ctx.beginPath()
      ctx.moveTo(-7, 13)
      ctx.lineTo(7, 13)
      ctx.moveTo(-7, 17)
      ctx.lineTo(7, 17)
      ctx.closePath()
      ctx.stroke()
    }

    ctx.restore()
  }
}

},{}],3:[function(require,module,exports){
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
},{}],4:[function(require,module,exports){
const EventEmitter = require('./EventEmitter.js');

module.exports = class GUI extends EventEmitter {

    constructor() {
        super();
       
        this.accelCanvas = null;
        this.compassCanvas = null;
        this.compassRose = new Image();
        this.dataGraphCanvasContext = null;
        this.compassRose.src = 'gfx/compass_rose.png';

        this.overlayTimer = null;
    };

    map(x, in_min, in_max, out_min, out_max) {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    };

    log(text, time, doNotEmit, level = "info") {
        if (time == undefined) time = Date.now();

        if(!doNotEmit) super.emit("log", text, time);

        let d = new Date(time).toISOString();
        let timestamp = d.split('T')[1].split('.')[0] + " | " + d.split('T')[0];

        text = `<span style='color:var(--log-${level}-color);'>${text}</span>`;

        const table = document.getElementById("logTable")
        const tr = document.createElement("tr")
        tr.innerHTML = "<th>" + timestamp + "</th><td>" + text + "</td>";
        table.prepend(tr);
    };

    setButton(name, text, callback) {
        const btn = document.getElementsByName(name)[0];
        if (!btn) return false;
        if (text) btn.innerHTML = text;
        if (callback) btn.onclick = (e) => callback(e);
        return true;
    }

    buttonState(name, newState) {
        const btn = document.getElementsByName(name)[0];
        if (!btn) return null;
        else if (newState === true) { btn.classList.add("selected"); } 
        else if (newState === false) { btn.classList.remove("selected"); }
        return btn.classList.contains("selected");
    }

    pressButton(name) {
        const btn = document.getElementsByName(name)[0];
        return btn && btn.click();
    };

    overlayText(message, time) {
        clearTimeout(this.overlayTimer);
        const overlay = document.getElementById("overlay");

        overlay.innerHTML = message;
        overlay.style.display = "block";
        overlay.style.opacity = 1;
        this.overlayTimer = setTimeout(() => { overlay.style.opacity = 0; }, time);
    };

    setInfo(no, value, titleText = false) {
        no--;
        let parent = document.getElementsByClassName("data")[0];
        let child = parent.getElementsByTagName("li")[no];
        let title = child.getElementsByTagName("b")[0];
        let text = child.getElementsByTagName("span")[0];

        if(titleText) title.innerHTML = titleText;
        text.innerHTML = value;
    };

}
},{"./EventEmitter.js":3}],5:[function(require,module,exports){
/*
 * HudBlock Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

module.exports = class HUDBlock {
  
  constructor(canvas) {

    this.canvas = canvas
    this.compassRose = new Image()
    this.compassRose.src = "gfx/compass_rose.png"
    this.pitch = 0;
    this.roll = 0;
    this.heading = 0;
    this.turns = 0;
  }


  draw(pitch = this.pitch, roll = this.roll, heading = this.heading, turns = this.turns) {

    this.roll = roll;
    this.pitch = pitch;
    this.heading = heading;
    this.turns = turns;

    const width = this.canvas.width
    const height = this.canvas.height
    const ctx = this.canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height);
    ctx.save()
    this.drawArtificialHorizon(pitch, roll)
    this.drawCompass(heading, turns)
    ctx.restore()
  }


  drawArtificialHorizon(pitch, roll) {

    const width         = this.canvas.width
    const height        = this.canvas.height
    const ctx           = this.canvas.getContext('2d')
    const centerY       = height / 2
    const centerX       = width / 2
    const pixelPrDegree = (height / 2) / 30 // (Top = 30 deg bottom = -30 deg)

    

    // Draw background lines each 5deg
    ctx.fillStyle = "rgba(145,152,169,0.2)";
    ctx.fillRect(0, centerY - (pixelPrDegree * 20), width, 2) // +20 degrees
    ctx.fillRect(0, centerY - (pixelPrDegree * 10), width, 2) // +10 degrees
    ctx.fillRect(0, centerY, width, 2)                        // 0 degrees
    ctx.fillRect(0, centerY + (pixelPrDegree * 10), width, 2) // -10 degrees
    ctx.fillRect(0, centerY + (pixelPrDegree * 20), width, 2) // -20 degrees

    // Draw square showing roll and pitch
    ctx.beginPath()
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    if (Math.abs(roll) > 5 || Math.abs(pitch) > 5) { ctx.fillStyle = "rgba(231,96,98,.2)"; }
    else { ctx.fillStyle = "rgba(255,255,255,.2)"; }
    ctx.lineWidth = 2;
    ctx.save()
    ctx.translate(centerX, centerY + pitch * pixelPrDegree);
    ctx.rotate(roll * Math.PI / 180);
    ctx.translate(-centerX, 0);
    ctx.rect(-centerX, 0, width * 2, height * 4);
    ctx.restore()
    ctx.stroke();
    ctx.fill();
    ctx.closePath()    


    
    roll = Math.round(roll);
    pitch = Math.round(pitch);

    // Common text formats
    ctx.font = "bold 15px Open Sans";
    ctx.textBaseline = "middle";

    // Draw PITCH text    
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillText("PITCH", 20, centerY);
    ctx.fillStyle = "rgb(231,96,98)";
    ctx.fillText(pitch + "°", 20 + ctx.measureText("PITCH ").width, centerY)

    // Draw ROLL text
    ctx.textAlign = "right";
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillText("ROLL", width - 20 - ctx.measureText(roll + "° ").width, centerY);
    ctx.fillStyle = "rgb(231,96,98)";
    ctx.fillText(roll + "°", width - 20, centerY)
  }


  drawCompass(heading, turns = 0) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.canvas.getContext("2d");

    heading = Math.round(heading)

    // Rose
    const left = (width / 2 - 74) - ((1200 / 360) * heading);
    ctx.drawImage(this.compassRose, left, 0);
    ctx.drawImage(this.compassRose, -1200 + left, 0);
    ctx.drawImage(this.compassRose, 1200 + left, 0);

    // Heading background
    ctx.save()
    ctx.beginPath()
    ctx.fillStyle = "#fb6362";
    ctx.strokeStyle = "rgba(145,152,169,1)";
    ctx.lineWidth = 2;
    ctx.rect(width/2-35,-2,70,30)
    ctx.stroke()
    ctx.fill()
    ctx.closePath()
    ctx.restore()

    // Heading
    ctx.font = "bold 25px Open Sans";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillText(heading.toString().padStart(3,'0'), width/2, 15);

    if (turns != 0) {
      const text = `${turns < 0 ? '< ' : ''}${Math.abs(turns)}${turns > 0 ? ' >' : ''}`
      ctx.font = "bold 15px Open Sans";
      ctx.fillText(text, width/2, 40);
    }
  }
}

},{}],6:[function(require,module,exports){
/*
 * LineChart Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

module.exports = class LineChart {

  #canvas;
  #ctx;
  #points;
  #seaLevelOffset;

  constructor(canvas) {

    this.#canvas = canvas;
    this.#ctx = this.#canvas.getContext("2d");

    this.setDepthScale(10);
    this.setTimeScale(60*3); // 2 minute

    this.#seaLevelOffset = 1; // 1 meter down

    this.#points = [];
  }

  setTimeScale(timeScale) {
    this.timeScale = timeScale;
    this.pixelsPerSecond = this.#canvas.width / this.timeScale;
  }

  setDepthScale(depthScale) {
    this.depthScale = depthScale + this.#seaLevelOffset;
    this.pixelsPerCentimeter = this.#canvas.height / (this.depthScale * 100);
  }


  addDataPoint(depth) {

    this.#points.push({ depth, time: new Date() });
    this.checkDatapoints();
  }

  // Remove all points outside of current time minus the time scale
  checkDatapoints() {
    let time = new Date();
    let deepest = 0;
    this.#points.forEach((point, index) => {

      // Calculate time difference
      const diff = (time - point.time) / 1000;
      // Remove if diff is bigger than the time scale
      if (diff > this.timeScale) {
        this.#points.splice(index, 1);
      }

      // Find the deepets point 
      if (point.depth > deepest) { deepest = point.depth; }
    });

    // Update depth scale if needed     
    if (deepest < 5) deepest = 5;
    this.setDepthScale(deepest);
    this.setTimeScale(this.timeScale);
  }

  draw() {
    this.drawPoints();
    this.drawDepthScale();
  }


  drawPoints() {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#ctx.save();

    let lastPointsTime = this.#points[0] ? this.#points[0].time : new Date();
    let sealevel = (this.#seaLevelOffset * 100) * this.pixelsPerCentimeter;;

    this.#ctx.beginPath();
    this.#ctx.lineWidth = 3;
    this.#ctx.strokeStyle = "rgba(255,255,255,0.9)";

    // Draw lines between each point.
    this.#points.forEach(point => {

      // Calculate y axis position
      let yPosition = (point.depth * 100) * this.pixelsPerCentimeter;

      // Calculate x axis position
      let timeDiff = (point.time - lastPointsTime) / 1000;  // In seconds
      let xPosition = timeDiff * this.pixelsPerSecond;

      // Draw line
      this.#ctx.lineTo(xPosition, yPosition + sealevel);
    });

    this.#ctx.stroke();

    this.#ctx.beginPath();
    this.#ctx.strokeStyle = "rgba(0,255,0,0.1)";
    this.#ctx.moveTo(0, sealevel);
    this.#ctx.lineTo(this.#canvas.width, sealevel);
    this.#ctx.stroke();
    this.#ctx.restore();
  }

  drawDepthScale() {

    // Common text formats
    const offSet =  this.#seaLevelOffset * 100 * this.pixelsPerCentimeter;
    let increment;
    
    if(this.depthScale < 10) { increment = 1; }
    else if(this.depthScale < 20) { increment = 2; }
    else if(this.depthScale < 50) { increment = 5; }
    else if(this.depthScale < 100) { increment = 5; }
    else { increment = 20; }

    // Spread numbers of meters between depth scale
    for (let i = 0; i < this.depthScale-1; i+=increment) {
      let yPosition = (i * 100) * this.pixelsPerCentimeter + offSet;
      this.writeText(i + "m", yPosition);
    }

  }



  writeText(text, y, baseline = "middle") {
    this.#ctx.font = "bold 15px Open Sans";
    this.#ctx.textBaseline = baseline;

    this.#ctx.textAlign = "left";

    this.#ctx.fillStyle = "rgb(255,255,255)";
    this.#ctx.fillText(text, 10, y);
  }

  toggleWide() {
    this.#canvas.parentElement.classList.toggle("fullWidth");
    this.#canvas.height = this.#canvas.offsetHeight;
    this.#canvas.width = this.#canvas.offsetWidth;
  }

}

},{}],7:[function(require,module,exports){
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
},{"./EventEmitter.js":3}],8:[function(require,module,exports){
const Decoder = require('./broadway/Decoder.js');
const YUVCanvas = require('./broadway/YUVCanvas.js');
const Player = require('./broadway/Player.js');
const EventEmitter = require('./EventEmitter.js');

module.exports = class Video extends EventEmitter {

    constructor(videoElement) {
        super();

        this.player = new Player({
            useWorker: false,
            webgl: true
        });
        this.canvas = this.player.canvas;
        this.skipFrames = false;

        this.videoElement = videoElement;
        videoElement.appendChild(this.canvas);

        this.recordState = null;

        new ResizeObserver(() => this.resizeToFit()).observe(this.canvas)
        new ResizeObserver(() => this.resizeToFit()).observe(this.videoElement)
        this.resizeToFit();
    }

 
    decodeFrame(frame) {
        if (this.skipFrames) { return; }
        try {
            this.skipFrames = true;
            frame = new Uint8Array(frame);
            this.player.decode(frame);
            this.skipFrames = false;
        } catch (e) {
            console.log(e)
        }

    }

    resizeToFit() {

        // This makes sure the canvas is 100% in the video element without losing aspect ratio
        
        let width = this.player.canvas.offsetWidth
        let height = this.player.canvas.offsetHeight
    
        const videoMaxWidth = this.videoElement.clientWidth; // Size excluding border
        const videoMaxHeight = this.videoElement.clientHeight; // Size excluding border

        // Min will make no video dissapear, max will fill
        const zoom = Math.max(videoMaxWidth / width, videoMaxHeight / height);

        // lets center this aswell
        const left = Math.abs(videoMaxWidth - width) / 2
        const top = Math.abs(videoMaxHeight - height) / 2

        this.canvas.style.zoom = zoom;
        this.canvas.style.left = left;
        this.canvas.style.top = top;

        console.log(zoom,left,top);
    }

    startRecord() {
        return this.ws.send('record start');
    }

    stopRecord() {
        return this.ws.send('record stop');
    }

    updateRecordState() {
        return this.ws.send('record state');
    }
}
},{"./EventEmitter.js":3,"./broadway/Decoder.js":9,"./broadway/Player.js":10,"./broadway/YUVCanvas.js":11}],9:[function(require,module,exports){
(function (process,__dirname){(function (){
// universal module definition
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        window.Decoder = factory();
    }
}(this, function () {
  
  var global;
  
  function initglobal(){
    global = this;
    if (!global){
      if (typeof window != "undefined"){
        global = window;
      }else if (typeof self != "undefined"){
        global = self;
      };
    };
  };
  initglobal();
  
  
  function error(message) {
    console.error(message);
    console.trace();
  };

  
  function assert(condition, message) {
    if (!condition) {
      error(message);
    };
  };
  
  
  var getModule = function(par_broadwayOnHeadersDecoded, par_broadwayOnPictureDecoded){
    
    
    /*var ModuleX = {
      'print': function(text) { console.log('stdout: ' + text); },
      'printErr': function(text) { console.log('stderr: ' + text); }
    };*/
    
    
    /*
    
      The reason why this is all packed into one file is that this file can also function as worker.
      you can integrate the file into your build system and provide the original file to be loaded into a worker.
    
    */
    
    var Module = (function(){
    
var Module;if(!Module)Module=(typeof Module!=="undefined"?Module:null)||{};var moduleOverrides={};for(var key in Module){if(Module.hasOwnProperty(key)){moduleOverrides[key]=Module[key]}}var ENVIRONMENT_IS_WEB=typeof window==="object";var ENVIRONMENT_IS_WORKER=typeof importScripts==="function";var ENVIRONMENT_IS_NODE=typeof process==="object"&&typeof null==="function"&&!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_WORKER;var ENVIRONMENT_IS_SHELL=!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_NODE&&!ENVIRONMENT_IS_WORKER;if(ENVIRONMENT_IS_NODE){if(!Module["print"])Module["print"]=function print(x){process["stdout"].write(x+"\n")};if(!Module["printErr"])Module["printErr"]=function printErr(x){process["stderr"].write(x+"\n")};var nodeFS=(null)("fs");var nodePath=(null)("path");Module["read"]=function read(filename,binary){filename=nodePath["normalize"](filename);var ret=nodeFS["readFileSync"](filename);if(!ret&&filename!=nodePath["resolve"](filename)){filename=path.join(__dirname,"..","src",filename);ret=nodeFS["readFileSync"](filename)}if(ret&&!binary)ret=ret.toString();return ret};Module["readBinary"]=function readBinary(filename){var ret=Module["read"](filename,true);if(!ret.buffer){ret=new Uint8Array(ret)}assert(ret.buffer);return ret};Module["load"]=function load(f){globalEval(read(f))};if(!Module["thisProgram"]){if(process["argv"].length>1){Module["thisProgram"]=process["argv"][1].replace(/\\/g,"/")}else{Module["thisProgram"]="unknown-program"}}Module["arguments"]=process["argv"].slice(2);if(typeof module!=="undefined"){module["exports"]=Module}process["on"]("uncaughtException",(function(ex){if(!(ex instanceof ExitStatus)){throw ex}}));Module["inspect"]=(function(){return"[Emscripten Module object]"})}else if(ENVIRONMENT_IS_SHELL){if(!Module["print"])Module["print"]=print;if(typeof printErr!="undefined")Module["printErr"]=printErr;if(typeof read!="undefined"){Module["read"]=read}else{Module["read"]=function read(){throw"no read() available (jsc?)"}}Module["readBinary"]=function readBinary(f){if(typeof readbuffer==="function"){return new Uint8Array(readbuffer(f))}var data=read(f,"binary");assert(typeof data==="object");return data};if(typeof scriptArgs!="undefined"){Module["arguments"]=scriptArgs}else if(typeof arguments!="undefined"){Module["arguments"]=arguments}}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){Module["read"]=function read(url){var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.send(null);return xhr.responseText};if(typeof arguments!="undefined"){Module["arguments"]=arguments}if(typeof console!=="undefined"){if(!Module["print"])Module["print"]=function print(x){console.log(x)};if(!Module["printErr"])Module["printErr"]=function printErr(x){console.log(x)}}else{var TRY_USE_DUMP=false;if(!Module["print"])Module["print"]=TRY_USE_DUMP&&typeof dump!=="undefined"?(function(x){dump(x)}):(function(x){})}if(ENVIRONMENT_IS_WORKER){Module["load"]=importScripts}if(typeof Module["setWindowTitle"]==="undefined"){Module["setWindowTitle"]=(function(title){document.title=title})}}else{throw"Unknown runtime environment. Where are we?"}function globalEval(x){eval.call(null,x)}if(!Module["load"]&&Module["read"]){Module["load"]=function load(f){globalEval(Module["read"](f))}}if(!Module["print"]){Module["print"]=(function(){})}if(!Module["printErr"]){Module["printErr"]=Module["print"]}if(!Module["arguments"]){Module["arguments"]=[]}if(!Module["thisProgram"]){Module["thisProgram"]="./this.program"}Module.print=Module["print"];Module.printErr=Module["printErr"];Module["preRun"]=[];Module["postRun"]=[];for(var key in moduleOverrides){if(moduleOverrides.hasOwnProperty(key)){Module[key]=moduleOverrides[key]}}var Runtime={setTempRet0:(function(value){tempRet0=value}),getTempRet0:(function(){return tempRet0}),stackSave:(function(){return STACKTOP}),stackRestore:(function(stackTop){STACKTOP=stackTop}),getNativeTypeSize:(function(type){switch(type){case"i1":case"i8":return 1;case"i16":return 2;case"i32":return 4;case"i64":return 8;case"float":return 4;case"double":return 8;default:{if(type[type.length-1]==="*"){return Runtime.QUANTUM_SIZE}else if(type[0]==="i"){var bits=parseInt(type.substr(1));assert(bits%8===0);return bits/8}else{return 0}}}}),getNativeFieldSize:(function(type){return Math.max(Runtime.getNativeTypeSize(type),Runtime.QUANTUM_SIZE)}),STACK_ALIGN:16,prepVararg:(function(ptr,type){if(type==="double"||type==="i64"){if(ptr&7){assert((ptr&7)===4);ptr+=4}}else{assert((ptr&3)===0)}return ptr}),getAlignSize:(function(type,size,vararg){if(!vararg&&(type=="i64"||type=="double"))return 8;if(!type)return Math.min(size,8);return Math.min(size||(type?Runtime.getNativeFieldSize(type):0),Runtime.QUANTUM_SIZE)}),dynCall:(function(sig,ptr,args){if(args&&args.length){if(!args.splice)args=Array.prototype.slice.call(args);args.splice(0,0,ptr);return Module["dynCall_"+sig].apply(null,args)}else{return Module["dynCall_"+sig].call(null,ptr)}}),functionPointers:[],addFunction:(function(func){for(var i=0;i<Runtime.functionPointers.length;i++){if(!Runtime.functionPointers[i]){Runtime.functionPointers[i]=func;return 2*(1+i)}}throw"Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS."}),removeFunction:(function(index){Runtime.functionPointers[(index-2)/2]=null}),warnOnce:(function(text){if(!Runtime.warnOnce.shown)Runtime.warnOnce.shown={};if(!Runtime.warnOnce.shown[text]){Runtime.warnOnce.shown[text]=1;Module.printErr(text)}}),funcWrappers:{},getFuncWrapper:(function(func,sig){assert(sig);if(!Runtime.funcWrappers[sig]){Runtime.funcWrappers[sig]={}}var sigCache=Runtime.funcWrappers[sig];if(!sigCache[func]){sigCache[func]=function dynCall_wrapper(){return Runtime.dynCall(sig,func,arguments)}}return sigCache[func]}),getCompilerSetting:(function(name){throw"You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work"}),stackAlloc:(function(size){var ret=STACKTOP;STACKTOP=STACKTOP+size|0;STACKTOP=STACKTOP+15&-16;return ret}),staticAlloc:(function(size){var ret=STATICTOP;STATICTOP=STATICTOP+size|0;STATICTOP=STATICTOP+15&-16;return ret}),dynamicAlloc:(function(size){var ret=DYNAMICTOP;DYNAMICTOP=DYNAMICTOP+size|0;DYNAMICTOP=DYNAMICTOP+15&-16;if(DYNAMICTOP>=TOTAL_MEMORY){var success=enlargeMemory();if(!success){DYNAMICTOP=ret;return 0}}return ret}),alignMemory:(function(size,quantum){var ret=size=Math.ceil(size/(quantum?quantum:16))*(quantum?quantum:16);return ret}),makeBigInt:(function(low,high,unsigned){var ret=unsigned?+(low>>>0)+ +(high>>>0)*+4294967296:+(low>>>0)+ +(high|0)*+4294967296;return ret}),GLOBAL_BASE:8,QUANTUM_SIZE:4,__dummy__:0};Module["Runtime"]=Runtime;var __THREW__=0;var ABORT=false;var EXITSTATUS=0;var undef=0;var tempValue,tempInt,tempBigInt,tempInt2,tempBigInt2,tempPair,tempBigIntI,tempBigIntR,tempBigIntS,tempBigIntP,tempBigIntD,tempDouble,tempFloat;var tempI64,tempI64b;var tempRet0,tempRet1,tempRet2,tempRet3,tempRet4,tempRet5,tempRet6,tempRet7,tempRet8,tempRet9;function assert(condition,text){if(!condition){abort("Assertion failed: "+text)}}var globalScope=this;function getCFunc(ident){var func=Module["_"+ident];if(!func){try{func=eval("_"+ident)}catch(e){}}assert(func,"Cannot call unknown function "+ident+" (perhaps LLVM optimizations or closure removed it?)");return func}var cwrap,ccall;((function(){var JSfuncs={"stackSave":(function(){Runtime.stackSave()}),"stackRestore":(function(){Runtime.stackRestore()}),"arrayToC":(function(arr){var ret=Runtime.stackAlloc(arr.length);writeArrayToMemory(arr,ret);return ret}),"stringToC":(function(str){var ret=0;if(str!==null&&str!==undefined&&str!==0){ret=Runtime.stackAlloc((str.length<<2)+1);writeStringToMemory(str,ret)}return ret})};var toC={"string":JSfuncs["stringToC"],"array":JSfuncs["arrayToC"]};ccall=function ccallFunc(ident,returnType,argTypes,args,opts){var func=getCFunc(ident);var cArgs=[];var stack=0;if(args){for(var i=0;i<args.length;i++){var converter=toC[argTypes[i]];if(converter){if(stack===0)stack=Runtime.stackSave();cArgs[i]=converter(args[i])}else{cArgs[i]=args[i]}}}var ret=func.apply(null,cArgs);if(returnType==="string")ret=Pointer_stringify(ret);if(stack!==0){if(opts&&opts.async){EmterpreterAsync.asyncFinalizers.push((function(){Runtime.stackRestore(stack)}));return}Runtime.stackRestore(stack)}return ret};var sourceRegex=/^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;function parseJSFunc(jsfunc){var parsed=jsfunc.toString().match(sourceRegex).slice(1);return{arguments:parsed[0],body:parsed[1],returnValue:parsed[2]}}var JSsource={};for(var fun in JSfuncs){if(JSfuncs.hasOwnProperty(fun)){JSsource[fun]=parseJSFunc(JSfuncs[fun])}}cwrap=function cwrap(ident,returnType,argTypes){argTypes=argTypes||[];var cfunc=getCFunc(ident);var numericArgs=argTypes.every((function(type){return type==="number"}));var numericRet=returnType!=="string";if(numericRet&&numericArgs){return cfunc}var argNames=argTypes.map((function(x,i){return"$"+i}));var funcstr="(function("+argNames.join(",")+") {";var nargs=argTypes.length;if(!numericArgs){funcstr+="var stack = "+JSsource["stackSave"].body+";";for(var i=0;i<nargs;i++){var arg=argNames[i],type=argTypes[i];if(type==="number")continue;var convertCode=JSsource[type+"ToC"];funcstr+="var "+convertCode.arguments+" = "+arg+";";funcstr+=convertCode.body+";";funcstr+=arg+"="+convertCode.returnValue+";"}}var cfuncname=parseJSFunc((function(){return cfunc})).returnValue;funcstr+="var ret = "+cfuncname+"("+argNames.join(",")+");";if(!numericRet){var strgfy=parseJSFunc((function(){return Pointer_stringify})).returnValue;funcstr+="ret = "+strgfy+"(ret);"}if(!numericArgs){funcstr+=JSsource["stackRestore"].body.replace("()","(stack)")+";"}funcstr+="return ret})";return eval(funcstr)}}))();Module["ccall"]=ccall;Module["cwrap"]=cwrap;function setValue(ptr,value,type,noSafe){type=type||"i8";if(type.charAt(type.length-1)==="*")type="i32";switch(type){case"i1":HEAP8[ptr>>0]=value;break;case"i8":HEAP8[ptr>>0]=value;break;case"i16":HEAP16[ptr>>1]=value;break;case"i32":HEAP32[ptr>>2]=value;break;case"i64":tempI64=[value>>>0,(tempDouble=value,+Math_abs(tempDouble)>=+1?tempDouble>+0?(Math_min(+Math_floor(tempDouble/+4294967296),+4294967295)|0)>>>0:~~+Math_ceil((tempDouble- +(~~tempDouble>>>0))/+4294967296)>>>0:0)],HEAP32[ptr>>2]=tempI64[0],HEAP32[ptr+4>>2]=tempI64[1];break;case"float":HEAPF32[ptr>>2]=value;break;case"double":HEAPF64[ptr>>3]=value;break;default:abort("invalid type for setValue: "+type)}}Module["setValue"]=setValue;function getValue(ptr,type,noSafe){type=type||"i8";if(type.charAt(type.length-1)==="*")type="i32";switch(type){case"i1":return HEAP8[ptr>>0];case"i8":return HEAP8[ptr>>0];case"i16":return HEAP16[ptr>>1];case"i32":return HEAP32[ptr>>2];case"i64":return HEAP32[ptr>>2];case"float":return HEAPF32[ptr>>2];case"double":return HEAPF64[ptr>>3];default:abort("invalid type for setValue: "+type)}return null}Module["getValue"]=getValue;var ALLOC_NORMAL=0;var ALLOC_STACK=1;var ALLOC_STATIC=2;var ALLOC_DYNAMIC=3;var ALLOC_NONE=4;Module["ALLOC_NORMAL"]=ALLOC_NORMAL;Module["ALLOC_STACK"]=ALLOC_STACK;Module["ALLOC_STATIC"]=ALLOC_STATIC;Module["ALLOC_DYNAMIC"]=ALLOC_DYNAMIC;Module["ALLOC_NONE"]=ALLOC_NONE;function allocate(slab,types,allocator,ptr){var zeroinit,size;if(typeof slab==="number"){zeroinit=true;size=slab}else{zeroinit=false;size=slab.length}var singleType=typeof types==="string"?types:null;var ret;if(allocator==ALLOC_NONE){ret=ptr}else{ret=[_malloc,Runtime.stackAlloc,Runtime.staticAlloc,Runtime.dynamicAlloc][allocator===undefined?ALLOC_STATIC:allocator](Math.max(size,singleType?1:types.length))}if(zeroinit){var ptr=ret,stop;assert((ret&3)==0);stop=ret+(size&~3);for(;ptr<stop;ptr+=4){HEAP32[ptr>>2]=0}stop=ret+size;while(ptr<stop){HEAP8[ptr++>>0]=0}return ret}if(singleType==="i8"){if(slab.subarray||slab.slice){HEAPU8.set(slab,ret)}else{HEAPU8.set(new Uint8Array(slab),ret)}return ret}var i=0,type,typeSize,previousType;while(i<size){var curr=slab[i];if(typeof curr==="function"){curr=Runtime.getFunctionIndex(curr)}type=singleType||types[i];if(type===0){i++;continue}if(type=="i64")type="i32";setValue(ret+i,curr,type);if(previousType!==type){typeSize=Runtime.getNativeTypeSize(type);previousType=type}i+=typeSize}return ret}Module["allocate"]=allocate;function getMemory(size){if(!staticSealed)return Runtime.staticAlloc(size);if(typeof _sbrk!=="undefined"&&!_sbrk.called||!runtimeInitialized)return Runtime.dynamicAlloc(size);return _malloc(size)}Module["getMemory"]=getMemory;function Pointer_stringify(ptr,length){if(length===0||!ptr)return"";var hasUtf=0;var t;var i=0;while(1){t=HEAPU8[ptr+i>>0];hasUtf|=t;if(t==0&&!length)break;i++;if(length&&i==length)break}if(!length)length=i;var ret="";if(hasUtf<128){var MAX_CHUNK=1024;var curr;while(length>0){curr=String.fromCharCode.apply(String,HEAPU8.subarray(ptr,ptr+Math.min(length,MAX_CHUNK)));ret=ret?ret+curr:curr;ptr+=MAX_CHUNK;length-=MAX_CHUNK}return ret}return Module["UTF8ToString"](ptr)}Module["Pointer_stringify"]=Pointer_stringify;function AsciiToString(ptr){var str="";while(1){var ch=HEAP8[ptr++>>0];if(!ch)return str;str+=String.fromCharCode(ch)}}Module["AsciiToString"]=AsciiToString;function stringToAscii(str,outPtr){return writeAsciiToMemory(str,outPtr,false)}Module["stringToAscii"]=stringToAscii;function UTF8ArrayToString(u8Array,idx){var u0,u1,u2,u3,u4,u5;var str="";while(1){u0=u8Array[idx++];if(!u0)return str;if(!(u0&128)){str+=String.fromCharCode(u0);continue}u1=u8Array[idx++]&63;if((u0&224)==192){str+=String.fromCharCode((u0&31)<<6|u1);continue}u2=u8Array[idx++]&63;if((u0&240)==224){u0=(u0&15)<<12|u1<<6|u2}else{u3=u8Array[idx++]&63;if((u0&248)==240){u0=(u0&7)<<18|u1<<12|u2<<6|u3}else{u4=u8Array[idx++]&63;if((u0&252)==248){u0=(u0&3)<<24|u1<<18|u2<<12|u3<<6|u4}else{u5=u8Array[idx++]&63;u0=(u0&1)<<30|u1<<24|u2<<18|u3<<12|u4<<6|u5}}}if(u0<65536){str+=String.fromCharCode(u0)}else{var ch=u0-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023)}}}Module["UTF8ArrayToString"]=UTF8ArrayToString;function UTF8ToString(ptr){return UTF8ArrayToString(HEAPU8,ptr)}Module["UTF8ToString"]=UTF8ToString;function stringToUTF8Array(str,outU8Array,outIdx,maxBytesToWrite){if(!(maxBytesToWrite>0))return 0;var startIdx=outIdx;var endIdx=outIdx+maxBytesToWrite-1;for(var i=0;i<str.length;++i){var u=str.charCodeAt(i);if(u>=55296&&u<=57343)u=65536+((u&1023)<<10)|str.charCodeAt(++i)&1023;if(u<=127){if(outIdx>=endIdx)break;outU8Array[outIdx++]=u}else if(u<=2047){if(outIdx+1>=endIdx)break;outU8Array[outIdx++]=192|u>>6;outU8Array[outIdx++]=128|u&63}else if(u<=65535){if(outIdx+2>=endIdx)break;outU8Array[outIdx++]=224|u>>12;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}else if(u<=2097151){if(outIdx+3>=endIdx)break;outU8Array[outIdx++]=240|u>>18;outU8Array[outIdx++]=128|u>>12&63;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}else if(u<=67108863){if(outIdx+4>=endIdx)break;outU8Array[outIdx++]=248|u>>24;outU8Array[outIdx++]=128|u>>18&63;outU8Array[outIdx++]=128|u>>12&63;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}else{if(outIdx+5>=endIdx)break;outU8Array[outIdx++]=252|u>>30;outU8Array[outIdx++]=128|u>>24&63;outU8Array[outIdx++]=128|u>>18&63;outU8Array[outIdx++]=128|u>>12&63;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}}outU8Array[outIdx]=0;return outIdx-startIdx}Module["stringToUTF8Array"]=stringToUTF8Array;function stringToUTF8(str,outPtr,maxBytesToWrite){return stringToUTF8Array(str,HEAPU8,outPtr,maxBytesToWrite)}Module["stringToUTF8"]=stringToUTF8;function lengthBytesUTF8(str){var len=0;for(var i=0;i<str.length;++i){var u=str.charCodeAt(i);if(u>=55296&&u<=57343)u=65536+((u&1023)<<10)|str.charCodeAt(++i)&1023;if(u<=127){++len}else if(u<=2047){len+=2}else if(u<=65535){len+=3}else if(u<=2097151){len+=4}else if(u<=67108863){len+=5}else{len+=6}}return len}Module["lengthBytesUTF8"]=lengthBytesUTF8;function UTF16ToString(ptr){var i=0;var str="";while(1){var codeUnit=HEAP16[ptr+i*2>>1];if(codeUnit==0)return str;++i;str+=String.fromCharCode(codeUnit)}}Module["UTF16ToString"]=UTF16ToString;function stringToUTF16(str,outPtr,maxBytesToWrite){if(maxBytesToWrite===undefined){maxBytesToWrite=2147483647}if(maxBytesToWrite<2)return 0;maxBytesToWrite-=2;var startPtr=outPtr;var numCharsToWrite=maxBytesToWrite<str.length*2?maxBytesToWrite/2:str.length;for(var i=0;i<numCharsToWrite;++i){var codeUnit=str.charCodeAt(i);HEAP16[outPtr>>1]=codeUnit;outPtr+=2}HEAP16[outPtr>>1]=0;return outPtr-startPtr}Module["stringToUTF16"]=stringToUTF16;function lengthBytesUTF16(str){return str.length*2}Module["lengthBytesUTF16"]=lengthBytesUTF16;function UTF32ToString(ptr){var i=0;var str="";while(1){var utf32=HEAP32[ptr+i*4>>2];if(utf32==0)return str;++i;if(utf32>=65536){var ch=utf32-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023)}else{str+=String.fromCharCode(utf32)}}}Module["UTF32ToString"]=UTF32ToString;function stringToUTF32(str,outPtr,maxBytesToWrite){if(maxBytesToWrite===undefined){maxBytesToWrite=2147483647}if(maxBytesToWrite<4)return 0;var startPtr=outPtr;var endPtr=startPtr+maxBytesToWrite-4;for(var i=0;i<str.length;++i){var codeUnit=str.charCodeAt(i);if(codeUnit>=55296&&codeUnit<=57343){var trailSurrogate=str.charCodeAt(++i);codeUnit=65536+((codeUnit&1023)<<10)|trailSurrogate&1023}HEAP32[outPtr>>2]=codeUnit;outPtr+=4;if(outPtr+4>endPtr)break}HEAP32[outPtr>>2]=0;return outPtr-startPtr}Module["stringToUTF32"]=stringToUTF32;function lengthBytesUTF32(str){var len=0;for(var i=0;i<str.length;++i){var codeUnit=str.charCodeAt(i);if(codeUnit>=55296&&codeUnit<=57343)++i;len+=4}return len}Module["lengthBytesUTF32"]=lengthBytesUTF32;function demangle(func){var hasLibcxxabi=!!Module["___cxa_demangle"];if(hasLibcxxabi){try{var buf=_malloc(func.length);writeStringToMemory(func.substr(1),buf);var status=_malloc(4);var ret=Module["___cxa_demangle"](buf,0,0,status);if(getValue(status,"i32")===0&&ret){return Pointer_stringify(ret)}}catch(e){}finally{if(buf)_free(buf);if(status)_free(status);if(ret)_free(ret)}}var i=3;var basicTypes={"v":"void","b":"bool","c":"char","s":"short","i":"int","l":"long","f":"float","d":"double","w":"wchar_t","a":"signed char","h":"unsigned char","t":"unsigned short","j":"unsigned int","m":"unsigned long","x":"long long","y":"unsigned long long","z":"..."};var subs=[];var first=true;function dump(x){if(x)Module.print(x);Module.print(func);var pre="";for(var a=0;a<i;a++)pre+=" ";Module.print(pre+"^")}function parseNested(){i++;if(func[i]==="K")i++;var parts=[];while(func[i]!=="E"){if(func[i]==="S"){i++;var next=func.indexOf("_",i);var num=func.substring(i,next)||0;parts.push(subs[num]||"?");i=next+1;continue}if(func[i]==="C"){parts.push(parts[parts.length-1]);i+=2;continue}var size=parseInt(func.substr(i));var pre=size.toString().length;if(!size||!pre){i--;break}var curr=func.substr(i+pre,size);parts.push(curr);subs.push(curr);i+=pre+size}i++;return parts}function parse(rawList,limit,allowVoid){limit=limit||Infinity;var ret="",list=[];function flushList(){return"("+list.join(", ")+")"}var name;if(func[i]==="N"){name=parseNested().join("::");limit--;if(limit===0)return rawList?[name]:name}else{if(func[i]==="K"||first&&func[i]==="L")i++;var size=parseInt(func.substr(i));if(size){var pre=size.toString().length;name=func.substr(i+pre,size);i+=pre+size}}first=false;if(func[i]==="I"){i++;var iList=parse(true);var iRet=parse(true,1,true);ret+=iRet[0]+" "+name+"<"+iList.join(", ")+">"}else{ret=name}paramLoop:while(i<func.length&&limit-->0){var c=func[i++];if(c in basicTypes){list.push(basicTypes[c])}else{switch(c){case"P":list.push(parse(true,1,true)[0]+"*");break;case"R":list.push(parse(true,1,true)[0]+"&");break;case"L":{i++;var end=func.indexOf("E",i);var size=end-i;list.push(func.substr(i,size));i+=size+2;break};case"A":{var size=parseInt(func.substr(i));i+=size.toString().length;if(func[i]!=="_")throw"?";i++;list.push(parse(true,1,true)[0]+" ["+size+"]");break};case"E":break paramLoop;default:ret+="?"+c;break paramLoop}}}if(!allowVoid&&list.length===1&&list[0]==="void")list=[];if(rawList){if(ret){list.push(ret+"?")}return list}else{return ret+flushList()}}var parsed=func;try{if(func=="Object._main"||func=="_main"){return"main()"}if(typeof func==="number")func=Pointer_stringify(func);if(func[0]!=="_")return func;if(func[1]!=="_")return func;if(func[2]!=="Z")return func;switch(func[3]){case"n":return"operator new()";case"d":return"operator delete()"}parsed=parse()}catch(e){parsed+="?"}if(parsed.indexOf("?")>=0&&!hasLibcxxabi){Runtime.warnOnce("warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling")}return parsed}function demangleAll(text){return text.replace(/__Z[\w\d_]+/g,(function(x){var y=demangle(x);return x===y?x:x+" ["+y+"]"}))}function jsStackTrace(){var err=new Error;if(!err.stack){try{throw new Error(0)}catch(e){err=e}if(!err.stack){return"(no stack trace available)"}}return err.stack.toString()}function stackTrace(){return demangleAll(jsStackTrace())}Module["stackTrace"]=stackTrace;var PAGE_SIZE=4096;function alignMemoryPage(x){if(x%4096>0){x+=4096-x%4096}return x}var HEAP;var HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64;var STATIC_BASE=0,STATICTOP=0,staticSealed=false;var STACK_BASE=0,STACKTOP=0,STACK_MAX=0;var DYNAMIC_BASE=0,DYNAMICTOP=0;function abortOnCannotGrowMemory(){abort("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value "+TOTAL_MEMORY+", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")}function enlargeMemory(){abortOnCannotGrowMemory()}var TOTAL_STACK=Module["TOTAL_STACK"]||5242880;var TOTAL_MEMORY=Module["TOTAL_MEMORY"]||52428800;var totalMemory=64*1024;while(totalMemory<TOTAL_MEMORY||totalMemory<2*TOTAL_STACK){if(totalMemory<16*1024*1024){totalMemory*=2}else{totalMemory+=16*1024*1024}}if(totalMemory!==TOTAL_MEMORY){TOTAL_MEMORY=totalMemory}assert(typeof Int32Array!=="undefined"&&typeof Float64Array!=="undefined"&&!!(new Int32Array(1))["subarray"]&&!!(new Int32Array(1))["set"],"JS engine does not provide full typed array support");var buffer;buffer=new ArrayBuffer(TOTAL_MEMORY);HEAP8=new Int8Array(buffer);HEAP16=new Int16Array(buffer);HEAP32=new Int32Array(buffer);HEAPU8=new Uint8Array(buffer);HEAPU16=new Uint16Array(buffer);HEAPU32=new Uint32Array(buffer);HEAPF32=new Float32Array(buffer);HEAPF64=new Float64Array(buffer);HEAP32[0]=255;assert(HEAPU8[0]===255&&HEAPU8[3]===0,"Typed arrays 2 must be run on a little-endian system");Module["HEAP"]=HEAP;Module["buffer"]=buffer;Module["HEAP8"]=HEAP8;Module["HEAP16"]=HEAP16;Module["HEAP32"]=HEAP32;Module["HEAPU8"]=HEAPU8;Module["HEAPU16"]=HEAPU16;Module["HEAPU32"]=HEAPU32;Module["HEAPF32"]=HEAPF32;Module["HEAPF64"]=HEAPF64;function callRuntimeCallbacks(callbacks){while(callbacks.length>0){var callback=callbacks.shift();if(typeof callback=="function"){callback();continue}var func=callback.func;if(typeof func==="number"){if(callback.arg===undefined){Runtime.dynCall("v",func)}else{Runtime.dynCall("vi",func,[callback.arg])}}else{func(callback.arg===undefined?null:callback.arg)}}}var __ATPRERUN__=[];var __ATINIT__=[];var __ATMAIN__=[];var __ATEXIT__=[];var __ATPOSTRUN__=[];var runtimeInitialized=false;var runtimeExited=false;function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift())}}callRuntimeCallbacks(__ATPRERUN__)}function ensureInitRuntime(){if(runtimeInitialized)return;runtimeInitialized=true;callRuntimeCallbacks(__ATINIT__)}function preMain(){callRuntimeCallbacks(__ATMAIN__)}function exitRuntime(){callRuntimeCallbacks(__ATEXIT__);runtimeExited=true}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift())}}callRuntimeCallbacks(__ATPOSTRUN__)}function addOnPreRun(cb){__ATPRERUN__.unshift(cb)}Module["addOnPreRun"]=addOnPreRun;function addOnInit(cb){__ATINIT__.unshift(cb)}Module["addOnInit"]=addOnInit;function addOnPreMain(cb){__ATMAIN__.unshift(cb)}Module["addOnPreMain"]=addOnPreMain;function addOnExit(cb){__ATEXIT__.unshift(cb)}Module["addOnExit"]=addOnExit;function addOnPostRun(cb){__ATPOSTRUN__.unshift(cb)}Module["addOnPostRun"]=addOnPostRun;function intArrayFromString(stringy,dontAddNull,length){var len=length>0?length:lengthBytesUTF8(stringy)+1;var u8array=new Array(len);var numBytesWritten=stringToUTF8Array(stringy,u8array,0,u8array.length);if(dontAddNull)u8array.length=numBytesWritten;return u8array}Module["intArrayFromString"]=intArrayFromString;function intArrayToString(array){var ret=[];for(var i=0;i<array.length;i++){var chr=array[i];if(chr>255){chr&=255}ret.push(String.fromCharCode(chr))}return ret.join("")}Module["intArrayToString"]=intArrayToString;function writeStringToMemory(string,buffer,dontAddNull){var array=intArrayFromString(string,dontAddNull);var i=0;while(i<array.length){var chr=array[i];HEAP8[buffer+i>>0]=chr;i=i+1}}Module["writeStringToMemory"]=writeStringToMemory;function writeArrayToMemory(array,buffer){for(var i=0;i<array.length;i++){HEAP8[buffer++>>0]=array[i]}}Module["writeArrayToMemory"]=writeArrayToMemory;function writeAsciiToMemory(str,buffer,dontAddNull){for(var i=0;i<str.length;++i){HEAP8[buffer++>>0]=str.charCodeAt(i)}if(!dontAddNull)HEAP8[buffer>>0]=0}Module["writeAsciiToMemory"]=writeAsciiToMemory;function unSign(value,bits,ignore){if(value>=0){return value}return bits<=32?2*Math.abs(1<<bits-1)+value:Math.pow(2,bits)+value}function reSign(value,bits,ignore){if(value<=0){return value}var half=bits<=32?Math.abs(1<<bits-1):Math.pow(2,bits-1);if(value>=half&&(bits<=32||value>half)){value=-2*half+value}return value}if(!Math["imul"]||Math["imul"](4294967295,5)!==-5)Math["imul"]=function imul(a,b){var ah=a>>>16;var al=a&65535;var bh=b>>>16;var bl=b&65535;return al*bl+(ah*bl+al*bh<<16)|0};Math.imul=Math["imul"];if(!Math["clz32"])Math["clz32"]=(function(x){x=x>>>0;for(var i=0;i<32;i++){if(x&1<<31-i)return i}return 32});Math.clz32=Math["clz32"];var Math_abs=Math.abs;var Math_cos=Math.cos;var Math_sin=Math.sin;var Math_tan=Math.tan;var Math_acos=Math.acos;var Math_asin=Math.asin;var Math_atan=Math.atan;var Math_atan2=Math.atan2;var Math_exp=Math.exp;var Math_log=Math.log;var Math_sqrt=Math.sqrt;var Math_ceil=Math.ceil;var Math_floor=Math.floor;var Math_pow=Math.pow;var Math_imul=Math.imul;var Math_fround=Math.fround;var Math_min=Math.min;var Math_clz32=Math.clz32;var runDependencies=0;var runDependencyWatcher=null;var dependenciesFulfilled=null;function getUniqueRunDependency(id){return id}function addRunDependency(id){runDependencies++;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}}Module["addRunDependency"]=addRunDependency;function removeRunDependency(id){runDependencies--;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}if(runDependencies==0){if(runDependencyWatcher!==null){clearInterval(runDependencyWatcher);runDependencyWatcher=null}if(dependenciesFulfilled){var callback=dependenciesFulfilled;dependenciesFulfilled=null;callback()}}}Module["removeRunDependency"]=removeRunDependency;Module["preloadedImages"]={};Module["preloadedAudios"]={};var memoryInitializer=null;var ASM_CONSTS=[];STATIC_BASE=8;STATICTOP=STATIC_BASE+8896;__ATINIT__.push();allocate([10,0,0,0,13,0,0,0,16,0,0,0,11,0,0,0,14,0,0,0,18,0,0,0,13,0,0,0,16,0,0,0,20,0,0,0,14,0,0,0,18,0,0,0,23,0,0,0,16,0,0,0,20,0,0,0,25,0,0,0,18,0,0,0,23,0,0,0,29,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,11,0,0,0,12,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,16,0,0,0,17,0,0,0,18,0,0,0,19,0,0,0,20,0,0,0,21,0,0,0,22,0,0,0,23,0,0,0,24,0,0,0,25,0,0,0,26,0,0,0,27,0,0,0,28,0,0,0,29,0,0,0,29,0,0,0,30,0,0,0,31,0,0,0,32,0,0,0,32,0,0,0,33,0,0,0,34,0,0,0,34,0,0,0,35,0,0,0,35,0,0,0,36,0,0,0,36,0,0,0,37,0,0,0,37,0,0,0,37,0,0,0,38,0,0,0,38,0,0,0,38,0,0,0,39,0,0,0,39,0,0,0,39,0,0,0,39,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,0,0,0,0,1,0,0,0,4,0,0,0,5,0,0,0,2,0,0,0,3,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,12,0,0,0,13,0,0,0,10,0,0,0,11,0,0,0,14,0,0,0,15,0,0,0,0,0,0,0,5,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,4,0,0,0,2,0,0,0,4,0,0,0,1,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,0,0,0,0,13,0,0,0,4,0,0,0,8,0,0,0,0,0,0,0,15,0,0,0,4,0,0,0,10,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,12,0,0,0,4,0,0,0,11,0,0,0,4,0,0,0,14,0,0,0,0,0,0,0,17,0,0,0,4,0,0,0,16,0,0,0,0,0,0,0,19,0,0,0,4,0,0,0,18,0,0,0,0,0,0,0,21,0,0,0,4,0,0,0,20,0,0,0,0,0,0,0,23,0,0,0,4,0,0,0,22,0,0,0,1,0,0,0,10,0,0,0,1,0,0,0,11,0,0,0,4,0,0,0,0,0,0,0,4,0,0,0,1,0,0,0,1,0,0,0,14,0,0,0,1,0,0,0,15,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,5,0,0,0,4,0,0,0,2,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,8,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,7,0,0,0,4,0,0,0,12,0,0,0,4,0,0,0,13,0,0,0,1,0,0,0,18,0,0,0,1,0,0,0,19,0,0,0,4,0,0,0,16,0,0,0,4,0,0,0,17,0,0,0,1,0,0,0,22,0,0,0,1,0,0,0,23,0,0,0,4,0,0,0,20,0,0,0,4,0,0,0,21,0,0,0,1,0,0,0,11,0,0,0,1,0,0,0,14,0,0,0,4,0,0,0,1,0,0,0,255,0,0,0,4,0,0,0,1,0,0,0,15,0,0,0,2,0,0,0,10,0,0,0,4,0,0,0,5,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,9,0,0,0,255,0,0,0,12,0,0,0,4,0,0,0,7,0,0,0,255,0,0,0,2,0,0,0,4,0,0,0,13,0,0,0,255,0,0,0,8,0,0,0,1,0,0,0,19,0,0,0,2,0,0,0,18,0,0,0,4,0,0,0,17,0,0,0,255,0,0,0,16,0,0,0,1,0,0,0,23,0,0,0,2,0,0,0,22,0,0,0,4,0,0,0,21,0,0,0,255,0,0,0,20,0,0,0,3,0,0,0,15,0,0,0,1,0,0,0,10,0,0,0,0,0,0,0,5,0,0,0,4,0,0,0,0,0,0,0,1,0,0,0,11,0,0,0,1,0,0,0,14,0,0,0,4,0,0,0,1,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,7,0,0,0,4,0,0,0,2,0,0,0,0,0,0,0,13,0,0,0,4,0,0,0,8,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,12,0,0,0,3,0,0,0,19,0,0,0,1,0,0,0,18,0,0,0,0,0,0,0,17,0,0,0,4,0,0,0,16,0,0,0,3,0,0,0,23,0,0,0,1,0,0,0,22,0,0,0,0,0,0,0,21,0,0,0,4,0,0,0,20,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,4,0,0,0,8,0,0,0,12,0,0,0,8,0,0,0,12,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,4,0,0,0,8,0,0,0,12,0,0,0,8,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,8,0,0,0,8,0,0,0,12,0,0,0,12,0,0,0,8,0,0,0,8,0,0,0,12,0,0,0,12,0,0,0,0,0,0,0,5,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,7,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,4,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,4,0,0,0,2,0,0,0,4,0,0,0,1,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,1,0,0,0,4,0,0,0,3,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,1,0,0,0,4,0,0,0,4,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,1,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,0,0,0,0,13,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,0,0,0,0,15,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,0,0,0,8,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,0,0,0,8,0,0,0,0,0,0,0,15,0,0,0,4,0,0,0,10,0,0,0,4,0,0,0,9,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,11,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,12,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,12,0,0,0,4,0,0,0,11,0,0,0,4,0,0,0,14,0,0,0,1,0,0,0,10,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,10,0,0,0,4,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,10,0,0,0,1,0,0,0,11,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,10,0,0,0,1,0,0,0,11,0,0,0,4,0,0,0,0,0,0,0,4,0,0,0,1,0,0,0,1,0,0,0,14,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,14,0,0,0,4,0,0,0,4,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,14,0,0,0,1,0,0,0,15,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,14,0,0,0,1,0,0,0,15,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,5,0,0,0,4,0,0,0,2,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,2,0,0,0,4,0,0,0,8,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,2,0,0,0,4,0,0,0,3,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,2,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,8,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,6,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,12,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,7,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,7,0,0,0,4,0,0,0,12,0,0,0,4,0,0,0,13,0,0,0,1,0,0,0,14,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,14,0,0,0,255,0,0,0,4,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,11,0,0,0,1,0,0,0,14,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,11,0,0,0,1,0,0,0,14,0,0,0,4,0,0,0,1,0,0,0,255,0,0,0,4,0,0,0,2,0,0,0,10,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,2,0,0,0,10,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,15,0,0,0,2,0,0,0,10,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,15,0,0,0,2,0,0,0,10,0,0,0,4,0,0,0,5,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,6,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,6,0,0,0,255,0,0,0,12,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,9,0,0,0,255,0,0,0,12,0,0,0,255,0,0,0,2,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,2,0,0,0,255,0,0,0,8,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,7,0,0,0,255,0,0,0,2,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,7,0,0,0,255,0,0,0,2,0,0,0,4,0,0,0,13,0,0,0,255,0,0,0,8,0,0,0,3,0,0,0,15,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,3,0,0,0,15,0,0,0,0,0,0,0,5,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,3,0,0,0,15,0,0,0,1,0,0,0,10,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,3,0,0,0,15,0,0,0,1,0,0,0,10,0,0,0,0,0,0,0,5,0,0,0,4,0,0,0,0,0,0,0,1,0,0,0,11,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,11,0,0,0,4,0,0,0,1,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,11,0,0,0,1,0,0,0,14,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,1,0,0,0,11,0,0,0,1,0,0,0,14,0,0,0,4,0,0,0,1,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,7,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,13,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,4,0,0,0,2,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,4,0,0,0,2,0,0,0,0,0,0,0,13,0,0,0,4,0,0,0,8,0,0,0,4,0,0,0,3,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,9,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,12,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,11,0,0,0,12,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,192,30,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,102,32,38,16,6,8,101,24,101,24,67,16,67,16,67,16,67,16,67,16,67,16,67,16,67,16,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,34,8,0,0,0,0,0,0,0,0,106,64,74,48,42,40,10,32,105,56,105,56,73,40,73,40,41,32,41,32,9,24,9,24,104,48,104,48,104,48,104,48,72,32,72,32,72,32,72,32,40,24,40,24,40,24,40,24,8,16,8,16,8,16,8,16,103,40,103,40,103,40,103,40,103,40,103,40,103,40,103,40,71,24,71,24,71,24,71,24,71,24,71,24,71,24,71,24,110,96,78,88,46,80,14,80,110,88,78,80,46,72,14,72,13,64,13,64,77,72,77,72,45,64,45,64,13,56,13,56,109,80,109,80,77,64,77,64,45,56,45,56,13,48,13,48,107,72,107,72,107,72,107,72,107,72,107,72,107,72,107,72,75,56,75,56,75,56,75,56,75,56,75,56,75,56,75,56,43,48,43,48,43,48,43,48,43,48,43,48,43,48,43,48,11,40,11,40,11,40,11,40,11,40,11,40,11,40,11,40,0,0,0,0,47,104,47,104,16,128,80,128,48,128,16,120,112,128,80,120,48,120,16,112,112,120,80,112,48,112,16,104,111,112,111,112,79,104,79,104,47,96,47,96,15,96,15,96,111,104,111,104,79,96,79,96,47,88,47,88,15,88,15,88,0,0,0,0,0,0,0,0,102,56,70,32,38,32,6,16,102,48,70,24,38,24,6,8,101,40,101,40,37,16,37,16,100,32,100,32,100,32,100,32,100,24,100,24,100,24,100,24,67,16,67,16,67,16,67,16,67,16,67,16,67,16,67,16,0,0,0,0,0,0,0,0,105,72,73,56,41,56,9,48,8,40,8,40,72,48,72,48,40,48,40,48,8,32,8,32,103,64,103,64,103,64,103,64,71,40,71,40,71,40,71,40,39,40,39,40,39,40,39,40,7,24,7,24,7,24,7,24,0,0,0,0,109,120,109,120,110,128,78,128,46,128,14,128,46,120,14,120,78,120,46,112,77,112,77,112,13,112,13,112,109,112,109,112,77,104,77,104,45,104,45,104,13,104,13,104,109,104,109,104,77,96,77,96,45,96,45,96,13,96,13,96,12,88,12,88,12,88,12,88,76,88,76,88,76,88,76,88,44,88,44,88,44,88,44,88,12,80,12,80,12,80,12,80,108,96,108,96,108,96,108,96,76,80,76,80,76,80,76,80,44,80,44,80,44,80,44,80,12,72,12,72,12,72,12,72,107,88,107,88,107,88,107,88,107,88,107,88,107,88,107,88,75,72,75,72,75,72,75,72,75,72,75,72,75,72,75,72,43,72,43,72,43,72,43,72,43,72,43,72,43,72,43,72,11,64,11,64,11,64,11,64,11,64,11,64,11,64,11,64,107,80,107,80,107,80,107,80,107,80,107,80,107,80,107,80,75,64,75,64,75,64,75,64,75,64,75,64,75,64,75,64,43,64,43,64,43,64,43,64,43,64,43,64,43,64,43,64,11,56,11,56,11,56,11,56,11,56,11,56,11,56,11,56,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,24,70,56,38,56,6,16,102,72,70,48,38,48,6,8,37,40,37,40,69,40,69,40,37,32,37,32,69,32,69,32,37,24,37,24,101,64,101,64,69,24,69,24,37,16,37,16,100,56,100,56,100,56,100,56,100,48,100,48,100,48,100,48,100,40,100,40,100,40,100,40,100,32,100,32,100,32,100,32,100,24,100,24,100,24,100,24,68,16,68,16,68,16,68,16,36,8,36,8,36,8,36,8,4,0,4,0,4,0,4,0,0,0,10,128,106,128,74,128,42,128,10,120,106,120,74,120,42,120,10,112,106,112,74,112,42,112,10,104,41,104,41,104,9,96,9,96,73,104,73,104,41,96,41,96,9,88,9,88,105,104,105,104,73,96,73,96,41,88,41,88,9,80,9,80,104,96,104,96,104,96,104,96,72,88,72,88,72,88,72,88,40,80,40,80,40,80,40,80,8,72,8,72,8,72,8,72,104,88,104,88,104,88,104,88,72,80,72,80,72,80,72,80,40,72,40,72,40,72,40,72,8,64,8,64,8,64,8,64,7,56,7,56,7,56,7,56,7,56,7,56,7,56,7,56,7,48,7,48,7,48,7,48,7,48,7,48,7,48,7,48,71,72,71,72,71,72,71,72,71,72,71,72,71,72,71,72,7,40,7,40,7,40,7,40,7,40,7,40,7,40,7,40,103,80,103,80,103,80,103,80,103,80,103,80,103,80,103,80,71,64,71,64,71,64,71,64,71,64,71,64,71,64,71,64,39,64,39,64,39,64,39,64,39,64,39,64,39,64,39,64,7,32,7,32,7,32,7,32,7,32,7,32,7,32,7,32,6,8,38,8,0,0,6,0,6,16,38,16,70,16,0,0,6,24,38,24,70,24,102,24,6,32,38,32,70,32,102,32,6,40,38,40,70,40,102,40,6,48,38,48,70,48,102,48,6,56,38,56,70,56,102,56,6,64,38,64,70,64,102,64,6,72,38,72,70,72,102,72,6,80,38,80,70,80,102,80,6,88,38,88,70,88,102,88,6,96,38,96,70,96,102,96,6,104,38,104,70,104,102,104,6,112,38,112,70,112,102,112,6,120,38,120,70,120,102,120,6,128,38,128,70,128,102,128,0,0,67,16,2,0,2,0,33,8,33,8,33,8,33,8,103,32,103,32,72,32,40,32,71,24,71,24,39,24,39,24,6,32,6,32,6,32,6,32,6,24,6,24,6,24,6,24,6,16,6,16,6,16,6,16,102,24,102,24,102,24,102,24,38,16,38,16,38,16,38,16,6,8,6,8,6,8,6,8,0,0,0,0,0,0,1,1,1,1,1,1,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,7,7,7,7,7,7,8,8,8,8,0,1,2,3,4,5,0,1,2,3,4,5,0,1,2,3,4,5,0,1,2,3,4,5,0,1,2,3,4,5,0,1,2,3,4,5,0,1,2,3,4,5,0,1,2,3,4,5,0,1,2,3,0,16,1,2,4,8,32,3,5,10,12,15,47,7,11,13,14,6,9,31,35,37,42,44,33,34,36,40,39,43,45,46,17,18,20,24,19,21,26,28,23,27,29,30,22,25,38,41,47,31,15,0,23,27,29,30,7,11,13,14,39,43,45,46,16,3,5,10,12,19,21,26,28,35,37,42,44,1,2,4,8,17,18,20,24,6,9,22,25,32,33,34,36,40,38,41,0,0,101,85,68,68,52,52,35,35,35,35,19,19,19,19,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,249,233,217,200,200,184,184,167,167,167,167,151,151,151,151,134,134,134,134,134,134,134,134,118,118,118,118,118,118,118,118,230,214,198,182,165,165,149,149,132,132,132,132,116,116,116,116,100,100,100,100,84,84,84,84,67,67,67,67,67,67,67,67,51,51,51,51,51,51,51,51,35,35,35,35,35,35,35,35,19,19,19,19,19,19,19,19,3,3,3,3,3,3,3,3,214,182,197,197,165,165,149,149,132,132,132,132,84,84,84,84,68,68,68,68,4,4,4,4,115,115,115,115,115,115,115,115,99,99,99,99,99,99,99,99,51,51,51,51,51,51,51,51,35,35,35,35,35,35,35,35,19,19,19,19,19,19,19,19,197,181,165,5,148,148,116,116,52,52,36,36,131,131,131,131,99,99,99,99,83,83,83,83,67,67,67,67,19,19,19,19,181,149,164,164,132,132,36,36,20,20,4,4,115,115,115,115,99,99,99,99,83,83,83,83,67,67,67,67,51,51,51,51,166,6,21,21,132,132,132,132,147,147,147,147,147,147,147,147,115,115,115,115,115,115,115,115,99,99,99,99,99,99,99,99,83,83,83,83,83,83,83,83,67,67,67,67,67,67,67,67,51,51,51,51,51,51,51,51,35,35,35,35,35,35,35,35,150,6,21,21,116,116,116,116,131,131,131,131,131,131,131,131,99,99,99,99,99,99,99,99,67,67,67,67,67,67,67,67,51,51,51,51,51,51,51,51,35,35,35,35,35,35,35,35,82,82,82,82,82,82,82,82,82,82,82,82,82,82,82,82,134,6,37,37,20,20,20,20,115,115,115,115,115,115,115,115,99,99,99,99,99,99,99,99,51,51,51,51,51,51,51,51,82,82,82,82,82,82,82,82,82,82,82,82,82,82,82,82,66,66,66,66,66,66,66,66,66,66,66,66,66,66,66,66,22,6,117,117,36,36,36,36,83,83,83,83,83,83,83,83,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,98,66,66,66,66,66,66,66,66,66,66,66,66,66,66,66,66,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,50,21,5,100,100,35,35,35,35,82,82,82,82,82,82,82,82,66,66,66,66,66,66,66,66,50,50,50,50,50,50,50,50,4,20,35,35,51,51,83,83,65,65,65,65,65,65,65,65,4,20,67,67,34,34,34,34,49,49,49,49,49,49,49,49,3,19,50,50,33,33,33,33,2,18,33,33,17,1,34,18,1,1,50,34,18,2,67,51,34,34,18,18,2,2,83,67,51,35,18,18,2,2,19,35,67,51,99,83,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,5,6,7,8,9,10,12,13,15,17,20,22,25,28,32,36,40,45,50,56,63,71,80,90,101,113,127,144,162,182,203,226,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,3,3,3,3,4,4,4,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,16,16,17,17,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,2,1,2,3,1,2,3,2,2,3,2,2,4,2,3,4,2,3,4,3,3,5,3,4,6,3,4,6,4,5,7,4,5,8,4,6,9,5,7,10,6,8,11,6,8,13,7,10,14,8,11,16,9,12,18,10,13,20,11,15,23,13,17,25,68,69,67,79,68,69,82,32,73,78,73,84,73,65,76,73,90,65,84,73,79,78,32,70,65,73,76,69,68,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"i8",ALLOC_NONE,Runtime.GLOBAL_BASE);var tempDoublePtr=Runtime.alignMemory(allocate(12,"i8",ALLOC_STATIC),8);assert(tempDoublePtr%8==0);function copyTempFloat(ptr){HEAP8[tempDoublePtr]=HEAP8[ptr];HEAP8[tempDoublePtr+1]=HEAP8[ptr+1];HEAP8[tempDoublePtr+2]=HEAP8[ptr+2];HEAP8[tempDoublePtr+3]=HEAP8[ptr+3]}function copyTempDouble(ptr){HEAP8[tempDoublePtr]=HEAP8[ptr];HEAP8[tempDoublePtr+1]=HEAP8[ptr+1];HEAP8[tempDoublePtr+2]=HEAP8[ptr+2];HEAP8[tempDoublePtr+3]=HEAP8[ptr+3];HEAP8[tempDoublePtr+4]=HEAP8[ptr+4];HEAP8[tempDoublePtr+5]=HEAP8[ptr+5];HEAP8[tempDoublePtr+6]=HEAP8[ptr+6];HEAP8[tempDoublePtr+7]=HEAP8[ptr+7]}function ___setErrNo(value){if(Module["___errno_location"])HEAP32[Module["___errno_location"]()>>2]=value;return value}var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name){switch(name){case 30:return PAGE_SIZE;case 85:return totalMemory/PAGE_SIZE;case 132:case 133:case 12:case 137:case 138:case 15:case 235:case 16:case 17:case 18:case 19:case 20:case 149:case 13:case 10:case 236:case 153:case 9:case 21:case 22:case 159:case 154:case 14:case 77:case 78:case 139:case 80:case 81:case 82:case 68:case 67:case 164:case 11:case 29:case 47:case 48:case 95:case 52:case 51:case 46:return 200809;case 79:return 0;case 27:case 246:case 127:case 128:case 23:case 24:case 160:case 161:case 181:case 182:case 242:case 183:case 184:case 243:case 244:case 245:case 165:case 178:case 179:case 49:case 50:case 168:case 169:case 175:case 170:case 171:case 172:case 97:case 76:case 32:case 173:case 35:return-1;case 176:case 177:case 7:case 155:case 8:case 157:case 125:case 126:case 92:case 93:case 129:case 130:case 131:case 94:case 91:return 1;case 74:case 60:case 69:case 70:case 4:return 1024;case 31:case 42:case 72:return 32;case 87:case 26:case 33:return 2147483647;case 34:case 1:return 47839;case 38:case 36:return 99;case 43:case 37:return 2048;case 0:return 2097152;case 3:return 65536;case 28:return 32768;case 44:return 32767;case 75:return 16384;case 39:return 1e3;case 89:return 700;case 71:return 256;case 40:return 255;case 2:return 100;case 180:return 64;case 25:return 20;case 5:return 16;case 6:return 6;case 73:return 4;case 84:{if(typeof navigator==="object")return navigator["hardwareConcurrency"]||1;return 1}}___setErrNo(ERRNO_CODES.EINVAL);return-1}Module["_memset"]=_memset;function _pthread_cleanup_push(routine,arg){__ATEXIT__.push((function(){Runtime.dynCall("vi",routine,[arg])}));_pthread_cleanup_push.level=__ATEXIT__.length}function _broadwayOnPictureDecoded($buffer,width,height){par_broadwayOnPictureDecoded($buffer,width,height)}Module["_broadwayOnPictureDecoded"]=_broadwayOnPictureDecoded;function _pthread_cleanup_pop(){assert(_pthread_cleanup_push.level==__ATEXIT__.length,"cannot pop if something else added meanwhile!");__ATEXIT__.pop();_pthread_cleanup_push.level=__ATEXIT__.length}function _abort(){Module["abort"]()}function _emscripten_memcpy_big(dest,src,num){HEAPU8.set(HEAPU8.subarray(src,src+num),dest);return dest}Module["_memcpy"]=_memcpy;var SYSCALLS={varargs:0,get:(function(varargs){SYSCALLS.varargs+=4;var ret=HEAP32[SYSCALLS.varargs-4>>2];return ret}),getStr:(function(){var ret=Pointer_stringify(SYSCALLS.get());return ret}),get64:(function(){var low=SYSCALLS.get(),high=SYSCALLS.get();if(low>=0)assert(high===0);else assert(high===-1);return low}),getZero:(function(){assert(SYSCALLS.get()===0)})};function ___syscall6(which,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.getStreamFromFD();FS.close(stream);return 0}catch(e){if(typeof FS==="undefined"||!(e instanceof FS.ErrnoError))abort(e);return-e.errno}}function _sbrk(bytes){var self=_sbrk;if(!self.called){DYNAMICTOP=alignMemoryPage(DYNAMICTOP);self.called=true;assert(Runtime.dynamicAlloc);self.alloc=Runtime.dynamicAlloc;Runtime.dynamicAlloc=(function(){abort("cannot dynamically allocate, sbrk now has control")})}var ret=DYNAMICTOP;if(bytes!=0){var success=self.alloc(bytes);if(!success)return-1>>>0}return ret}function _broadwayOnHeadersDecoded(){par_broadwayOnHeadersDecoded()}Module["_broadwayOnHeadersDecoded"]=_broadwayOnHeadersDecoded;function _time(ptr){var ret=Date.now()/1e3|0;if(ptr){HEAP32[ptr>>2]=ret}return ret}function _pthread_self(){return 0}function ___syscall140(which,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.getStreamFromFD(),offset_high=SYSCALLS.get(),offset_low=SYSCALLS.get(),result=SYSCALLS.get(),whence=SYSCALLS.get();var offset=offset_low;assert(offset_high===0);FS.llseek(stream,offset,whence);HEAP32[result>>2]=stream.position;if(stream.getdents&&offset===0&&whence===0)stream.getdents=null;return 0}catch(e){if(typeof FS==="undefined"||!(e instanceof FS.ErrnoError))abort(e);return-e.errno}}function ___syscall146(which,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.get(),iov=SYSCALLS.get(),iovcnt=SYSCALLS.get();var ret=0;if(!___syscall146.buffer)___syscall146.buffer=[];var buffer=___syscall146.buffer;for(var i=0;i<iovcnt;i++){var ptr=HEAP32[iov+i*8>>2];var len=HEAP32[iov+(i*8+4)>>2];for(var j=0;j<len;j++){var curr=HEAPU8[ptr+j];if(curr===0||curr===10){Module["print"](UTF8ArrayToString(buffer,0));buffer.length=0}else{buffer.push(curr)}}ret+=len}return ret}catch(e){if(typeof FS==="undefined"||!(e instanceof FS.ErrnoError))abort(e);return-e.errno}}function ___syscall54(which,varargs){SYSCALLS.varargs=varargs;try{return 0}catch(e){if(typeof FS==="undefined"||!(e instanceof FS.ErrnoError))abort(e);return-e.errno}}STACK_BASE=STACKTOP=Runtime.alignMemory(STATICTOP);staticSealed=true;STACK_MAX=STACK_BASE+TOTAL_STACK;DYNAMIC_BASE=DYNAMICTOP=Runtime.alignMemory(STACK_MAX);assert(DYNAMIC_BASE<TOTAL_MEMORY,"TOTAL_MEMORY not big enough for stack");function invoke_ii(index,a1){try{return Module["dynCall_ii"](index,a1)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;asm["setThrew"](1,0)}}function invoke_iiii(index,a1,a2,a3){try{return Module["dynCall_iiii"](index,a1,a2,a3)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;asm["setThrew"](1,0)}}function invoke_viiiii(index,a1,a2,a3,a4,a5){try{Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;asm["setThrew"](1,0)}}function invoke_vi(index,a1){try{Module["dynCall_vi"](index,a1)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;asm["setThrew"](1,0)}}Module.asmGlobalArg={"Math":Math,"Int8Array":Int8Array,"Int16Array":Int16Array,"Int32Array":Int32Array,"Uint8Array":Uint8Array,"Uint16Array":Uint16Array,"Uint32Array":Uint32Array,"Float32Array":Float32Array,"Float64Array":Float64Array,"NaN":NaN,"Infinity":Infinity};Module.asmLibraryArg={"abort":abort,"assert":assert,"invoke_ii":invoke_ii,"invoke_iiii":invoke_iiii,"invoke_viiiii":invoke_viiiii,"invoke_vi":invoke_vi,"_broadwayOnPictureDecoded":_broadwayOnPictureDecoded,"_pthread_cleanup_pop":_pthread_cleanup_pop,"_pthread_self":_pthread_self,"___syscall6":___syscall6,"___setErrNo":___setErrNo,"_abort":_abort,"_sbrk":_sbrk,"_time":_time,"_pthread_cleanup_push":_pthread_cleanup_push,"_emscripten_memcpy_big":_emscripten_memcpy_big,"___syscall54":___syscall54,"_broadwayOnHeadersDecoded":_broadwayOnHeadersDecoded,"___syscall140":___syscall140,"_sysconf":_sysconf,"___syscall146":___syscall146,"STACKTOP":STACKTOP,"STACK_MAX":STACK_MAX,"tempDoublePtr":tempDoublePtr,"ABORT":ABORT};// EMSCRIPTEN_START_ASM
var asm=(function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer);var b=new global.Int16Array(buffer);var c=new global.Int32Array(buffer);var d=new global.Uint8Array(buffer);var e=new global.Uint16Array(buffer);var f=new global.Uint32Array(buffer);var g=new global.Float32Array(buffer);var h=new global.Float64Array(buffer);var i=env.STACKTOP|0;var j=env.STACK_MAX|0;var k=env.tempDoublePtr|0;var l=env.ABORT|0;var m=0;var n=0;var o=0;var p=0;var q=global.NaN,r=global.Infinity;var s=0,t=0,u=0,v=0,w=0.0,x=0,y=0,z=0,A=0.0;var B=0;var C=0;var D=0;var E=0;var F=0;var G=0;var H=0;var I=0;var J=0;var K=0;var L=global.Math.floor;var M=global.Math.abs;var N=global.Math.sqrt;var O=global.Math.pow;var P=global.Math.cos;var Q=global.Math.sin;var R=global.Math.tan;var S=global.Math.acos;var T=global.Math.asin;var U=global.Math.atan;var V=global.Math.atan2;var W=global.Math.exp;var X=global.Math.log;var Y=global.Math.ceil;var Z=global.Math.imul;var _=global.Math.min;var $=global.Math.clz32;var aa=env.abort;var ba=env.assert;var ca=env.invoke_ii;var da=env.invoke_iiii;var ea=env.invoke_viiiii;var fa=env.invoke_vi;var ga=env._broadwayOnPictureDecoded;var ha=env._pthread_cleanup_pop;var ia=env._pthread_self;var ja=env.___syscall6;var ka=env.___setErrNo;var la=env._abort;var ma=env._sbrk;var na=env._time;var oa=env._pthread_cleanup_push;var pa=env._emscripten_memcpy_big;var qa=env.___syscall54;var ra=env._broadwayOnHeadersDecoded;var sa=env.___syscall140;var ta=env._sysconf;var ua=env.___syscall146;var va=0.0;
// EMSCRIPTEN_START_FUNCS
function Aa(a){a=a|0;var b=0;b=i;i=i+a|0;i=i+15&-16;return b|0}function Ba(){return i|0}function Ca(a){a=a|0;i=a}function Da(a,b){a=a|0;b=b|0;i=a;j=b}function Ea(a,b){a=a|0;b=b|0;if(!m){m=a;n=b}}function Fa(b){b=b|0;a[k>>0]=a[b>>0];a[k+1>>0]=a[b+1>>0];a[k+2>>0]=a[b+2>>0];a[k+3>>0]=a[b+3>>0]}function Ga(b){b=b|0;a[k>>0]=a[b>>0];a[k+1>>0]=a[b+1>>0];a[k+2>>0]=a[b+2>>0];a[k+3>>0]=a[b+3>>0];a[k+4>>0]=a[b+4>>0];a[k+5>>0]=a[b+5>>0];a[k+6>>0]=a[b+6>>0];a[k+7>>0]=a[b+7>>0]}function Ha(a){a=a|0;B=a}function Ia(){return B|0}function Ja(a,b,e,f){a=a|0;b=b|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;g=d[5472+b>>0]|0;j=d[5524+b>>0]|0;h=c[8+(j*12|0)>>2]<<g;b=c[8+(j*12|0)+4>>2]<<g;g=c[8+(j*12|0)+8>>2]<<g;if(!e)c[a>>2]=Z(c[a>>2]|0,h)|0;a:do if(!(f&65436)){if(f&98){j=Z(c[a+4>>2]|0,b)|0;k=Z(c[a+20>>2]|0,h)|0;h=Z(c[a+24>>2]|0,b)|0;g=c[a>>2]|0;f=k+32+g+((h>>1)+j)>>6;c[a>>2]=f;e=g-k+32+((j>>1)-h)>>6;c[a+4>>2]=e;i=g-k+32-((j>>1)-h)>>6;c[a+8>>2]=i;j=k+32+g-((h>>1)+j)>>6;c[a+12>>2]=j;c[a+48>>2]=f;c[a+32>>2]=f;c[a+16>>2]=f;c[a+52>>2]=e;c[a+36>>2]=e;c[a+20>>2]=e;c[a+56>>2]=i;c[a+40>>2]=i;c[a+24>>2]=i;c[a+60>>2]=j;c[a+44>>2]=j;c[a+28>>2]=j;if((f+512|e+512|i+512|j+512)>>>0>1023)b=1;else break;return b|0}b=(c[a>>2]|0)+32>>6;if((b+512|0)>>>0>1023){k=1;return k|0}else{c[a+60>>2]=b;c[a+56>>2]=b;c[a+52>>2]=b;c[a+48>>2]=b;c[a+44>>2]=b;c[a+40>>2]=b;c[a+36>>2]=b;c[a+32>>2]=b;c[a+28>>2]=b;c[a+24>>2]=b;c[a+20>>2]=b;c[a+16>>2]=b;c[a+12>>2]=b;c[a+8>>2]=b;c[a+4>>2]=b;c[a>>2]=b;break}}else{f=Z(c[a+4>>2]|0,b)|0;i=Z(c[a+56>>2]|0,b)|0;l=Z(c[a+60>>2]|0,g)|0;m=Z(c[a+8>>2]|0,b)|0;r=Z(c[a+20>>2]|0,h)|0;o=Z(c[a+16>>2]|0,g)|0;s=Z(c[a+32>>2]|0,b)|0;e=Z(c[a+12>>2]|0,h)|0;q=Z(c[a+24>>2]|0,b)|0;n=Z(c[a+28>>2]|0,b)|0;p=Z(c[a+48>>2]|0,g)|0;k=Z(c[a+36>>2]|0,b)|0;g=Z(c[a+40>>2]|0,g)|0;h=Z(c[a+44>>2]|0,h)|0;t=Z(c[a+52>>2]|0,b)|0;b=c[a>>2]|0;c[a>>2]=b+r+((q>>1)+f);c[a+4>>2]=b-r+((f>>1)-q);c[a+8>>2]=b-r-((f>>1)-q);c[a+12>>2]=b+r-((q>>1)+f);c[a+16>>2]=(p>>1)+o+(n+m);c[a+20>>2]=(o>>1)-p+(m-n);c[a+24>>2]=m-n-((o>>1)-p);c[a+28>>2]=n+m-((p>>1)+o);c[a+32>>2]=(t>>1)+s+(h+e);c[a+36>>2]=(s>>1)-t+(e-h);c[a+40>>2]=e-h-((s>>1)-t);c[a+44>>2]=h+e-((t>>1)+s);c[a+48>>2]=(l>>1)+g+(i+k);c[a+52>>2]=(g>>1)-l+(k-i);c[a+56>>2]=k-i-((g>>1)-l);c[a+60>>2]=i+k-((l>>1)+g);j=3;e=(t>>1)+s+(h+e)|0;f=b+r+((q>>1)+f)|0;b=(p>>1)+o+(n+m)|0;g=(l>>1)+g+(i+k)|0;while(1){i=(b>>1)-g|0;g=(g>>1)+b|0;h=e+32+f|0;c[a>>2]=h+g>>6;b=f-e+32|0;c[a+16>>2]=b+i>>6;c[a+32>>2]=b-i>>6;c[a+48>>2]=h-g>>6;if(((h+g>>6)+512|(b+i>>6)+512)>>>0>1023){b=1;g=14;break}if(((b-i>>6)+512|(h-g>>6)+512)>>>0>1023){b=1;g=14;break}b=a+4|0;if(!j)break a;e=c[a+36>>2]|0;t=c[a+20>>2]|0;g=c[a+52>>2]|0;a=b;j=j+-1|0;f=c[b>>2]|0;b=t}if((g|0)==14)return b|0}while(0);t=0;return t|0}function Ka(f,g,h,j,k,l,m,n){f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;l=l|0;m=m|0;n=n|0;var o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,_=0,$=0,aa=0;$=i;i=i+80|0;G=c[g>>2]|0;c[f>>2]=G;o=(c[f+196>>2]|0)+1|0;c[f+196>>2]=o;X=c[h+4>>2]|0;Y=Z(c[h+8>>2]|0,X)|0;W=c[h>>2]|0;c[h+12>>2]=W+((l-((l>>>0)%(X>>>0)|0)<<8)+(((l>>>0)%(X>>>0)|0)<<4));X=(((l>>>0)%(X>>>0)|0)<<3)+(Y<<8)+(l-((l>>>0)%(X>>>0)|0)<<6)|0;c[h+16>>2]=W+X;c[h+20>>2]=W+(X+(Y<<6));if((G|0)==31){c[f+20>>2]=0;if(o>>>0>1){b[f+28>>1]=16;b[f+30>>1]=16;b[f+32>>1]=16;b[f+34>>1]=16;b[f+36>>1]=16;b[f+38>>1]=16;b[f+40>>1]=16;b[f+42>>1]=16;b[f+44>>1]=16;b[f+46>>1]=16;b[f+48>>1]=16;b[f+50>>1]=16;b[f+52>>1]=16;b[f+54>>1]=16;b[f+56>>1]=16;b[f+58>>1]=16;b[f+60>>1]=16;b[f+62>>1]=16;b[f+64>>1]=16;b[f+66>>1]=16;b[f+68>>1]=16;b[f+70>>1]=16;b[f+72>>1]=16;b[f+74>>1]=16;n=0;i=$;return n|0}k=23;p=g+328|0;q=n;o=f+28|0;while(1){b[o>>1]=16;a[q>>0]=c[p>>2];a[q+1>>0]=c[p+4>>2];a[q+2>>0]=c[p+8>>2];a[q+3>>0]=c[p+12>>2];a[q+4>>0]=c[p+16>>2];a[q+5>>0]=c[p+20>>2];a[q+6>>0]=c[p+24>>2];a[q+7>>0]=c[p+28>>2];a[q+8>>0]=c[p+32>>2];a[q+9>>0]=c[p+36>>2];a[q+10>>0]=c[p+40>>2];a[q+11>>0]=c[p+44>>2];a[q+12>>0]=c[p+48>>2];a[q+13>>0]=c[p+52>>2];a[q+14>>0]=c[p+56>>2];a[q+15>>0]=c[p+60>>2];if(!k)break;else{k=k+-1|0;p=p+64|0;q=q+16|0;o=o+2|0}}$a(h,n);n=0;i=$;return n|0}do if(!G){o=f+28|0;q=o+54|0;do{a[o>>0]=0;o=o+1|0}while((o|0)<(q|0));c[f+20>>2]=c[k>>2];r=0}else{o=f+28|0;p=g+272|0;q=o+54|0;do{a[o>>0]=a[p>>0]|0;o=o+1|0;p=p+1|0}while((o|0)<(q|0));p=c[g+8>>2]|0;o=c[k>>2]|0;do if(p){c[k>>2]=o+p;if((o+p|0)<0){c[k>>2]=o+p+52;o=o+p+52|0;break}if((o+p|0)>51){c[k>>2]=o+p+-52;o=o+p+-52|0}else o=o+p|0}while(0);c[f+20>>2]=o;a:do if(G>>>0>6){if(!(b[f+76>>1]|0)){r=g+1992|0;p=15;q=g+328|0;k=320;s=f+28|0}else{F=a[5524+o>>0]|0;p=a[5472+o>>0]|0;y=c[g+1872>>2]|0;u=c[g+1884>>2]|0;w=c[g+1880>>2]|0;A=c[g+1896>>2]|0;Y=c[g+1876>>2]|0;s=c[g+1888>>2]|0;z=c[g+1892>>2]|0;x=c[g+1912>>2]|0;X=c[g+1900>>2]|0;E=c[g+1904>>2]|0;B=c[g+1908>>2]|0;W=c[g+1916>>2]|0;v=c[g+1864>>2]|0;t=c[g+1868>>2]|0;q=t+s+(v+u)|0;c[g+1864>>2]=q;k=t-s+(v-u)|0;c[g+1868>>2]=k;r=v-u-(t-s)|0;c[g+1872>>2]=r;s=v+u-(t+s)|0;c[g+1876>>2]=s;t=x+w+(z+y)|0;c[g+1880>>2]=t;u=w-x+(y-z)|0;c[g+1884>>2]=u;v=y-z-(w-x)|0;c[g+1888>>2]=v;w=z+y-(x+w)|0;c[g+1892>>2]=w;x=W+A+(B+Y)|0;c[g+1896>>2]=x;y=A-W+(Y-B)|0;c[g+1900>>2]=y;z=Y-B-(A-W)|0;c[g+1904>>2]=z;A=B+Y-(W+A)|0;c[g+1908>>2]=A;W=c[g+1920>>2]|0;Y=c[g+1924>>2]|0;B=Y+E+(W+X)|0;c[g+1912>>2]=B;C=E-Y+(X-W)|0;c[g+1916>>2]=C;D=X-W-(E-Y)|0;c[g+1920>>2]=D;E=W+X-(Y+E)|0;c[g+1924>>2]=E;F=c[8+((F&255)*12|0)>>2]|0;if(o>>>0>11){o=F<<(p&255)+-2;c[g+1864>>2]=Z(B+t+(q+x)|0,o)|0;c[g+1880>>2]=Z(t-B+(q-x)|0,o)|0;c[g+1896>>2]=Z(q-x-(t-B)|0,o)|0;c[g+1912>>2]=Z(q+x-(B+t)|0,o)|0;c[g+1868>>2]=Z(C+u+(k+y)|0,o)|0;c[g+1884>>2]=Z(u-C+(k-y)|0,o)|0;c[g+1900>>2]=Z(k-y-(u-C)|0,o)|0;c[g+1916>>2]=Z(k+y-(C+u)|0,o)|0;c[g+1872>>2]=Z(D+v+(r+z)|0,o)|0;c[g+1888>>2]=Z(v-D+(r-z)|0,o)|0;c[g+1904>>2]=Z(r-z-(v-D)|0,o)|0;c[g+1920>>2]=Z(r+z-(D+v)|0,o)|0;c[g+1876>>2]=Z(E+w+(s+A)|0,o)|0;c[g+1892>>2]=Z(w-E+(s-A)|0,o)|0;c[g+1908>>2]=Z(s-A-(w-E)|0,o)|0;o=Z(s+A-(E+w)|0,o)|0}else{Y=(o+-6|0)>>>0<6?1:2;o=2-(p&255)|0;c[g+1864>>2]=(Z(B+t+(q+x)|0,F)|0)+Y>>o;c[g+1880>>2]=(Z(t-B+(q-x)|0,F)|0)+Y>>o;c[g+1896>>2]=(Z(q-x-(t-B)|0,F)|0)+Y>>o;c[g+1912>>2]=(Z(q+x-(B+t)|0,F)|0)+Y>>o;c[g+1868>>2]=(Z(C+u+(k+y)|0,F)|0)+Y>>o;c[g+1884>>2]=(Z(u-C+(k-y)|0,F)|0)+Y>>o;c[g+1900>>2]=(Z(k-y-(u-C)|0,F)|0)+Y>>o;c[g+1916>>2]=(Z(k+y-(C+u)|0,F)|0)+Y>>o;c[g+1872>>2]=(Z(D+v+(r+z)|0,F)|0)+Y>>o;c[g+1888>>2]=(Z(v-D+(r-z)|0,F)|0)+Y>>o;c[g+1904>>2]=(Z(r-z-(v-D)|0,F)|0)+Y>>o;c[g+1920>>2]=(Z(r+z-(D+v)|0,F)|0)+Y>>o;c[g+1876>>2]=(Z(E+w+(s+A)|0,F)|0)+Y>>o;c[g+1892>>2]=(Z(w-E+(s-A)|0,F)|0)+Y>>o;c[g+1908>>2]=(Z(s-A-(w-E)|0,F)|0)+Y>>o;o=(Z(s+A-(E+w)|0,F)|0)+Y>>o}c[g+1924>>2]=o;r=g+1992|0;p=15;q=g+328|0;k=320;s=f+28|0}while(1){Y=c[g+1864+(c[k>>2]<<2)>>2]|0;k=k+4|0;c[q>>2]=Y;if((Y|0)==0?(b[s>>1]|0)==0:0)c[q>>2]=16777215;else _=21;if((_|0)==21?(_=0,(Ja(q,c[f+20>>2]|0,1,c[r>>2]|0)|0)!=0):0){o=1;break}t=s+2|0;o=r+4|0;if(!p){k=r;v=s;break a}else{r=o;p=p+-1|0;q=q+64|0;s=t}}i=$;return o|0}else{k=g+1992|0;p=15;q=g+328|0;r=f+28|0;while(1){if(b[r>>1]|0){if(Ja(q,c[f+20>>2]|0,0,c[k>>2]|0)|0){o=1;break}}else c[q>>2]=16777215;s=r+2|0;o=k+4|0;if(!p){v=r;t=s;break a}else{k=o;p=p+-1|0;q=q+64|0;r=s}}i=$;return o|0}while(0);p=(c[f+24>>2]|0)+(c[f+20>>2]|0)|0;p=(p|0)<0?0:(p|0)>51?51:p;u=c[80+(p<<2)>>2]|0;if((b[f+78>>1]|0)==0?(b[f+80>>1]|0)==0:0){s=g+1932|0;r=c[g+1928>>2]|0}else{r=c[8+((d[5524+u>>0]|0)*12|0)>>2]|0;if((p+-6|0)>>>0<46){r=r<<(d[5472+u>>0]|0)+-1;p=0}else p=1;s=c[g+1928>>2]|0;X=c[g+1936>>2]|0;W=c[g+1932>>2]|0;V=c[g+1940>>2]|0;Y=(Z(V+W+(X+s)|0,r)|0)>>p;c[g+1928>>2]=Y;c[g+1932>>2]=(Z(X+s-(V+W)|0,r)|0)>>p;c[g+1936>>2]=(Z(W-V+(s-X)|0,r)|0)>>p;c[g+1940>>2]=(Z(s-X-(W-V)|0,r)|0)>>p;V=c[g+1944>>2]|0;W=c[g+1952>>2]|0;X=c[g+1948>>2]|0;s=c[g+1956>>2]|0;c[g+1944>>2]=(Z(s+X+(W+V)|0,r)|0)>>p;c[g+1948>>2]=(Z(W+V-(s+X)|0,r)|0)>>p;c[g+1952>>2]=(Z(X-s+(V-W)|0,r)|0)>>p;c[g+1956>>2]=(Z(V-W-(X-s)|0,r)|0)>>p;s=g+1932|0;r=Y}p=q+64|0;c[p>>2]=r;if((r|0)==0?(b[t>>1]|0)==0:0)c[p>>2]=16777215;else _=36;if((_|0)==36?(Ja(p,u,1,c[o>>2]|0)|0)!=0:0){n=1;i=$;return n|0}p=k+8|0;Y=c[s>>2]|0;o=q+128|0;c[o>>2]=Y;if((Y|0)==0?(b[v+4>>1]|0)==0:0)c[o>>2]=16777215;else _=40;if((_|0)==40?(Ja(o,u,1,c[p>>2]|0)|0)!=0:0){n=1;i=$;return n|0}o=k+12|0;Y=c[g+1936>>2]|0;p=q+192|0;c[p>>2]=Y;if((Y|0)==0?(b[v+6>>1]|0)==0:0)c[p>>2]=16777215;else _=44;if((_|0)==44?(Ja(p,u,1,c[o>>2]|0)|0)!=0:0){n=1;i=$;return n|0}o=k+16|0;Y=c[g+1940>>2]|0;p=q+256|0;c[p>>2]=Y;if((Y|0)==0?(b[v+8>>1]|0)==0:0)c[p>>2]=16777215;else _=48;if((_|0)==48?(Ja(p,u,1,c[o>>2]|0)|0)!=0:0){n=1;i=$;return n|0}o=k+20|0;Y=c[g+1944>>2]|0;p=q+320|0;c[p>>2]=Y;if((Y|0)==0?(b[v+10>>1]|0)==0:0)c[p>>2]=16777215;else _=52;if((_|0)==52?(Ja(p,u,1,c[o>>2]|0)|0)!=0:0){n=1;i=$;return n|0}o=k+24|0;Y=c[g+1948>>2]|0;p=q+384|0;c[p>>2]=Y;if((Y|0)==0?(b[v+12>>1]|0)==0:0)c[p>>2]=16777215;else _=56;if((_|0)==56?(Ja(p,u,1,c[o>>2]|0)|0)!=0:0){n=1;i=$;return n|0}o=k+28|0;Y=c[g+1952>>2]|0;p=q+448|0;c[p>>2]=Y;if((Y|0)==0?(b[v+14>>1]|0)==0:0)c[p>>2]=16777215;else _=60;if((_|0)==60?(Ja(p,u,1,c[o>>2]|0)|0)!=0:0){n=1;i=$;return n|0}p=k+32|0;Y=c[g+1956>>2]|0;o=q+512|0;c[o>>2]=Y;if((Y|0)==0?(b[v+16>>1]|0)==0:0)c[o>>2]=16777215;else _=64;if((_|0)==64?(Ja(o,u,1,c[p>>2]|0)|0)!=0:0){n=1;i=$;return n|0}if(G>>>0<6){r=c[f>>2]|0;break}do if(l){G=c[h+4>>2]|0;H=Z(c[h+8>>2]|0,G)|0;I=Z((l>>>0)/(G>>>0)|0,G)|0;p=c[h>>2]|0;o=(l-I<<4)+(Z(G<<8,(l>>>0)/(G>>>0)|0)|0)|0;if((l>>>0)/(G>>>0)|0){F=o-(G<<4|1)|0;a[$>>0]=a[p+F>>0]|0;a[$+1>>0]=a[p+(F+1)>>0]|0;a[$+2>>0]=a[p+(F+2)>>0]|0;a[$+3>>0]=a[p+(F+3)>>0]|0;a[$+4>>0]=a[p+(F+4)>>0]|0;a[$+5>>0]=a[p+(F+5)>>0]|0;a[$+6>>0]=a[p+(F+6)>>0]|0;a[$+7>>0]=a[p+(F+7)>>0]|0;a[$+8>>0]=a[p+(F+8)>>0]|0;a[$+9>>0]=a[p+(F+9)>>0]|0;a[$+10>>0]=a[p+(F+10)>>0]|0;a[$+11>>0]=a[p+(F+11)>>0]|0;a[$+12>>0]=a[p+(F+12)>>0]|0;a[$+13>>0]=a[p+(F+13)>>0]|0;a[$+14>>0]=a[p+(F+14)>>0]|0;a[$+15>>0]=a[p+(F+15)>>0]|0;a[$+16>>0]=a[p+(F+16)>>0]|0;a[$+17>>0]=a[p+(F+17)>>0]|0;a[$+18>>0]=a[p+(F+18)>>0]|0;a[$+19>>0]=a[p+(F+19)>>0]|0;a[$+20>>0]=a[p+(F+20)>>0]|0;F=$+21|0;J=22;K=23;L=24;M=25;N=26;O=27;P=28;Q=29;R=30;S=31;T=32;U=33;j=34;V=35;W=36;X=37;Y=38}else{F=$;J=1;K=2;L=3;M=4;N=5;O=6;P=7;Q=8;R=9;S=10;T=11;U=12;j=13;V=14;W=15;X=16;Y=17}if((I|0)!=(l|0)){a[$+40>>0]=a[p+(o+-1)>>0]|0;a[$+40+1>>0]=a[p+(o+-1+(G<<4))>>0]|0;o=o+-1+(G<<4)+(G<<4)|0;a[$+40+2>>0]=a[p+o>>0]|0;a[$+40+3>>0]=a[p+(o+(G<<4))>>0]|0;a[$+40+4>>0]=a[p+(o+(G<<4)+(G<<4))>>0]|0;o=o+(G<<4)+(G<<4)+(G<<4)|0;a[$+40+5>>0]=a[p+o>>0]|0;a[$+40+6>>0]=a[p+(o+(G<<4))>>0]|0;a[$+40+7>>0]=a[p+(o+(G<<4)+(G<<4))>>0]|0;o=o+(G<<4)+(G<<4)+(G<<4)|0;a[$+40+8>>0]=a[p+o>>0]|0;a[$+40+9>>0]=a[p+(o+(G<<4))>>0]|0;a[$+40+10>>0]=a[p+(o+(G<<4)+(G<<4))>>0]|0;o=o+(G<<4)+(G<<4)+(G<<4)|0;a[$+40+11>>0]=a[p+o>>0]|0;a[$+40+12>>0]=a[p+(o+(G<<4))>>0]|0;a[$+40+13>>0]=a[p+(o+(G<<4)+(G<<4))>>0]|0;o=o+(G<<4)+(G<<4)+(G<<4)|0;a[$+40+14>>0]=a[p+o>>0]|0;a[$+40+15>>0]=a[p+(o+(G<<4))>>0]|0;o=$+40+16|0;k=17;r=18;s=19;t=20;u=21;v=22;w=23;x=24;y=25;z=26;A=27;B=28;C=29;D=30;E=31}else{o=$+40|0;k=1;r=2;s=3;t=4;u=5;v=6;w=7;x=8;y=9;z=10;A=11;B=12;C=13;D=14;E=15}q=c[h>>2]|0;p=(Z(((l>>>0)/(G>>>0)|0)<<3,G<<3&2147483640)|0)+(H<<8)+(l-I<<3)|0;if((l>>>0)/(G>>>0)|0){aa=p-(G<<3&2147483640|1)|0;a[F>>0]=a[q+aa>>0]|0;a[$+J>>0]=a[q+(aa+1)>>0]|0;a[$+K>>0]=a[q+(aa+2)>>0]|0;a[$+L>>0]=a[q+(aa+3)>>0]|0;a[$+M>>0]=a[q+(aa+4)>>0]|0;a[$+N>>0]=a[q+(aa+5)>>0]|0;a[$+O>>0]=a[q+(aa+6)>>0]|0;a[$+P>>0]=a[q+(aa+7)>>0]|0;a[$+Q>>0]=a[q+(aa+8)>>0]|0;a[$+R>>0]=a[q+(aa+(H<<6))>>0]|0;a[$+S>>0]=a[q+(aa+(H<<6)+1)>>0]|0;a[$+T>>0]=a[q+(aa+(H<<6)+2)>>0]|0;a[$+U>>0]=a[q+(aa+(H<<6)+3)>>0]|0;a[$+j>>0]=a[q+(aa+(H<<6)+4)>>0]|0;a[$+V>>0]=a[q+(aa+(H<<6)+5)>>0]|0;a[$+W>>0]=a[q+(aa+(H<<6)+6)>>0]|0;a[$+X>>0]=a[q+(aa+(H<<6)+7)>>0]|0;a[$+Y>>0]=a[q+(aa+(H<<6)+8)>>0]|0}if((I|0)==(l|0))break;a[o>>0]=a[q+(p+-1)>>0]|0;a[$+40+k>>0]=a[q+(p+-1+(G<<3&2147483640))>>0]|0;aa=p+-1+(G<<3&2147483640)+(G<<3&2147483640)|0;a[$+40+r>>0]=a[q+aa>>0]|0;a[$+40+s>>0]=a[q+(aa+(G<<3&2147483640))>>0]|0;a[$+40+t>>0]=a[q+(aa+(G<<3&2147483640)+(G<<3&2147483640))>>0]|0;aa=aa+(G<<3&2147483640)+(G<<3&2147483640)+(G<<3&2147483640)|0;a[$+40+u>>0]=a[q+aa>>0]|0;a[$+40+v>>0]=a[q+(aa+(G<<3&2147483640))>>0]|0;a[$+40+w>>0]=a[q+(aa+(G<<3&2147483640)+(G<<3&2147483640))>>0]|0;aa=(H-G<<6)+(G<<3&2147483640)+(aa+(G<<3&2147483640)+(G<<3&2147483640))|0;a[$+40+x>>0]=a[q+aa>>0]|0;a[$+40+y>>0]=a[q+(aa+(G<<3&2147483640))>>0]|0;a[$+40+z>>0]=a[q+(aa+(G<<3&2147483640)+(G<<3&2147483640))>>0]|0;aa=aa+(G<<3&2147483640)+(G<<3&2147483640)+(G<<3&2147483640)|0;a[$+40+A>>0]=a[q+aa>>0]|0;a[$+40+B>>0]=a[q+(aa+(G<<3&2147483640))>>0]|0;a[$+40+C>>0]=a[q+(aa+(G<<3&2147483640)+(G<<3&2147483640))>>0]|0;aa=aa+(G<<3&2147483640)+(G<<3&2147483640)+(G<<3&2147483640)|0;a[$+40+D>>0]=a[q+aa>>0]|0;a[$+40+E>>0]=a[q+(aa+(G<<3&2147483640))>>0]|0}while(0);s=c[f>>2]|0;b:do if(s>>>0>6){o=c[f+200>>2]|0;do if(!o){r=(m|0)!=0;k=0}else{p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if(!((m|0)!=0&p)){r=(m|0)!=0;k=p&1;break}r=1;k=(c[o>>2]|0)>>>0<6?0:p&1}while(0);o=c[f+204>>2]|0;do if(!o)q=0;else{p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if(!(r&p)){q=p&1;break}q=(c[o>>2]|0)>>>0<6?0:p&1}while(0);o=c[f+212>>2]|0;do if(!o)o=0;else{p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if(!(r&p)){o=p&1;break}o=(c[o>>2]|0)>>>0<6?0:p&1}while(0);switch(s+1&3|0){case 0:{if(!q)break b;o=n;p=0;while(1){a[o>>0]=a[$+1>>0]|0;a[o+1>>0]=a[$+2>>0]|0;a[o+2>>0]=a[$+3>>0]|0;a[o+3>>0]=a[$+4>>0]|0;a[o+4>>0]=a[$+5>>0]|0;a[o+5>>0]=a[$+6>>0]|0;a[o+6>>0]=a[$+7>>0]|0;a[o+7>>0]=a[$+8>>0]|0;a[o+8>>0]=a[$+9>>0]|0;a[o+9>>0]=a[$+10>>0]|0;a[o+10>>0]=a[$+11>>0]|0;a[o+11>>0]=a[$+12>>0]|0;a[o+12>>0]=a[$+13>>0]|0;a[o+13>>0]=a[$+14>>0]|0;a[o+14>>0]=a[$+15>>0]|0;a[o+15>>0]=a[$+16>>0]|0;p=p+1|0;if((p|0)==16)break;else o=o+16|0}break}case 1:{if(!k)break b;else{o=n;p=0}while(1){aa=$+40+p|0;a[o>>0]=a[aa>>0]|0;a[o+1>>0]=a[aa>>0]|0;a[o+2>>0]=a[aa>>0]|0;a[o+3>>0]=a[aa>>0]|0;a[o+4>>0]=a[aa>>0]|0;a[o+5>>0]=a[aa>>0]|0;a[o+6>>0]=a[aa>>0]|0;a[o+7>>0]=a[aa>>0]|0;a[o+8>>0]=a[aa>>0]|0;a[o+9>>0]=a[aa>>0]|0;a[o+10>>0]=a[aa>>0]|0;a[o+11>>0]=a[aa>>0]|0;a[o+12>>0]=a[aa>>0]|0;a[o+13>>0]=a[aa>>0]|0;a[o+14>>0]=a[aa>>0]|0;a[o+15>>0]=a[aa>>0]|0;p=p+1|0;if((p|0)==16)break;else o=o+16|0}break}case 2:{p=(k|0)!=0;o=(q|0)!=0;do if(p&o)o=((d[$+1>>0]|0)+16+(d[$+40>>0]|0)+(d[$+2>>0]|0)+(d[$+40+1>>0]|0)+(d[$+3>>0]|0)+(d[$+40+2>>0]|0)+(d[$+4>>0]|0)+(d[$+40+3>>0]|0)+(d[$+5>>0]|0)+(d[$+40+4>>0]|0)+(d[$+6>>0]|0)+(d[$+40+5>>0]|0)+(d[$+7>>0]|0)+(d[$+40+6>>0]|0)+(d[$+8>>0]|0)+(d[$+40+7>>0]|0)+(d[$+9>>0]|0)+(d[$+40+8>>0]|0)+(d[$+10>>0]|0)+(d[$+40+9>>0]|0)+(d[$+11>>0]|0)+(d[$+40+10>>0]|0)+(d[$+12>>0]|0)+(d[$+40+11>>0]|0)+(d[$+13>>0]|0)+(d[$+40+12>>0]|0)+(d[$+14>>0]|0)+(d[$+40+13>>0]|0)+(d[$+15>>0]|0)+(d[$+40+14>>0]|0)+(d[$+16>>0]|0)+(d[$+40+15>>0]|0)|0)>>>5;else{if(p){o=((d[$+40>>0]|0)+8+(d[$+40+1>>0]|0)+(d[$+40+2>>0]|0)+(d[$+40+3>>0]|0)+(d[$+40+4>>0]|0)+(d[$+40+5>>0]|0)+(d[$+40+6>>0]|0)+(d[$+40+7>>0]|0)+(d[$+40+8>>0]|0)+(d[$+40+9>>0]|0)+(d[$+40+10>>0]|0)+(d[$+40+11>>0]|0)+(d[$+40+12>>0]|0)+(d[$+40+13>>0]|0)+(d[$+40+14>>0]|0)+(d[$+40+15>>0]|0)|0)>>>4;break}if(!o){o=128;break}o=((d[$+1>>0]|0)+8+(d[$+2>>0]|0)+(d[$+3>>0]|0)+(d[$+4>>0]|0)+(d[$+5>>0]|0)+(d[$+6>>0]|0)+(d[$+7>>0]|0)+(d[$+8>>0]|0)+(d[$+9>>0]|0)+(d[$+10>>0]|0)+(d[$+11>>0]|0)+(d[$+12>>0]|0)+(d[$+13>>0]|0)+(d[$+14>>0]|0)+(d[$+15>>0]|0)+(d[$+16>>0]|0)|0)>>>4}while(0);xb(n|0,o&255|0,256)|0;break}default:{if(!((k|0)!=0&(q|0)!=0&(o|0)!=0))break b;o=d[$+16>>0]|0;p=d[$+40+15>>0]|0;k=d[$>>0]|0;q=(((d[$+9>>0]|0)-(d[$+7>>0]|0)+((d[$+10>>0]|0)-(d[$+6>>0]|0)<<1)+(((d[$+11>>0]|0)-(d[$+5>>0]|0)|0)*3|0)+((d[$+12>>0]|0)-(d[$+4>>0]|0)<<2)+(((d[$+13>>0]|0)-(d[$+3>>0]|0)|0)*5|0)+(((d[$+14>>0]|0)-(d[$+2>>0]|0)|0)*6|0)+(((d[$+15>>0]|0)-(d[$+1>>0]|0)|0)*7|0)+(o-k<<3)|0)*5|0)+32>>6;k=(((d[$+40+8>>0]|0)-(d[$+40+6>>0]|0)+(p-k<<3)+((d[$+40+9>>0]|0)-(d[$+40+5>>0]|0)<<1)+(((d[$+40+10>>0]|0)-(d[$+40+4>>0]|0)|0)*3|0)+((d[$+40+11>>0]|0)-(d[$+40+3>>0]|0)<<2)+(((d[$+40+12>>0]|0)-(d[$+40+2>>0]|0)|0)*5|0)+(((d[$+40+13>>0]|0)-(d[$+40+1>>0]|0)|0)*6|0)+(((d[$+40+14>>0]|0)-(d[$+40>>0]|0)|0)*7|0)|0)*5|0)+32>>6;t=0;do{r=(p+o<<4)+16+(Z(t+-7|0,k)|0)|0;s=t<<4;u=0;do{aa=r+(Z(u+-7|0,q)|0)>>5;a[n+(u+s)>>0]=(aa|0)<0?0:(aa|0)>255?-1:aa&255;u=u+1|0}while((u|0)!=16);t=t+1|0}while((t|0)!=16)}}Pa(n,g+328|0,0);Pa(n,g+392|0,1);Pa(n,g+456|0,2);Pa(n,g+520|0,3);Pa(n,g+584|0,4);Pa(n,g+648|0,5);Pa(n,g+712|0,6);Pa(n,g+776|0,7);Pa(n,g+840|0,8);Pa(n,g+904|0,9);Pa(n,g+968|0,10);Pa(n,g+1032|0,11);Pa(n,g+1096|0,12);Pa(n,g+1160|0,13);Pa(n,g+1224|0,14);Pa(n,g+1288|0,15);o=f+200|0;_=179}else{M=0;while(1){aa=384+(M<<3)|0;s=c[aa+4>>2]|0;switch(c[aa>>2]|0){case 0:{o=f+200|0;_=113;break}case 1:{o=f+204|0;_=113;break}case 2:{o=f+208|0;_=113;break}case 3:{o=f+212|0;_=113;break}case 4:{o=f;_=114;break}default:{r=0;q=0}}if((_|0)==113){_=0;o=c[o>>2]|0;if(!o){r=0;q=0}else _=114}do if((_|0)==114){p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if(!((m|0)!=0&p)){r=o;q=p&1;break}r=o;q=(c[o>>2]|0)>>>0<6?0:p&1}while(0);aa=576+(M<<3)|0;k=c[aa+4>>2]|0;switch(c[aa>>2]|0){case 0:{o=f+200|0;_=120;break}case 1:{o=f+204|0;_=120;break}case 2:{o=f+208|0;_=120;break}case 3:{o=f+212|0;_=120;break}case 4:{o=f;_=122;break}default:_=121}if((_|0)==120){o=c[o>>2]|0;if(!o)_=121;else _=122}do if((_|0)==121){_=0;C=0;B=0;A=(q|0)!=0;o=2}else if((_|0)==122){_=0;p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if((m|0)!=0&p)p=(c[o>>2]|0)>>>0<6?0:p&1;else p=p&1;q=(q|0)!=0;p=(p|0)!=0;if(!(q&p)){C=0;B=p;A=q;o=2;break}if((c[r>>2]|0)==6)p=d[(s&255)+(r+82)>>0]|0;else p=2;if((c[o>>2]|0)==6)o=d[(k&255)+(o+82)>>0]|0;else o=2;C=1;B=1;A=1;o=p>>>0<o>>>0?p:o}while(0);if(!(c[g+12+(M<<2)>>2]|0)){aa=c[g+76+(M<<2)>>2]|0;o=(aa>>>0>=o>>>0&1)+aa|0}a[f+82+M>>0]=o;switch(c[768+(M<<3)>>2]|0){case 0:{p=f+200|0;_=136;break}case 1:{p=f+204|0;_=136;break}case 2:{p=f+208|0;_=136;break}case 3:{p=f+212|0;_=136;break}case 4:{p=f;_=137;break}default:z=0}if((_|0)==136){_=0;p=c[p>>2]|0;if(!p)z=0;else _=137}do if((_|0)==137){_=0;q=(c[f+4>>2]|0)==(c[p+4>>2]|0);if(!((m|0)!=0&q)){z=q&1;break}z=(c[p>>2]|0)>>>0<6?0:q&1}while(0);switch(c[960+(M<<3)>>2]|0){case 0:{p=f+200|0;_=143;break}case 1:{p=f+204|0;_=143;break}case 2:{p=f+208|0;_=143;break}case 3:{p=f+212|0;_=143;break}case 4:{p=f;_=144;break}default:y=0}if((_|0)==143){_=0;p=c[p>>2]|0;if(!p)y=0;else _=144}do if((_|0)==144){_=0;q=(c[f+4>>2]|0)==(c[p+4>>2]|0);if(!((m|0)!=0&q)){y=q&1;break}y=(c[p>>2]|0)>>>0<6?0:q&1}while(0);K=c[1152+(M<<2)>>2]|0;L=c[1216+(M<<2)>>2]|0;u=(1285>>>M&1|0)!=0;if(u){q=$+40+(L+1)|0;p=$+40+L|0;k=$+40+(L+3)|0;r=$+40+(L+2)|0}else{q=n+((L<<4)+K+15)|0;p=n+((L<<4)+K+-1)|0;k=n+((L<<4)+K+47)|0;r=n+((L<<4)+K+31)|0}J=a[p>>0]|0;I=a[q>>0]|0;H=a[k>>0]|0;G=a[r>>0]|0;do if(!(51>>>M&1)){p=(L+-1<<4)+K|0;q=a[n+p>>0]|0;r=a[n+(p+1)>>0]|0;s=a[n+(p+2)>>0]|0;v=a[n+(p+3)>>0]|0;x=a[n+(p+4)>>0]|0;k=a[n+(p+5)>>0]|0;w=a[n+(p+6)>>0]|0;t=a[n+(p+7)>>0]|0;if(u){u=$+40+(L+-1)|0;F=v;E=w;p=x;break}else{u=n+(p+-1)|0;F=v;E=w;p=x;break}}else{u=$+K|0;q=a[$+(K+1)>>0]|0;r=a[$+(K+2)>>0]|0;s=a[$+(K+3)>>0]|0;F=a[$+(K+4)>>0]|0;t=a[$+(K+8)>>0]|0;E=a[$+(K+7)>>0]|0;k=a[$+(K+6)>>0]|0;p=a[$+(K+5)>>0]|0}while(0);D=a[u>>0]|0;switch(o|0){case 0:{if(!B)break b;p=F;k=s;t=r;u=q;v=F;w=s;x=r;y=q;z=F;A=s;B=r;C=q;o=(s&255)<<16|(F&255)<<24|(r&255)<<8|q&255;break}case 1:{if(!A)break b;u=Z(J&255,16843009)|0;y=Z(I&255,16843009)|0;C=Z(G&255,16843009)|0;p=u>>>24&255;k=u>>>16&255;t=u>>>8&255;u=u&255;v=y>>>24&255;w=y>>>16&255;x=y>>>8&255;y=y&255;z=C>>>24&255;A=C>>>16&255;B=C>>>8&255;C=C&255;o=Z(H&255,16843009)|0;break}case 2:{do if(C)o=((J&255)+4+(I&255)+(H&255)+(G&255)+(F&255)+(s&255)+(r&255)+(q&255)|0)>>>3;else{if(A){o=((J&255)+2+(I&255)+(H&255)+(G&255)|0)>>>2;break}if(!B){o=128;break}o=((F&255)+2+(s&255)+(r&255)+(q&255)|0)>>>2}while(0);o=Z(o&255,16843009)|0;p=o>>>24&255;k=o>>>16&255;t=o>>>8&255;u=o&255;v=o>>>24&255;w=o>>>16&255;x=o>>>8&255;y=o&255;z=o>>>24&255;A=o>>>16&255;B=o>>>8&255;C=o&255;break}case 3:{if(!B)break b;aa=(z|0)==0;y=r&255;C=s&255;X=F&255;Y=(aa?F:p)&255;l=(aa?F:k)&255;B=(X+2+l+(Y<<1)|0)>>>2&255;o=(aa?F:E)&255;A=(Y+2+o+(l<<1)|0)>>>2&255;aa=(aa?F:t)&255;p=B;k=(Y+(X<<1)+(C+2)|0)>>>2&255;t=(y+(X+2)+(C<<1)|0)>>>2&255;u=((q&255)+(C+2)+(y<<1)|0)>>>2&255;v=A;w=B;x=(Y+(X<<1)+(C+2)|0)>>>2&255;y=(y+(X+2)+(C<<1)|0)>>>2&255;z=(l+2+aa+(o<<1)|0)>>>2&255;C=(Y+(X<<1)+(C+2)|0)>>>2&255;o=(X+2+l+(Y<<1)|0)>>>2&255|(o+2+(aa*3|0)|0)>>>2<<24|(Y+2+o+(l<<1)|0)>>>2<<8&65280|(l+2+aa+(o<<1)|0)>>>2<<16&16711680;break}case 4:{if(!(C&(y|0)!=0))break b;o=q&255;A=(o+2+(J&255)+((D&255)<<1)|0)>>>2&255;z=r&255;v=s&255;B=((I&255)+((J&255)<<1)+((D&255)+2)|0)>>>2&255;p=((F&255)+2+z+(v<<1)|0)>>>2&255;k=((z<<1)+v+(o+2)|0)>>>2&255;t=((o<<1)+z+((D&255)+2)|0)>>>2&255;u=A;v=((z<<1)+v+(o+2)|0)>>>2&255;w=((o<<1)+z+((D&255)+2)|0)>>>2&255;x=A;y=B;z=((o<<1)+z+((D&255)+2)|0)>>>2&255;C=((J&255)+2+((I&255)<<1)+(G&255)|0)>>>2&255;o=((I&255)+2+(H&255)+((G&255)<<1)|0)>>>2&255|((J&255)+2+((I&255)<<1)+(G&255)|0)>>>2<<8&65280|(o+2+(J&255)+((D&255)<<1)|0)>>>2<<24|((I&255)+((J&255)<<1)+((D&255)+2)|0)>>>2<<16&16711680;break}case 5:{if(!(C&(y|0)!=0))break b;o=q&255;aa=r&255;l=s&255;v=F&255;p=(v+1+l|0)>>>1&255;k=(l+1+aa|0)>>>1&255;t=(aa+1+o|0)>>>1&255;u=(o+1+(D&255)|0)>>>1&255;v=(v+2+aa+(l<<1)|0)>>>2&255;w=((aa<<1)+l+(o+2)|0)>>>2&255;x=(aa+2+(o<<1)+(D&255)|0)>>>2&255;y=(o+2+(J&255)+((D&255)<<1)|0)>>>2&255;z=(l+1+aa|0)>>>1&255;A=(aa+1+o|0)>>>1&255;B=(o+1+(D&255)|0)>>>1&255;C=((I&255)+2+((J&255)<<1)+(D&255)|0)>>>2&255;o=((aa<<1)+l+(o+2)|0)>>>2<<24|((J&255)+2+((I&255)<<1)+(G&255)|0)>>>2&255|(aa+2+(o<<1)+(D&255)|0)>>>2<<16&16711680|(o+2+(J&255)+((D&255)<<1)|0)>>>2<<8&65280;break}case 6:{if(!(C&(y|0)!=0))break b;v=q&255;k=r&255;p=((s&255)+2+(k<<1)+v|0)>>>2&255;k=(k+2+(v<<1)+(D&255)|0)>>>2&255;t=(v+((J&255)+2)+((D&255)<<1)|0)>>>2&255;u=((D&255)+((J&255)+1)|0)>>>1&255;v=(v+((J&255)+2)+((D&255)<<1)|0)>>>2&255;w=((D&255)+((J&255)+1)|0)>>>1&255;x=(((J&255)<<1)+2+(I&255)+(D&255)|0)>>>2&255;y=((J&255)+1+(I&255)|0)>>>1&255;z=(((J&255)<<1)+2+(I&255)+(D&255)|0)>>>2&255;A=((J&255)+1+(I&255)|0)>>>1&255;B=(((I&255)<<1)+((J&255)+2)+(G&255)|0)>>>2&255;C=((I&255)+1+(G&255)|0)>>>1&255;o=((H&255)+1+(G&255)|0)>>>1&255|(((I&255)<<1)+((J&255)+2)+(G&255)|0)>>>2<<24|((I&255)+1+(G&255)|0)>>>1<<16&16711680|(I&255)+2+(H&255)+((G&255)<<1)<<6&65280;break}case 7:{if(!B)break b;X=(z|0)==0;y=q&255;W=r&255;o=s&255;aa=F&255;l=(X?F:p)&255;Y=(X?F:k)&255;p=(aa+1+l|0)>>>1&255;k=(aa+1+o|0)>>>1&255;t=(o+1+W|0)>>>1&255;u=(W+1+y|0)>>>1&255;v=(aa+2+Y+(l<<1)|0)>>>2&255;w=(l+(aa<<1)+(o+2)|0)>>>2&255;x=(W+(aa+2)+(o<<1)|0)>>>2&255;y=(y+(o+2)+(W<<1)|0)>>>2&255;z=(l+1+Y|0)>>>1&255;A=(aa+1+l|0)>>>1&255;B=(aa+1+o|0)>>>1&255;C=(o+1+W|0)>>>1&255;o=(W+(aa+2)+(o<<1)|0)>>>2&255|(l+2+((X?F:E)&255)+(Y<<1)|0)>>>2<<24|(aa+2+Y+(l<<1)|0)>>>2<<16&16711680|(l+(aa<<1)+(o+2)|0)>>>2<<8&65280;break}default:{if(!A)break b;p=((I&255)+2+(H&255)+((G&255)<<1)|0)>>>2&255;k=((I&255)+1+(G&255)|0)>>>1&255;t=((J&255)+2+((I&255)<<1)+(G&255)|0)>>>2&255;u=((J&255)+1+(I&255)|0)>>>1&255;v=((G&255)+2+((H&255)*3|0)|0)>>>2&255;w=((H&255)+1+(G&255)|0)>>>1&255;x=((I&255)+2+(H&255)+((G&255)<<1)|0)>>>2&255;y=((I&255)+1+(G&255)|0)>>>1&255;z=H;A=H;B=((G&255)+2+((H&255)*3|0)|0)>>>2&255;C=((H&255)+1+(G&255)|0)>>>1&255;o=(H&255)<<8|H&255|(H&255)<<16|(H&255)<<24}}c[n+((L<<4)+K)>>2]=(k&255)<<16|(p&255)<<24|(t&255)<<8|u&255;c[n+((L<<4)+K+16)>>2]=(w&255)<<16|(v&255)<<24|(x&255)<<8|y&255;c[n+((L<<4)+K+32)>>2]=(A&255)<<16|(z&255)<<24|(B&255)<<8|C&255;c[n+((L<<4)+K+48)>>2]=o;Pa(n,g+328+(M<<6)|0,M);M=M+1|0;if(M>>>0>=16){o=f+200|0;_=179;break b}}}while(0);c:do if((_|0)==179){E=c[g+140>>2]|0;o=c[o>>2]|0;do if(!o){q=(m|0)!=0;r=0}else{p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if(!((m|0)!=0&p)){q=(m|0)!=0;r=p&1;break}q=1;r=(c[o>>2]|0)>>>0<6?0:p&1}while(0);o=c[f+204>>2]|0;do if(!o)k=0;else{p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if(!(q&p)){k=p&1;break}k=(c[o>>2]|0)>>>0<6?0:p&1}while(0);o=c[f+212>>2]|0;do if(!o)o=0;else{p=(c[f+4>>2]|0)==(c[o+4>>2]|0);if(!(q&p)){o=p&1;break}o=(c[o>>2]|0)>>>0<6?0:p&1}while(0);C=(r|0)!=0;D=(k|0)!=0;B=C&D&(o|0)!=0;A=(r|0)==0;z=(k|0)==0;w=n+256|0;x=$+40+16|0;y=$+21|0;t=g+1352|0;u=16;v=0;while(1){switch(E|0){case 0:{q=y+1|0;do if(C&D){o=((d[q>>0]|0)+4+(d[y+2>>0]|0)+(d[y+3>>0]|0)+(d[y+4>>0]|0)+(d[x>>0]|0)+(d[x+1>>0]|0)+(d[x+2>>0]|0)+(d[x+3>>0]|0)|0)>>>3;p=((d[y+5>>0]|0)+2+(d[y+6>>0]|0)+(d[y+7>>0]|0)+(d[y+8>>0]|0)|0)>>>2}else{if(D){o=((d[q>>0]|0)+2+(d[y+2>>0]|0)+(d[y+3>>0]|0)+(d[y+4>>0]|0)|0)>>>2;p=((d[y+5>>0]|0)+2+(d[y+6>>0]|0)+(d[y+7>>0]|0)+(d[y+8>>0]|0)|0)>>>2;break}if(!C){o=128;p=128;break}p=((d[x>>0]|0)+2+(d[x+1>>0]|0)+(d[x+2>>0]|0)+(d[x+3>>0]|0)|0)>>>2;o=p}while(0);g=o&255;aa=p&255;s=w+32|0;xb(w|0,g|0,4)|0;xb(w+4|0,aa|0,4)|0;xb(w+8|0,g|0,4)|0;xb(w+12|0,aa|0,4)|0;xb(w+16|0,g|0,4)|0;xb(w+20|0,aa|0,4)|0;xb(w+24|0,g|0,4)|0;xb(w+28|0,aa|0,4)|0;do if(C){o=d[x+4>>0]|0;p=d[x+5>>0]|0;q=d[x+6>>0]|0;k=d[x+7>>0]|0;if(!D){r=(o+2+p+q+k|0)>>>2;o=(o+2+p+q+k|0)>>>2;break}r=(o+2+p+q+k|0)>>>2;o=(o+4+p+q+k+(d[y+5>>0]|0)+(d[y+6>>0]|0)+(d[y+7>>0]|0)+(d[y+8>>0]|0)|0)>>>3}else{if(!D){r=128;o=128;break}r=((d[q>>0]|0)+2+(d[y+2>>0]|0)+(d[y+3>>0]|0)+(d[y+4>>0]|0)|0)>>>2;o=((d[y+5>>0]|0)+2+(d[y+6>>0]|0)+(d[y+7>>0]|0)+(d[y+8>>0]|0)|0)>>>2}while(0);g=r&255;aa=o&255;xb(s|0,g|0,4)|0;xb(w+36|0,aa|0,4)|0;xb(w+40|0,g|0,4)|0;xb(w+44|0,aa|0,4)|0;xb(w+48|0,g|0,4)|0;xb(w+52|0,aa|0,4)|0;xb(w+56|0,g|0,4)|0;xb(w+60|0,aa|0,4)|0;break}case 1:{if(A)break c;xb(w|0,a[x>>0]|0,8)|0;xb(w+8|0,a[x+1>>0]|0,8)|0;xb(w+16|0,a[x+2>>0]|0,8)|0;xb(w+24|0,a[x+3>>0]|0,8)|0;xb(w+32|0,a[x+4>>0]|0,8)|0;xb(w+40|0,a[x+5>>0]|0,8)|0;xb(w+48|0,a[x+6>>0]|0,8)|0;xb(w+56|0,a[x+7>>0]|0,8)|0;break}case 2:{if(z)break c;aa=a[y+1>>0]|0;a[w>>0]=aa;a[w+8>>0]=aa;a[w+16>>0]=aa;a[w+24>>0]=aa;a[w+32>>0]=aa;a[w+40>>0]=aa;a[w+48>>0]=aa;a[w+56>>0]=aa;aa=a[y+2>>0]|0;a[w+1>>0]=aa;a[w+9>>0]=aa;a[w+17>>0]=aa;a[w+25>>0]=aa;a[w+33>>0]=aa;a[w+41>>0]=aa;a[w+49>>0]=aa;a[w+57>>0]=aa;aa=a[y+3>>0]|0;a[w+2>>0]=aa;a[w+10>>0]=aa;a[w+18>>0]=aa;a[w+26>>0]=aa;a[w+34>>0]=aa;a[w+42>>0]=aa;a[w+50>>0]=aa;a[w+58>>0]=aa;aa=a[y+4>>0]|0;a[w+3>>0]=aa;a[w+11>>0]=aa;a[w+19>>0]=aa;a[w+27>>0]=aa;a[w+35>>0]=aa;a[w+43>>0]=aa;a[w+51>>0]=aa;a[w+59>>0]=aa;aa=a[y+5>>0]|0;a[w+4>>0]=aa;a[w+12>>0]=aa;a[w+20>>0]=aa;a[w+28>>0]=aa;a[w+36>>0]=aa;a[w+44>>0]=aa;a[w+52>>0]=aa;a[w+60>>0]=aa;aa=a[y+6>>0]|0;a[w+5>>0]=aa;a[w+13>>0]=aa;a[w+21>>0]=aa;a[w+29>>0]=aa;a[w+37>>0]=aa;a[w+45>>0]=aa;a[w+53>>0]=aa;a[w+61>>0]=aa;aa=a[y+7>>0]|0;a[w+6>>0]=aa;a[w+14>>0]=aa;a[w+22>>0]=aa;a[w+30>>0]=aa;a[w+38>>0]=aa;a[w+46>>0]=aa;a[w+54>>0]=aa;a[w+62>>0]=aa;aa=a[y+8>>0]|0;a[w+7>>0]=aa;a[w+15>>0]=aa;a[w+23>>0]=aa;a[w+31>>0]=aa;a[w+39>>0]=aa;a[w+47>>0]=aa;a[w+55>>0]=aa;a[w+63>>0]=aa;break}default:{if(!B)break c;r=d[y+8>>0]|0;s=d[x+7>>0]|0;q=d[y>>0]|0;p=(((d[y+5>>0]|0)-(d[y+3>>0]|0)+((d[y+6>>0]|0)-(d[y+2>>0]|0)<<1)+(((d[y+7>>0]|0)-(d[y+1>>0]|0)|0)*3|0)+(r-q<<2)|0)*17|0)+16>>5;q=(((d[x+4>>0]|0)-(d[x+2>>0]|0)+(s-q<<2)+((d[x+5>>0]|0)-(d[x+1>>0]|0)<<1)+(((d[x+6>>0]|0)-(d[x>>0]|0)|0)*3|0)|0)*17|0)+16>>5;k=Z(p,-3)|0;o=w;r=(s+r<<4)+16+(Z(q,-3)|0)|0;s=8;while(1){s=s+-1|0;aa=r+k|0;a[o>>0]=a[6294+((aa>>5)+512)>>0]|0;a[o+1>>0]=a[6294+((aa+p>>5)+512)>>0]|0;a[o+2>>0]=a[6294+((aa+p+p>>5)+512)>>0]|0;a[o+3>>0]=a[6294+((aa+p+p+p>>5)+512)>>0]|0;a[o+4>>0]=a[6294+((aa+p+p+p+p>>5)+512)>>0]|0;aa=aa+p+p+p+p+p|0;a[o+5>>0]=a[6294+((aa>>5)+512)>>0]|0;a[o+6>>0]=a[6294+((aa+p>>5)+512)>>0]|0;a[o+7>>0]=a[6294+((aa+p+p>>5)+512)>>0]|0;if(!s)break;else{o=o+8|0;r=r+q|0}}}}Pa(w,t,u);aa=u|1;Pa(w,t+64|0,aa);Pa(w,t+128|0,aa+1|0);Pa(w,t+192|0,u|3);v=v+1|0;if(v>>>0>=2)break;else{w=w+64|0;x=x+8|0;y=y+9|0;t=t+256|0;u=u+4|0}}if((c[f+196>>2]|0)>>>0<=1)$a(h,n);aa=0;i=$;return aa|0}while(0);aa=1;i=$;return aa|0}while(0);aa=c[h+4>>2]|0;T=((l>>>0)/(aa>>>0)|0)<<4;U=l-(Z((l>>>0)/(aa>>>0)|0,aa)|0)<<4;c[$+4>>2]=aa;c[$+8>>2]=c[h+8>>2];d:do switch(r|0){case 1:case 0:{z=c[g+144>>2]|0;o=c[f+200>>2]|0;if((o|0)!=0?(c[o+4>>2]|0)==(c[f+4>>2]|0):0)if((c[o>>2]|0)>>>0<6){v=e[o+152>>1]|e[o+152+2>>1]<<16;k=1;s=c[o+104>>2]|0;o=v>>>16&65535;v=v&65535}else{k=1;s=-1;o=0;v=0}else{k=0;s=-1;o=0;v=0}p=c[f+204>>2]|0;if((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0)if((c[p>>2]|0)>>>0<6){u=e[p+172>>1]|e[p+172+2>>1]<<16;q=1;t=c[p+108>>2]|0;w=u>>>16&65535;u=u&65535}else{q=1;t=-1;w=0;u=0}else{q=0;t=-1;w=0;u=0}do if(!r)if(!((k|0)==0|(q|0)==0)){if((s|0)==0?((o&65535)<<16|v&65535|0)==0:0){p=0;o=0;break}if((t|0)==0?((w&65535)<<16|u&65535|0)==0:0){p=0;o=0}else _=230}else{p=0;o=0}else _=230;while(0);if((_|0)==230){x=b[g+160>>1]|0;y=b[g+162>>1]|0;p=c[f+208>>2]|0;if((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0)if((c[p>>2]|0)>>>0<6){r=c[p+108>>2]|0;k=e[p+172>>1]|e[p+172+2>>1]<<16;_=239}else{r=-1;k=0;_=239}else _=234;do if((_|0)==234){p=c[f+212>>2]|0;if((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0){if((c[p>>2]|0)>>>0>=6){r=-1;k=0;_=239;break}r=c[p+112>>2]|0;k=e[p+192>>1]|e[p+192+2>>1]<<16;_=239;break}if((k|0)==0|(q|0)!=0){r=-1;k=0;_=239}else p=v}while(0);do if((_|0)==239){q=(s|0)==(z|0);p=(t|0)==(z|0);if(((p&1)+(q&1)+((r|0)==(z|0)&1)|0)!=1){Y=v<<16>>16;W=u<<16>>16;p=k<<16>>16;V=u<<16>>16>v<<16>>16;X=V?W:Y;Y=V?Y:(W|0)<(Y|0)?W:Y;W=o<<16>>16;V=w<<16>>16;aa=k>>16;o=w<<16>>16>o<<16>>16;m=o?V:W;o=o?W:(V|0)<(W|0)?V:W;p=((X|0)<(p|0)?X:(Y|0)>(p|0)?Y:p)&65535;o=((m|0)<(aa|0)?m:(o|0)>(aa|0)?o:aa)&65535;break}if(q|p){p=q?v:u;o=q?o:w}else{p=k&65535;o=k>>>16&65535}}while(0);p=(p&65535)+(x&65535)|0;o=(o&65535)+(y&65535)|0;if(((p<<16>>16)+8192|0)>>>0>16383){_=427;break d}if(((o<<16>>16)+2048|0)>>>0>4095){_=427;break d}else{p=p&65535;o=o&65535}}if(((z>>>0<=16?(J=c[(c[j+4>>2]|0)+(z<<2)>>2]|0,(J|0)!=0):0)?(c[J+20>>2]|0)>>>0>1:0)?(K=c[J>>2]|0,(K|0)!=0):0){b[f+192>>1]=p;b[f+194>>1]=o;aa=e[f+192>>1]|e[f+192+2>>1]<<16;b[f+188>>1]=aa;b[f+188+2>>1]=aa>>>16;b[f+184>>1]=aa;b[f+184+2>>1]=aa>>>16;b[f+180>>1]=aa;b[f+180+2>>1]=aa>>>16;b[f+176>>1]=aa;b[f+176+2>>1]=aa>>>16;b[f+172>>1]=aa;b[f+172+2>>1]=aa>>>16;b[f+168>>1]=aa;b[f+168+2>>1]=aa>>>16;b[f+164>>1]=aa;b[f+164+2>>1]=aa>>>16;b[f+160>>1]=aa;b[f+160+2>>1]=aa>>>16;b[f+156>>1]=aa;b[f+156+2>>1]=aa>>>16;b[f+152>>1]=aa;b[f+152+2>>1]=aa>>>16;b[f+148>>1]=aa;b[f+148+2>>1]=aa>>>16;b[f+144>>1]=aa;b[f+144+2>>1]=aa>>>16;b[f+140>>1]=aa;b[f+140+2>>1]=aa>>>16;b[f+136>>1]=aa;b[f+136+2>>1]=aa>>>16;b[f+132>>1]=aa;b[f+132+2>>1]=aa>>>16;c[f+100>>2]=z;c[f+104>>2]=z;c[f+108>>2]=z;c[f+112>>2]=z;c[f+116>>2]=K;c[f+120>>2]=K;c[f+124>>2]=K;c[f+128>>2]=K;c[$>>2]=K;Wa(n,f+132|0,$,U,T,0,0,16,16)}else _=427;break}case 2:{v=b[g+160>>1]|0;w=b[g+162>>1]|0;x=c[g+144>>2]|0;o=c[f+204>>2]|0;if((o|0)!=0?(c[o+4>>2]|0)==(c[f+4>>2]|0):0)if((c[o>>2]|0)>>>0<6){u=e[o+172>>1]|e[o+172+2>>1]<<16;o=c[o+108>>2]|0;r=1;t=u&65535;u=u>>>16&65535}else{o=-1;r=1;t=0;u=0}else{o=-1;r=0;t=0;u=0}e:do if((o|0)!=(x|0)){o=c[f+200>>2]|0;if((o|0)!=0?(c[o+4>>2]|0)==(c[f+4>>2]|0):0)if((c[o>>2]|0)>>>0<6){aa=e[o+152>>1]|e[o+152+2>>1]<<16;k=1;s=c[o+104>>2]|0;p=aa&65535;o=aa>>>16&65535}else{k=1;s=-1;p=0;o=0}else{k=0;s=-1;p=0;o=0}q=c[f+208>>2]|0;if((q|0)!=0?(c[q+4>>2]|0)==(c[f+4>>2]|0):0)if((c[q>>2]|0)>>>0<6){r=c[q+108>>2]|0;k=e[q+172>>1]|e[q+172+2>>1]<<16}else{r=-1;k=0}else _=263;do if((_|0)==263){q=c[f+212>>2]|0;if((q|0)!=0?(c[q+4>>2]|0)==(c[f+4>>2]|0):0){if((c[q>>2]|0)>>>0>=6){r=-1;k=0;break}r=c[q+112>>2]|0;k=e[q+192>>1]|e[q+192+2>>1]<<16;break}if((r|0)!=0|(k|0)==0){r=-1;k=0}else break e}while(0);q=(s|0)==(x|0);if((((r|0)==(x|0)&1)+(q&1)|0)!=1){W=p<<16>>16;V=t<<16>>16;Y=k<<16>>16;p=t<<16>>16>p<<16>>16;X=p?V:W;p=p?W:(V|0)<(W|0)?V:W;W=o<<16>>16;V=u<<16>>16;aa=k>>16;o=u<<16>>16>o<<16>>16;m=o?V:W;o=o?W:(V|0)<(W|0)?V:W;p=((X|0)<(Y|0)?X:(p|0)>(Y|0)?p:Y)&65535;o=((m|0)<(aa|0)?m:(o|0)>(aa|0)?o:aa)&65535;break}if(q){p=q?p:t;o=q?o:u}else{p=k&65535;o=k>>>16&65535}}else{p=t;o=u}while(0);p=(p&65535)+(v&65535)|0;o=(o&65535)+(w&65535)|0;if((((((p<<16>>16)+8192|0)>>>0<=16383?!(x>>>0>16|((o<<16>>16)+2048|0)>>>0>4095):0)?(I=c[(c[j+4>>2]|0)+(x<<2)>>2]|0,(I|0)!=0):0)?(c[I+20>>2]|0)>>>0>1:0)?(M=c[I>>2]|0,(M|0)!=0):0){b[f+160>>1]=p;b[f+162>>1]=o;k=e[f+160>>1]|e[f+160+2>>1]<<16;b[f+156>>1]=k;b[f+156+2>>1]=k>>>16;b[f+152>>1]=k;b[f+152+2>>1]=k>>>16;b[f+148>>1]=k;b[f+148+2>>1]=k>>>16;b[f+144>>1]=k;b[f+144+2>>1]=k>>>16;b[f+140>>1]=k;b[f+140+2>>1]=k>>>16;b[f+136>>1]=k;b[f+136+2>>1]=k>>>16;b[f+132>>1]=k;b[f+132+2>>1]=k>>>16;c[f+100>>2]=x;c[f+104>>2]=x;c[f+116>>2]=M;c[f+120>>2]=M;s=b[g+164>>1]|0;t=b[g+166>>1]|0;u=c[g+148>>2]|0;p=c[f+200>>2]|0;if(((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0)?(c[p>>2]|0)>>>0<6:0){r=e[p+184>>1]|e[p+184+2>>1]<<16;o=c[p+112>>2]|0;q=r>>>16&65535;r=r&65535}else{o=-1;q=0;r=0}do if((o|0)!=(u|0)){if(((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0)?(c[p>>2]|0)>>>0<6:0){o=c[p+104>>2]|0;p=e[p+160>>1]|e[p+160+2>>1]<<16}else{o=-1;p=0}if((((o|0)==(u|0)&1)+((x|0)==(u|0)&1)|0)==1){q=(x|0)==(u|0)?k>>>16:p>>>16;o=(x|0)==(u|0)?k:p;break}else{aa=r<<16>>16;o=p<<16>>16;W=(k&65535)<<16>>16>r<<16>>16;m=W?k<<16>>16:aa;aa=W?aa:(k<<16>>16|0)<(aa|0)?k<<16>>16:aa;W=q<<16>>16;Y=p>>16;q=(k>>>16&65535)<<16>>16>q<<16>>16;X=q?k>>16:W;q=q?W:(k>>16|0)<(W|0)?k>>16:W;q=(X|0)<(Y|0)?X:(q|0)>(Y|0)?q:Y;o=(m|0)<(o|0)?m:(aa|0)>(o|0)?aa:o;break}}else{o=q&65535;q=o;o=o<<16|r&65535}while(0);p=(o&65535)+(s&65535)|0;o=(q&65535)+(t&65535)|0;if((((((p<<16>>16)+8192|0)>>>0<=16383?!(u>>>0>16|((o<<16>>16)+2048|0)>>>0>4095):0)?(N=c[(c[j+4>>2]|0)+(u<<2)>>2]|0,(N|0)!=0):0)?(c[N+20>>2]|0)>>>0>1:0)?(O=c[N>>2]|0,(O|0)!=0):0){b[f+192>>1]=p;b[f+194>>1]=o;aa=e[f+192>>1]|e[f+192+2>>1]<<16;b[f+188>>1]=aa;b[f+188+2>>1]=aa>>>16;b[f+184>>1]=aa;b[f+184+2>>1]=aa>>>16;b[f+180>>1]=aa;b[f+180+2>>1]=aa>>>16;b[f+176>>1]=aa;b[f+176+2>>1]=aa>>>16;b[f+172>>1]=aa;b[f+172+2>>1]=aa>>>16;b[f+168>>1]=aa;b[f+168+2>>1]=aa>>>16;b[f+164>>1]=aa;b[f+164+2>>1]=aa>>>16;c[f+108>>2]=u;c[f+112>>2]=u;c[f+124>>2]=O;c[f+128>>2]=O;c[$>>2]=M;Wa(n,f+132|0,$,U,T,0,0,16,8);c[$>>2]=c[f+124>>2];Wa(n,f+164|0,$,U,T,0,8,16,8)}else _=427}else _=427;break}case 3:{u=b[g+160>>1]|0;v=b[g+162>>1]|0;w=c[g+144>>2]|0;o=c[f+200>>2]|0;if((o|0)!=0?(c[o+4>>2]|0)==(c[f+4>>2]|0):0)if((c[o>>2]|0)>>>0<6){aa=e[o+152>>1]|e[o+152+2>>1]<<16;p=c[o+104>>2]|0;q=1;t=aa&65535;o=aa>>>16&65535}else{p=-1;q=1;t=0;o=0}else{p=-1;q=0;t=0;o=0}f:do if((p|0)!=(w|0)){k=c[f+204>>2]|0;if((k|0)!=0?(c[k+4>>2]|0)==(c[f+4>>2]|0):0)if((c[k>>2]|0)>>>0<6){r=e[k+172>>1]|e[k+172+2>>1]<<16;q=c[k+108>>2]|0;s=c[k+112>>2]|0;p=r&65535;k=e[k+188>>1]|e[k+188+2>>1]<<16;r=r>>>16&65535}else{q=-1;s=-1;p=0;k=0;r=0}else _=305;do if((_|0)==305){k=c[f+212>>2]|0;if((k|0)!=0?(c[k+4>>2]|0)==(c[f+4>>2]|0):0){if((c[k>>2]|0)>>>0>=6){q=-1;s=-1;p=0;k=0;r=0;break}q=-1;s=c[k+112>>2]|0;p=0;k=e[k+192>>1]|e[k+192+2>>1]<<16;r=0;break}if(!q){q=-1;s=-1;p=0;k=0;r=0}else{p=t;break f}}while(0);q=(q|0)==(w|0);if(((q&1)+((s|0)==(w|0)&1)|0)!=1){W=t<<16>>16;V=p<<16>>16;Y=k<<16>>16;p=p<<16>>16>t<<16>>16;X=p?V:W;p=p?W:(V|0)<(W|0)?V:W;W=o<<16>>16;V=r<<16>>16;aa=k>>16;o=r<<16>>16>o<<16>>16;m=o?V:W;o=o?W:(V|0)<(W|0)?V:W;p=((X|0)<(Y|0)?X:(p|0)>(Y|0)?p:Y)&65535;o=((m|0)<(aa|0)?m:(o|0)>(aa|0)?o:aa)&65535;break}if(q)o=r;else{p=k&65535;o=k>>>16&65535}}else p=t;while(0);p=(p&65535)+(u&65535)|0;o=(o&65535)+(v&65535)|0;if((((((p<<16>>16)+8192|0)>>>0<=16383?!(w>>>0>16|((o<<16>>16)+2048|0)>>>0>4095):0)?(H=c[(c[j+4>>2]|0)+(w<<2)>>2]|0,(H|0)!=0):0)?(c[H+20>>2]|0)>>>0>1:0)?(Q=c[H>>2]|0,(Q|0)!=0):0){b[f+176>>1]=p;b[f+178>>1]=o;o=e[f+176>>1]|e[f+176+2>>1]<<16;b[f+172>>1]=o;b[f+172+2>>1]=o>>>16;b[f+168>>1]=o;b[f+168+2>>1]=o>>>16;b[f+164>>1]=o;b[f+164+2>>1]=o>>>16;b[f+144>>1]=o;b[f+144+2>>1]=o>>>16;b[f+140>>1]=o;b[f+140+2>>1]=o>>>16;b[f+136>>1]=o;b[f+136+2>>1]=o>>>16;b[f+132>>1]=o;b[f+132+2>>1]=o>>>16;c[f+100>>2]=w;c[f+108>>2]=w;c[f+116>>2]=Q;c[f+124>>2]=Q;s=b[g+164>>1]|0;t=b[g+166>>1]|0;u=c[g+148>>2]|0;p=c[f+208>>2]|0;if((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0)if((c[p>>2]|0)>>>0<6){k=c[p+108>>2]|0;r=e[p+172>>1]|e[p+172+2>>1]<<16;q=1}else{k=-1;r=0;q=1}else{p=c[f+204>>2]|0;if((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0)if((c[p>>2]|0)>>>0<6){k=c[p+108>>2]|0;r=e[p+176>>1]|e[p+176+2>>1]<<16;q=1}else{k=-1;r=0;q=1}else{k=-1;r=0;q=0}}do if((k|0)!=(u|0)){p=c[f+204>>2]|0;if((p|0)!=0?(c[p+4>>2]|0)==(c[f+4>>2]|0):0)if((c[p>>2]|0)>>>0<6){q=e[p+188>>1]|e[p+188+2>>1]<<16;p=c[p+112>>2]|0;k=q&65535;q=q>>>16&65535}else{p=-1;k=0;q=0}else if(!q){q=o>>>16;break}else{p=-1;k=0;q=0}p=(p|0)==(u|0);if(((p&1)+((w|0)==(u|0)&1)|0)!=1){m=k<<16>>16;aa=r<<16>>16;V=k<<16>>16>(o&65535)<<16>>16;Y=V?m:o<<16>>16;m=V?o<<16>>16:(m|0)<(o<<16>>16|0)?m:o<<16>>16;V=q<<16>>16;X=r>>16;q=q<<16>>16>(o>>>16&65535)<<16>>16;W=q?V:o>>16;q=q?o>>16:(V|0)<(o>>16|0)?V:o>>16;q=(W|0)<(X|0)?W:(q|0)>(X|0)?q:X;o=(Y|0)<(aa|0)?Y:(m|0)>(aa|0)?m:aa;break}if((w|0)!=(u|0))if(p){o=q&65535;q=o;o=o<<16|k&65535;break}else{q=r>>>16;o=r;break}else q=o>>>16}else{q=r>>>16;o=r}while(0);p=(o&65535)+(s&65535)|0;o=(q&65535)+(t&65535)|0;if((((((p<<16>>16)+8192|0)>>>0<=16383?!(u>>>0>16|((o<<16>>16)+2048|0)>>>0>4095):0)?(R=c[(c[j+4>>2]|0)+(u<<2)>>2]|0,(R|0)!=0):0)?(c[R+20>>2]|0)>>>0>1:0)?(S=c[R>>2]|0,(S|0)!=0):0){b[f+192>>1]=p;b[f+194>>1]=o;aa=e[f+192>>1]|e[f+192+2>>1]<<16;b[f+188>>1]=aa;b[f+188+2>>1]=aa>>>16;b[f+184>>1]=aa;b[f+184+2>>1]=aa>>>16;b[f+180>>1]=aa;b[f+180+2>>1]=aa>>>16;b[f+160>>1]=aa;b[f+160+2>>1]=aa>>>16;b[f+156>>1]=aa;b[f+156+2>>1]=aa>>>16;b[f+152>>1]=aa;b[f+152+2>>1]=aa>>>16;b[f+148>>1]=aa;b[f+148+2>>1]=aa>>>16;c[f+104>>2]=u;c[f+112>>2]=u;c[f+120>>2]=S;c[f+128>>2]=S;c[$>>2]=Q;Wa(n,f+132|0,$,U,T,0,0,8,16);c[$>>2]=c[f+120>>2];Wa(n,f+148|0,$,U,T,8,0,8,16)}else _=427}else _=427;break}default:{o=0;do{F=g+176+(o<<2)|0;switch(c[F>>2]|0){case 0:{E=1;break}case 2:case 1:{E=2;break}default:E=4}G=g+192+(o<<2)|0;c[f+100+(o<<2)>>2]=c[G>>2];q=c[G>>2]|0;if(q>>>0>16){_=353;break}p=c[(c[j+4>>2]|0)+(q<<2)>>2]|0;if(!p){_=353;break}if((c[p+20>>2]|0)>>>0<=1){_=353;break}aa=c[p>>2]|0;c[f+116+(o<<2)>>2]=aa;if(!aa){_=427;break d}D=o<<2;p=0;while(1){A=b[g+208+(o<<4)+(p<<2)>>1]|0;B=b[g+208+(o<<4)+(p<<2)+2>>1]|0;C=c[F>>2]|0;switch(c[1280+(o<<7)+(C<<5)+(p<<3)>>2]|0){case 0:{k=c[f+200>>2]|0;_=361;break}case 1:{k=c[f+204>>2]|0;_=361;break}case 2:{k=c[f+208>>2]|0;_=361;break}case 3:{k=c[f+212>>2]|0;_=361;break}case 4:{k=f;_=361;break}default:{u=0;w=-1;k=0;z=0}}if((_|0)==361){_=0;r=d[1280+(o<<7)+(C<<5)+(p<<3)+4>>0]|0;if((k|0)!=0?(c[k+4>>2]|0)==(c[f+4>>2]|0):0)if((c[k>>2]|0)>>>0<6){z=k+132+(r<<2)|0;z=e[z>>1]|e[z+2>>1]<<16;u=1;w=c[k+100+(r>>>2<<2)>>2]|0;k=z&65535;z=z>>>16&65535}else{u=1;w=-1;k=0;z=0}else{u=0;w=-1;k=0;z=0}}switch(c[1792+(o<<7)+(C<<5)+(p<<3)>>2]|0){case 0:{s=c[f+200>>2]|0;_=370;break}case 1:{s=c[f+204>>2]|0;_=370;break}case 2:{s=c[f+208>>2]|0;_=370;break}case 3:{s=c[f+212>>2]|0;_=370;break}case 4:{s=f;_=370;break}default:{t=0;v=-1;x=0;y=0}}if((_|0)==370){r=d[1792+(o<<7)+(C<<5)+(p<<3)+4>>0]|0;if((s|0)!=0?(c[s+4>>2]|0)==(c[f+4>>2]|0):0)if((c[s>>2]|0)>>>0<6){y=s+132+(r<<2)|0;y=e[y>>1]|e[y+2>>1]<<16;t=1;v=c[s+100+(r>>>2<<2)>>2]|0;x=y&65535;y=y>>>16&65535}else{t=1;v=-1;x=0;y=0}else{t=0;v=-1;x=0;y=0}}switch(c[2304+(o<<7)+(C<<5)+(p<<3)>>2]|0){case 0:{s=c[f+200>>2]|0;_=379;break}case 1:{s=c[f+204>>2]|0;_=379;break}case 2:{s=c[f+208>>2]|0;_=379;break}case 3:{s=c[f+212>>2]|0;_=379;break}case 4:{s=f;_=379;break}default:_=383}if((_|0)==379){r=d[2304+(o<<7)+(C<<5)+(p<<3)+4>>0]|0;if((s|0)!=0?(c[s+4>>2]|0)==(c[f+4>>2]|0):0)if((c[s>>2]|0)>>>0<6){u=s+132+(r<<2)|0;t=c[s+100+(r>>>2<<2)>>2]|0;u=e[u>>1]|e[u+2>>1]<<16;_=393}else{t=-1;u=0;_=393}else _=383}do if((_|0)==383){_=0;switch(c[2816+(o<<7)+(C<<5)+(p<<3)>>2]|0){case 0:{L=c[f+200>>2]|0;_=388;break}case 1:{L=c[f+204>>2]|0;_=388;break}case 2:{L=c[f+208>>2]|0;_=388;break}case 3:{L=c[f+212>>2]|0;_=388;break}case 4:{L=f;_=388;break}default:{}}if(((_|0)==388?(_=0,P=d[2816+(o<<7)+(C<<5)+(p<<3)+4>>0]|0,(L|0)!=0):0)?(c[L+4>>2]|0)==(c[f+4>>2]|0):0){if((c[L>>2]|0)>>>0>=6){t=-1;u=0;_=393;break}u=L+132+(P<<2)|0;t=c[L+100+(P>>>2<<2)>>2]|0;u=e[u>>1]|e[u+2>>1]<<16;_=393;break}if((u|0)==0|(t|0)!=0){t=-1;u=0;_=393}else q=z}while(0);do if((_|0)==393){_=0;s=(w|0)==(q|0);r=(v|0)==(q|0);if(((r&1)+(s&1)+((t|0)==(q|0)&1)|0)!=1){aa=k<<16>>16;W=x<<16>>16;Y=u<<16>>16;k=x<<16>>16>k<<16>>16;X=k?W:aa;k=k?aa:(W|0)<(aa|0)?W:aa;aa=z<<16>>16;W=y<<16>>16;q=u>>16;V=y<<16>>16>z<<16>>16;m=V?W:aa;aa=V?aa:(W|0)<(aa|0)?W:aa;k=((X|0)<(Y|0)?X:(k|0)>(Y|0)?k:Y)&65535;q=((m|0)<(q|0)?m:(aa|0)>(q|0)?aa:q)&65535;break}if(s|r){k=s?k:x;q=s?z:y}else{k=u&65535;q=u>>>16&65535}}while(0);k=(k&65535)+(A&65535)|0;q=(q&65535)+(B&65535)|0;if(((k<<16>>16)+8192|0)>>>0>16383){_=427;break d}if(((q<<16>>16)+2048|0)>>>0>4095){_=427;break d}switch(C|0){case 0:{b[f+132+(D<<2)>>1]=k;b[f+132+(D<<2)+2>>1]=q;b[f+132+((D|1)<<2)>>1]=k;b[f+132+((D|1)<<2)+2>>1]=q;b[f+132+((D|2)<<2)>>1]=k;b[f+132+((D|2)<<2)+2>>1]=q;b[f+132+((D|3)<<2)>>1]=k;b[f+132+((D|3)<<2)+2>>1]=q;break}case 1:{aa=(p<<1)+D|0;b[f+132+(aa<<2)>>1]=k;b[f+132+(aa<<2)+2>>1]=q;b[f+132+((aa|1)<<2)>>1]=k;b[f+132+((aa|1)<<2)+2>>1]=q;break}case 2:{aa=p+D|0;b[f+132+(aa<<2)>>1]=k;b[f+132+(aa<<2)+2>>1]=q;b[f+132+(aa+2<<2)>>1]=k;b[f+132+(aa+2<<2)+2>>1]=q;break}case 3:{aa=p+D|0;b[f+132+(aa<<2)>>1]=k;b[f+132+(aa<<2)+2>>1]=q;break}default:{}}p=p+1|0;if(p>>>0>=E>>>0)break;q=c[G>>2]|0}o=o+1|0}while(o>>>0<4);if((_|0)==353){c[f+116+(o<<2)>>2]=0;_=427;break d}q=0;while(1){c[$>>2]=c[f+116+(q<<2)>>2];o=q<<3&8;p=q>>>0<2?0:8;switch(c[g+176+(q<<2)>>2]|0){case 0:{Wa(n,f+132+(q<<2<<2)|0,$,U,T,o,p,8,8);break}case 1:{aa=q<<2;Wa(n,f+132+(aa<<2)|0,$,U,T,o,p,8,4);Wa(n,f+132+((aa|2)<<2)|0,$,U,T,o,p|4,8,4);break}case 2:{aa=q<<2;Wa(n,f+132+(aa<<2)|0,$,U,T,o,p,4,8);Wa(n,f+132+((aa|1)<<2)|0,$,U,T,o|4,p,4,8);break}default:{aa=q<<2;Wa(n,f+132+(aa<<2)|0,$,U,T,o,p,4,4);Wa(n,f+132+((aa|1)<<2)|0,$,U,T,o|4,p,4,4);Wa(n,f+132+((aa|2)<<2)|0,$,U,T,o,p|4,4,4);Wa(n,f+132+((aa|3)<<2)|0,$,U,T,o|4,p|4,4,4)}}q=q+1|0;if((q|0)==4)break d}}}while(0);if((_|0)==427){aa=1;i=$;return aa|0}do if((c[f+196>>2]|0)>>>0<=1){if(!(c[f>>2]|0)){$a(h,n);break}w=c[h+4>>2]|0;s=c[h+8>>2]|0;v=c[h>>2]|0;r=0;do{p=c[1152+(r<<2)>>2]|0;q=c[1216+(r<<2)>>2]|0;o=(l-((l>>>0)%(w>>>0)|0)<<8)+(((l>>>0)%(w>>>0)|0)<<4)+p+(Z(q,w<<4)|0)|0;k=c[g+328+(r<<6)>>2]|0;if((k|0)==16777215){aa=c[n+((q<<4)+p+16)>>2]|0;c[v+o>>2]=c[n+((q<<4)+p)>>2];c[v+o+((w<<2&1073741820)<<2)>>2]=aa;aa=c[n+((q<<4)+p+48)>>2]|0;c[v+o+((w<<2&1073741820)<<1<<2)>>2]=c[n+((q<<4)+p+32)>>2];c[v+o+((w<<2&1073741820)*3<<2)>>2]=aa}else{aa=d[n+((q<<4)+p+1)>>0]|0;h=c[g+328+(r<<6)+4>>2]|0;a[v+o>>0]=a[6294+(k+512+(d[n+((q<<4)+p)>>0]|0))>>0]|0;f=d[n+((q<<4)+p+2)>>0]|0;_=c[g+328+(r<<6)+8>>2]|0;a[v+(o+1)>>0]=a[6294+((aa|512)+h)>>0]|0;h=d[n+((q<<4)+p+3)>>0]|0;aa=c[g+328+(r<<6)+12>>2]|0;a[v+(o+2)>>0]=a[6294+(_+512+f)>>0]|0;a[v+(o+3)>>0]=a[6294+(aa+512+h)>>0]|0;h=d[n+((q<<4)+p+17)>>0]|0;aa=c[g+328+(r<<6)+20>>2]|0;a[v+(o+(w<<4))>>0]=a[6294+((c[g+328+(r<<6)+16>>2]|0)+512+(d[n+((q<<4)+p+16)>>0]|0))>>0]|0;f=d[n+((q<<4)+p+18)>>0]|0;_=c[g+328+(r<<6)+24>>2]|0;a[v+(o+(w<<4)+1)>>0]=a[6294+((h|512)+aa)>>0]|0;aa=d[n+((q<<4)+p+19)>>0]|0;h=c[g+328+(r<<6)+28>>2]|0;a[v+(o+(w<<4)+2)>>0]=a[6294+(_+512+f)>>0]|0;a[v+(o+(w<<4)+3)>>0]=a[6294+(h+512+aa)>>0]|0;aa=o+(w<<4)+(w<<4)|0;h=d[n+((q<<4)+p+33)>>0]|0;f=c[g+328+(r<<6)+36>>2]|0;a[v+aa>>0]=a[6294+((c[g+328+(r<<6)+32>>2]|0)+512+(d[n+((q<<4)+p+32)>>0]|0))>>0]|0;_=d[n+((q<<4)+p+34)>>0]|0;m=c[g+328+(r<<6)+40>>2]|0;a[v+(aa+1)>>0]=a[6294+((h|512)+f)>>0]|0;f=d[n+((q<<4)+p+35)>>0]|0;h=c[g+328+(r<<6)+44>>2]|0;a[v+(aa+2)>>0]=a[6294+(m+512+_)>>0]|0;a[v+(aa+3)>>0]=a[6294+(h+512+f)>>0]|0;f=d[n+((q<<4)+p+49)>>0]|0;h=c[g+328+(r<<6)+52>>2]|0;a[v+(aa+(w<<4))>>0]=a[6294+((c[g+328+(r<<6)+48>>2]|0)+512+(d[n+((q<<4)+p+48)>>0]|0))>>0]|0;_=d[n+((q<<4)+p+50)>>0]|0;m=c[g+328+(r<<6)+56>>2]|0;a[v+(aa+(w<<4)+1)>>0]=a[6294+((f|512)+h)>>0]|0;h=d[n+((q<<4)+p+51)>>0]|0;f=c[g+328+(r<<6)+60>>2]|0;a[v+(aa+(w<<4)+2)>>0]=a[6294+(m+512+_)>>0]|0;a[v+(aa+(w<<4)+3)>>0]=a[6294+(f+512+h)>>0]|0}r=r+1|0}while((r|0)!=16);q=Z(s,w)|0;t=16;do{r=t&3;k=c[1152+(r<<2)>>2]|0;r=c[1216+(r<<2)>>2]|0;u=t>>>0>19;o=u?320:256;p=(r<<3)+k+o|0;u=(((l>>>0)%(w>>>0)|0)<<3)+(q<<8)+(l-((l>>>0)%(w>>>0)|0)<<6)+k+(u?q<<6:0)+(Z(r,w<<3&2147483640)|0)|0;s=c[g+328+(t<<6)>>2]|0;if((s|0)==16777215){aa=c[n+((r<<3)+k+(o|8))>>2]|0;c[v+u>>2]=c[n+p>>2];c[v+u+((w<<3&2147483640)>>>2<<2)>>2]=aa;aa=c[n+((r<<3)+k+(o|24))>>2]|0;c[v+u+((w<<3&2147483640)>>>1<<2)>>2]=c[n+((r<<3)+k+(o|16))>>2];c[v+u+(((w<<3&2147483640)>>>1)+((w<<3&2147483640)>>>2)<<2)>>2]=aa}else{f=d[n+(p+1)>>0]|0;aa=c[g+328+(t<<6)+4>>2]|0;a[v+u>>0]=a[6294+(s+512+(d[n+p>>0]|0))>>0]|0;h=d[n+(p+2)>>0]|0;_=c[g+328+(t<<6)+8>>2]|0;a[v+(u+1)>>0]=a[6294+((f|512)+aa)>>0]|0;aa=d[n+(p+3)>>0]|0;f=c[g+328+(t<<6)+12>>2]|0;a[v+(u+2)>>0]=a[6294+(_+512+h)>>0]|0;a[v+(u+3)>>0]=a[6294+(f+512+aa)>>0]|0;aa=u+(w<<3&2147483640)|0;f=d[n+(p+9)>>0]|0;h=c[g+328+(t<<6)+20>>2]|0;a[v+aa>>0]=a[6294+((c[g+328+(t<<6)+16>>2]|0)+512+(d[n+(p+8)>>0]|0))>>0]|0;_=d[n+(p+10)>>0]|0;m=c[g+328+(t<<6)+24>>2]|0;a[v+(aa+1)>>0]=a[6294+((f|512)+h)>>0]|0;h=d[n+(p+11)>>0]|0;f=c[g+328+(t<<6)+28>>2]|0;a[v+(aa+2)>>0]=a[6294+(m+512+_)>>0]|0;a[v+(aa+3)>>0]=a[6294+(f+512+h)>>0]|0;aa=aa+(w<<3&2147483640)|0;h=d[n+(p+17)>>0]|0;f=c[g+328+(t<<6)+36>>2]|0;a[v+aa>>0]=a[6294+((c[g+328+(t<<6)+32>>2]|0)+512+(d[n+(p+16)>>0]|0))>>0]|0;_=d[n+(p+18)>>0]|0;m=c[g+328+(t<<6)+40>>2]|0;a[v+(aa+1)>>0]=a[6294+((h|512)+f)>>0]|0;f=d[n+(p+19)>>0]|0;h=c[g+328+(t<<6)+44>>2]|0;a[v+(aa+2)>>0]=a[6294+(m+512+_)>>0]|0;a[v+(aa+3)>>0]=a[6294+(h+512+f)>>0]|0;f=d[n+(p+25)>>0]|0;h=c[g+328+(t<<6)+52>>2]|0;a[v+(aa+(w<<3&2147483640))>>0]=a[6294+((c[g+328+(t<<6)+48>>2]|0)+512+(d[n+(p+24)>>0]|0))>>0]|0;_=d[n+(p+26)>>0]|0;m=c[g+328+(t<<6)+56>>2]|0;a[v+(aa+(w<<3&2147483640)+1)>>0]=a[6294+((f|512)+h)>>0]|0;h=d[n+(p+27)>>0]|0;f=c[g+328+(t<<6)+60>>2]|0;a[v+(aa+(w<<3&2147483640)+2)>>0]=a[6294+(m+512+_)>>0]|0;a[v+(aa+(w<<3&2147483640)+3)>>0]=a[6294+(f+512+h)>>0]|0}t=t+1|0}while((t|0)!=24)}while(0);aa=0;i=$;return aa|0}function La(d,e,f){d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;h=a[384+(e<<3)+4>>0]|0;i=a[576+(e<<3)+4>>0]|0;if(11205370>>>e&1){g=b[f+((h&255)<<1)>>1]|0;if(13434828>>>e&1){d=g+1+(b[f+((i&255)<<1)>>1]|0)>>1;return d|0}e=c[d+204>>2]|0;if(!e){d=g;return d|0}if((c[d+4>>2]|0)!=(c[e+4>>2]|0)){d=g;return d|0}d=g+1+(b[e+28+((i&255)<<1)>>1]|0)>>1;return d|0}if(13434828>>>e&1){e=b[f+((i&255)<<1)>>1]|0;g=c[d+200>>2]|0;if(!g){d=e;return d|0}if((c[d+4>>2]|0)!=(c[g+4>>2]|0)){d=e;return d|0}d=e+1+(b[g+28+((h&255)<<1)>>1]|0)>>1;return d|0}e=c[d+200>>2]|0;if((e|0)!=0?(c[d+4>>2]|0)==(c[e+4>>2]|0):0){g=b[e+28+((h&255)<<1)>>1]|0;f=1}else{g=0;f=0}e=c[d+204>>2]|0;if(!e){d=g;return d|0}if((c[d+4>>2]|0)!=(c[e+4>>2]|0)){d=g;return d|0}e=b[e+28+((i&255)<<1)>>1]|0;if(!f){d=e;return d|0}d=g+1+e>>1;return d|0}function Ma(a,b){a=a|0;b=b|0;var e=0,f=0,g=0,h=0,i=0,j=0;g=c[a+4>>2]|0;i=c[a+12>>2]<<3;j=c[a+16>>2]|0;if((i-j|0)>31){f=c[a+8>>2]|0;e=(d[g+1>>0]|0)<<16|(d[g>>0]|0)<<24|(d[g+2>>0]|0)<<8|(d[g+3>>0]|0);if(!f)f=a+8|0;else{e=(d[g+4>>0]|0)>>>(8-f|0)|e<<f;f=a+8|0}}else if((i-j|0)>0){f=c[a+8>>2]|0;e=(d[g>>0]|0)<<f+24;if((i-j+-8+f|0)>0){h=i-j+-8+f|0;f=f+24|0;while(1){g=g+1|0;f=f+-8|0;e=(d[g>>0]|0)<<f|e;if((h|0)<=8){f=a+8|0;break}else h=h+-8|0}}else f=a+8|0}else{e=0;f=a+8|0}c[a+16>>2]=j+b;c[f>>2]=j+b&7;if((j+b|0)>>>0>i>>>0){j=0;a=32-b|0;a=e>>>a;a=j?a:-1;return a|0}c[a+4>>2]=(c[a>>2]|0)+((j+b|0)>>>3);j=1;a=32-b|0;a=e>>>a;a=j?a:-1;return a|0}function Na(a,b){a=a|0;b=b|0;var e=0,f=0,g=0,h=0,i=0,j=0;g=c[a+4>>2]|0;j=c[a+12>>2]<<3;i=c[a+16>>2]|0;if((j-i|0)>31){f=c[a+8>>2]|0;e=(d[g+1>>0]|0)<<16|(d[g>>0]|0)<<24|(d[g+2>>0]|0)<<8|(d[g+3>>0]|0);if(!f)f=7;else{e=(d[g+4>>0]|0)>>>(8-f|0)|e<<f;f=7}}else if((j-i|0)>0){f=c[a+8>>2]|0;e=(d[g>>0]|0)<<f+24;if((j-i+-8+f|0)>0){h=j-i+-8+f|0;f=f+24|0;while(1){g=g+1|0;f=f+-8|0;e=(d[g>>0]|0)<<f|e;if((h|0)<=8){f=7;break}else h=h+-8|0}}else f=7}else{e=0;f=21}do if((f|0)==7){if((e|0)<0){c[a+16>>2]=i+1;c[a+8>>2]=i+1&7;if((i+1|0)>>>0<=j>>>0)c[a+4>>2]=(c[a>>2]|0)+((i+1|0)>>>3);c[b>>2]=0;b=0;return b|0}if(e>>>0>1073741823){c[a+16>>2]=i+3;c[a+8>>2]=i+3&7;if((i+3|0)>>>0>j>>>0){b=1;return b|0}c[a+4>>2]=(c[a>>2]|0)+((i+3|0)>>>3);c[b>>2]=(e>>>29&1)+1;b=0;return b|0}if(e>>>0>536870911){c[a+16>>2]=i+5;c[a+8>>2]=i+5&7;if((i+5|0)>>>0>j>>>0){b=1;return b|0}c[a+4>>2]=(c[a>>2]|0)+((i+5|0)>>>3);c[b>>2]=(e>>>27&3)+3;b=0;return b|0}if(e>>>0<=268435455)if(!(e&134217728)){f=21;break}else{g=4;e=0;break}c[a+16>>2]=i+7;c[a+8>>2]=i+7&7;if((i+7|0)>>>0>j>>>0){b=1;return b|0}c[a+4>>2]=(c[a>>2]|0)+((i+7|0)>>>3);c[b>>2]=(e>>>25&7)+7;b=0;return b|0}while(0);if((f|0)==21){f=134217728;g=0;while(1){h=g+1|0;f=f>>>1;if(!((f|0)!=0&(f&e|0)==0))break;else g=h}e=g+5|0;if((e|0)==32){c[b>>2]=0;e=(c[a+16>>2]|0)+32|0;c[a+16>>2]=e;c[a+8>>2]=e&7;if(e>>>0<=c[a+12>>2]<<3>>>0)c[a+4>>2]=(c[a>>2]|0)+(e>>>3);if((Ma(a,1)|0)!=1){b=1;return b|0}g=c[a+4>>2]|0;i=c[a+12>>2]<<3;j=c[a+16>>2]|0;if((i-j|0)>31){f=c[a+8>>2]|0;e=(d[g+1>>0]|0)<<16|(d[g>>0]|0)<<24|(d[g+2>>0]|0)<<8|(d[g+3>>0]|0);if(f)e=(d[g+4>>0]|0)>>>(8-f|0)|e<<f}else if((i-j|0)>0){f=c[a+8>>2]|0;e=(d[g>>0]|0)<<f+24;if((i-j+-8+f|0)>0){h=i-j+-8+f|0;f=f+24|0;while(1){g=g+1|0;f=f+-8|0;e=(d[g>>0]|0)<<f|e;if((h|0)<=8)break;else h=h+-8|0}}}else e=0;c[a+16>>2]=j+32;c[a+8>>2]=j+32&7;if((j+32|0)>>>0>i>>>0){b=1;return b|0}c[a+4>>2]=(c[a>>2]|0)+((j+32|0)>>>3);switch(e|0){case 0:{c[b>>2]=-1;b=0;return b|0}case 1:{c[b>>2]=-1;b=1;return b|0}default:{b=1;return b|0}}}else{g=e;e=h}}e=e+5+i|0;c[a+16>>2]=e;c[a+8>>2]=e&7;if(e>>>0<=j>>>0)c[a+4>>2]=(c[a>>2]|0)+(e>>>3);e=Ma(a,g)|0;if((e|0)==-1){b=1;return b|0}c[b>>2]=(1<<g)+-1+e;b=0;return b|0}function Oa(a,b,f,g){a=a|0;b=b|0;f=f|0;g=g|0;var h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0;Q=i;i=i+128|0;p=c[a+4>>2]|0;M=c[a+12>>2]<<3;o=c[a+16>>2]|0;if((M-o|0)>31){h=c[a+8>>2]|0;m=(d[p+1>>0]|0)<<16|(d[p>>0]|0)<<24|(d[p+2>>0]|0)<<8|(d[p+3>>0]|0);if(h)m=(d[p+4>>0]|0)>>>(8-h|0)|m<<h}else if((M-o|0)>0){h=c[a+8>>2]|0;m=(d[p>>0]|0)<<h+24;if((M-o+-8+h|0)>0){q=M-o+-8+h|0;h=h+24|0;while(1){p=p+1|0;h=h+-8|0;m=(d[p>>0]|0)<<h|m;if((q|0)<=8)break;else q=q+-8|0}}}else m=0;h=m>>>16;do if(f>>>0<2)if((m|0)>=0){if(m>>>0>201326591){r=e[4160+(m>>>26<<1)>>1]|0;t=31;break}if(m>>>0>16777215){r=e[4224+(m>>>22<<1)>>1]|0;t=31;break}if(m>>>0>2097151){r=e[4320+((m>>>18)+-8<<1)>>1]|0;t=31;break}else{r=e[4432+(h<<1)>>1]|0;t=31;break}}else s=1;else if(f>>>0<4){if((m|0)<0){s=(h&16384|0)!=0?2:2082;break}if(m>>>0>268435455){r=e[4496+(m>>>26<<1)>>1]|0;t=31;break}if(m>>>0>33554431){r=e[4560+(m>>>23<<1)>>1]|0;t=31;break}else{r=e[4624+(m>>>18<<1)>>1]|0;t=31;break}}else{if(f>>>0<8){h=m>>>26;if((h+-8|0)>>>0<56){r=e[4880+(h<<1)>>1]|0;t=31;break}r=e[5008+(m>>>22<<1)>>1]|0;t=31;break}if(f>>>0<17){r=e[5264+(m>>>26<<1)>>1]|0;t=31;break}h=m>>>29;if(h){r=e[5392+(h<<1)>>1]|0;t=31;break}r=e[5408+(m>>>24<<1)>>1]|0;t=31;break}while(0);if((t|0)==31)if(!r){a=1;i=Q;return a|0}else s=r;r=s&31;h=m<<r;K=s>>>11&31;if(K>>>0>g>>>0){a=1;i=Q;return a|0}w=s>>>5&63;do if(K){if(!w){p=32-r|0;m=0}else{do if((32-r|0)>>>0<w>>>0){c[a+16>>2]=o+r;f=o+s&7;c[a+8>>2]=f;if(M>>>0<(o+r|0)>>>0){a=1;i=Q;return a|0}m=c[a>>2]|0;p=(o+r|0)>>>3;c[a+4>>2]=m+p;if((M-(o+r)|0)>31){h=(d[m+(p+1)>>0]|0)<<16|(d[m+p>>0]|0)<<24|(d[m+(p+2)>>0]|0)<<8|(d[m+(p+3)>>0]|0);if(!f){o=o+r|0;r=32;q=h;break}o=o+r|0;r=32;q=(d[m+(p+4)>>0]|0)>>>(8-f|0)|h<<f;break}if((M-(o+r)|0)>0){h=(d[m+p>>0]|0)<<(f|24);if((M-(o+r)+-8+f|0)>0){p=m+p|0;q=M-(o+r)+-8+f|0;m=f|24;while(1){p=p+1|0;m=m+-8|0;h=(d[p>>0]|0)<<m|h;if((q|0)<=8){o=o+r|0;r=32;q=h;break}else q=q+-8|0}}else{o=o+r|0;r=32;q=h}}else{o=o+r|0;r=32;q=0}}else{r=32-r|0;q=h}while(0);h=q>>>(32-w|0);f=0;m=1<<w+-1;do{c[Q+64+(f<<2)>>2]=(m&h|0)!=0?-1:1;m=m>>>1;f=f+1|0}while((m|0)!=0);p=r-w|0;h=q<<w;m=f}a:do if(m>>>0<K>>>0){q=h;v=m;u=K>>>0>10&w>>>0<3&1;b:while(1){do if(p>>>0<16){q=o+(32-p)|0;c[a+16>>2]=q;c[a+8>>2]=q&7;if(M>>>0<q>>>0){L=1;t=158;break b}m=c[a>>2]|0;c[a+4>>2]=m+(q>>>3);if((M-q|0)>31){h=(d[m+((q>>>3)+1)>>0]|0)<<16|(d[m+(q>>>3)>>0]|0)<<24|(d[m+((q>>>3)+2)>>0]|0)<<8|(d[m+((q>>>3)+3)>>0]|0);if(!(q&7)){o=q;s=32;r=h;break}o=q;s=32;r=(d[m+((q>>>3)+4)>>0]|0)>>>(8-(q&7)|0)|h<<(q&7);break}if((M-q|0)<=0){L=1;t=158;break b}h=(d[m+(q>>>3)>>0]|0)<<(q&7|24);if((M-q+-8+(q&7)|0)>0){o=m+(q>>>3)|0;p=M-q+-8+(q&7)|0;m=q&7|24;while(1){o=o+1|0;m=m+-8|0;h=(d[o>>0]|0)<<m|h;if((p|0)<=8){o=q;s=32;r=h;break}else p=p+-8|0}}else{o=q;s=32;r=h}}else{s=p;r=q}while(0);do if((r|0)>=0)if(r>>>0<=1073741823)if(r>>>0<=536870911)if(r>>>0<=268435455)if(r>>>0<=134217727)if(r>>>0<=67108863)if(r>>>0<=33554431)if(r>>>0<=16777215)if(r>>>0>8388607){J=8;t=75}else{if(r>>>0>4194303){J=9;t=75;break}if(r>>>0>2097151){J=10;t=75;break}if(r>>>0>1048575){J=11;t=75;break}if(r>>>0>524287){J=12;t=75;break}if(r>>>0>262143){J=13;t=75;break}if(r>>>0>131071){m=s+-15|0;p=r<<15;h=14;q=u;f=(u|0)!=0?u:4}else{if(r>>>0<65536){L=1;t=158;break b}m=s+-16|0;p=r<<16;h=15;q=(u|0)!=0?u:1;f=12}I=h<<q;G=m;H=(q|0)==0;F=p;E=q;D=f;t=76}else{J=7;t=75}else{J=6;t=75}else{J=5;t=75}else{J=4;t=75}else{J=3;t=75}else{J=2;t=75}else{J=1;t=75}else{J=0;t=75}while(0);if((t|0)==75){t=0;h=J+1|0;p=r<<h;h=s-h|0;m=J<<u;if(!u){C=1;B=o;z=h;A=p;x=m;y=0}else{I=m;G=h;H=0;F=p;E=u;D=u;t=76}}if((t|0)==76){do if(G>>>0<D>>>0){q=o+(32-G)|0;c[a+16>>2]=q;c[a+8>>2]=q&7;if(M>>>0<q>>>0){L=1;t=158;break b}m=c[a>>2]|0;c[a+4>>2]=m+(q>>>3);if((M-q|0)>31){h=(d[m+((q>>>3)+1)>>0]|0)<<16|(d[m+(q>>>3)>>0]|0)<<24|(d[m+((q>>>3)+2)>>0]|0)<<8|(d[m+((q>>>3)+3)>>0]|0);if(!(q&7)){o=q;p=32;break}o=q;p=32;h=(d[m+((q>>>3)+4)>>0]|0)>>>(8-(q&7)|0)|h<<(q&7);break}if((M-q|0)>0){h=(d[m+(q>>>3)>>0]|0)<<(q&7|24);if((M-q+-8+(q&7)|0)>0){o=m+(q>>>3)|0;p=M-q+-8+(q&7)|0;m=q&7|24;while(1){o=o+1|0;m=m+-8|0;h=(d[o>>0]|0)<<m|h;if((p|0)<=8){o=q;p=32;break}else p=p+-8|0}}else{o=q;p=32}}else{o=q;p=32;h=0}}else{p=G;h=F}while(0);C=H;B=o;z=p-D|0;A=h<<D;x=(h>>>(32-D|0))+I|0;y=E}h=w>>>0<3&(v|0)==(w|0)?x+2|0:x;m=C?1:y;c[Q+64+(v<<2)>>2]=(h&1|0)==0?(h+2|0)>>>1:0-((h+2|0)>>>1)|0;v=v+1|0;if(v>>>0>=K>>>0){n=B;l=z;k=A;break a}else{o=B;p=z;q=A;u=((m>>>0<6?((h+2|0)>>>1|0)>(3<<m+-1|0):0)&1)+m|0}}if((t|0)==158){i=Q;return L|0}}else{n=o;l=p;k=h}while(0);if(K>>>0<g>>>0){do if(l>>>0<9){o=n+(32-l)|0;c[a+16>>2]=o;c[a+8>>2]=o&7;if(M>>>0<o>>>0){a=1;i=Q;return a|0}k=c[a>>2]|0;c[a+4>>2]=k+(o>>>3);if((M-o|0)>31){h=(d[k+((o>>>3)+1)>>0]|0)<<16|(d[k+(o>>>3)>>0]|0)<<24|(d[k+((o>>>3)+2)>>0]|0)<<8|(d[k+((o>>>3)+3)>>0]|0);if(!(o&7)){n=o;l=32;k=h;break}n=o;l=32;k=(d[k+((o>>>3)+4)>>0]|0)>>>(8-(o&7)|0)|h<<(o&7);break}if((M-o|0)>0){h=(d[k+(o>>>3)>>0]|0)<<(o&7|24);if((M-o+-8+(o&7)|0)>0){l=k+(o>>>3)|0;m=M-o+-8+(o&7)|0;k=o&7|24;while(1){l=l+1|0;k=k+-8|0;h=(d[l>>0]|0)<<k|h;if((m|0)<=8){n=o;l=32;k=h;break}else m=m+-8|0}}else{n=o;l=32;k=h}}else{n=o;l=32;k=0}}while(0);h=k>>>23;c:do if((g|0)==4)if((k|0)>=0)if((K|0)!=3)if(k>>>0<=1073741823)if((K|0)==2)h=34;else h=k>>>0>536870911?35:51;else h=18;else h=17;else h=1;else{do switch(K|0){case 1:{if(k>>>0>268435455)h=d[5672+(k>>>27)>>0]|0;else h=d[5704+h>>0]|0;break}case 2:{h=d[5736+(k>>>26)>>0]|0;break}case 3:{h=d[5800+(k>>>26)>>0]|0;break}case 4:{h=d[5864+(k>>>27)>>0]|0;break}case 5:{h=d[5896+(k>>>27)>>0]|0;break}case 6:{h=d[5928+(k>>>26)>>0]|0;break}case 7:{h=d[5992+(k>>>26)>>0]|0;break}case 8:{h=d[6056+(k>>>26)>>0]|0;break}case 9:{h=d[6120+(k>>>26)>>0]|0;break}case 10:{h=d[6184+(k>>>27)>>0]|0;break}case 11:{h=d[6216+(k>>>28)>>0]|0;break}case 12:{h=d[6232+(k>>>28)>>0]|0;break}case 13:{h=d[6248+(k>>>29)>>0]|0;break}case 14:{h=d[6256+(k>>>30)>>0]|0;break}default:{h=k>>31&16|1;break c}}while(0);if(!h){a=1;i=Q;return a|0}}while(0);m=h&15;l=l-m|0;k=k<<m;m=h>>>4&15}else m=0;if(!(K+-1|0)){c[b+(m<<2)>>2]=c[Q+64>>2];N=l;O=1<<m;break}h=k;q=0;p=m;d:while(1){if(!p){c[Q+(q<<2)>>2]=1;k=n;P=l;j=0}else{do if(l>>>0<11){o=n+(32-l)|0;c[a+16>>2]=o;c[a+8>>2]=o&7;if(M>>>0<o>>>0){L=1;t=158;break d}k=c[a>>2]|0;c[a+4>>2]=k+(o>>>3);if((M-o|0)>31){h=(d[k+((o>>>3)+1)>>0]|0)<<16|(d[k+(o>>>3)>>0]|0)<<24|(d[k+((o>>>3)+2)>>0]|0)<<8|(d[k+((o>>>3)+3)>>0]|0);if(!(o&7)){n=o;l=32;m=h;break}n=o;l=32;m=(d[k+((o>>>3)+4)>>0]|0)>>>(8-(o&7)|0)|h<<(o&7);break}if((M-o|0)>0){h=(d[k+(o>>>3)>>0]|0)<<(o&7|24);if((M-o+-8+(o&7)|0)>0){l=k+(o>>>3)|0;m=M-o+-8+(o&7)|0;k=o&7|24;while(1){l=l+1|0;k=k+-8|0;h=(d[l>>0]|0)<<k|h;if((m|0)<=8){n=o;l=32;m=h;break}else m=m+-8|0}}else{n=o;l=32;m=h}}else{n=o;l=32;m=0}}else m=h;while(0);switch(p|0){case 1:{h=d[6260+(m>>>31)>>0]|0;break}case 2:{h=d[6262+(m>>>30)>>0]|0;break}case 3:{h=d[6266+(m>>>30)>>0]|0;break}case 4:{h=d[6270+(m>>>29)>>0]|0;break}case 5:{h=d[6278+(m>>>29)>>0]|0;break}case 6:{h=d[6286+(m>>>29)>>0]|0;break}default:{do if(m>>>0<=536870911)if(m>>>0<=268435455)if(m>>>0<=134217727)if(m>>>0<=67108863)if(m>>>0>33554431)h=167;else{if(m>>>0>16777215){h=184;break}if(m>>>0>8388607){h=201;break}if(m>>>0>4194303){h=218;break}h=m>>>0<2097152?0:235}else h=150;else h=133;else h=116;else h=m>>>29<<4^115;while(0);if((h>>>4&15)>>>0>p>>>0){L=1;t=158;break d}}}if(!h){L=1;t=158;break}g=h&15;j=h>>>4&15;c[Q+(q<<2)>>2]=j+1;k=n;P=l-g|0;h=m<<g;j=p-j|0}q=q+1|0;if(q>>>0>=(K+-1|0)>>>0){t=154;break}else{n=k;l=P;p=j}}if((t|0)==154){c[b+(j<<2)>>2]=c[Q+64+(K+-1<<2)>>2];k=K+-2|0;h=1<<j;while(1){j=(c[Q+(k<<2)>>2]|0)+j|0;h=1<<j|h;c[b+(j<<2)>>2]=c[Q+64+(k<<2)>>2];if(!k){N=P;O=h;break}else k=k+-1|0}}else if((t|0)==158){i=Q;return L|0}}else{N=32-r|0;O=0}while(0);h=(c[a+16>>2]|0)+(32-N)|0;c[a+16>>2]=h;c[a+8>>2]=h&7;if(h>>>0>c[a+12>>2]<<3>>>0){a=1;i=Q;return a|0}c[a+4>>2]=(c[a>>2]|0)+(h>>>3);a=O<<16|K<<4;i=Q;return a|0}function Pa(b,e,f){b=b|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0;g=c[e>>2]|0;if((g|0)==16777215)return;h=f>>>0<16?16:8;f=f>>>0<16?f:f&3;f=(Z(c[1216+(f<<2)>>2]|0,h)|0)+(c[1152+(f<<2)>>2]|0)|0;k=c[e+4>>2]|0;j=d[b+(f+1)>>0]|0;a[b+f>>0]=a[6294+(g+512+(d[b+f>>0]|0))>>0]|0;i=c[e+8>>2]|0;g=d[b+(f+2)>>0]|0;a[b+(f+1)>>0]=a[6294+(k+512+j)>>0]|0;j=a[6294+((c[e+12>>2]|0)+512+(d[b+(f+3)>>0]|0))>>0]|0;a[b+(f+2)>>0]=a[6294+(i+512+g)>>0]|0;a[b+(f+3)>>0]=j;j=c[e+20>>2]|0;g=d[b+(f+h+1)>>0]|0;a[b+(f+h)>>0]=a[6294+((c[e+16>>2]|0)+512+(d[b+(f+h)>>0]|0))>>0]|0;i=c[e+24>>2]|0;k=d[b+(f+h+2)>>0]|0;a[b+(f+h+1)>>0]=a[6294+(j+512+g)>>0]|0;g=a[6294+((c[e+28>>2]|0)+512+(d[b+(f+h+3)>>0]|0))>>0]|0;a[b+(f+h+2)>>0]=a[6294+(i+512+k)>>0]|0;a[b+(f+h+3)>>0]=g;f=f+h+h|0;g=c[e+36>>2]|0;k=d[b+(f+1)>>0]|0;a[b+f>>0]=a[6294+((c[e+32>>2]|0)+512+(d[b+f>>0]|0))>>0]|0;i=c[e+40>>2]|0;j=d[b+(f+2)>>0]|0;a[b+(f+1)>>0]=a[6294+(g+512+k)>>0]|0;k=a[6294+((c[e+44>>2]|0)+512+(d[b+(f+3)>>0]|0))>>0]|0;a[b+(f+2)>>0]=a[6294+(i+512+j)>>0]|0;a[b+(f+3)>>0]=k;k=c[e+52>>2]|0;j=d[b+(f+h+1)>>0]|0;a[b+(f+h)>>0]=a[6294+((c[e+48>>2]|0)+512+(d[b+(f+h)>>0]|0))>>0]|0;i=c[e+56>>2]|0;g=d[b+(f+h+2)>>0]|0;a[b+(f+h+1)>>0]=a[6294+(k+512+j)>>0]|0;e=a[6294+((c[e+60>>2]|0)+512+(d[b+(f+h+3)>>0]|0))>>0]|0;a[b+(f+h+2)>>0]=a[6294+(i+512+g)>>0]|0;a[b+(f+h+3)>>0]=e;return}function Qa(a,b,c,d,e,f,g,h,i){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;q=(c|0)<0|(g+c|0)>(e|0)?2:1;p=(h+d|0)<0?0-h|0:d;n=(g+c|0)<0?0-g|0:c;p=(p|0)>(f|0)?f:p;n=(n|0)>(e|0)?e:n;c=(n|0)>0?a+n|0:a;o=c+(Z(p,e)|0)|0;c=(p|0)>0?o:c;o=(n|0)<0?0-n|0:0;n=(n+g|0)>(e|0)?n+g-e|0:0;l=(p|0)<0?0-p|0:0;m=(p+h|0)>(f|0)?p+h-f|0:0;if(l){j=h+-1+((h+d|0)>0?0-(h+d)|0:0)|0;j=(j|0)>(~f|0)?j:~f;a=b;k=0-p|0;while(1){ya[q&3](c,a,o,g-o-n|0,n);k=k+-1|0;if(!k)break;else a=a+i|0}b=b+(Z(j+1+((j|0)<-1?~j:0)|0,i)|0)|0}if((h-l|0)!=(m|0)){d=h+-1-((h+d|0)>0?h+d|0:0)|0;d=(d|0)>(~f|0)?d:~f;d=f+-1+h-d+((d|0)<-1?d+1|0:0)-((h+-1-d|0)<(f|0)?f:h+-1-d|0)|0;j=b;k=c;a=h-l-m|0;while(1){ya[q&3](k,j,o,g-o-n|0,n);a=a+-1|0;if(!a)break;else{j=j+i|0;k=k+e|0}}b=b+(Z(d,i)|0)|0;c=c+(Z(d,e)|0)|0}a=c+(0-e)|0;if(!m)return;else c=p+h-f|0;while(1){ya[q&3](a,b,o,g-o-n|0,n);c=c+-1|0;if(!c)break;else b=b+i|0}return}function Ra(b,c,e,f,g,h,j,k,l){b=b|0;c=c|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;l=l|0;var m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;s=i;i=i+448|0;if(((e|0)>=0?!((f|0)<0|(j+e|0)>>>0>g>>>0):0)?(f+5+k|0)>>>0<=h>>>0:0)h=e;else{Qa(b,s,e,f,g,h,j,k+5|0,j);b=s;h=0;f=0;g=j}f=h+g+(Z(f,g)|0)|0;if(!(k>>>2)){i=s;return}p=g<<2;q=0-g|0;r=g<<1;if(!j){i=s;return}o=c;m=k>>>2;n=b+f|0;l=b+(f+(Z(g,l+2|0)|0))|0;c=b+(f+(g*5|0))|0;while(1){f=o;h=j;b=n;e=l;k=c;while(1){t=d[k+(q<<1)>>0]|0;x=d[k+q>>0]|0;u=d[k+g>>0]|0;y=d[k>>0]|0;v=d[b+r>>0]|0;a[f+48>>0]=((d[6294+(((d[k+r>>0]|0)+16-(u+t)-(u+t<<2)+v+((y+x|0)*20|0)>>5)+512)>>0]|0)+1+(d[e+r>>0]|0)|0)>>>1;w=d[b+g>>0]|0;a[f+32>>0]=((d[6294+((u+16+((x+t|0)*20|0)-(v+y)-(v+y<<2)+w>>5)+512)>>0]|0)+1+(d[e+g>>0]|0)|0)>>>1;u=d[b>>0]|0;a[f+16>>0]=((d[6294+((y+16+((v+t|0)*20|0)-(w+x)-(w+x<<2)+u>>5)+512)>>0]|0)+1+(d[e>>0]|0)|0)>>>1;a[f>>0]=((d[6294+((x+16+((w+v|0)*20|0)-(u+t)-(u+t<<2)+(d[b+q>>0]|0)>>5)+512)>>0]|0)+1+(d[e+q>>0]|0)|0)>>>1;h=h+-1|0;if(!h)break;else{f=f+1|0;b=b+1|0;e=e+1|0;k=k+1|0}}m=m+-1|0;if(!m)break;else{o=o+64|0;n=n+p|0;l=l+p|0;c=c+p|0}}i=s;return}function Sa(b,c,e,f,g,h,j,k,l){b=b|0;c=c|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;l=l|0;var m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;r=i;i=i+448|0;if((e|0)>=0?!((k+f|0)>>>0>h>>>0|((f|0)<0|(e+5+j|0)>>>0>g>>>0)):0)h=g;else{Qa(b,r,e,f,g,h,j+5|0,k,j+5|0);b=r;e=0;f=0;h=j+5|0}if(!k){i=r;return}q=h-j|0;h=b+(e+5+(Z(f,h)|0))|0;while(1){if(j>>>2){e=d[h+-1>>0]|0;m=d[h+-2>>0]|0;g=d[h+-3>>0]|0;f=d[h+-4>>0]|0;b=d[h+-5>>0]|0;p=c+(j>>>2<<2)|0;if(!l){o=h;n=e;e=j>>>2;while(1){s=n+f|0;t=f;f=d[o>>0]|0;a[c>>0]=(g+1+(d[6294+((b+16-s+((m+g|0)*20|0)-(s<<2)+f>>5)+512)>>0]|0)|0)>>>1;s=f+g|0;b=g;g=d[o+1>>0]|0;a[c+1>>0]=(m+1+(d[6294+((t+16+((n+m|0)*20|0)-s-(s<<2)+g>>5)+512)>>0]|0)|0)>>>1;s=g+m|0;t=m;m=d[o+2>>0]|0;a[c+2>>0]=(n+1+(d[6294+((b+16+((f+n|0)*20|0)-s-(s<<2)+m>>5)+512)>>0]|0)|0)>>>1;s=m+n|0;b=d[o+3>>0]|0;a[c+3>>0]=(f+1+(d[6294+((t+16+((g+f|0)*20|0)-s-(s<<2)+b>>5)+512)>>0]|0)|0)>>>1;e=e+-1|0;if(!e)break;else{t=n;c=c+4|0;o=o+4|0;n=b;b=t}}}else{o=h;n=e;e=j>>>2;while(1){t=n+f|0;s=f;f=d[o>>0]|0;a[c>>0]=(m+1+(d[6294+((b+16-t+((m+g|0)*20|0)-(t<<2)+f>>5)+512)>>0]|0)|0)>>>1;t=f+g|0;b=g;g=d[o+1>>0]|0;a[c+1>>0]=(n+1+(d[6294+((s+16+((n+m|0)*20|0)-t-(t<<2)+g>>5)+512)>>0]|0)|0)>>>1;t=g+m|0;s=m;m=d[o+2>>0]|0;a[c+2>>0]=(f+1+(d[6294+((b+16+((f+n|0)*20|0)-t-(t<<2)+m>>5)+512)>>0]|0)|0)>>>1;t=m+n|0;b=d[o+3>>0]|0;a[c+3>>0]=(g+1+(d[6294+((s+16+((g+f|0)*20|0)-t-(t<<2)+b>>5)+512)>>0]|0)|0)>>>1;e=e+-1|0;if(!e)break;else{t=n;c=c+4|0;o=o+4|0;n=b;b=t}}}c=p;h=h+(j>>>2<<2)|0}k=k+-1|0;if(!k)break;else{c=c+(16-j)|0;h=h+q|0}}i=r;return}function Ta(b,c,e,f,g,h,j,k,l){b=b|0;c=c|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;l=l|0;var m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;v=i;i=i+448|0;if(((e|0)>=0?!((f|0)<0|(e+5+j|0)>>>0>g>>>0):0)?(f+5+k|0)>>>0<=h>>>0:0)h=e;else{Qa(b,v,e,f,g,h,j+5|0,k+5|0,j+5|0);b=v;h=0;f=0;g=j+5|0}f=(Z(f,g)|0)+h|0;u=g+(l&1|2)+f|0;m=b+u|0;if(!k){i=v;return}t=g-j|0;h=c;f=b+((Z(g,l>>>1&1|2)|0)+5+f)|0;s=k;while(1){if(j>>>2){c=h;l=f;n=d[f+-1>>0]|0;o=d[f+-2>>0]|0;p=d[f+-3>>0]|0;q=d[f+-4>>0]|0;e=d[f+-5>>0]|0;r=j>>>2;while(1){w=n+q|0;x=q;q=d[l>>0]|0;a[c>>0]=a[6294+((e+16-w+((o+p|0)*20|0)-(w<<2)+q>>5)+512)>>0]|0;w=q+p|0;e=p;p=d[l+1>>0]|0;a[c+1>>0]=a[6294+((x+16+((n+o|0)*20|0)-w-(w<<2)+p>>5)+512)>>0]|0;w=p+o|0;x=o;o=d[l+2>>0]|0;a[c+2>>0]=a[6294+((e+16+((q+n|0)*20|0)-w-(w<<2)+o>>5)+512)>>0]|0;w=o+n|0;e=d[l+3>>0]|0;a[c+3>>0]=a[6294+((x+16+((p+q|0)*20|0)-w-(w<<2)+e>>5)+512)>>0]|0;r=r+-1|0;if(!r)break;else{x=n;c=c+4|0;l=l+4|0;n=e;e=x}}h=h+(j>>>2<<2)|0;f=f+(j>>>2<<2)|0}s=s+-1|0;if(!s)break;else{h=h+(16-j)|0;f=f+t|0}}if(!(k>>>2)){i=v;return}o=g<<2;p=0-g|0;q=g<<1;if(!j){i=v;return}n=h+(16-j-(k<<4))|0;l=b+(u+(g*5|0))|0;c=k>>>2;while(1){f=n;h=m;b=l;e=j;while(1){x=d[b+(p<<1)>>0]|0;t=d[b+p>>0]|0;s=d[b+g>>0]|0;r=d[b>>0]|0;k=d[h+q>>0]|0;u=f+48|0;a[u>>0]=((d[6294+(((d[b+q>>0]|0)+16-(s+x)-(s+x<<2)+k+((r+t|0)*20|0)>>5)+512)>>0]|0)+1+(d[u>>0]|0)|0)>>>1;u=d[h+g>>0]|0;w=f+32|0;a[w>>0]=((d[6294+((s+16+((t+x|0)*20|0)-(k+r)-(k+r<<2)+u>>5)+512)>>0]|0)+1+(d[w>>0]|0)|0)>>>1;w=d[h>>0]|0;s=f+16|0;a[s>>0]=((d[6294+((r+16+((k+x|0)*20|0)-(u+t)-(u+t<<2)+w>>5)+512)>>0]|0)+1+(d[s>>0]|0)|0)>>>1;a[f>>0]=((d[6294+((t+16+((u+k|0)*20|0)-(w+x)-(w+x<<2)+(d[h+p>>0]|0)>>5)+512)>>0]|0)+1+(d[f>>0]|0)|0)>>>1;e=e+-1|0;if(!e)break;else{f=f+1|0;h=h+1|0;b=b+1|0}}c=c+-1|0;if(!c)break;else{n=n+64|0;m=m+o|0;l=l+o|0}}i=v;return}function Ua(b,e,f,g,h,j,k,l,m){b=b|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;l=l|0;m=m|0;var n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;u=i;i=i+1792|0;if(((f|0)>=0?!((g|0)<0|(f+5+k|0)>>>0>h>>>0):0)?(g+5+l|0)>>>0<=j>>>0:0){n=f+5|0;f=h;h=l+5|0}else{Qa(b,u+1344|0,f,g,h,j,k+5|0,l+5|0,k+5|0);b=u+1344|0;n=5;g=0;f=k+5|0;h=l+5|0}if(h){t=f-k|0;j=u;b=b+(n+(Z(g,f)|0))|0;while(1){if(k>>>2){g=j;n=b;o=d[b+-1>>0]|0;p=d[b+-2>>0]|0;q=d[b+-3>>0]|0;r=d[b+-4>>0]|0;f=d[b+-5>>0]|0;s=k>>>2;while(1){v=o+r|0;w=r;r=d[n>>0]|0;c[g>>2]=f-v+((p+q|0)*20|0)-(v<<2)+r;v=r+q|0;f=q;q=d[n+1>>0]|0;c[g+4>>2]=((o+p|0)*20|0)+w-v+q-(v<<2);v=q+p|0;w=p;p=d[n+2>>0]|0;c[g+8>>2]=f-v+p+((r+o|0)*20|0)-(v<<2);v=p+o|0;f=d[n+3>>0]|0;c[g+12>>2]=w-v+f+((q+r|0)*20|0)-(v<<2);s=s+-1|0;if(!s)break;else{w=o;g=g+16|0;n=n+4|0;o=f;f=w}}j=j+(k>>>2<<2<<2)|0;b=b+(k>>>2<<2)|0}h=h+-1|0;if(!h)break;else b=b+t|0}}if(!(l>>>2)){i=u;return}j=u+(k<<2)|0;b=u+((Z(m+2|0,k)|0)+k<<2)|0;f=u+(k*6<<2)|0;q=l>>>2;while(1){if(k){g=e;h=j;n=b;o=f;p=k;while(1){w=c[o+(0-k<<1<<2)>>2]|0;t=c[o+(0-k<<2)>>2]|0;v=c[o+(k<<2)>>2]|0;s=c[o>>2]|0;l=c[h+(k<<1<<2)>>2]|0;a[g+48>>0]=((d[6294+(((c[o+(k<<1<<2)>>2]|0)+512-(v+w)-(v+w<<2)+l+((s+t|0)*20|0)>>10)+512)>>0]|0)+1+(d[6294+(((c[n+(k<<1<<2)>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;m=c[h+(k<<2)>>2]|0;a[g+32>>0]=((d[6294+((v+512+((t+w|0)*20|0)-(l+s)-(l+s<<2)+m>>10)+512)>>0]|0)+1+(d[6294+(((c[n+(k<<2)>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;v=c[h>>2]|0;a[g+16>>0]=((d[6294+((s+512+((l+w|0)*20|0)-(m+t)-(m+t<<2)+v>>10)+512)>>0]|0)+1+(d[6294+(((c[n>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;a[g>>0]=((d[6294+((t+512+((m+l|0)*20|0)-(v+w)-(v+w<<2)+(c[h+(0-k<<2)>>2]|0)>>10)+512)>>0]|0)+1+(d[6294+(((c[n+(0-k<<2)>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;p=p+-1|0;if(!p)break;else{g=g+1|0;h=h+4|0;n=n+4|0;o=o+4|0}}e=e+k|0;j=j+(k<<2)|0;b=b+(k<<2)|0;f=f+(k<<2)|0}q=q+-1|0;if(!q)break;else{e=e+(64-k)|0;j=j+(k*3<<2)|0;b=b+(k*3<<2)|0;f=f+(k*3<<2)|0}}i=u;return}function Va(b,e,f,g,h,j,k,l,m){b=b|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;l=l|0;m=m|0;var n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;u=i;i=i+1792|0;if(((f|0)>=0?!((g|0)<0|(f+5+k|0)>>>0>h>>>0):0)?(g+5+l|0)>>>0<=j>>>0:0)j=f;else{Qa(b,u+1344|0,f,g,h,j,k+5|0,l+5|0,k+5|0);b=u+1344|0;j=0;g=0;h=k+5|0}g=j+h+(Z(g,h)|0)|0;if(l>>>2){r=(h<<2)-k+-5|0;s=0-h|0;t=h<<1;q=u+(k+5<<2)|0;j=b+g|0;b=b+(g+(h*5|0))|0;p=l>>>2;while(1){if(!(k+5|0))g=q;else{g=q;f=j;n=b;o=k+5|0;while(1){v=d[n+(s<<1)>>0]|0;z=d[n+s>>0]|0;w=d[n+h>>0]|0;A=d[n>>0]|0;x=d[f+t>>0]|0;c[g+(k+5<<1<<2)>>2]=(d[n+t>>0]|0)-(w+v)-(w+v<<2)+x+((A+z|0)*20|0);y=d[f+h>>0]|0;c[g+(k+5<<2)>>2]=((z+v|0)*20|0)+w-(x+A)+y-(x+A<<2);w=d[f>>0]|0;c[g>>2]=A-(y+z)+w+((x+v|0)*20|0)-(y+z<<2);c[g+(-5-k<<2)>>2]=z-(w+v)+(d[f+s>>0]|0)+((y+x|0)*20|0)-(w+v<<2);o=o+-1|0;if(!o)break;else{g=g+4|0;f=f+1|0;n=n+1|0}}g=q+(k+5<<2)|0;j=j+(k+5)|0;b=b+(k+5)|0}p=p+-1|0;if(!p)break;else{q=g+((k+5|0)*3<<2)|0;j=j+r|0;b=b+r|0}}}if(!l){i=u;return}g=u+(m+2<<2)|0;j=u+20|0;while(1){if(k>>>2){f=e;h=g;n=j;o=c[j+-4>>2]|0;p=c[j+-8>>2]|0;q=c[j+-12>>2]|0;r=c[j+-16>>2]|0;b=c[j+-20>>2]|0;s=k>>>2;while(1){A=o+r|0;z=r;r=c[n>>2]|0;a[f>>0]=((d[6294+((b+512-A+((p+q|0)*20|0)-(A<<2)+r>>10)+512)>>0]|0)+1+(d[6294+(((c[h>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;A=r+q|0;b=q;q=c[n+4>>2]|0;a[f+1>>0]=((d[6294+((z+512+((o+p|0)*20|0)-A-(A<<2)+q>>10)+512)>>0]|0)+1+(d[6294+(((c[h+4>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;A=q+p|0;z=p;p=c[n+8>>2]|0;a[f+2>>0]=((d[6294+((b+512+((r+o|0)*20|0)-A-(A<<2)+p>>10)+512)>>0]|0)+1+(d[6294+(((c[h+8>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;A=p+o|0;b=c[n+12>>2]|0;a[f+3>>0]=((d[6294+((z+512+((q+r|0)*20|0)-A-(A<<2)+b>>10)+512)>>0]|0)+1+(d[6294+(((c[h+12>>2]|0)+16>>5)+512)>>0]|0)|0)>>>1;s=s+-1|0;if(!s)break;else{A=o;f=f+4|0;h=h+16|0;n=n+16|0;o=b;b=A}}e=e+(k>>>2<<2)|0;g=g+(k>>>2<<2<<2)|0;j=j+(k>>>2<<2<<2)|0}l=l+-1|0;if(!l)break;else{e=e+(16-k)|0;g=g+20|0;j=j+20|0}}i=u;return}function Wa(e,f,g,h,j,k,l,m,n){e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;l=l|0;m=m|0;n=n|0;var o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0;D=i;i=i+1792|0;B=b[f>>1]|0;C=b[f+2>>1]|0;p=c[g+4>>2]<<4;s=c[g+8>>2]<<4;r=(B>>2)+(k+h)|0;q=(C>>2)+(l+j)|0;do switch(c[3328+((B&3)<<4)+((C&3)<<2)>>2]|0){case 0:{Qa(c[g>>2]|0,e+((l<<4)+k)|0,r,q,p,s,m,n,16);o=g;break}case 1:{Ra(c[g>>2]|0,e+((l<<4)+k)|0,r,q+-2|0,p,s,m,n,0);o=g;break}case 2:{o=c[g>>2]|0;if(((r|0)>=0?!((q|0)<2|(r+m|0)>>>0>p>>>0):0)?(q+3+n|0)>>>0<=s>>>0:0){s=o;o=q+-2|0}else{Qa(o,D,r,q+-2|0,p,s,m,n+5|0,m);s=D;r=0;o=0;p=m}o=r+p+(Z(o,p)|0)|0;if((n>>>2|0)!=0?(x=p<<2,y=0-p|0,z=p<<1,(m|0)!=0):0){u=e+((l<<4)+k)|0;v=n>>>2;w=s+o|0;s=s+(o+(p*5|0))|0;while(1){o=u;q=m;r=w;t=s;while(1){C=d[t+(y<<1)>>0]|0;F=d[t+y>>0]|0;B=d[t+p>>0]|0;G=d[t>>0]|0;A=d[r+z>>0]|0;a[o+48>>0]=a[6294+(((d[t+z>>0]|0)+16-(B+C)-(B+C<<2)+A+((G+F|0)*20|0)>>5)+512)>>0]|0;E=d[r+p>>0]|0;a[o+32>>0]=a[6294+((B+16+((F+C|0)*20|0)-(A+G)-(A+G<<2)+E>>5)+512)>>0]|0;B=d[r>>0]|0;a[o+16>>0]=a[6294+((G+16+((A+C|0)*20|0)-(E+F)-(E+F<<2)+B>>5)+512)>>0]|0;a[o>>0]=a[6294+((F+16+((E+A|0)*20|0)-(B+C)-(B+C<<2)+(d[r+y>>0]|0)>>5)+512)>>0]|0;q=q+-1|0;if(!q)break;else{o=o+1|0;r=r+1|0;t=t+1|0}}v=v+-1|0;if(!v)break;else{u=u+64|0;w=w+x|0;s=s+x|0}}}o=g;break}case 3:{Ra(c[g>>2]|0,e+((l<<4)+k)|0,r,q+-2|0,p,s,m,n,1);o=g;break}case 4:{Sa(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q,p,s,m,n,0);o=g;break}case 5:{Ta(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,0);o=g;break}case 6:{Va(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,0);o=g;break}case 7:{Ta(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,2);o=g;break}case 8:{o=c[g>>2]|0;if((r|0)>=2?!((q+n|0)>>>0>s>>>0|((q|0)<0|(r+3+m|0)>>>0>p>>>0)):0){s=o;r=r+-2|0}else{Qa(o,D,r+-2|0,q,p,s,m+5|0,n,m+5|0);s=D;r=0;q=0;p=m+5|0}if(n){z=p-m|0;o=e+((l<<4)+k)|0;p=s+(r+5+(Z(q,p)|0))|0;y=n;while(1){if(m>>>2){r=o;s=p;t=d[p+-1>>0]|0;u=d[p+-2>>0]|0;v=d[p+-3>>0]|0;w=d[p+-4>>0]|0;q=d[p+-5>>0]|0;x=m>>>2;while(1){G=t+w|0;F=w;w=d[s>>0]|0;a[r>>0]=a[6294+((q+16-G+((u+v|0)*20|0)-(G<<2)+w>>5)+512)>>0]|0;G=w+v|0;q=v;v=d[s+1>>0]|0;a[r+1>>0]=a[6294+((F+16+((t+u|0)*20|0)-G-(G<<2)+v>>5)+512)>>0]|0;G=v+u|0;F=u;u=d[s+2>>0]|0;a[r+2>>0]=a[6294+((q+16+((w+t|0)*20|0)-G-(G<<2)+u>>5)+512)>>0]|0;G=u+t|0;q=d[s+3>>0]|0;a[r+3>>0]=a[6294+((F+16+((v+w|0)*20|0)-G-(G<<2)+q>>5)+512)>>0]|0;x=x+-1|0;if(!x)break;else{G=t;r=r+4|0;s=s+4|0;t=q;q=G}}o=o+(m>>>2<<2)|0;p=p+(m>>>2<<2)|0}y=y+-1|0;if(!y)break;else{o=o+(16-m)|0;p=p+z|0}}}o=g;break}case 9:{Ua(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,0);o=g;break}case 10:{o=c[g>>2]|0;if(((r|0)>=2?!((q|0)<2|(r+3+m|0)>>>0>p>>>0):0)?(q+3+n|0)>>>0<=s>>>0:0){s=r+3|0;q=q+-2|0;r=n+5|0}else{Qa(o,D,r+-2|0,q+-2|0,p,s,m+5|0,n+5|0,m+5|0);o=D;s=5;q=0;p=m+5|0;r=n+5|0}if(r){z=p-m|0;y=D+448|0;p=o+(s+(Z(q,p)|0))|0;while(1){if(!(m>>>2))o=y;else{q=y;s=p;t=d[p+-1>>0]|0;u=d[p+-2>>0]|0;v=d[p+-3>>0]|0;w=d[p+-4>>0]|0;o=d[p+-5>>0]|0;x=m>>>2;while(1){G=t+w|0;F=w;w=d[s>>0]|0;c[q>>2]=o-G+((u+v|0)*20|0)-(G<<2)+w;G=w+v|0;o=v;v=d[s+1>>0]|0;c[q+4>>2]=((t+u|0)*20|0)+F-G+v-(G<<2);G=v+u|0;F=u;u=d[s+2>>0]|0;c[q+8>>2]=o-G+u+((w+t|0)*20|0)-(G<<2);G=u+t|0;o=d[s+3>>0]|0;c[q+12>>2]=F-G+o+((v+w|0)*20|0)-(G<<2);x=x+-1|0;if(!x)break;else{G=t;q=q+16|0;s=s+4|0;t=o;o=G}}o=y+(m>>>2<<2<<2)|0;p=p+(m>>>2<<2)|0}r=r+-1|0;if(!r)break;else{y=o;p=p+z|0}}}if(n>>>2){o=e+((l<<4)+k)|0;p=D+448+(m<<2)|0;q=D+448+(m*6<<2)|0;v=n>>>2;while(1){if(m){r=o;s=p;t=q;u=m;while(1){G=c[t+(0-m<<1<<2)>>2]|0;B=c[t+(0-m<<2)>>2]|0;F=c[t+(m<<2)>>2]|0;A=c[t>>2]|0;E=c[s+(m<<1<<2)>>2]|0;a[r+48>>0]=a[6294+(((c[t+(m<<1<<2)>>2]|0)+512-(F+G)-(F+G<<2)+E+((A+B|0)*20|0)>>10)+512)>>0]|0;C=c[s+(m<<2)>>2]|0;a[r+32>>0]=a[6294+((F+512+((B+G|0)*20|0)-(E+A)-(E+A<<2)+C>>10)+512)>>0]|0;F=c[s>>2]|0;a[r+16>>0]=a[6294+((A+512+((E+G|0)*20|0)-(C+B)-(C+B<<2)+F>>10)+512)>>0]|0;a[r>>0]=a[6294+((B+512+((C+E|0)*20|0)-(F+G)-(F+G<<2)+(c[s+(0-m<<2)>>2]|0)>>10)+512)>>0]|0;u=u+-1|0;if(!u)break;else{r=r+1|0;s=s+4|0;t=t+4|0}}o=o+m|0;p=p+(m<<2)|0;q=q+(m<<2)|0}v=v+-1|0;if(!v)break;else{o=o+(64-m)|0;p=p+(m*3<<2)|0;q=q+(m*3<<2)|0}}}o=g;break}case 11:{Ua(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,1);o=g;break}case 12:{Sa(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q,p,s,m,n,1);o=g;break}case 13:{Ta(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,1);o=g;break}case 14:{Va(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,1);o=g;break}default:{Ta(c[g>>2]|0,e+((l<<4)+k)|0,r+-2|0,q+-2|0,p,s,m,n,3);o=g}}while(0);u=e+((k>>>1)+256+(l>>>1<<3))|0;p=c[o>>2]|0;s=c[g+4>>2]|0;t=c[g+8>>2]|0;C=b[f>>1]|0;q=(C>>3)+((k+h|0)>>>1)|0;B=b[f+2>>1]|0;r=(B>>3)+((l+j|0)>>>1)|0;o=Z(s<<8,t)|0;if((C&7|0)!=0&(B&7|0)!=0){if(((q|0)>=0?!((r|0)<0?1:(q+1+(m>>>1)|0)>>>0>s<<3>>>0):0)?(r+1+(n>>>1)|0)>>>0<=t<<3>>>0:0){A=p+o|0;j=s<<3;o=t<<3}else{Qa(p+o|0,D+448|0,q,r,s<<3,t<<3,(m>>>1)+1|0,(n>>>1)+1|0,(m>>>1)+1|0);Qa(p+(o+(Z(t<<3,s<<3)|0))|0,D+448+(Z((n>>>1)+1|0,(m>>>1)+1|0)|0)|0,q,r,s<<3,t<<3,(m>>>1)+1|0,(n>>>1)+1|0,(m>>>1)+1|0);A=D+448|0;q=0;r=0;j=(m>>>1)+1|0;o=(n>>>1)+1|0}t=j<<1;p=j+1|0;s=j+2|0;w=0;do{if(!((m>>>2|0)==0|(n>>>2|0)==0)){u=e+((k>>>1)+256+(l>>>1<<3)+(w<<6))|0;x=A+((Z((Z(w,o)|0)+r|0,j)|0)+q)|0;f=n>>>2;while(1){z=d[x+j>>0]|0;g=(Z(d[x+t>>0]|0,B&7)|0)+(Z(z,8-(B&7)|0)|0)|0;z=Z(z,B&7)|0;v=u;y=x;z=(Z(d[x>>0]|0,8-(B&7)|0)|0)+z|0;h=m>>>2;while(1){F=d[y+p>>0]|0;G=(Z(F,B&7)|0)+(Z(d[y+1>>0]|0,8-(B&7)|0)|0)|0;F=(Z(d[y+(t|1)>>0]|0,B&7)|0)+(Z(F,8-(B&7)|0)|0)|0;H=((Z(z,8-(C&7)|0)|0)+32+(Z(G,C&7)|0)|0)>>>6;a[v+8>>0]=((Z(g,8-(C&7)|0)|0)+32+(Z(F,C&7)|0)|0)>>>6;a[v>>0]=H;H=y;y=y+2|0;E=d[H+s>>0]|0;z=(Z(E,B&7)|0)+(Z(d[y>>0]|0,8-(B&7)|0)|0)|0;g=(Z(d[H+(t+2)>>0]|0,B&7)|0)+(Z(E,8-(B&7)|0)|0)|0;G=((Z(G,8-(C&7)|0)|0)+32+(Z(z,C&7)|0)|0)>>>6;a[v+9>>0]=((Z(F,8-(C&7)|0)|0)+32+(Z(g,C&7)|0)|0)>>>6;a[v+1>>0]=G;h=h+-1|0;if(!h)break;else v=v+2|0}f=f+-1|0;if(!f)break;else{u=u+(16-(m>>>1)+(m>>>2<<1))|0;x=x+((m>>>2<<1)-(m>>>1)+t)|0}}}w=w+1|0}while((w|0)!=2);i=D;return}if(C&7){if((q|0)>=0?!(((n>>>1)+r|0)>>>0>t<<3>>>0|((r|0)<0?1:(q+1+(m>>>1)|0)>>>0>s<<3>>>0)):0){x=p+o|0;f=s<<3;w=t<<3}else{Qa(p+o|0,D+448|0,q,r,s<<3,t<<3,(m>>>1)+1|0,n>>>1,(m>>>1)+1|0);Qa(p+(o+(Z(t<<3,s<<3)|0))|0,D+448+(Z((m>>>1)+1|0,n>>>1)|0)|0,q,r,s<<3,t<<3,(m>>>1)+1|0,n>>>1,(m>>>1)+1|0);x=D+448|0;q=0;r=0;f=(m>>>1)+1|0;w=n>>>1}g=8-(C&7)|0;y=f+1|0;z=f+2|0;if(!((m>>>2|0)==0|(n>>>2|0)==0)){h=(f<<1)-(m>>>1)+(m>>>2<<1)|0;o=u;s=x+((Z(r,f)|0)+q)|0;v=n>>>2;while(1){p=o;t=s;u=m>>>2;while(1){G=d[t>>0]|0;F=d[t+y>>0]|0;E=t;t=t+2|0;H=d[E+1>>0]|0;a[p+8>>0]=(((Z(F,C&7)|0)+(Z(d[E+f>>0]|0,g)|0)<<3)+32|0)>>>6;a[p>>0]=(((Z(H,C&7)|0)+(Z(G,g)|0)<<3)+32|0)>>>6;G=d[t>>0]|0;a[p+9>>0]=(((Z(d[E+z>>0]|0,C&7)|0)+(Z(F,g)|0)<<3)+32|0)>>>6;a[p+1>>0]=(((Z(G,C&7)|0)+(Z(H,g)|0)<<3)+32|0)>>>6;u=u+-1|0;if(!u)break;else p=p+2|0}v=v+-1|0;if(!v)break;else{o=o+((m>>>2<<1)+(16-(m>>>1)))|0;s=s+h|0}}t=e+((k>>>1)+256+(l>>>1<<3)+64)|0;s=x+((Z(r+w|0,f)|0)+q)|0;r=n>>>2;while(1){o=t;p=s;q=m>>>2;while(1){G=d[p>>0]|0;F=d[p+y>>0]|0;E=p;p=p+2|0;H=d[E+1>>0]|0;a[o+8>>0]=(((Z(F,C&7)|0)+(Z(d[E+f>>0]|0,g)|0)<<3)+32|0)>>>6;a[o>>0]=(((Z(H,C&7)|0)+(Z(G,g)|0)<<3)+32|0)>>>6;G=d[p>>0]|0;a[o+9>>0]=(((Z(d[E+z>>0]|0,C&7)|0)+(Z(F,g)|0)<<3)+32|0)>>>6;a[o+1>>0]=(((Z(G,C&7)|0)+(Z(H,g)|0)<<3)+32|0)>>>6;q=q+-1|0;if(!q)break;else o=o+2|0}r=r+-1|0;if(!r)break;else{t=t+((m>>>2<<1)+(16-(m>>>1)))|0;s=s+h|0}}}i=D;return}if(!(B&7)){Qa(p+o|0,u,q,r,s<<3,t<<3,m>>>1,n>>>1,8);Qa(p+((Z(t<<3,s<<3)|0)+o)|0,e+((k>>>1)+256+(l>>>1<<3)+64)|0,q,r,s<<3,t<<3,m>>>1,n>>>1,8);i=D;return}if(((q|0)>=0?!((r|0)<0?1:((m>>>1)+q|0)>>>0>s<<3>>>0):0)?(r+1+(n>>>1)|0)>>>0<=t<<3>>>0:0){x=p+o|0;h=s<<3;w=t<<3}else{Qa(p+o|0,D+448|0,q,r,s<<3,t<<3,m>>>1,(n>>>1)+1|0,m>>>1);Qa(p+(o+(Z(t<<3,s<<3)|0))|0,D+448+(Z((n>>>1)+1|0,m>>>1)|0)|0,q,r,s<<3,t<<3,m>>>1,(n>>>1)+1|0,m>>>1);x=D+448|0;q=0;r=0;h=m>>>1;w=(n>>>1)+1|0}z=8-(B&7)|0;g=h<<1;y=h+1|0;if(!((m>>>2|0)==0|(n>>>2|0)==0)){o=u;s=x+((Z(r,h)|0)+q)|0;v=n>>>2;while(1){p=o;t=s;u=m>>>2;while(1){H=d[t+h>>0]|0;G=d[t>>0]|0;a[p+8>>0]=(((Z(H,z)|0)+(Z(d[t+g>>0]|0,B&7)|0)<<3)+32|0)>>>6;a[p>>0]=(((Z(G,z)|0)+(Z(H,B&7)|0)<<3)+32|0)>>>6;H=d[t+y>>0]|0;G=d[t+1>>0]|0;a[p+9>>0]=(((Z(H,z)|0)+(Z(d[t+(g|1)>>0]|0,B&7)|0)<<3)+32|0)>>>6;a[p+1>>0]=(((Z(G,z)|0)+(Z(H,B&7)|0)<<3)+32|0)>>>6;u=u+-1|0;if(!u)break;else{p=p+2|0;t=t+2|0}}v=v+-1|0;if(!v)break;else{o=o+((m>>>2<<1)+(16-(m>>>1)))|0;s=s+(g-(m>>>1)+(m>>>2<<1))|0}}t=e+((k>>>1)+256+(l>>>1<<3)+64)|0;s=x+((Z(r+w|0,h)|0)+q)|0;r=n>>>2;while(1){o=t;p=s;q=m>>>2;while(1){H=d[p+h>>0]|0;G=d[p>>0]|0;a[o+8>>0]=(((Z(H,z)|0)+(Z(d[p+g>>0]|0,B&7)|0)<<3)+32|0)>>>6;a[o>>0]=(((Z(G,z)|0)+(Z(H,B&7)|0)<<3)+32|0)>>>6;H=d[p+y>>0]|0;G=d[p+1>>0]|0;a[o+9>>0]=(((Z(H,z)|0)+(Z(d[p+(g|1)>>0]|0,B&7)|0)<<3)+32|0)>>>6;a[o+1>>0]=(((Z(G,z)|0)+(Z(H,B&7)|0)<<3)+32|0)>>>6;q=q+-1|0;if(!q)break;else{o=o+2|0;p=p+2|0}}r=r+-1|0;if(!r)break;else{t=t+((m>>>2<<1)+(16-(m>>>1)))|0;s=s+(g-(m>>>1)+(m>>>2<<1))|0}}}i=D;return}function Xa(b,c,d,e,f){b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;if(d){xb(c|0,a[b>>0]|0,d|0)|0;c=c+d|0}if(e){d=e;g=b;h=c;while(1){a[h>>0]=a[g>>0]|0;d=d+-1|0;if(!d)break;else{g=g+1|0;h=h+1|0}}b=b+e|0;c=c+e|0}if(!f)return;xb(c|0,a[b+-1>>0]|0,f|0)|0;return}function Ya(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;yb(b|0,a|0,d|0)|0;return}function Za(a,b,d,e,f,g,h,i){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;w=c[a+8>>2]|0;x=c[w>>2]|0;if((x|0)!=(d|0))return;c[a+52>>2]=0;v=c[a+56>>2]|0;do if(!b){c[w+20>>2]=0;c[w+12>>2]=e;c[w+8>>2]=e;c[w+16>>2]=f;c[w+24>>2]=(v|0)==0&1;if(!v){j=(c[a+44>>2]|0)+1|0;c[a+44>>2]=j;c[w+36>>2]=g;c[w+28>>2]=h;c[w+32>>2]=i;n=a+44|0;u=108;break}else{c[w+36>>2]=g;c[w+28>>2]=h;c[w+32>>2]=i;u=110;break}}else{do if(!g){if(!(c[b+8>>2]|0)){j=c[a+40>>2]|0;d=c[a+24>>2]|0;if(j>>>0>=d>>>0)if(j){m=c[a>>2]|0;n=0;k=-1;l=0;do{if(((c[m+(n*40|0)+20>>2]|0)+-1|0)>>>0<2){b=c[m+(n*40|0)+8>>2]|0;u=(k|0)==-1|(b|0)<(l|0);k=u?n:k;l=u?b:l}n=n+1|0}while((n|0)!=(j|0));if((k|0)>-1){c[m+(k*40|0)+20>>2]=0;c[a+40>>2]=j+-1;if(!(c[m+(k*40|0)+24>>2]|0)){c[a+44>>2]=(c[a+44>>2]|0)+-1;k=a+40|0;j=j+-1|0}else{k=a+40|0;j=j+-1|0}}else k=a+40|0}else{k=a+40|0;j=0}else k=a+40|0}else{d=v;r=v;s=0;k=0;a:while(1){switch(c[b+12+(s*20|0)>>2]|0){case 6:{n=c[b+12+(s*20|0)+12>>2]|0;q=c[a+36>>2]|0;if((q|0)==65535|q>>>0<n>>>0)break a;o=c[a+24>>2]|0;b:do if(o){m=c[a>>2]|0;l=0;while(1){j=m+(l*40|0)+20|0;if((c[j>>2]|0)==3?(c[m+(l*40|0)+8>>2]|0)==(n|0):0)break;j=l+1|0;if(j>>>0<o>>>0)l=j;else{u=89;break b}}c[j>>2]=0;j=(c[a+40>>2]|0)+-1|0;c[a+40>>2]=j;if(!(c[m+(l*40|0)+24>>2]|0))c[a+44>>2]=(c[a+44>>2]|0)+-1}else u=89;while(0);if((u|0)==89){u=0;j=c[a+40>>2]|0}if(j>>>0>=o>>>0)break a;c[w+12>>2]=e;c[w+8>>2]=n;c[w+16>>2]=f;c[w+20>>2]=3;c[w+24>>2]=(d|0)==0&1;c[a+40>>2]=j+1;c[a+44>>2]=(c[a+44>>2]|0)+1;j=r;k=1;break}case 1:{m=e-(c[b+12+(s*20|0)+4>>2]|0)|0;n=c[a+24>>2]|0;if(!n)break a;o=c[a>>2]|0;j=0;while(1){l=o+(j*40|0)+20|0;if(((c[l>>2]|0)+-1|0)>>>0<2?(c[o+(j*40|0)+8>>2]|0)==(m|0):0)break;j=j+1|0;if(j>>>0>=n>>>0)break a}if((j|0)<0)break a;c[l>>2]=0;c[a+40>>2]=(c[a+40>>2]|0)+-1;if(!(c[o+(j*40|0)+24>>2]|0)){c[a+44>>2]=(c[a+44>>2]|0)+-1;j=r}else j=r;break}case 2:{m=c[b+12+(s*20|0)+8>>2]|0;n=c[a+24>>2]|0;if(!n)break a;o=c[a>>2]|0;j=0;while(1){l=o+(j*40|0)+20|0;if((c[l>>2]|0)==3?(c[o+(j*40|0)+8>>2]|0)==(m|0):0)break;j=j+1|0;if(j>>>0>=n>>>0)break a}if((j|0)<0)break a;c[l>>2]=0;c[a+40>>2]=(c[a+40>>2]|0)+-1;if(!(c[o+(j*40|0)+24>>2]|0)){c[a+44>>2]=(c[a+44>>2]|0)+-1;j=r}else j=r;break}case 3:{j=c[b+12+(s*20|0)+4>>2]|0;o=c[b+12+(s*20|0)+12>>2]|0;q=c[a+36>>2]|0;if((q|0)==65535|q>>>0<o>>>0)break a;p=c[a+24>>2]|0;if(!p)break a;q=c[a>>2]|0;n=0;while(1){l=q+(n*40|0)+20|0;if((c[l>>2]|0)==3?(c[q+(n*40|0)+8>>2]|0)==(o|0):0){u=48;break}m=n+1|0;if(m>>>0<p>>>0)n=m;else break}if((u|0)==48?(u=0,c[l>>2]=0,c[a+40>>2]=(c[a+40>>2]|0)+-1,(c[q+(n*40|0)+24>>2]|0)==0):0)c[a+44>>2]=(c[a+44>>2]|0)+-1;n=e-j|0;j=0;while(1){l=q+(j*40|0)+20|0;m=c[l>>2]|0;if((m+-1|0)>>>0<2?(t=q+(j*40|0)+8|0,(c[t>>2]|0)==(n|0)):0)break;j=j+1|0;if(j>>>0>=p>>>0)break a}if(!((j|0)>-1&m>>>0>1))break a;c[l>>2]=3;c[t>>2]=o;j=r;break}case 4:{m=c[b+12+(s*20|0)+16>>2]|0;c[a+36>>2]=m;n=c[a+24>>2]|0;if(!n)j=r;else{o=c[a>>2]|0;j=m;p=0;do{l=o+(p*40|0)+20|0;do if((c[l>>2]|0)==3){if((c[o+(p*40|0)+8>>2]|0)>>>0<=m>>>0)if((j|0)==65535)j=65535;else break;c[l>>2]=0;c[a+40>>2]=(c[a+40>>2]|0)+-1;if(!(c[o+(p*40|0)+24>>2]|0))c[a+44>>2]=(c[a+44>>2]|0)+-1}while(0);p=p+1|0}while((p|0)!=(n|0));j=r}break}case 5:{n=c[a>>2]|0;e=0;do{j=n+(e*40|0)+20|0;if((c[j>>2]|0)!=0?(c[j>>2]=0,(c[n+(e*40|0)+24>>2]|0)==0):0)c[a+44>>2]=(c[a+44>>2]|0)+-1;e=e+1|0}while((e|0)!=16);c:do if(!d){l=c[a+28>>2]|0;m=r;while(1){e=0;d=2147483647;j=0;do{if(c[n+(e*40|0)+24>>2]|0){q=c[n+(e*40|0)+16>>2]|0;r=(q|0)<(d|0);d=r?q:d;j=r?n+(e*40|0)|0:j}e=e+1|0}while(e>>>0<=l>>>0);if(!j){j=m;d=0;break c}r=c[a+16>>2]|0;q=c[a+12>>2]|0;c[q+(r<<4)>>2]=c[j>>2];c[q+(r<<4)+12>>2]=c[j+36>>2];c[q+(r<<4)+4>>2]=c[j+28>>2];c[q+(r<<4)+8>>2]=c[j+32>>2];c[a+16>>2]=r+1;c[j+24>>2]=0;if(!(c[j+20>>2]|0))c[a+44>>2]=(c[a+44>>2]|0)+-1;if(!m)m=0;else{j=m;d=m;break}}}else j=r;while(0);c[a+40>>2]=0;c[a+36>>2]=65535;c[a+48>>2]=0;c[a+52>>2]=1;e=0;break}default:break a}r=j;s=s+1|0}if(k)break;k=a+40|0;j=c[a+40>>2]|0;d=c[a+24>>2]|0}if(j>>>0<d>>>0){c[w+12>>2]=e;c[w+8>>2]=e;c[w+16>>2]=f;c[w+20>>2]=2;c[w+24>>2]=(v|0)==0&1;c[a+44>>2]=(c[a+44>>2]|0)+1;c[k>>2]=j+1}}else{c[a+20>>2]=0;c[a+16>>2]=0;m=c[a>>2]|0;j=0;do{d=m+(j*40|0)+20|0;if((c[d>>2]|0)!=0?(c[d>>2]=0,(c[m+(j*40|0)+24>>2]|0)==0):0)c[a+44>>2]=(c[a+44>>2]|0)+-1;j=j+1|0}while((j|0)!=16);d:do if(!v){l=c[a+28>>2]|0;d=0;while(1){k=0;j=2147483647;e=0;do{if(c[m+(k*40|0)+24>>2]|0){u=c[m+(k*40|0)+16>>2]|0;f=(u|0)<(j|0);j=f?u:j;e=f?m+(k*40|0)|0:e}k=k+1|0}while(k>>>0<=l>>>0);if(!e)break d;f=c[a+12>>2]|0;c[f+(d<<4)>>2]=c[e>>2];c[f+(d<<4)+12>>2]=c[e+36>>2];c[f+(d<<4)+4>>2]=c[e+28>>2];c[f+(d<<4)+8>>2]=c[e+32>>2];d=d+1|0;c[a+16>>2]=d;c[e+24>>2]=0;if(c[e+20>>2]|0)continue;c[a+44>>2]=(c[a+44>>2]|0)+-1}}while(0);c[a+40>>2]=0;c[a+36>>2]=65535;c[a+48>>2]=0;if((c[b>>2]|0)!=0|(v|0)==0^1){c[a+16>>2]=0;c[a+20>>2]=0}f=(c[b+4>>2]|0)==0;c[w+20>>2]=f?2:3;c[a+36>>2]=f?65535:0;c[w+12>>2]=0;c[w+8>>2]=0;c[w+16>>2]=0;c[w+24>>2]=(v|0)==0&1;c[a+44>>2]=1;c[a+40>>2]=1}while(0);c[w+36>>2]=g;c[w+28>>2]=h;c[w+32>>2]=i;if(!v){n=a+44|0;j=c[a+44>>2]|0;u=108}else u=110}while(0);if((u|0)==108){d=c[a+28>>2]|0;if(j>>>0>d>>>0){m=c[a>>2]|0;do{l=0;e=2147483647;k=0;do{if(c[m+(l*40|0)+24>>2]|0){g=c[m+(l*40|0)+16>>2]|0;i=(g|0)<(e|0);e=i?g:e;k=i?m+(l*40|0)|0:k}l=l+1|0}while(l>>>0<=d>>>0);if((k|0)!=0?(i=c[a+16>>2]|0,g=c[a+12>>2]|0,c[g+(i<<4)>>2]=c[k>>2],c[g+(i<<4)+12>>2]=c[k+36>>2],c[g+(i<<4)+4>>2]=c[k+28>>2],c[g+(i<<4)+8>>2]=c[k+32>>2],c[a+16>>2]=i+1,c[k+24>>2]=0,(c[k+20>>2]|0)==0):0){j=j+-1|0;c[n>>2]=j}}while(j>>>0>d>>>0)}}else if((u|0)==110){d=c[a+16>>2]|0;w=c[a+12>>2]|0;c[w+(d<<4)>>2]=x;c[w+(d<<4)+12>>2]=g;c[w+(d<<4)+4>>2]=h;c[w+(d<<4)+8>>2]=i;c[a+16>>2]=d+1;d=c[a+28>>2]|0}_a(c[a>>2]|0,d+1|0);return}function _a(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0;s=i;i=i+16|0;q=7;do{if(q>>>0<b>>>0){p=q;do{n=a+(p*40|0)|0;m=c[n>>2]|0;n=c[n+4>>2]|0;o=c[a+(p*40|0)+8>>2]|0;j=a+(p*40|0)+12|0;h=c[j>>2]|0;j=c[j+4>>2]|0;k=c[a+(p*40|0)+20>>2]|0;l=c[a+(p*40|0)+24>>2]|0;g=a+(p*40|0)+28|0;c[s>>2]=c[g>>2];c[s+4>>2]=c[g+4>>2];c[s+8>>2]=c[g+8>>2];a:do if(p>>>0<q>>>0){e=p;r=9}else{b:do if(!k)if(!l)e=p;else{d=p;while(1){e=d-q|0;if(c[a+(e*40|0)+20>>2]|0){e=d;break b}if(c[a+(e*40|0)+24>>2]|0){e=d;break b}d=a+(d*40|0)|0;f=a+(e*40|0)|0;g=d+40|0;do{c[d>>2]=c[f>>2];d=d+4|0;f=f+4|0}while((d|0)<(g|0));if(e>>>0<q>>>0){r=9;break a}else d=e}}else{g=p;while(1){e=g-q|0;d=c[a+(e*40|0)+20>>2]|0;do if(d){if((d+-1|k+-1)>>>0<2){f=c[a+(e*40|0)+8>>2]|0;if((f|0)>(o|0)){e=g;break b}d=a+(g*40|0)|0;if((f|0)<(o|0))break;else{e=g;break a}}if((d+-1|0)>>>0<2){e=g;break b}if((k+-1|0)>>>0>=2?(c[a+(e*40|0)+8>>2]|0)<=(o|0):0){e=g;break b}else r=17}else r=17;while(0);if((r|0)==17){r=0;d=a+(g*40|0)|0}f=a+(e*40|0)|0;g=d+40|0;do{c[d>>2]=c[f>>2];d=d+4|0;f=f+4|0}while((d|0)<(g|0));if(e>>>0<q>>>0){r=9;break a}else g=e}}while(0);d=a+(e*40|0)|0}while(0);if((r|0)==9){r=0;d=a+(e*40|0)|0}g=d;c[g>>2]=m;c[g+4>>2]=n;c[a+(e*40|0)+8>>2]=o;o=a+(e*40|0)+12|0;c[o>>2]=h;c[o+4>>2]=j;c[a+(e*40|0)+20>>2]=k;c[a+(e*40|0)+24>>2]=l;o=a+(e*40|0)+28|0;c[o>>2]=c[s>>2];c[o+4>>2]=c[s+4>>2];c[o+8>>2]=c[s+8>>2];p=p+1|0}while((p|0)!=(b|0))}q=q>>>1}while((q|0)!=0);i=s;return}function $a(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;e=c[a+4>>2]|0;f=c[a+16>>2]|0;g=c[a+20>>2]|0;h=16;a=c[a+12>>2]|0;d=b;while(1){i=c[d+4>>2]|0;c[a>>2]=c[d>>2];c[a+4>>2]=i;i=c[d+12>>2]|0;c[a+8>>2]=c[d+8>>2];c[a+12>>2]=i;h=h+-1|0;if(!h)break;else{a=a+(e<<2<<2)|0;d=d+16|0}}d=c[b+260>>2]|0;c[f>>2]=c[b+256>>2];c[f+4>>2]=d;d=c[b+268>>2]|0;c[f+((e<<1&2147483646)<<2)>>2]=c[b+264>>2];c[f+((e<<1&2147483646|1)<<2)>>2]=d;d=c[b+276>>2]|0;c[f+(e<<2<<2)>>2]=c[b+272>>2];c[f+((e<<2|1)<<2)>>2]=d;d=(e<<1&2147483646)+(e<<2)|0;h=c[b+284>>2]|0;c[f+(d<<2)>>2]=c[b+280>>2];c[f+((d|1)<<2)>>2]=h;h=c[b+292>>2]|0;c[f+(d+(e<<1&2147483646)<<2)>>2]=c[b+288>>2];c[f+((d+(e<<1&2147483646)|1)<<2)>>2]=h;h=d+(e<<1&2147483646)+(e<<1&2147483646)|0;i=c[b+300>>2]|0;c[f+(h<<2)>>2]=c[b+296>>2];c[f+((h|1)<<2)>>2]=i;i=c[b+308>>2]|0;c[f+(h+(e<<1&2147483646)<<2)>>2]=c[b+304>>2];c[f+((h+(e<<1&2147483646)|1)<<2)>>2]=i;i=h+(e<<1&2147483646)+(e<<1&2147483646)|0;a=c[b+316>>2]|0;c[f+(i<<2)>>2]=c[b+312>>2];c[f+((i|1)<<2)>>2]=a;f=c[b+324>>2]|0;c[g>>2]=c[b+320>>2];c[g+4>>2]=f;f=c[b+332>>2]|0;c[g+((e<<1&2147483646)<<2)>>2]=c[b+328>>2];c[g+((e<<1&2147483646|1)<<2)>>2]=f;f=c[b+340>>2]|0;c[g+(e<<2<<2)>>2]=c[b+336>>2];c[g+((e<<2|1)<<2)>>2]=f;f=c[b+348>>2]|0;c[g+(d<<2)>>2]=c[b+344>>2];c[g+((d|1)<<2)>>2]=f;f=c[b+356>>2]|0;c[g+(d+(e<<1&2147483646)<<2)>>2]=c[b+352>>2];c[g+((d+(e<<1&2147483646)|1)<<2)>>2]=f;f=c[b+364>>2]|0;c[g+(h<<2)>>2]=c[b+360>>2];c[g+((h|1)<<2)>>2]=f;f=c[b+372>>2]|0;c[g+(h+(e<<1&2147483646)<<2)>>2]=c[b+368>>2];c[g+((h+(e<<1&2147483646)|1)<<2)>>2]=f;h=c[b+380>>2]|0;c[g+(i<<2)>>2]=c[b+376>>2];c[g+((i|1)<<2)>>2]=h;return}function ab(b,e,f,g){b=b|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;if(e>>>0<4){p=d[(c[f>>2]|0)+(e+-1)>>0]|0;o=4;while(1){e=b+-2|0;k=b+-1|0;i=b+1|0;l=a[i>>0]|0;m=d[k>>0]|0;n=d[b>>0]|0;if((((m-n|0)<0?0-(m-n)|0:m-n|0)>>>0<(c[f+4>>2]|0)>>>0?(q=d[e>>0]|0,r=c[f+8>>2]|0,((q-m|0)<0?0-(q-m)|0:q-m|0)>>>0<r>>>0):0)?(((l&255)-n|0)<0?0-((l&255)-n)|0:(l&255)-n|0)>>>0<r>>>0:0){j=a[b+2>>0]|0;h=d[b+-3>>0]|0;if(((h-m|0)<0?0-(h-m)|0:h-m|0)>>>0<r>>>0){a[e>>0]=((((m+1+n|0)>>>1)-(q<<1)+h>>1|0)<(0-p|0)?0-p|0:(((m+1+n|0)>>>1)-(q<<1)+h>>1|0)>(p|0)?p:((m+1+n|0)>>>1)-(q<<1)+h>>1)+q;h=c[f+8>>2]|0;e=p+1|0}else{h=r;e=p}if((((j&255)-n|0)<0?0-((j&255)-n)|0:(j&255)-n|0)>>>0<h>>>0){a[i>>0]=((((m+1+n|0)>>>1)-((l&255)<<1)+(j&255)>>1|0)<(0-p|0)?0-p|0:(((m+1+n|0)>>>1)-((l&255)<<1)+(j&255)>>1|0)>(p|0)?p:((m+1+n|0)>>>1)-((l&255)<<1)+(j&255)>>1)+(l&255);e=e+1|0}s=0-e|0;s=(4-(l&255)+(n-m<<2)+q>>3|0)<(s|0)?s:(4-(l&255)+(n-m<<2)+q>>3|0)>(e|0)?e:4-(l&255)+(n-m<<2)+q>>3;t=a[6294+((n|512)-s)>>0]|0;a[k>>0]=a[6294+(s+(m|512))>>0]|0;a[b>>0]=t}o=o+-1|0;if(!o)break;else b=b+g|0}return}r=4;while(1){i=b+-2|0;j=b+-1|0;k=b+1|0;l=a[k>>0]|0;m=d[j>>0]|0;n=d[b>>0]|0;e=(m-n|0)<0?0-(m-n)|0:m-n|0;h=c[f+4>>2]|0;do if((e>>>0<h>>>0?(s=d[i>>0]|0,t=c[f+8>>2]|0,((s-m|0)<0?0-(s-m)|0:s-m|0)>>>0<t>>>0):0)?(((l&255)-n|0)<0?0-((l&255)-n)|0:(l&255)-n|0)>>>0<t>>>0:0){o=b+-3|0;p=b+2|0;q=a[p>>0]|0;if(e>>>0<((h>>>2)+2|0)>>>0){e=d[o>>0]|0;if(((e-m|0)<0?0-(e-m)|0:e-m|0)>>>0<t>>>0){a[j>>0]=((l&255)+4+(n+m+s<<1)+e|0)>>>3;a[i>>0]=(n+m+s+2+e|0)>>>2;a[o>>0]=(n+m+s+4+(e*3|0)+((d[b+-4>>0]|0)<<1)|0)>>>3}else a[j>>0]=(m+2+(l&255)+(s<<1)|0)>>>2;if((((q&255)-n|0)<0?0-((q&255)-n)|0:(q&255)-n|0)>>>0<(c[f+8>>2]|0)>>>0){a[b>>0]=((n+m+(l&255)<<1)+4+s+(q&255)|0)>>>3;a[k>>0]=(n+m+(l&255)+2+(q&255)|0)>>>2;a[p>>0]=(n+m+(l&255)+4+((q&255)*3|0)+((d[b+3>>0]|0)<<1)|0)>>>3;break}}else a[j>>0]=(m+2+(l&255)+(s<<1)|0)>>>2;a[b>>0]=(n+2+((l&255)<<1)+s|0)>>>2}while(0);r=r+-1|0;if(!r)break;else b=b+g|0}return}function bb(b,e,f,g){b=b|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0;p=d[(c[f>>2]|0)+(e+-1)>>0]|0;q=Z(g,-3)|0;o=4;while(1){e=b+(0-g<<1)|0;k=b+(0-g)|0;j=b+g|0;l=a[j>>0]|0;m=d[k>>0]|0;n=d[b>>0]|0;if((((m-n|0)<0?0-(m-n)|0:m-n|0)>>>0<(c[f+4>>2]|0)>>>0?(r=d[e>>0]|0,s=c[f+8>>2]|0,((r-m|0)<0?0-(r-m)|0:r-m|0)>>>0<s>>>0):0)?(((l&255)-n|0)<0?0-((l&255)-n)|0:(l&255)-n|0)>>>0<s>>>0:0){h=d[b+q>>0]|0;if(((h-m|0)<0?0-(h-m)|0:h-m|0)>>>0<s>>>0){a[e>>0]=((((m+1+n|0)>>>1)-(r<<1)+h>>1|0)<(0-p|0)?0-p|0:(((m+1+n|0)>>>1)-(r<<1)+h>>1|0)>(p|0)?p:((m+1+n|0)>>>1)-(r<<1)+h>>1)+r;i=c[f+8>>2]|0;e=p+1|0}else{i=s;e=p}h=d[b+(g<<1)>>0]|0;if(((h-n|0)<0?0-(h-n)|0:h-n|0)>>>0<i>>>0){a[j>>0]=((((m+1+n|0)>>>1)-((l&255)<<1)+h>>1|0)<(0-p|0)?0-p|0:(((m+1+n|0)>>>1)-((l&255)<<1)+h>>1|0)>(p|0)?p:((m+1+n|0)>>>1)-((l&255)<<1)+h>>1)+(l&255);e=e+1|0}j=0-e|0;l=(4-(l&255)+(n-m<<2)+r>>3|0)<(j|0)?j:(4-(l&255)+(n-m<<2)+r>>3|0)>(e|0)?e:4-(l&255)+(n-m<<2)+r>>3;n=a[6294+((n|512)-l)>>0]|0;a[k>>0]=a[6294+(l+(m|512))>>0]|0;a[b>>0]=n}o=o+-1|0;if(!o)break;else b=b+1|0}return}function cb(b,e,f,g){b=b|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0;j=a[b+1>>0]|0;k=d[b+-1>>0]|0;l=d[b>>0]|0;do if((((k-l|0)<0?0-(k-l)|0:k-l|0)>>>0<(c[f+4>>2]|0)>>>0?(h=d[b+-2>>0]|0,i=c[f+8>>2]|0,((h-k|0)<0?0-(h-k)|0:h-k|0)>>>0<i>>>0):0)?(((j&255)-l|0)<0?0-((j&255)-l)|0:(j&255)-l|0)>>>0<i>>>0:0)if(e>>>0<4){i=d[(c[f>>2]|0)+(e+-1)>>0]|0;j=(4-(j&255)+(l-k<<2)+h>>3|0)<(~i|0)?~i:(4-(j&255)+(l-k<<2)+h>>3|0)>(i+1|0)?i+1|0:4-(j&255)+(l-k<<2)+h>>3;l=a[6294+((l|512)-j)>>0]|0;a[b+-1>>0]=a[6294+(j+(k|512))>>0]|0;a[b>>0]=l;break}else{a[b+-1>>0]=(k+2+(j&255)+(h<<1)|0)>>>2;a[b>>0]=(l+2+((j&255)<<1)+h|0)>>>2;break}while(0);h=d[b+(g+-1)>>0]|0;i=d[b+g>>0]|0;if(((h-i|0)<0?0-(h-i)|0:h-i|0)>>>0>=(c[f+4>>2]|0)>>>0)return;j=d[b+(g+-2)>>0]|0;k=c[f+8>>2]|0;if(((j-h|0)<0?0-(j-h)|0:j-h|0)>>>0>=k>>>0)return;l=d[b+(g+1)>>0]|0;if(((l-i|0)<0?0-(l-i)|0:l-i|0)>>>0>=k>>>0)return;if(e>>>0<4){e=d[(c[f>>2]|0)+(e+-1)>>0]|0;e=(4-l+(i-h<<2)+j>>3|0)<(~e|0)?~e:(4-l+(i-h<<2)+j>>3|0)>(e+1|0)?e+1|0:4-l+(i-h<<2)+j>>3;f=a[6294+((i|512)-e)>>0]|0;a[b+(g+-1)>>0]=a[6294+(e+(h|512))>>0]|0;a[b+g>>0]=f;return}else{a[b+(g+-1)>>0]=(h+2+l+(j<<1)|0)>>>2;a[b+g>>0]=(i+2+(l<<1)+j|0)>>>2;return}}function db(b,e,f,g){b=b|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;if(e>>>0<4){l=d[(c[f>>2]|0)+(e+-1)>>0]|0;k=8;while(1){e=b+(0-g)|0;h=a[b+g>>0]|0;i=d[e>>0]|0;j=d[b>>0]|0;if((((i-j|0)<0?0-(i-j)|0:i-j|0)>>>0<(c[f+4>>2]|0)>>>0?(n=d[b+(0-g<<1)>>0]|0,o=c[f+8>>2]|0,((n-i|0)<0?0-(n-i)|0:n-i|0)>>>0<o>>>0):0)?(((h&255)-j|0)<0?0-((h&255)-j)|0:(h&255)-j|0)>>>0<o>>>0:0){h=(4-(h&255)+(j-i<<2)+n>>3|0)<(~l|0)?~l:(4-(h&255)+(j-i<<2)+n>>3|0)>(l+1|0)?l+1|0:4-(h&255)+(j-i<<2)+n>>3;m=a[6294+((j|512)-h)>>0]|0;a[e>>0]=a[6294+(h+(i|512))>>0]|0;a[b>>0]=m}k=k+-1|0;if(!k)break;else b=b+1|0}return}else{k=8;while(1){e=b+(0-g)|0;h=a[b+g>>0]|0;i=d[e>>0]|0;j=d[b>>0]|0;if((((i-j|0)<0?0-(i-j)|0:i-j|0)>>>0<(c[f+4>>2]|0)>>>0?(l=d[b+(0-g<<1)>>0]|0,m=c[f+8>>2]|0,((l-i|0)<0?0-(l-i)|0:l-i|0)>>>0<m>>>0):0)?(((h&255)-j|0)<0?0-((h&255)-j)|0:(h&255)-j|0)>>>0<m>>>0:0){a[e>>0]=(i+2+(h&255)+(l<<1)|0)>>>2;a[b>>0]=(j+2+((h&255)<<1)+l|0)>>>2}k=k+-1|0;if(!k)break;else b=b+1|0}return}}function eb(b,e,f,g){b=b|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0;m=d[(c[f>>2]|0)+(e+-1)>>0]|0;h=a[b+g>>0]|0;i=d[b+(0-g)>>0]|0;j=d[b>>0]|0;e=c[f+4>>2]|0;if((((i-j|0)<0?0-(i-j)|0:i-j|0)>>>0<e>>>0?(k=d[b+(0-g<<1)>>0]|0,l=c[f+8>>2]|0,((k-i|0)<0?0-(k-i)|0:k-i|0)>>>0<l>>>0):0)?(((h&255)-j|0)<0?0-((h&255)-j)|0:(h&255)-j|0)>>>0<l>>>0:0){l=(4-(h&255)+(j-i<<2)+k>>3|0)<(~m|0)?~m:(4-(h&255)+(j-i<<2)+k>>3|0)>(m+1|0)?m+1|0:4-(h&255)+(j-i<<2)+k>>3;e=a[6294+((j|512)-l)>>0]|0;a[b+(0-g)>>0]=a[6294+(l+(i|512))>>0]|0;a[b>>0]=e;e=c[f+4>>2]|0}j=d[b+(1-g)>>0]|0;k=d[b+1>>0]|0;if(((j-k|0)<0?0-(j-k)|0:j-k|0)>>>0>=e>>>0)return;i=d[b+(0-g<<1|1)>>0]|0;e=c[f+8>>2]|0;if(((i-j|0)<0?0-(i-j)|0:i-j|0)>>>0>=e>>>0)return;h=d[b+(g+1)>>0]|0;if(((h-k|0)<0?0-(h-k)|0:h-k|0)>>>0>=e>>>0)return;f=(4-h+(k-j<<2)+i>>3|0)<(~m|0)?~m:(4-h+(k-j<<2)+i>>3|0)>(m+1|0)?m+1|0:4-h+(k-j<<2)+i>>3;m=a[6294+((k|512)-f)>>0]|0;a[b+(1-g)>>0]=a[6294+(f+(j|512))>>0]|0;a[b+1>>0]=m;return}
function ib(e,f,g,h,j){e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,$a=0,gb=0,ib=0,jb=0,kb=0,lb=0,mb=0,nb=0,ob=0,pb=0,qb=0,rb=0;rb=i;i=i+816|0;if((c[e+3344>>2]|0)!=0?(c[e+3348>>2]|0)==(f|0):0){c[rb+624>>2]=c[e+3356>>2];c[rb+624+4>>2]=c[e+3356+4>>2];c[rb+624+8>>2]=c[e+3356+8>>2];c[rb+624+12>>2]=c[e+3356+12>>2];c[rb+624+4>>2]=c[rb+624>>2];c[rb+624+8>>2]=0;c[rb+624+16>>2]=0;c[j>>2]=c[e+3352>>2];B=rb+624+8|0;t=rb+624+4|0;u=rb+624+16|0;m=0}else{do if(((g>>>0>3?(a[f>>0]|0)==0:0)?(a[f+1>>0]|0)==0:0)?(n=a[f+2>>0]|0,(n&255)<2):0){s=-3;r=3;q=f+3|0;o=2;while(1){if(n<<24>>24)if(n<<24>>24==1&o>>>0>1){t=r;u=0;v=0;x=q;y=0;break}else o=0;else o=o+1|0;p=r+1|0;if((p|0)==(g|0)){Xa=9;break}s=~r;n=a[q>>0]|0;r=p;q=q+1|0}if((Xa|0)==9){c[j>>2]=g;e=3;i=rb;return e|0}while(1){n=a[x>>0]|0;o=t+1|0;p=(n<<24>>24!=0^1)+y|0;u=n<<24>>24==3&(p|0)==2?1:u;if(n<<24>>24==1&p>>>0>1){Xa=16;break}y=n<<24>>24!=0?0:p;w=n<<24>>24!=0&p>>>0>2?1:v;if((o|0)==(g|0)){Xa=18;break}else{t=o;v=w;x=x+1|0}}if((Xa|0)==16){z=t+s-p|0;c[rb+624+12>>2]=z;E=rb+624+12|0;A=u;B=r;C=v;D=p-(p>>>0<3?p:3)|0;break}else if((Xa|0)==18){z=s+g-y|0;c[rb+624+12>>2]=z;E=rb+624+12|0;A=u;B=r;C=w;D=y;break}}else Xa=19;while(0);if((Xa|0)==19){c[rb+624+12>>2]=g;E=rb+624+12|0;z=g;A=1;B=0;C=0;D=0}n=f+B|0;c[rb+624>>2]=n;c[rb+624+4>>2]=n;c[rb+624+8>>2]=0;c[rb+624+16>>2]=0;c[j>>2]=B+z+D;if(C){e=3;i=rb;return e|0}do if(A){p=c[E>>2]|0;q=n;r=n;n=0;a:while(1){while(1){Sa=p;p=p+-1|0;if(!Sa){Xa=31;break a}o=a[q>>0]|0;if((n|0)!=2){F=n;break}if(o<<24>>24!=3){Xa=29;break}if(!p){ka=3;Xa=1494;break a}n=q+1|0;if((d[n>>0]|0)>3){ka=3;Xa=1494;break a}else{q=n;n=0}}if((Xa|0)==29){Xa=0;if((o&255)<3){ka=3;Xa=1494;break}else F=2}a[r>>0]=o;q=q+1|0;r=r+1|0;n=o<<24>>24==0?F+1|0:0}if((Xa|0)==31){c[E>>2]=r-q+(c[E>>2]|0);m=c[rb+624+16>>2]|0;break}else if((Xa|0)==1494){i=rb;return ka|0}}else m=0;while(0);c[e+3356>>2]=c[rb+624>>2];c[e+3356+4>>2]=c[rb+624+4>>2];c[e+3356+8>>2]=c[rb+624+8>>2];c[e+3356+12>>2]=c[rb+624+12>>2];c[e+3356+16>>2]=c[rb+624+16>>2];c[e+3352>>2]=c[j>>2];c[e+3348>>2]=f;B=rb+624+8|0;t=rb+624+4|0;u=rb+624+16|0}c[e+3344>>2]=0;A=rb+624+12|0;Sa=c[A>>2]<<3;o=m+1|0;c[u>>2]=o;c[B>>2]=o&7;if(o>>>0>Sa>>>0){e=3;i=rb;return e|0}s=c[rb+624>>2]|0;c[t>>2]=s+(o>>>3);q=c[A>>2]<<3;r=c[u>>2]|0;if((q-r|0)>31){m=c[B>>2]|0;n=d[s+((o>>>3)+1)>>0]<<16|d[s+(o>>>3)>>0]<<24|d[s+((o>>>3)+2)>>0]<<8|d[s+((o>>>3)+3)>>0];if(m)n=(d[s+((o>>>3)+4)>>0]|0)>>>(8-m|0)|n<<m}else if((q-r|0)>0){m=c[B>>2]|0;n=d[s+(o>>>3)>>0]<<m+24;if((q-r+-8+m|0)>0){o=s+(o>>>3)|0;p=q-r+-8+m|0;m=m+24|0;while(1){o=o+1|0;m=m+-8|0;n=d[o>>0]<<m|n;if((p|0)<=8)break;else p=p+-8|0}}}else n=0;c[u>>2]=r+2;c[B>>2]=r+2&7;if((r+2|0)>>>0>q>>>0){m=0;o=c[t>>2]|0}else{c[t>>2]=s+((r+2|0)>>>3);m=1;o=s+((r+2|0)>>>3)|0}z=m?n>>>30:-1;q=c[A>>2]<<3;r=c[u>>2]|0;if((q-r|0)>31){n=c[B>>2]|0;m=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(n)m=(d[o+4>>0]|0)>>>(8-n|0)|m<<n}else if((q-r|0)>0){n=c[B>>2]|0;m=d[o>>0]<<n+24;if((q-r+-8+n|0)>0){p=q-r+-8+n|0;n=n+24|0;while(1){o=o+1|0;n=n+-8|0;m=d[o>>0]<<n|m;if((p|0)<=8)break;else p=p+-8|0}}}else m=0;c[u>>2]=r+5;c[B>>2]=r+5&7;if((r+5|0)>>>0>q>>>0){e=0;i=rb;return e|0}c[t>>2]=s+((r+5|0)>>>3);y=m>>>27;if((y+-2|0)>>>0<3){e=3;i=rb;return e|0}switch(y|0){case 5:case 7:case 8:{if((z|0)==0|(y|0)==6){e=3;i=rb;return e|0}break}case 6:case 9:case 10:case 11:case 12:{if(z){e=3;i=rb;return e|0}break}default:{}}if((y+-1|0)>>>0>11){e=0;i=rb;return e|0}b:do switch(y|0){case 6:case 7:case 8:case 9:case 10:case 11:case 13:case 14:case 15:case 16:case 17:case 18:{P=1;Xa=206;break}case 5:case 1:{if(!(c[e+1332>>2]|0))x=0;else{c[e+1332>>2]=0;x=1};c[rb+644>>2]=c[rb+624>>2];c[rb+644+4>>2]=c[rb+624+4>>2];c[rb+644+8>>2]=c[rb+624+8>>2];c[rb+644+12>>2]=c[rb+624+12>>2];c[rb+644+16>>2]=c[rb+624+16>>2];m=Na(rb+644|0,rb+680|0)|0;c:do if(!m){m=Na(rb+644|0,rb+680|0)|0;if(!m){m=Na(rb+644|0,rb+680|0)|0;if(!m){m=c[rb+680>>2]|0;if(m>>>0>255){O=1;Xa=63}else{u=c[e+148+(m<<2)>>2]|0;if(((u|0)!=0?(G=c[u+4>>2]|0,M=c[e+20+(G<<2)>>2]|0,(M|0)!=0):0)?(Sa=c[e+8>>2]|0,(Sa|0)==32|(G|0)==(Sa|0)|(y|0)==5):0){m=c[e+1304>>2]|0;if((m|0)==(z|0))m=x;else m=(m|0)==0|(z|0)==0?1:x;if((c[e+1300>>2]|0)==5)if((y|0)==5)k=m;else Xa=72;else if((y|0)==5)Xa=72;else k=m;if((Xa|0)==72)k=1;m=c[M+12>>2]|0;c[rb+604>>2]=c[rb+624>>2];c[rb+604+4>>2]=c[rb+624+4>>2];c[rb+604+8>>2]=c[rb+624+8>>2];c[rb+604+12>>2]=c[rb+624+12>>2];c[rb+604+16>>2]=c[rb+624+16>>2];d:do if(!(Na(rb+604|0,rb+680|0)|0)){if(Na(rb+604|0,rb+680|0)|0){Xa=85;break}if(!(Na(rb+604|0,rb+680|0)|0))t=0;else{Xa=85;break}while(1)if(!(m>>>t))break;else t=t+1|0;q=t+-1|0;w=rb+604+4|0;o=c[w>>2]|0;v=rb+604+12|0;r=c[v>>2]<<3;g=rb+604+16|0;s=c[g>>2]|0;do if((r-s|0)>31){n=c[rb+604+8>>2]|0;m=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(!n){n=rb+604+8|0;break}m=(d[o+4>>0]|0)>>>(8-n|0)|m<<n;n=rb+604+8|0}else{if((r-s|0)<=0){m=0;n=rb+604+8|0;break}n=c[rb+604+8>>2]|0;m=d[o>>0]<<n+24;if((r-s+-8+n|0)>0){p=r-s+-8+n|0;n=n+24|0}else{n=rb+604+8|0;break}while(1){o=o+1|0;n=n+-8|0;m=d[o>>0]<<n|m;if((p|0)<=8){n=rb+604+8|0;break}else p=p+-8|0}}while(0);c[g>>2]=q+s;c[n>>2]=q+s&7;if((q+s|0)>>>0>r>>>0){Xa=85;break}c[w>>2]=(c[rb+604>>2]|0)+((q+s|0)>>>3);m=m>>>(33-t|0);if((m|0)==-1){Xa=85;break}if((c[e+1308>>2]|0)!=(m|0)){c[e+1308>>2]=m;k=1}e:do if((y|0)==5){m=c[M+12>>2]|0;c[rb+604>>2]=c[rb+624>>2];c[rb+604+4>>2]=c[rb+624+4>>2];c[rb+604+8>>2]=c[rb+624+8>>2];c[rb+604+12>>2]=c[rb+624+12>>2];c[rb+604+16>>2]=c[rb+624+16>>2];do if(!(Na(rb+604|0,rb+680|0)|0)){if(Na(rb+604|0,rb+680|0)|0)break;if(!(Na(rb+604|0,rb+680|0)|0))t=0;else break;while(1)if(!(m>>>t))break;else t=t+1|0;q=t+-1|0;o=c[w>>2]|0;r=c[v>>2]<<3;s=c[g>>2]|0;do if((r-s|0)>31){n=c[rb+604+8>>2]|0;m=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(!n){n=rb+604+8|0;break}m=(d[o+4>>0]|0)>>>(8-n|0)|m<<n;n=rb+604+8|0}else{if((r-s|0)<=0){m=0;n=rb+604+8|0;break}n=c[rb+604+8>>2]|0;m=d[o>>0]<<n+24;if((r-s+-8+n|0)>0){p=r-s+-8+n|0;n=n+24|0}else{n=rb+604+8|0;break}while(1){o=o+1|0;n=n+-8|0;m=d[o>>0]<<n|m;if((p|0)<=8){n=rb+604+8|0;break}else p=p+-8|0}}while(0);c[g>>2]=q+s;c[n>>2]=q+s&7;if((q+s|0)>>>0>r>>>0)break;c[w>>2]=(c[rb+604>>2]|0)+((q+s|0)>>>3);if((m>>>(33-t|0)|0)==-1)break;if(Na(rb+604|0,rb+172|0)|0)break d;if((c[e+1300>>2]|0)==5){Ra=c[e+1312>>2]|0;Sa=c[rb+172>>2]|0;m=e+1312|0;n=(Ra|0)==(Sa|0)?Ra:Sa;k=(Ra|0)==(Sa|0)?k:1}else{m=e+1312|0;n=c[rb+172>>2]|0}c[m>>2]=n;break e}while(0);break d}while(0);f:do switch(c[M+16>>2]|0){case 0:{c[rb+604>>2]=c[rb+624>>2];c[rb+604+4>>2]=c[rb+624+4>>2];c[rb+604+8>>2]=c[rb+624+8>>2];c[rb+604+12>>2]=c[rb+624+12>>2];c[rb+604+16>>2]=c[rb+624+16>>2];do if(!(Na(rb+604|0,rb+680|0)|0)){if(Na(rb+604|0,rb+680|0)|0)break;if(Na(rb+604|0,rb+680|0)|0)break;m=c[M+12>>2]|0;t=0;while(1)if(!(m>>>t))break;else t=t+1|0;q=t+-1|0;o=c[w>>2]|0;r=c[v>>2]<<3;s=c[g>>2]|0;do if((r-s|0)>31){n=c[rb+604+8>>2]|0;m=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(!n){n=rb+604+8|0;break}m=(d[o+4>>0]|0)>>>(8-n|0)|m<<n;n=rb+604+8|0}else{if((r-s|0)<=0){m=0;n=rb+604+8|0;break}n=c[rb+604+8>>2]|0;m=d[o>>0]<<n+24;if((r-s+-8+n|0)>0){p=r-s+-8+n|0;n=n+24|0}else{n=rb+604+8|0;break}while(1){o=o+1|0;n=n+-8|0;m=d[o>>0]<<n|m;if((p|0)<=8){n=rb+604+8|0;break}else p=p+-8|0}}while(0);c[g>>2]=q+s;c[n>>2]=q+s&7;if((q+s|0)>>>0>r>>>0)break;c[w>>2]=(c[rb+604>>2]|0)+((q+s|0)>>>3);if((m>>>(33-t|0)|0)==-1)break;if((y|0)==5?(Na(rb+604|0,rb+680|0)|0)!=0:0)break;m=c[M+20>>2]|0;t=0;while(1)if(!(m>>>t))break;else t=t+1|0;q=t+-1|0;o=c[w>>2]|0;r=c[v>>2]<<3;s=c[g>>2]|0;do if((r-s|0)>31){n=c[rb+604+8>>2]|0;m=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(!n){n=rb+604+8|0;break}m=(d[o+4>>0]|0)>>>(8-n|0)|m<<n;n=rb+604+8|0}else{if((r-s|0)<=0){m=0;n=rb+604+8|0;break}n=c[rb+604+8>>2]|0;m=d[o>>0]<<n+24;if((r-s+-8+n|0)>0){p=r-s+-8+n|0;n=n+24|0}else{n=rb+604+8|0;break}while(1){o=o+1|0;n=n+-8|0;m=d[o>>0]<<n|m;if((p|0)<=8){n=rb+604+8|0;break}else p=p+-8|0}}while(0);c[g>>2]=q+s;c[n>>2]=q+s&7;if((q+s|0)>>>0>r>>>0)break;c[w>>2]=(c[rb+604>>2]|0)+((q+s|0)>>>3);m=m>>>(33-t|0);if((m|0)==-1)break;if((c[e+1316>>2]|0)!=(m|0)){c[e+1316>>2]=m;k=1}if(!(c[u+8>>2]|0))break f;c[rb+604>>2]=c[rb+624>>2];c[rb+604+4>>2]=c[rb+624+4>>2];c[rb+604+8>>2]=c[rb+624+8>>2];c[rb+604+12>>2]=c[rb+624+12>>2];c[rb+604+16>>2]=c[rb+624+16>>2];m=Na(rb+604|0,rb+644|0)|0;do if(!m){m=Na(rb+604|0,rb+644|0)|0;if(m){l=m;break}m=Na(rb+604|0,rb+644|0)|0;if(m){l=m;break}m=c[M+12>>2]|0;t=0;while(1)if(!(m>>>t))break;else t=t+1|0;q=t+-1|0;o=c[w>>2]|0;r=c[v>>2]<<3;s=c[g>>2]|0;do if((r-s|0)>31){n=c[rb+604+8>>2]|0;m=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(!n){n=rb+604+8|0;break}m=(d[o+4>>0]|0)>>>(8-n|0)|m<<n;n=rb+604+8|0}else{if((r-s|0)<=0){m=0;n=rb+604+8|0;break}n=c[rb+604+8>>2]|0;m=d[o>>0]<<n+24;if((r-s+-8+n|0)>0){p=r-s+-8+n|0;n=n+24|0}else{n=rb+604+8|0;break}while(1){o=o+1|0;n=n+-8|0;m=d[o>>0]<<n|m;if((p|0)<=8){n=rb+604+8|0;break}else p=p+-8|0}}while(0);c[g>>2]=q+s;c[n>>2]=q+s&7;if((q+s|0)>>>0>r>>>0){l=1;break}c[w>>2]=(c[rb+604>>2]|0)+((q+s|0)>>>3);if((m>>>(33-t|0)|0)==-1){l=1;break}if((y|0)==5?(L=Na(rb+604|0,rb+644|0)|0,(L|0)!=0):0){l=L;break}m=c[M+20>>2]|0;t=0;while(1)if(!(m>>>t))break;else t=t+1|0;s=t+-1|0;o=c[w>>2]|0;q=c[v>>2]<<3;r=c[g>>2]|0;do if((q-r|0)>31){n=c[rb+604+8>>2]|0;m=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(!n){n=rb+604+8|0;break}m=(d[o+4>>0]|0)>>>(8-n|0)|m<<n;n=rb+604+8|0}else{if((q-r|0)<=0){m=0;n=rb+604+8|0;break}n=c[rb+604+8>>2]|0;m=d[o>>0]<<n+24;if((q-r+-8+n|0)>0){p=q-r+-8+n|0;n=n+24|0}else{n=rb+604+8|0;break}while(1){o=o+1|0;n=n+-8|0;m=d[o>>0]<<n|m;if((p|0)<=8){n=rb+604+8|0;break}else p=p+-8|0}}while(0);c[g>>2]=s+r;c[n>>2]=s+r&7;if((s+r|0)>>>0>q>>>0){l=1;break}c[w>>2]=(c[rb+604>>2]|0)+((s+r|0)>>>3);if((m>>>(33-t|0)|0)==-1){l=1;break}c[rb+680>>2]=0;m=Na(rb+604|0,rb+680|0)|0;n=c[rb+680>>2]|0;do if((n|0)==-1){o=(m|0)==0?1:0;m=(m|0)==0?0:-2147483648}else{if(m){o=1;m=0;break}o=0;m=(n&1|0)!=0?(n+1|0)>>>1:0-((n+1|0)>>>1)|0}while(0);if(o)break d;if((c[e+1320>>2]|0)==(m|0))break f;c[e+1320>>2]=m;k=1;break f}else l=m;while(0);N=k;Xa=208;break c}while(0);break d}case 1:{if(c[M+24>>2]|0)break f;t=c[u+8>>2]|0;c[rb+604>>2]=c[rb+624>>2];c[rb+604+4>>2]=c[rb+624+4>>2];c[rb+604+8>>2]=c[rb+624+8>>2];c[rb+604+12>>2]=c[rb+624+12>>2];c[rb+604+16>>2]=c[rb+624+16>>2];l=Na(rb+604|0,rb+644|0)|0;g:do if(!l){l=Na(rb+604|0,rb+644|0)|0;if(l)break;l=Na(rb+604|0,rb+644|0)|0;if(l)break;l=c[M+12>>2]|0;s=0;while(1)if(!(l>>>s))break;else s=s+1|0;r=s+-1|0;n=c[w>>2]|0;p=c[v>>2]<<3;q=c[g>>2]|0;do if((p-q|0)>31){m=c[rb+604+8>>2]|0;l=d[n+1>>0]<<16|d[n>>0]<<24|d[n+2>>0]<<8|d[n+3>>0];if(!m){m=rb+604+8|0;break}l=(d[n+4>>0]|0)>>>(8-m|0)|l<<m;m=rb+604+8|0}else{if((p-q|0)<=0){l=0;m=rb+604+8|0;break}m=c[rb+604+8>>2]|0;l=d[n>>0]<<m+24;if((p-q+-8+m|0)>0){o=p-q+-8+m|0;m=m+24|0}else{m=rb+604+8|0;break}while(1){n=n+1|0;m=m+-8|0;l=d[n>>0]<<m|l;if((o|0)<=8){m=rb+604+8|0;break}else o=o+-8|0}}while(0);c[g>>2]=r+q;c[m>>2]=r+q&7;if((r+q|0)>>>0>p>>>0){l=1;break}c[w>>2]=(c[rb+604>>2]|0)+((r+q|0)>>>3);if((l>>>(33-s|0)|0)==-1){l=1;break}if((y|0)==5?(H=Na(rb+604|0,rb+644|0)|0,(H|0)!=0):0){l=H;break}c[rb+680>>2]=0;l=Na(rb+604|0,rb+680|0)|0;m=c[rb+680>>2]|0;do if((m|0)==-1)if(!l)Xa=190;else I=-2147483648;else{if(l){Xa=190;break}I=(m&1|0)!=0?(m+1|0)>>>1:0-((m+1|0)>>>1)|0}while(0);if((Xa|0)==190){l=1;break}do if(t){c[rb+680>>2]=0;l=Na(rb+604|0,rb+680|0)|0;m=c[rb+680>>2]|0;do if((m|0)==-1)if(!l)Xa=197;else{J=-2147483648;Xa=196}else{if(l){Xa=197;break}J=(m&1|0)!=0?(m+1|0)>>>1:0-((m+1|0)>>>1)|0;Xa=196}while(0);if((Xa|0)==196){K=J;break}else if((Xa|0)==197){l=1;break g}}else K=0;while(0);if((c[e+1324>>2]|0)!=(I|0)){c[e+1324>>2]=I;k=1}if(!(c[u+8>>2]|0))break f;if((c[e+1328>>2]|0)==(K|0))break f;c[e+1328>>2]=K;k=1;break f}while(0);N=k;Xa=208;break c}default:{}}while(0);c[e+1300>>2]=y;c[e+1300+4>>2]=z;P=k;Xa=206;break b}else Xa=85;while(0);break}e=4;i=rb;return e|0}}else{O=m;Xa=63}}else{O=m;Xa=63}}else{O=m;Xa=63}while(0);if((Xa|0)==63){l=O;N=x;Xa=208}h:do if((Xa|0)==208){if((l|0)<65520)switch(l|0){case 0:{Q=N;break b}default:break h}switch(l|0){case 65520:{ka=4;break}default:break h}i=rb;return ka|0}while(0);e=3;i=rb;return e|0}default:{P=0;Xa=206}}while(0);if((Xa|0)==206)Q=P;do if(!Q)Xa=222;else{if((c[e+1184>>2]|0)!=0?(c[e+16>>2]|0)!=0:0){if(c[e+3380>>2]|0){e=3;i=rb;return e|0}if(!(c[e+1188>>2]|0)){k=c[e+1220>>2]|0;l=k+((c[e+1248>>2]|0)*40|0)|0;c[e+1228>>2]=l;c[e+1336>>2]=c[l>>2];l=c[e+1260>>2]|0;if((l|0)!=0?(c[c[e+1224>>2]>>2]=k,(l|0)!=1):0){k=1;do{c[(c[e+1224>>2]|0)+(k<<2)>>2]=(c[e+1220>>2]|0)+(k*40|0);k=k+1|0}while((k|0)!=(l|0))}fb(e,e+1336|0,0);k=e+1336|0}else{fb(e,e+1336|0,c[e+1372>>2]|0);k=e+1336|0}c[j>>2]=0;c[e+3344>>2]=1;c[e+1180>>2]=0;Ua=e+16|0;Wa=e+1188|0;Ta=e+1212|0;Va=k;break}c[e+1188>>2]=0;c[e+1180>>2]=0;Xa=222}while(0);i:do if((Xa|0)==222)switch(y|0){case 7:{l=rb+72|0;m=l+92|0;do{c[l>>2]=0;l=l+4|0}while((l|0)<(m|0));k=Ma(rb+624|0,8)|0;j:do if((((((((k|0)!=-1?(c[rb+72>>2]=k,Ma(rb+624|0,1)|0,Ma(rb+624|0,1)|0,(Ma(rb+624|0,1)|0)!=-1):0)?(Ma(rb+624|0,5)|0)!=-1:0)?(T=Ma(rb+624|0,8)|0,(T|0)!=-1):0)?(c[rb+72+4>>2]=T,qb=(Na(rb+624|0,rb+72+8|0)|0)!=0,!(qb|(c[rb+72+8>>2]|0)>>>0>31)):0)?(Na(rb+624|0,rb+644|0)|0)==0:0)?(U=c[rb+644>>2]|0,U>>>0<=12):0)?(c[rb+72+12>>2]=1<<U+4,(Na(rb+624|0,rb+644|0)|0)==0):0){k=c[rb+644>>2]|0;if(k>>>0>2)break;c[rb+72+16>>2]=k;k:do switch(k|0){case 0:{if(Na(rb+624|0,rb+644|0)|0)break j;k=c[rb+644>>2]|0;if(k>>>0>12)break j;c[rb+72+20>>2]=1<<k+4;break}case 1:{k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[rb+72+24>>2]=(k|0)==1&1;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1)if(!k)Xa=241;else W=-2147483648;else{if(k){Xa=241;break}W=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}while(0);if((Xa|0)==241)break j;c[rb+72+28>>2]=W;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1)if(!k)Xa=246;else X=-2147483648;else{if(k){Xa=246;break}X=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}while(0);if((Xa|0)==246)break j;c[rb+72+32>>2]=X;o=rb+72+36|0;if(Na(rb+624|0,o)|0)break j;k=c[o>>2]|0;if(k>>>0>255)break j;if(!k){c[rb+72+40>>2]=0;break k}k=ub(k<<2)|0;c[rb+72+40>>2]=k;if(!k)break j;if(!(c[o>>2]|0))break k;c[rb+680>>2]=0;l=Na(rb+624|0,rb+680|0)|0;m=c[rb+680>>2]|0;do if((m|0)==-1)if(!l)Xa=258;else Y=-2147483648;else{if(l){Xa=258;break}Y=(m&1|0)!=0?(m+1|0)>>>1:0-((m+1|0)>>>1)|0}while(0);if((Xa|0)==258)break j;c[k>>2]=Y;if((c[o>>2]|0)>>>0<=1)break k;n=1;while(1){m=(c[rb+72+40>>2]|0)+(n<<2)|0;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k)break;else k=-2147483648;else{if(k)break;k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}c[m>>2]=k;n=n+1|0;if(n>>>0>=(c[o>>2]|0)>>>0)break k}break j}default:{}}while(0);t=rb+72+44|0;qb=(Na(rb+624|0,t)|0)!=0;if(qb|(c[t>>2]|0)>>>0>16)break;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break;c[rb+72+48>>2]=(k|0)==1&1;if(Na(rb+624|0,rb+644|0)|0)break;c[rb+72+52>>2]=(c[rb+644>>2]|0)+1;if(Na(rb+624|0,rb+644|0)|0)break;c[rb+72+56>>2]=(c[rb+644>>2]|0)+1;switch(Ma(rb+624|0,1)|0){case 0:case -1:break j;default:{}}if((Ma(rb+624|0,1)|0)==-1)break;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break;c[rb+72+60>>2]=(k|0)==1&1;if((k|0)==1){if(Na(rb+624|0,rb+72+64|0)|0)break;if(Na(rb+624|0,rb+72+68|0)|0)break;if(Na(rb+624|0,rb+72+72|0)|0)break;if(Na(rb+624|0,rb+72+76|0)|0)break;l=c[rb+72+52>>2]|0;if((c[rb+72+64>>2]|0)>((l<<3)+~c[rb+72+68>>2]|0))break;k=c[rb+72+56>>2]|0;if((c[rb+72+72>>2]|0)>((k<<3)+~c[rb+72+76>>2]|0))break}else{k=c[rb+72+56>>2]|0;l=c[rb+72+52>>2]|0}k=Z(l,k)|0;do switch(c[rb+72+4>>2]|0){case 10:{$=99;aa=152064;Xa=296;break}case 11:{$=396;aa=345600;Xa=296;break}case 12:{$=396;aa=912384;Xa=296;break}case 13:{$=396;aa=912384;Xa=296;break}case 20:{$=396;aa=912384;Xa=296;break}case 21:{$=792;aa=1824768;Xa=296;break}case 22:{$=1620;aa=3110400;Xa=296;break}case 30:{$=1620;aa=3110400;Xa=296;break}case 31:{$=3600;aa=6912e3;Xa=296;break}case 32:{$=5120;aa=7864320;Xa=296;break}case 40:{$=8192;aa=12582912;Xa=296;break}case 41:{$=8192;aa=12582912;Xa=296;break}case 42:{$=8704;aa=13369344;Xa=296;break}case 50:{$=22080;aa=42393600;Xa=296;break}case 51:{$=36864;aa=70778880;Xa=296;break}default:Xa=298}while(0);do if((Xa|0)==296){if($>>>0<k>>>0){Xa=298;break}k=(aa>>>0)/((k*384|0)>>>0)|0;k=k>>>0<16?k:16;c[rb+644>>2]=k;l=c[t>>2]|0;if(l>>>0>k>>>0){ba=l;Xa=299}else ca=k}while(0);if((Xa|0)==298){c[rb+644>>2]=2147483647;ba=c[t>>2]|0;Xa=299}if((Xa|0)==299){c[rb+644>>2]=ba;ca=ba}c[rb+72+88>>2]=ca;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break;c[rb+72+80>>2]=(k|0)==1&1;do if((k|0)==1){s=ub(952)|0;c[rb+72+84>>2]=s;if(!s)break j;xb(s|0,0,952)|0;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s>>2]=(k|0)==1&1;do if((k|0)==1){k=Ma(rb+624|0,8)|0;if((k|0)==-1)break j;c[s+4>>2]=k;if((k|0)!=255)break;k=Ma(rb+624|0,16)|0;if((k|0)==-1)break j;c[s+8>>2]=k;k=Ma(rb+624|0,16)|0;if((k|0)==-1)break j;c[s+12>>2]=k}while(0);k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+16>>2]=(k|0)==1&1;if((k|0)==1){k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+20>>2]=(k|0)==1&1}k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+24>>2]=(k|0)==1&1;do if((k|0)==1){k=Ma(rb+624|0,3)|0;if((k|0)==-1)break j;c[s+28>>2]=k;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+32>>2]=(k|0)==1&1;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+36>>2]=(k|0)==1&1;if((k|0)!=1){c[s+40>>2]=2;c[s+44>>2]=2;c[s+48>>2]=2;break}k=Ma(rb+624|0,8)|0;if((k|0)==-1)break j;c[s+40>>2]=k;k=Ma(rb+624|0,8)|0;if((k|0)==-1)break j;c[s+44>>2]=k;k=Ma(rb+624|0,8)|0;if((k|0)==-1)break j;c[s+48>>2]=k}else{c[s+28>>2]=5;c[s+40>>2]=2;c[s+44>>2]=2;c[s+48>>2]=2}while(0);k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+52>>2]=(k|0)==1&1;if((k|0)==1){if(Na(rb+624|0,s+56|0)|0)break j;if((c[s+56>>2]|0)>>>0>5)break j;if(Na(rb+624|0,s+60|0)|0)break j;if((c[s+60>>2]|0)>>>0>5)break j}k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+64>>2]=(k|0)==1&1;if((k|0)==1){m=c[rb+624+4>>2]|0;q=c[A>>2]<<3;r=c[rb+624+16>>2]|0;do if((q-r|0)>31){k=c[B>>2]|0;l=d[m+1>>0]<<16|d[m>>0]<<24|d[m+2>>0]<<8|d[m+3>>0];if(!k)break;l=(d[m+4>>0]|0)>>>(8-k|0)|l<<k}else{if((q-r|0)<=0){l=0;break}k=c[B>>2]|0;l=d[m>>0]<<k+24;if((q-r+-8+k|0)>0){n=q-r+-8+k|0;k=k+24|0}else break;while(1){m=m+1|0;k=k+-8|0;l=d[m>>0]<<k|l;if((n|0)<=8)break;else n=n+-8|0}}while(0);c[rb+624+16>>2]=r+32;o=r+32&7;c[B>>2]=o;if(q>>>0<(r+32|0)>>>0)break j;p=c[rb+624>>2]|0;m=(r+32|0)>>>3;c[rb+624+4>>2]=p+m;if(!l)break j;c[s+68>>2]=l;do if((q-(r+32)|0)>31){k=d[p+(m+1)>>0]<<16|d[p+m>>0]<<24|d[p+(m+2)>>0]<<8|d[p+(m+3)>>0];if(!o)break;k=(d[p+(m+4)>>0]|0)>>>(8-o|0)|k<<o}else{if((q-(r+32)|0)<=0){k=0;break}k=d[p+m>>0]<<(o|24);if((q-(r+32)+-8+o|0)>0){m=p+m|0;n=q-(r+32)+-8+o|0;l=o|24}else break;while(1){m=m+1|0;l=l+-8|0;k=d[m>>0]<<l|k;if((n|0)<=8)break;else n=n+-8|0}}while(0);c[rb+624+16>>2]=r+64;c[B>>2]=r+64&7;if((r+64|0)>>>0>q>>>0)break j;c[rb+624+4>>2]=p+((r+64|0)>>>3);if(!k)break j;c[s+72>>2]=k;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+76>>2]=(k|0)==1&1}k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+80>>2]=(k|0)==1&1;if((k|0)==1){if(hb(rb+624|0,s+84|0)|0)break j}else{c[s+84>>2]=1;c[s+96>>2]=288000001;c[s+224>>2]=288000001;c[s+480>>2]=24;c[s+484>>2]=24;c[s+488>>2]=24;c[s+492>>2]=24}k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+496>>2]=(k|0)==1&1;if((k|0)==1){if(hb(rb+624|0,s+500|0)|0)break j}else{c[s+500>>2]=1;c[s+512>>2]=240000001;c[s+640>>2]=240000001;c[s+896>>2]=24;c[s+900>>2]=24;c[s+904>>2]=24;c[s+908>>2]=24}if(!((c[s+80>>2]|0)==0?(c[s+496>>2]|0)==0:0)){k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+912>>2]=(k|0)==1&1}k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+916>>2]=(k|0)==1&1;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+920>>2]=(k|0)==1&1;if((k|0)==1){k=Ma(rb+624|0,1)|0;if((k|0)==-1)break j;c[s+924>>2]=(k|0)==1&1;if(Na(rb+624|0,s+928|0)|0)break j;if((c[s+928>>2]|0)>>>0>16)break j;if(Na(rb+624|0,s+932|0)|0)break j;if((c[s+932>>2]|0)>>>0>16)break j;if(Na(rb+624|0,s+936|0)|0)break j;if((c[s+936>>2]|0)>>>0>16)break j;if(Na(rb+624|0,s+940|0)|0)break j;if((c[s+940>>2]|0)>>>0>16)break j;if(Na(rb+624|0,s+944|0)|0)break j;if(Na(rb+624|0,s+948|0)|0)break j}else{c[s+924>>2]=1;c[s+928>>2]=2;c[s+932>>2]=1;c[s+936>>2]=16;c[s+940>>2]=16;c[s+944>>2]=16;c[s+948>>2]=16}k=c[rb+72+84>>2]|0;if(!(c[k+920>>2]|0))break;l=c[k+948>>2]|0;if((l>>>0<(c[t>>2]|0)>>>0?1:(c[k+944>>2]|0)>>>0>l>>>0)|l>>>0>(c[rb+72+88>>2]|0)>>>0)break j;c[rb+72+88>>2]=(l|0)==0?1:l}while(0);Ma(rb+624|0,8-(c[B>>2]|0)|0)|0;p=c[rb+72+8>>2]|0;q=c[e+20+(p<<2)>>2]|0;do if(!q){qb=ub(92)|0;c[e+20+(p<<2)>>2]=qb;if(!qb)ka=0;else break;i=rb;return ka|0}else{if((p|0)!=(c[e+8>>2]|0)){vb(c[q+40>>2]|0);c[(c[e+20+(p<<2)>>2]|0)+40>>2]=0;vb(c[(c[e+20+(p<<2)>>2]|0)+84>>2]|0);c[(c[e+20+(p<<2)>>2]|0)+84>>2]=0;break}r=c[e+16>>2]|0;l:do if((c[rb+72>>2]|0)==(c[r>>2]|0)){if((c[rb+72+4>>2]|0)!=(c[r+4>>2]|0))break;if((c[rb+72+12>>2]|0)!=(c[r+12>>2]|0))break;k=c[rb+72+16>>2]|0;if((k|0)!=(c[r+16>>2]|0))break;if((c[t>>2]|0)!=(c[r+44>>2]|0))break;if((c[rb+72+48>>2]|0)!=(c[r+48>>2]|0))break;if((c[rb+72+52>>2]|0)!=(c[r+52>>2]|0))break;if((c[rb+72+56>>2]|0)!=(c[r+56>>2]|0))break;o=c[rb+72+60>>2]|0;if((o|0)!=(c[r+60>>2]|0))break;if((c[rb+72+80>>2]|0)!=(c[r+80>>2]|0))break;m:do switch(k|0){case 0:{if((c[rb+72+20>>2]|0)!=(c[r+20>>2]|0))break l;break}case 1:{if((c[rb+72+24>>2]|0)!=(c[r+24>>2]|0))break l;if((c[rb+72+28>>2]|0)!=(c[r+28>>2]|0))break l;if((c[rb+72+32>>2]|0)!=(c[r+32>>2]|0))break l;k=c[rb+72+36>>2]|0;if((k|0)!=(c[r+36>>2]|0))break l;if(!k)break m;l=c[rb+72+40>>2]|0;m=c[r+40>>2]|0;n=0;do{if((c[l+(n<<2)>>2]|0)!=(c[m+(n<<2)>>2]|0))break l;n=n+1|0}while(n>>>0<k>>>0);break}default:{}}while(0);if(o){if((c[rb+72+64>>2]|0)!=(c[r+64>>2]|0))break;if((c[rb+72+68>>2]|0)!=(c[r+68>>2]|0))break;if((c[rb+72+72>>2]|0)!=(c[r+72>>2]|0))break;if((c[rb+72+76>>2]|0)!=(c[r+76>>2]|0))break}vb(c[rb+72+40>>2]|0);c[rb+72+40>>2]=0;vb(c[rb+72+84>>2]|0);c[rb+72+84>>2]=0;e=0;i=rb;return e|0}while(0);vb(c[q+40>>2]|0);c[(c[e+20+(p<<2)>>2]|0)+40>>2]=0;vb(c[(c[e+20+(p<<2)>>2]|0)+84>>2]|0);c[(c[e+20+(p<<2)>>2]|0)+84>>2]=0;c[e+8>>2]=33;c[e+4>>2]=257;c[e+16>>2]=0;c[e+12>>2]=0}while(0);l=c[e+20+(p<<2)>>2]|0;k=rb+72|0;m=l+92|0;do{c[l>>2]=c[k>>2];l=l+4|0;k=k+4|0}while((l|0)<(m|0));e=0;i=rb;return e|0}while(0);vb(c[rb+72+40>>2]|0);c[rb+72+40>>2]=0;vb(c[rb+72+84>>2]|0);c[rb+72+84>>2]=0;e=3;i=rb;return e|0}case 8:{l=rb;m=l+72|0;do{c[l>>2]=0;l=l+4|0}while((l|0)<(m|0));n:do if(((((!((Na(rb+624|0,rb)|0)!=0|(c[rb>>2]|0)>>>0>255)?(qb=(Na(rb+624|0,rb+4|0)|0)!=0,!(qb|(c[rb+4>>2]|0)>>>0>31)):0)?(Ma(rb+624|0,1)|0)==0:0)?(R=Ma(rb+624|0,1)|0,(R|0)!=-1):0)?(c[rb+8>>2]=(R|0)==1&1,(Na(rb+624|0,rb+644|0)|0)==0):0)?(S=(c[rb+644>>2]|0)+1|0,c[rb+12>>2]=S,S>>>0<=8):0){o:do if(S>>>0>1){if(Na(rb+624|0,rb+16|0)|0)break n;k=c[rb+16>>2]|0;if(k>>>0>6)break n;switch(k|0){case 0:{qb=ub(c[rb+12>>2]<<2)|0;c[rb+20>>2]=qb;if(!qb)break n;if(!(c[rb+12>>2]|0))break o;else k=0;do{if(Na(rb+624|0,rb+644|0)|0)break n;c[(c[rb+20>>2]|0)+(k<<2)>>2]=(c[rb+644>>2]|0)+1;k=k+1|0}while(k>>>0<(c[rb+12>>2]|0)>>>0);break}case 2:{c[rb+24>>2]=ub((c[rb+12>>2]<<2)+-4|0)|0;qb=ub((c[rb+12>>2]<<2)+-4|0)|0;c[rb+28>>2]=qb;if((qb|0)==0|(c[rb+24>>2]|0)==0)break n;if((c[rb+12>>2]|0)==1)break o;else k=0;do{if(Na(rb+624|0,rb+644|0)|0)break n;c[(c[rb+24>>2]|0)+(k<<2)>>2]=c[rb+644>>2];if(Na(rb+624|0,rb+644|0)|0)break n;c[(c[rb+28>>2]|0)+(k<<2)>>2]=c[rb+644>>2];k=k+1|0}while(k>>>0<((c[rb+12>>2]|0)+-1|0)>>>0);break}case 5:case 4:case 3:{k=Ma(rb+624|0,1)|0;if((k|0)==-1)break n;c[rb+32>>2]=(k|0)==1&1;if(Na(rb+624|0,rb+644|0)|0)break n;c[rb+36>>2]=(c[rb+644>>2]|0)+1;break o}case 6:{if(Na(rb+624|0,rb+644|0)|0)break n;qb=(c[rb+644>>2]|0)+1|0;c[rb+40>>2]=qb;qb=ub(qb<<2)|0;c[rb+44>>2]=qb;if(!qb)break n;k=c[288+((c[rb+12>>2]|0)+-1<<2)>>2]|0;if(!(c[rb+40>>2]|0))break o;else l=0;do{qb=Ma(rb+624|0,k)|0;c[(c[rb+44>>2]|0)+(l<<2)>>2]=qb;l=l+1|0;if(qb>>>0>=(c[rb+12>>2]|0)>>>0)break n}while(l>>>0<(c[rb+40>>2]|0)>>>0);break}default:break o}}while(0);if(!(Na(rb+624|0,rb+644|0)|0)){k=c[rb+644>>2]|0;if(k>>>0>31)break;c[rb+48>>2]=k+1;qb=(Na(rb+624|0,rb+644|0)|0)!=0;if(qb|(c[rb+644>>2]|0)>>>0>31)break;if(Ma(rb+624|0,1)|0)break;if((Ma(rb+624|0,2)|0)>>>0>2)break;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1){if(!k)break;break n}else{if(k)break;k=((l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0)+26|0;if(k>>>0>51)break n;c[rb+52>>2]=k;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1){if(!k)break;break n}else{if(k)break;if((((l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0)+26|0)>>>0>51)break n;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1){if(!k)break;break n}else{if(k)break;k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0;if((k+12|0)>>>0>24)break n;c[rb+56>>2]=k;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break n;c[rb+60>>2]=(k|0)==1&1;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break n;c[rb+64>>2]=(k|0)==1&1;k=Ma(rb+624|0,1)|0;if((k|0)==-1)break n;c[rb+68>>2]=(k|0)==1&1;Ma(rb+624|0,8-(c[B>>2]|0)|0)|0;l=c[rb>>2]|0;k=c[e+148+(l<<2)>>2]|0;do if(!k){qb=ub(72)|0;c[e+148+(l<<2)>>2]=qb;if(!qb)ka=0;else break;i=rb;return ka|0}else{if((l|0)!=(c[e+4>>2]|0)){vb(c[k+20>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+20>>2]=0;vb(c[(c[e+148+(l<<2)>>2]|0)+24>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+24>>2]=0;vb(c[(c[e+148+(l<<2)>>2]|0)+28>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+28>>2]=0;vb(c[(c[e+148+(l<<2)>>2]|0)+44>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+44>>2]=0;break}if((c[rb+4>>2]|0)!=(c[e+8>>2]|0)){c[e+4>>2]=257;k=c[e+148+(l<<2)>>2]|0}vb(c[k+20>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+20>>2]=0;vb(c[(c[e+148+(l<<2)>>2]|0)+24>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+24>>2]=0;vb(c[(c[e+148+(l<<2)>>2]|0)+28>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+28>>2]=0;vb(c[(c[e+148+(l<<2)>>2]|0)+44>>2]|0);c[(c[e+148+(l<<2)>>2]|0)+44>>2]=0}while(0);l=c[e+148+(l<<2)>>2]|0;k=rb;m=l+72|0;do{c[l>>2]=c[k>>2];l=l+4|0;k=k+4|0}while((l|0)<(m|0));e=0;i=rb;return e|0}while(0);break n}while(0);break n}while(0)}}while(0);vb(c[rb+20>>2]|0);c[rb+20>>2]=0;vb(c[rb+24>>2]|0);c[rb+24>>2]=0;vb(c[rb+28>>2]|0);c[rb+28>>2]=0;vb(c[rb+44>>2]|0);c[rb+44>>2]=0;e=3;i=rb;return e|0}case 1:case 5:{if(c[e+1180>>2]|0){e=0;i=rb;return e|0}c[e+1184>>2]=1;p:do if(!(c[e+1188>>2]|0)){c[e+1204>>2]=0;c[e+1208>>2]=h;c[rb+644>>2]=c[rb+624>>2];c[rb+644+4>>2]=c[rb+624+4>>2];c[rb+644+8>>2]=c[rb+624+8>>2];c[rb+644+12>>2]=c[rb+624+12>>2];c[rb+644+16>>2]=c[rb+624+16>>2];if((Na(rb+644|0,rb+680|0)|0)==0?(Na(rb+644|0,rb+680|0)|0)==0:0){Na(rb+644|0,rb+680|0)|0;t=c[rb+680>>2]|0}else t=0;u=c[e+8>>2]|0;s=e+148+(t<<2)|0;l=c[s>>2]|0;q:do if((l|0)!=0?(_=c[l+4>>2]|0,V=c[e+20+(_<<2)>>2]|0,(V|0)!=0):0){p=c[V+52>>2]|0;q=Z(c[V+56>>2]|0,p)|0;r=c[l+12>>2]|0;r:do if(r>>>0>1){k=c[l+16>>2]|0;switch(k|0){case 0:{k=c[l+20>>2]|0;l=0;do{if((c[k+(l<<2)>>2]|0)>>>0>q>>>0){k=4;break q}l=l+1|0}while(l>>>0<r>>>0);break}case 2:{o=c[l+24>>2]|0;k=c[l+28>>2]|0;n=0;do{l=c[o+(n<<2)>>2]|0;m=c[k+(n<<2)>>2]|0;if(!(l>>>0<=m>>>0&m>>>0<q>>>0)){k=4;break q}n=n+1|0;if(((l>>>0)%(p>>>0)|0)>>>0>((m>>>0)%(p>>>0)|0)>>>0){k=4;break q}}while(n>>>0<(r+-1|0)>>>0);break}default:{if((k+-3|0)>>>0<3)if((c[l+36>>2]|0)>>>0>q>>>0){k=4;break q}else break r;if((k|0)!=6)break r;if((c[l+40>>2]|0)>>>0<q>>>0){k=4;break q}else break r}}}while(0);k=c[e+4>>2]|0;do if((k|0)==256){c[e+4>>2]=t;k=c[s>>2]|0;c[e+12>>2]=k;k=c[k+4>>2]|0;c[e+8>>2]=k;Wa=c[e+20+(k<<2)>>2]|0;c[e+16>>2]=Wa;Va=c[Wa+52>>2]|0;Wa=c[Wa+56>>2]|0;c[e+1176>>2]=Z(Wa,Va)|0;c[e+1340>>2]=Va;c[e+1344>>2]=Wa;c[e+3380>>2]=1}else{if(!(c[e+3380>>2]|0)){if((k|0)==(t|0)){k=u;break}if((_|0)==(u|0)){c[e+4>>2]=t;c[e+12>>2]=c[s>>2];k=u;break}if((y|0)!=5){k=4;break q}c[e+4>>2]=t;k=c[s>>2]|0;c[e+12>>2]=k;k=c[k+4>>2]|0;c[e+8>>2]=k;Wa=c[e+20+(k<<2)>>2]|0;c[e+16>>2]=Wa;Va=c[Wa+52>>2]|0;Wa=c[Wa+56>>2]|0;c[e+1176>>2]=Z(Wa,Va)|0;c[e+1340>>2]=Va;c[e+1344>>2]=Wa;c[e+3380>>2]=1;break}c[e+3380>>2]=0;vb(c[e+1212>>2]|0);c[e+1212>>2]=0;vb(c[e+1172>>2]|0);c[e+1172>>2]=0;c[e+1212>>2]=ub((c[e+1176>>2]|0)*216|0)|0;Wa=ub(c[e+1176>>2]<<2)|0;c[e+1172>>2]=Wa;k=c[e+1212>>2]|0;if((Wa|0)==0|(k|0)==0){k=5;break q}xb(k|0,0,(c[e+1176>>2]|0)*216|0)|0;p=c[e+1212>>2]|0;k=c[e+16>>2]|0;q=c[k+52>>2]|0;r=c[e+1176>>2]|0;if(!r)l=k;else{m=0;n=0;o=0;while(1){k=(m|0)!=0;c[p+(n*216|0)+200>>2]=k?p+((n+-1|0)*216|0)|0:0;l=(o|0)!=0;do if(l){c[p+(n*216|0)+204>>2]=p+((n-q|0)*216|0);if(m>>>0>=(q+-1|0)>>>0){Xa=507;break}c[p+(n*216|0)+208>>2]=p+((1-q+n|0)*216|0)}else{c[p+(n*216|0)+204>>2]=0;Xa=507}while(0);if((Xa|0)==507){Xa=0;c[p+(n*216|0)+208>>2]=0}c[p+(n*216|0)+212>>2]=k&l?p+((n+~q|0)*216|0)|0:0;k=m+1|0;n=n+1|0;if((n|0)==(r|0))break;else{m=(k|0)==(q|0)?0:k;o=((k|0)==(q|0)&1)+o|0}}l=c[e+16>>2]|0}s:do if(!(c[e+1216>>2]|0)){if((c[l+16>>2]|0)==2){p=1;break}do if(c[l+80>>2]|0){k=c[l+84>>2]|0;if(!(c[k+920>>2]|0))break;if(!(c[k+944>>2]|0)){p=1;break s}}while(0);p=0}else p=1;while(0);r=Z(c[l+56>>2]|0,c[l+52>>2]|0)|0;n=c[l+88>>2]|0;o=c[l+44>>2]|0;m=c[l+12>>2]|0;k=c[e+1220>>2]|0;do if(!k)q=e+1248|0;else{if((c[e+1248>>2]|0)==-1){q=e+1248|0;break}else l=0;do{vb(c[k+(l*40|0)+4>>2]|0);k=c[e+1220>>2]|0;c[k+(l*40|0)+4>>2]=0;l=l+1|0}while(l>>>0<((c[e+1248>>2]|0)+1|0)>>>0);q=e+1248|0}while(0);vb(k);c[e+1220>>2]=0;vb(c[e+1224>>2]|0);c[e+1224>>2]=0;vb(c[e+1232>>2]|0);c[e+1232>>2]=0;c[e+1256>>2]=65535;k=o>>>0>1?o:1;c[e+1244>>2]=k;c[q>>2]=(p|0)==0?n:k;c[e+1252>>2]=m;c[e+1276>>2]=p;c[e+1264>>2]=0;c[e+1260>>2]=0;c[e+1268>>2]=0;k=ub(680)|0;c[e+1220>>2]=k;if(!k){k=5;break q}xb(k|0,0,680)|0;if((c[q>>2]|0)!=-1){m=0;do{k=ub(r*384|47)|0;l=c[e+1220>>2]|0;c[l+(m*40|0)+4>>2]=k;if(!k){k=5;break q}c[l+(m*40|0)>>2]=k+(0-k&15);m=m+1|0}while(m>>>0<((c[q>>2]|0)+1|0)>>>0)}c[e+1224>>2]=ub(68)|0;Wa=ub((c[q>>2]<<4)+16|0)|0;c[e+1232>>2]=Wa;k=c[e+1224>>2]|0;if((Wa|0)==0|(k|0)==0){k=5;break q}l=k;m=l+68|0;do{a[l>>0]=0;l=l+1|0}while((l|0)<(m|0));c[e+1240>>2]=0;c[e+1236>>2]=0;k=c[e+8>>2]|0}while(0);if((u|0)==(k|0))break p;w=c[e+16>>2]|0;k=c[e>>2]|0;if(k>>>0<32)v=c[e+20+(k<<2)>>2]|0;else v=0;c[j>>2]=0;c[e+3344>>2]=1;t:do if((y|0)==5){s=c[e+12>>2]|0;c[rb+604>>2]=c[rb+624>>2];c[rb+604+4>>2]=c[rb+624+4>>2];c[rb+604+8>>2]=c[rb+624+8>>2];c[rb+604+12>>2]=c[rb+624+12>>2];c[rb+604+16>>2]=c[rb+624+16>>2];k=Na(rb+604|0,rb+644|0)|0;u:do if(!k){k=Na(rb+604|0,rb+644|0)|0;if(k){l=1;break}k=Na(rb+604|0,rb+644|0)|0;if(k){l=1;break}k=c[w+12>>2]|0;r=0;while(1)if(!(k>>>r))break;else r=r+1|0;o=r+-1|0;t=rb+604+4|0;m=c[t>>2]|0;p=c[rb+604+12>>2]<<3;u=rb+604+16|0;q=c[u>>2]|0;do if((p-q|0)>31){l=c[rb+604+8>>2]|0;k=d[m+1>>0]<<16|d[m>>0]<<24|d[m+2>>0]<<8|d[m+3>>0];if(!l){l=rb+604+8|0;break}k=(d[m+4>>0]|0)>>>(8-l|0)|k<<l;l=rb+604+8|0}else{if((p-q|0)<=0){k=0;l=rb+604+8|0;break}l=c[rb+604+8>>2]|0;k=d[m>>0]<<l+24;if((p-q+-8+l|0)>0){n=p-q+-8+l|0;l=l+24|0}else{l=rb+604+8|0;break}while(1){m=m+1|0;l=l+-8|0;k=d[m>>0]<<l|k;if((n|0)<=8){l=rb+604+8|0;break}else n=n+-8|0}}while(0);c[u>>2]=o+q;c[l>>2]=o+q&7;if((o+q|0)>>>0>p>>>0){k=1;l=1;break}c[t>>2]=(c[rb+604>>2]|0)+((o+q|0)>>>3);if((k>>>(33-r|0)|0)==-1){k=1;l=1;break}k=Na(rb+604|0,rb+644|0)|0;if(k){l=1;break}k=c[w+16>>2]|0;do if(!k){k=c[w+20>>2]|0;r=0;while(1)if(!(k>>>r))break;else r=r+1|0;o=r+-1|0;m=c[t>>2]|0;p=c[rb+604+12>>2]<<3;q=c[u>>2]|0;do if((p-q|0)>31){l=c[rb+604+8>>2]|0;k=d[m+1>>0]<<16|d[m>>0]<<24|d[m+2>>0]<<8|d[m+3>>0];if(!l){l=rb+604+8|0;break}k=(d[m+4>>0]|0)>>>(8-l|0)|k<<l;l=rb+604+8|0}else{if((p-q|0)<=0){k=0;l=rb+604+8|0;break}l=c[rb+604+8>>2]|0;k=d[m>>0]<<l+24;if((p-q+-8+l|0)>0){n=p-q+-8+l|0;l=l+24|0}else{l=rb+604+8|0;break}while(1){m=m+1|0;l=l+-8|0;k=d[m>>0]<<l|k;if((n|0)<=8){l=rb+604+8|0;break}else n=n+-8|0}}while(0);c[u>>2]=o+q;c[l>>2]=o+q&7;if((o+q|0)>>>0>p>>>0){k=1;l=1;break u}c[t>>2]=(c[rb+604>>2]|0)+((o+q|0)>>>3);if((k>>>(33-r|0)|0)==-1){k=1;l=1;break u}if(!(c[s+8>>2]|0))break;c[rb+680>>2]=0;k=Na(rb+604|0,rb+680|0)|0;if((c[rb+680>>2]|0)==-1)if(!k)Xa=567;else Xa=566;else if(!k)Xa=566;else Xa=567;if((Xa|0)==566){ia=c[w+16>>2]|0;Xa=568;break}else if((Xa|0)==567){k=1;l=1;break u}}else{ia=k;Xa=568}while(0);do if((Xa|0)==568){if((ia|0)!=1)break;if(c[w+24>>2]|0)break;c[rb+680>>2]=0;k=Na(rb+604|0,rb+680|0)|0;if((c[rb+680>>2]|0)==-1){if(!k)Xa=573}else if(k)Xa=573;if((Xa|0)==573){k=1;l=1;break u}if(!(c[s+8>>2]|0))break;c[rb+680>>2]=0;k=Na(rb+604|0,rb+680|0)|0;if((c[rb+680>>2]|0)==-1)if(!k)Xa=579;else Xa=578;else if(!k)Xa=578;else Xa=579;if((Xa|0)==578)break;else if((Xa|0)==579){k=1;l=1;break u}}while(0);if((c[s+68>>2]|0)!=0?(ja=Na(rb+604|0,rb+644|0)|0,(ja|0)!=0):0){k=ja;l=1;break}m=c[t>>2]|0;o=c[rb+604+12>>2]<<3;p=c[u>>2]|0;do if((o-p|0)>31){k=c[rb+604+8>>2]|0;l=d[m+1>>0]<<16|d[m>>0]<<24|d[m+2>>0]<<8|d[m+3>>0];if(!k){k=rb+604+8|0;break}l=(d[m+4>>0]|0)>>>(8-k|0)|l<<k;k=rb+604+8|0}else{if((o-p|0)<=0){l=0;k=rb+604+8|0;break}k=c[rb+604+8>>2]|0;l=d[m>>0]<<k+24;if((o-p+-8+k|0)>0){n=o-p+-8+k|0;k=k+24|0}else{k=rb+604+8|0;break}while(1){m=m+1|0;k=k+-8|0;l=d[m>>0]<<k|l;if((n|0)<=8){k=rb+604+8|0;break}else n=n+-8|0}}while(0);c[u>>2]=p+1;c[k>>2]=p+1&7;if((p+1|0)>>>0>o>>>0)k=0;else{c[t>>2]=(c[rb+604>>2]|0)+((p+1|0)>>>3);k=1}l=k?l>>>31:-1;k=(l|0)==-1&1}else l=1;while(0);if(l|k){Xa=596;break}if((v|0)==0|(c[e+1276>>2]|0)!=0){Xa=596;break}if((c[v+52>>2]|0)!=(c[w+52>>2]|0)){Xa=596;break}if((c[v+56>>2]|0)!=(c[w+56>>2]|0)){Xa=596;break}if((c[v+88>>2]|0)!=(c[w+88>>2]|0)){Xa=596;break}n=c[e+1220>>2]|0;if(!n)break;c[e+1280>>2]=1;o=c[e+1248>>2]|0;k=0;l=2147483647;m=0;while(1){if(c[n+(k*40|0)+24>>2]|0){pb=c[n+(k*40|0)+16>>2]|0;qb=(pb|0)<(l|0);l=qb?pb:l;m=qb?n+(k*40|0)|0:m}k=k+1|0;if(k>>>0<=o>>>0)continue;if(!m)break t;qb=c[e+1236>>2]|0;pb=c[e+1232>>2]|0;c[pb+(qb<<4)>>2]=c[m>>2];c[pb+(qb<<4)+12>>2]=c[m+36>>2];c[pb+(qb<<4)+4>>2]=c[m+28>>2];c[pb+(qb<<4)+8>>2]=c[m+32>>2];c[e+1236>>2]=qb+1;c[m+24>>2]=0;if(c[m+20>>2]|0){k=0;l=2147483647;m=0;continue}c[e+1264>>2]=(c[e+1264>>2]|0)+-1;k=0;l=2147483647;m=0}}else Xa=596;while(0);if((Xa|0)==596)c[e+1280>>2]=0;c[e>>2]=c[e+8>>2];e=2;i=rb;return e|0}else k=4;while(0);c[e+4>>2]=256;c[e+12>>2]=0;c[e+8>>2]=32;c[e+16>>2]=0;c[e+3380>>2]=0;e=k;i=rb;return e|0}while(0);if(c[e+3380>>2]|0){e=3;i=rb;return e|0}o=c[e+16>>2]|0;s=c[e+12>>2]|0;xb(e+2356|0,0,988)|0;t=Z(c[o+56>>2]|0,c[o+52>>2]|0)|0;v:do if(((Na(rb+624|0,rb+604|0)|0)==0?(Wa=c[rb+604>>2]|0,c[e+2356>>2]=Wa,Wa>>>0<t>>>0):0)?(Na(rb+624|0,rb+604|0)|0)==0:0){Wa=c[rb+604>>2]|0;c[e+2360>>2]=Wa;switch(Wa|0){case 7:case 2:break;case 5:case 0:{if((y|0)==5)break v;if(!(c[o+44>>2]|0))break v;break}default:break v}if((Na(rb+624|0,rb+604|0)|0)==0?(Wa=c[rb+604>>2]|0,c[e+2364>>2]=Wa,(Wa|0)==(c[s>>2]|0)):0){k=c[o+12>>2]|0;l=0;while(1)if(!(k>>>l))break;else l=l+1|0;k=Ma(rb+624|0,l+-1|0)|0;if((k|0)==-1)break;if((k|0)!=0&(y|0)==5)break;c[e+2368>>2]=k;if((y|0)==5){if(Na(rb+624|0,rb+604|0)|0)break;Wa=c[rb+604>>2]|0;c[e+2372>>2]=Wa;if(Wa>>>0>65535)break}k=c[o+16>>2]|0;if(!k){k=c[o+20>>2]|0;l=0;while(1)if(!(k>>>l))break;else l=l+1|0;k=Ma(rb+624|0,l+-1|0)|0;if((k|0)==-1)break;c[e+2376>>2]=k;do if(c[s+8>>2]|0){c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1)if(!k)Xa=631;else{da=-2147483648;Xa=632}else{if(k){Xa=631;break}da=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0;Xa=632}while(0);if((Xa|0)==631)break v;else if((Xa|0)==632){c[e+2380>>2]=da;break}}while(0);if((y|0)==5){k=c[e+2376>>2]|0;if(k>>>0>(c[o+20>>2]|0)>>>1>>>0)break;Wa=c[e+2380>>2]|0;if((k|0)!=(((Wa|0)>0?0:0-Wa|0)|0))break}k=c[o+16>>2]|0}do if((k|0)==1){if(c[o+24>>2]|0)break;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1)if(!k)Xa=643;else ea=-2147483648;else{if(k){Xa=643;break}ea=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}while(0);if((Xa|0)==643)break v;c[e+2384>>2]=ea;do if(c[s+8>>2]|0){c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1)if(!k)Xa=649;else{fa=-2147483648;Xa=650}else{if(k){Xa=649;break}fa=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0;Xa=650}while(0);if((Xa|0)==649)break v;else if((Xa|0)==650){c[e+2388>>2]=fa;break}}while(0);if((y|0)!=5)break;Va=c[e+2384>>2]|0;Wa=(c[o+32>>2]|0)+Va+(c[e+2388>>2]|0)|0;if(((Va|0)<(Wa|0)?Va:Wa)|0)break v}while(0);if(c[s+68>>2]|0){if(Na(rb+624|0,rb+604|0)|0)break;Wa=c[rb+604>>2]|0;c[e+2392>>2]=Wa;if(Wa>>>0>127)break}k=c[e+2360>>2]|0;switch(k|0){case 5:case 0:{k=Ma(rb+624|0,1)|0;if((k|0)==-1)break v;c[e+2396>>2]=k;if(!k){k=c[s+48>>2]|0;if(k>>>0>16)break v;c[e+2400>>2]=k}else{if(Na(rb+624|0,rb+604|0)|0)break v;k=c[rb+604>>2]|0;if(k>>>0>15)break v;c[e+2400>>2]=k+1}k=c[e+2360>>2]|0;break}default:{}}w:do switch(k|0){case 5:case 0:{m=c[e+2400>>2]|0;n=c[o+12>>2]|0;k=Ma(rb+624|0,1)|0;x:do if((k|0)!=-1){c[e+2424>>2]=k;if(k){k=0;while(1){if(Na(rb+624|0,rb+644|0)|0)break x;l=c[rb+644>>2]|0;if(l>>>0>3)break x;c[e+2428+(k*12|0)>>2]=l;if(l>>>0<2){if(Na(rb+624|0,rb+680|0)|0)break x;l=c[rb+680>>2]|0;if(l>>>0>=n>>>0)break x;c[e+2428+(k*12|0)+4>>2]=l+1}else{if((l|0)!=2)break;if(Na(rb+624|0,rb+680|0)|0)break x;c[e+2428+(k*12|0)+8>>2]=c[rb+680>>2]}k=k+1|0;if(k>>>0>m>>>0)break x}if(!k)break}break w}while(0);break v}default:{}}while(0);do if(z){r=c[o+44>>2]|0;k=Ma(rb+624|0,1)|0;y:do if((y|0)==5){if((k|0)==-1){Xa=706;break}c[e+2632>>2]=k;k=Ma(rb+624|0,1)|0;if((k|0)==-1){Xa=706;break}c[e+2636>>2]=k;if((r|0)!=0|(k|0)==0)Xa=707;else Xa=706}else{if((k|0)==-1){Xa=706;break}c[e+2640>>2]=k;if(!k){Xa=707;break}m=0;n=0;o=0;p=0;q=0;while(1){if(m>>>0>((r<<1)+2|0)>>>0){Xa=706;break y}if(Na(rb+624|0,rb+644|0)|0){Xa=706;break y}l=c[rb+644>>2]|0;if(l>>>0>6){Xa=706;break y}c[e+2644+(m*20|0)>>2]=l;if((l&-3|0)==1){if(Na(rb+624|0,rb+680|0)|0){Xa=706;break y}c[e+2644+(m*20|0)+4>>2]=(c[rb+680>>2]|0)+1}switch(l|0){case 2:{if(Na(rb+624|0,rb+680|0)|0){Xa=706;break y}c[e+2644+(m*20|0)+8>>2]=c[rb+680>>2];ga=o;break}case 3:case 6:{if(Na(rb+624|0,rb+680|0)|0){Xa=706;break y}c[e+2644+(m*20|0)+12>>2]=c[rb+680>>2];if((l|0)==4)Xa=700;else ga=o;break}case 4:{Xa=700;break}default:ga=o}if((Xa|0)==700){Xa=0;if(Na(rb+624|0,rb+680|0)|0){Xa=706;break y}k=c[rb+680>>2]|0;if(k>>>0>r>>>0){Xa=706;break y}c[e+2644+(m*20|0)+16>>2]=(k|0)==0?65535:k+-1|0;ga=o+1|0}p=((l|0)==5&1)+p|0;n=((l+-1|0)>>>0<3&1)+n|0;q=((l|0)==6&1)+q|0;if(!l)break;else{m=m+1|0;o=ga}}if((p|ga|q)>>>0>1){Xa=706;break}if((p|0)!=0&(n|0)!=0)Xa=706;else Xa=707}while(0);if((Xa|0)==706)break v;else if((Xa|0)==707)break}while(0);c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1)if(!k)Xa=712;else ha=-2147483648;else{if(k){Xa=712;break}ha=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}while(0);if((Xa|0)==712)break;c[e+2404>>2]=ha;if(((c[s+52>>2]|0)+ha|0)>>>0>51)break;z:do if(c[s+60>>2]|0){if(Na(rb+624|0,rb+604|0)|0)break v;k=c[rb+604>>2]|0;c[e+2408>>2]=k;if(k>>>0>2)break v;if((k|0)==1)break;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1){if(!k)break;break v}else{if(k)break;k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0;if((k+6|0)>>>0>12)break v;c[e+2412>>2]=k<<1;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;do if((l|0)==-1){if(!k)break;break v}else{if(k)break;k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0;if((k+6|0)>>>0>12)break v;c[e+2416>>2]=k<<1;break z}while(0);break v}while(0);break v}while(0);do if((c[s+12>>2]|0)>>>0>1){if(((c[s+16>>2]|0)+-3|0)>>>0>=3)break;m=c[s+36>>2]|0;m=(((t>>>0)%(m>>>0)|0|0)==0?1:2)+((t>>>0)/(m>>>0)|0)|0;l=0;while(1){k=l+1|0;if(!(-1<<k&m))break;else l=k}k=Ma(rb+624|0,((1<<l)+-1&m|0)==0?l:k)|0;c[rb+604>>2]=k;if((k|0)==-1)break v;c[e+2420>>2]=k;Wa=c[s+36>>2]|0;if(k>>>0>(((t+-1+Wa|0)>>>0)/(Wa>>>0)|0)>>>0)break v}while(0);if(!(c[e+1188>>2]|0)){do if((y|0)!=5){t=c[e+2368>>2]|0;Wa=c[(c[e+16>>2]|0)+48>>2]|0;c[e+1236>>2]=0;c[e+1240>>2]=0;if(!Wa)break;u=c[e+1268>>2]|0;do if((u|0)!=(t|0)){k=c[e+1252>>2]|0;if((((u+1|0)>>>0)%(k>>>0)|0|0)==(t|0)){Xa=778;break}v=c[(c[e+1220>>2]|0)+((c[e+1248>>2]|0)*40|0)>>2]|0;n=k;s=((u+1|0)>>>0)%(k>>>0)|0;A:while(1){k=c[e+1260>>2]|0;if(!k)o=0;else{l=c[e+1220>>2]|0;m=0;do{if(((c[l+(m*40|0)+20>>2]|0)+-1|0)>>>0<2){Xa=c[l+(m*40|0)+12>>2]|0;c[l+(m*40|0)+8>>2]=Xa-(Xa>>>0>s>>>0?n:0)}m=m+1|0}while((m|0)!=(k|0));o=k}do if(o>>>0>=(c[e+1244>>2]|0)>>>0){if(!o){ka=3;Xa=1494;break A}p=c[e+1220>>2]|0;m=0;k=-1;l=0;while(1){if(((c[p+(m*40|0)+20>>2]|0)+-1|0)>>>0<2){Xa=c[p+(m*40|0)+8>>2]|0;Wa=(k|0)==-1|(Xa|0)<(l|0);n=Wa?m:k;l=Wa?Xa:l}else n=k;m=m+1|0;if((m|0)==(o|0))break;else k=n}if((n|0)<=-1){ka=3;Xa=1494;break A}c[p+(n*40|0)+20>>2]=0;k=o+-1|0;c[e+1260>>2]=k;if(c[p+(n*40|0)+24>>2]|0)break;c[e+1264>>2]=(c[e+1264>>2]|0)+-1}while(0);l=c[e+1264>>2]|0;r=c[e+1248>>2]|0;if(l>>>0>=r>>>0){q=(c[e+1276>>2]|0)==0;do do if(q){o=c[e+1220>>2]|0;p=0;m=2147483647;n=0;do{if(c[o+(p*40|0)+24>>2]|0){Wa=c[o+(p*40|0)+16>>2]|0;Xa=(Wa|0)<(m|0);m=Xa?Wa:m;n=Xa?o+(p*40|0)|0:n}p=p+1|0}while(p>>>0<=r>>>0);if(!n)break;Xa=c[e+1236>>2]|0;Wa=c[e+1232>>2]|0;c[Wa+(Xa<<4)>>2]=c[n>>2];c[Wa+(Xa<<4)+12>>2]=c[n+36>>2];c[Wa+(Xa<<4)+4>>2]=c[n+28>>2];c[Wa+(Xa<<4)+8>>2]=c[n+32>>2];c[e+1236>>2]=Xa+1;c[n+24>>2]=0;if(c[n+20>>2]|0)break;l=l+-1|0;c[e+1264>>2]=l}while(0);while(l>>>0>=r>>>0)}n=c[e+1220>>2]|0;c[n+(r*40|0)+20>>2]=1;c[n+(r*40|0)+12>>2]=s;c[n+(r*40|0)+8>>2]=s;c[n+(r*40|0)+16>>2]=0;c[n+(r*40|0)+24>>2]=0;c[e+1264>>2]=l+1;c[e+1260>>2]=k+1;_a(n,r+1|0);n=c[e+1252>>2]|0;s=((s+1|0)>>>0)%(n>>>0)|0;if((s|0)==(t|0)){Xa=770;break}}if((Xa|0)==770){k=c[e+1236>>2]|0;B:do if(k){l=c[e+1232>>2]|0;n=c[e+1248>>2]|0;o=c[e+1220>>2]|0;p=c[o+(n*40|0)>>2]|0;m=0;while(1){if((c[l+(m<<4)>>2]|0)==(p|0))break;m=m+1|0;if(m>>>0>=k>>>0)break B}if(!n)break;else l=0;while(1){k=o+(l*40|0)|0;l=l+1|0;if((c[k>>2]|0)==(v|0))break;if(l>>>0>=n>>>0)break B}c[k>>2]=p;c[o+(n*40|0)>>2]=v}while(0);if(z){Xa=782;break}la=c[e+1268>>2]|0;break}else if((Xa|0)==1494){i=rb;return ka|0}}else Xa=778;while(0);do if((Xa|0)==778){if(!z){la=u;break}if((u|0)==(t|0))ka=3;else{Xa=782;break}i=rb;return ka|0}while(0);if((Xa|0)==782){c[e+1268>>2]=t;break}if((la|0)==(t|0))break;Wa=c[e+1252>>2]|0;c[e+1268>>2]=((t+-1+Wa|0)>>>0)%(Wa>>>0)|0}while(0);Wa=(c[e+1220>>2]|0)+((c[e+1248>>2]|0)*40|0)|0;c[e+1228>>2]=Wa;c[e+1336>>2]=c[Wa>>2]}yb(e+1368|0,e+2356|0,988)|0;c[e+1188>>2]=1;c[e+1360>>2]=y;c[e+1360+4>>2]=z;k=c[e+1432>>2]|0;y=c[e+1172>>2]|0;m=c[e+12>>2]|0;g=c[e+16>>2]|0;x=c[g+52>>2]|0;g=c[g+56>>2]|0;t=Z(g,x)|0;s=c[m+12>>2]|0;C:do if((s|0)==1)xb(y|0,0,t<<2|0)|0;else{l=c[m+16>>2]|0;do if((l+-3|0)>>>0<3){k=Z(c[m+36>>2]|0,k)|0;k=k>>>0<t>>>0?k:t;if((l&-2|0)!=4){p=0;w=k;break}p=(c[m+32>>2]|0)==0?k:t-k|0;w=k}else{p=0;w=0}while(0);switch(l|0){case 0:{p=c[m+20>>2]|0;if(!t)break C;else{k=0;q=0}while(1){while(1)if(k>>>0<s>>>0)break;else k=0;o=p+(k<<2)|0;l=c[o>>2]|0;D:do if(!l)l=0;else{n=0;do{m=n+q|0;if(m>>>0>=t>>>0)break D;c[y+(m<<2)>>2]=k;n=n+1|0;l=c[o>>2]|0}while(n>>>0<l>>>0)}while(0);q=l+q|0;if(q>>>0>=t>>>0)break;else k=k+1|0}break}case 1:{if(!t)break C;else k=0;do{c[y+(k<<2)>>2]=((((Z((k>>>0)/(x>>>0)|0,s)|0)>>>1)+((k>>>0)%(x>>>0)|0)|0)>>>0)%(s>>>0)|0;k=k+1|0}while((k|0)!=(t|0));break}case 2:{r=c[m+24>>2]|0;q=c[m+28>>2]|0;if(t){k=0;do{c[y+(k<<2)>>2]=s+-1;k=k+1|0}while((k|0)!=(t|0));if(!(s+-1|0))break C}o=s+-2|0;while(1){k=c[r+(o<<2)>>2]|0;p=c[q+(o<<2)>>2]|0;E:do if(((k>>>0)/(x>>>0)|0)>>>0<=((p>>>0)/(x>>>0)|0)>>>0){if(((k>>>0)%(x>>>0)|0)>>>0>((p>>>0)%(x>>>0)|0)>>>0){k=(k>>>0)/(x>>>0)|0;while(1){k=k+1|0;if(k>>>0>((p>>>0)/(x>>>0)|0)>>>0)break E}}else n=(k>>>0)/(x>>>0)|0;do{l=Z(n,x)|0;m=(k>>>0)%(x>>>0)|0;do{c[y+(m+l<<2)>>2]=o;m=m+1|0}while(m>>>0<=((p>>>0)%(x>>>0)|0)>>>0);n=n+1|0}while(n>>>0<=((p>>>0)/(x>>>0)|0)>>>0)}while(0);if(!o)break;else o=o+-1|0}break}case 3:{v=c[m+32>>2]|0;if(t){k=0;do{c[y+(k<<2)>>2]=1;k=k+1|0}while((k|0)!=(t|0))}if(!w)break C;s=(g-v|0)>>>1;u=0;l=(x-v|0)>>>1;m=(x-v|0)>>>1;n=(g-v|0)>>>1;o=(x-v|0)>>>1;p=v+-1|0;q=(g-v|0)>>>1;r=v;while(1){k=y+((Z(q,x)|0)+o<<2)|0;t=(c[k>>2]|0)==1;if(t)c[k>>2]=0;do if(!((p|0)==-1&(o|0)==(l|0))){if((p|0)==1&(o|0)==(m|0)){o=m+1|0;o=(o|0)<(x+-1|0)?o:x+-1|0;k=s;m=o;p=0;r=1-(v<<1)|0;break}if((r|0)==-1&(q|0)==(n|0)){q=n+-1|0;q=(q|0)>0?q:0;k=s;n=q;p=1-(v<<1)|0;r=0;break}if((r|0)==1&(q|0)==(s|0)){q=s+1|0;q=(q|0)<(g+-1|0)?q:g+-1|0;k=q;p=(v<<1)+-1|0;r=0;break}else{k=s;o=o+p|0;q=q+r|0;break}}else{o=l+-1|0;o=(o|0)>0?o:0;k=s;l=o;p=0;r=(v<<1)+-1|0}while(0);u=(t&1)+u|0;if(u>>>0>=w>>>0)break;else s=k}break}case 4:{k=c[m+32>>2]|0;if(!t)break C;l=0;do{c[y+(l<<2)>>2]=l>>>0<p>>>0?k:1-k|0;l=l+1|0}while((l|0)!=(t|0));break}case 5:{k=c[m+32>>2]|0;if(!x)break C;if(!g)break C;else{m=0;n=0}while(1){l=0;o=n;while(1){Wa=y+((Z(l,x)|0)+m<<2)|0;c[Wa>>2]=o>>>0<p>>>0?k:1-k|0;l=l+1|0;if((l|0)==(g|0))break;else o=o+1|0}m=m+1|0;if((m|0)==(x|0))break;else n=n+g|0}break}default:{if(!t)break C;k=c[m+44>>2]|0;l=0;do{c[y+(l<<2)>>2]=c[k+(l<<2)>>2];l=l+1|0}while((l|0)!=(t|0))}}}while(0);o=c[e+1260>>2]|0;do if(!o){l=c[e+1380>>2]|0;p=c[e+1412>>2]|0;g=e+1412|0}else{k=0;do{c[(c[e+1224>>2]|0)+(k<<2)>>2]=(c[e+1220>>2]|0)+(k*40|0);k=k+1|0}while((k|0)!=(o|0));l=c[e+1380>>2]|0;p=c[e+1412>>2]|0;if(!o){g=e+1412|0;break}m=c[e+1220>>2]|0;n=0;do{if(((c[m+(n*40|0)+20>>2]|0)+-1|0)>>>0<2){k=c[m+(n*40|0)+12>>2]|0;if(k>>>0>l>>>0)k=k-(c[e+1252>>2]|0)|0;c[m+(n*40|0)+8>>2]=k}n=n+1|0}while((n|0)!=(o|0));g=e+1412|0}while(0);F:do if(c[e+1436>>2]|0){k=c[e+1440>>2]|0;if(k>>>0>=3)break;r=l;s=0;G:while(1){H:do if(k>>>0<2){m=c[e+1440+(s*12|0)+4>>2]|0;do if(!k){k=r-m|0;if((k|0)>=0)break;k=(c[e+1252>>2]|0)+k|0}else{Wa=m+r|0;k=c[e+1252>>2]|0;k=Wa-((Wa|0)<(k|0)?0:k)|0}while(0);if(k>>>0>l>>>0)q=k-(c[e+1252>>2]|0)|0;else q=k;m=c[e+1244>>2]|0;if(!m){ka=3;Xa=1494;break G}n=c[e+1220>>2]|0;r=0;while(1){o=c[n+(r*40|0)+20>>2]|0;if((o+-1|0)>>>0<2?(c[n+(r*40|0)+8>>2]|0)==(q|0):0){q=r;r=k;break H}r=r+1|0;if(r>>>0>=m>>>0){ka=3;Xa=1494;break G}}}else{k=c[e+1440+(s*12|0)+8>>2]|0;m=c[e+1244>>2]|0;if(!m){ka=3;Xa=1494;break G}n=c[e+1220>>2]|0;q=0;while(1){if((c[n+(q*40|0)+20>>2]|0)==3?(c[n+(q*40|0)+8>>2]|0)==(k|0):0){o=3;break H}q=q+1|0;if(q>>>0>=m>>>0){ka=3;Xa=1494;break G}}}while(0);if(!(o>>>0>1&(q|0)>-1)){ka=3;Xa=1494;break}if(s>>>0<p>>>0){k=p;do{Wa=k;k=k+-1|0;Va=c[e+1224>>2]|0;c[Va+(Wa<<2)>>2]=c[Va+(k<<2)>>2]}while(k>>>0>s>>>0);k=c[e+1220>>2]|0}else k=n;c[(c[e+1224>>2]|0)+(s<<2)>>2]=k+(q*40|0);s=s+1|0;if(s>>>0<=p>>>0){o=s;k=s;do{m=c[e+1224>>2]|0;n=c[m+(o<<2)>>2]|0;if((n|0)!=((c[e+1220>>2]|0)+(q*40|0)|0)){c[m+(k<<2)>>2]=n;k=k+1|0}o=o+1|0}while(o>>>0<=p>>>0)}k=c[e+1440+(s*12|0)>>2]|0;if(k>>>0>=3)break F}if((Xa|0)==1494){i=rb;return ka|0}}while(0);u=c[e+3376>>2]|0;t=c[e+1368>>2]|0;c[rb+168>>2]=0;c[e+1192>>2]=(c[e+1192>>2]|0)+1;c[e+1200>>2]=0;c[rb+164>>2]=(c[e+1416>>2]|0)+(c[(c[e+12>>2]|0)+52>>2]|0);v=rb+624+16|0;q=c[e+1212>>2]|0;m=0;w=0;n=0;I:while(1){if((c[e+1404>>2]|0)==0?(c[q+(t*216|0)+196>>2]|0)!=0:0){ta=1;break}l=c[(c[e+12>>2]|0)+56>>2]|0;Ua=c[e+1420>>2]|0;Va=c[e+1424>>2]|0;Wa=c[e+1428>>2]|0;c[q+(t*216|0)+4>>2]=c[e+1192>>2];c[q+(t*216|0)+8>>2]=Ua;c[q+(t*216|0)+12>>2]=Va;c[q+(t*216|0)+16>>2]=Wa;c[q+(t*216|0)+24>>2]=l;l=c[e+1372>>2]|0;do if((l|0)!=2){if((n|0)!=0|(l|0)==7){Xa=889;break}k=Na(rb+624|0,rb+168|0)|0;if(k){ta=k;break I}k=c[rb+168>>2]|0;if(k>>>0>((c[e+1176>>2]|0)-t|0)>>>0){ta=1;break I}if(!k){xa=c[e+1212>>2]|0;ya=c[e+1372>>2]|0;Xa=891;break}else{xb(u+12|0,0,164)|0;c[u>>2]=0;wa=k;Ca=1;Xa=890;break}}else Xa=889;while(0);if((Xa|0)==889)if(!m){xa=q;ya=l;Xa=891}else{wa=m;Ca=n;Xa=890}if((Xa|0)==890){Xa=0;ma=wa+-1|0;c[rb+168>>2]=ma;na=Ca}else if((Xa|0)==891){Xa=0;s=xa+(t*216|0)|0;o=c[g>>2]|0;xb(u|0,0,2088)|0;k=Na(rb+624|0,rb+604|0)|0;l=c[rb+604>>2]|0;switch(ya|0){case 2:case 7:{if((k|0)!=0|(l+6|0)>>>0>31){Ea=1;Xa=1092;break I}else n=l+6|0;break}default:if((k|0)!=0|(l+1|0)>>>0>31){Ea=1;Xa=1092;break I}else n=l+1|0}c[u>>2]=n;do if((n|0)!=31){Wa=n>>>0<6;r=Wa?2:(n|0)!=6&1;if(n>>>0<4|Wa^1){J:do switch(r|0){case 2:{K:do if(o>>>0>1){switch(n|0){case 0:case 1:{k=0;break}case 3:case 2:{k=1;break}default:k=3}if(o>>>0>2){m=0;while(1){if(Na(rb+624|0,rb+644|0)|0){ra=1;break J}l=c[rb+644>>2]|0;if(l>>>0>=o>>>0){ra=1;break J}c[u+144+(m<<2)>>2]=l;if(!k)break K;else{k=k+-1|0;m=m+1|0}}}else l=0;while(1){m=Ma(rb+624|0,1)|0;if((m|0)==-1){Aa=-1;Xa=1048;break}if((m^1)>>>0>=o>>>0){Aa=m^1;Xa=1048;break}c[u+144+(l<<2)>>2]=m^1;if(!k){Xa=1004;break}else{k=k+-1|0;l=l+1|0}}if((Xa|0)==1004){Xa=0;c[rb+644>>2]=m^1;break}else if((Xa|0)==1048){Xa=0;c[rb+644>>2]=Aa;ra=1;break J}}while(0);switch(n|0){case 0:case 1:{m=0;n=0;break}case 3:case 2:{m=1;n=0;break}default:{m=3;n=0}}while(1){c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=1012;break}else k=-2147483648;else{if(k){Xa=1012;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+160+(n<<2)>>1]=k;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=1017;break}else k=-2147483648;else{if(k){Xa=1017;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+160+(n<<2)+2>>1]=k;if(!m){ra=0;break J}else{m=m+-1|0;n=n+1|0}}if((Xa|0)==1012){Xa=0;ra=1;break J}else if((Xa|0)==1017){Xa=0;ra=1;break J}break}case 0:{k=c[A>>2]|0;l=c[v>>2]|0;o=c[rb+624+4>>2]|0;p=0;q=0;while(1){l=(k<<3)-l|0;do if((l|0)>31){k=c[B>>2]|0;l=d[o+1>>0]<<16|d[o>>0]<<24|d[o+2>>0]<<8|d[o+3>>0];if(!k){pa=l;Xa=1026;break}pa=(d[o+4>>0]|0)>>>(8-k|0)|l<<k;Xa=1026}else{if((l|0)<=0){c[u+12+(q<<2)>>2]=0;ua=0;Xa=1027;break}m=c[B>>2]|0;k=d[o>>0]<<m+24;if((l+-8+m|0)>0){n=l+-8+m|0;l=m+24|0}else{pa=k;Xa=1026;break}while(1){o=o+1|0;l=l+-8|0;k=d[o>>0]<<l|k;if((n|0)<=8){pa=k;Xa=1026;break}else n=n+-8|0}}while(0);if((Xa|0)==1026){Xa=0;Wa=pa>>>31;c[u+12+(q<<2)>>2]=Wa;if(!Wa){ua=pa;Xa=1027}else{za=pa<<1;Da=0}}if((Xa|0)==1027){c[u+76+(q<<2)>>2]=ua>>>28&7;za=ua<<4;Da=1}l=q|1;Xa=za>>>31;c[u+12+(l<<2)>>2]=Xa;if(!Xa){c[u+76+(l<<2)>>2]=za>>>28&7;m=za<<4;k=Da+1|0}else{m=za<<1;k=Da}Xa=m>>>31;c[u+12+(l+1<<2)>>2]=Xa;if(!Xa){c[u+76+(l+1<<2)>>2]=m>>>28&7;l=m<<4;k=k+1|0}else l=m<<1;m=q|3;Xa=l>>>31;c[u+12+(m<<2)>>2]=Xa;if(!Xa){c[u+76+(m<<2)>>2]=l>>>28&7;l=l<<4;k=k+1|0}else l=l<<1;Xa=l>>>31;c[u+12+(m+1<<2)>>2]=Xa;if(!Xa){c[u+76+(m+1<<2)>>2]=l>>>28&7;l=l<<4;k=k+1|0}else l=l<<1;Xa=l>>>31;c[u+12+(m+2<<2)>>2]=Xa;if(!Xa){c[u+76+(m+2<<2)>>2]=l>>>28&7;l=l<<4;k=k+1|0}else l=l<<1;Xa=l>>>31;c[u+12+(m+3<<2)>>2]=Xa;if(!Xa){c[u+76+(m+3<<2)>>2]=l>>>28&7;m=l<<4;k=k+1|0}else m=l<<1;l=q|7;Xa=m>>>31;c[u+12+(l<<2)>>2]=Xa;if(!Xa){c[u+76+(l<<2)>>2]=m>>>28&7;m=m<<4;k=k+1|0}else m=m<<1;l=(k*3|0)+8+(c[v>>2]|0)|0;c[v>>2]=l;c[B>>2]=l&7;k=c[A>>2]|0;if(l>>>0>k<<3>>>0){Xa=1033;break}o=(c[rb+624>>2]|0)+(l>>>3)|0;c[rb+624+4>>2]=o;p=p+1|0;if((p|0)>=2){Xa=1030;break}else q=q+8|0}if((Xa|0)==1030){c[rb+644>>2]=m;Xa=1031;break J}else if((Xa|0)==1033){Xa=0;c[rb+644>>2]=m;ra=1;break J}break}case 1:{Xa=1031;break}default:ra=0}while(0);do if((Xa|0)==1031){Xa=0;Wa=(Na(rb+624|0,rb+644|0)|0)!=0;k=c[rb+644>>2]|0;if(Wa|k>>>0>3){ra=1;break}c[u+140>>2]=k;ra=0}while(0);k=ra}else{Wa=(Na(rb+624|0,rb+644|0)|0)!=0;k=c[rb+644>>2]|0;L:do if(!(Wa|k>>>0>3)){c[u+176>>2]=k;Wa=(Na(rb+624|0,rb+644|0)|0)!=0;k=c[rb+644>>2]|0;if(Wa|k>>>0>3){sa=1;break}c[u+180>>2]=k;Wa=(Na(rb+624|0,rb+644|0)|0)!=0;k=c[rb+644>>2]|0;if(Wa|k>>>0>3){sa=1;break}c[u+184>>2]=k;Wa=(Na(rb+624|0,rb+644|0)|0)!=0;k=c[rb+644>>2]|0;if(Wa|k>>>0>3){sa=1;break}c[u+188>>2]=k;if(o>>>0>1&(n|0)!=5){if(o>>>0>2){if(Na(rb+624|0,rb+644|0)|0){sa=1;break}k=c[rb+644>>2]|0}else{k=Ma(rb+624|0,1)|0;c[rb+644>>2]=k;if((k|0)==-1){sa=1;break}c[rb+644>>2]=k^1;k=k^1}if(k>>>0>=o>>>0){sa=1;break}c[u+192>>2]=k;if(o>>>0>2){if(Na(rb+624|0,rb+644|0)|0){sa=1;break}k=c[rb+644>>2]|0}else{k=Ma(rb+624|0,1)|0;c[rb+644>>2]=k;if((k|0)==-1){sa=1;break}c[rb+644>>2]=k^1;k=k^1}if(k>>>0>=o>>>0){sa=1;break}c[u+196>>2]=k;if(o>>>0>2){if(Na(rb+624|0,rb+644|0)|0){sa=1;break}k=c[rb+644>>2]|0}else{k=Ma(rb+624|0,1)|0;c[rb+644>>2]=k;if((k|0)==-1){sa=1;break}c[rb+644>>2]=k^1;k=k^1}if(k>>>0>=o>>>0){sa=1;break}c[u+200>>2]=k;if(o>>>0>2){if(Na(rb+624|0,rb+644|0)|0){sa=1;break}k=c[rb+644>>2]|0}else{k=Ma(rb+624|0,1)|0;c[rb+644>>2]=k;if((k|0)==-1){sa=1;break}c[rb+644>>2]=k^1;k=k^1}if(k>>>0>=o>>>0){sa=1;break}c[u+204>>2]=k}switch(c[u+176>>2]|0){case 0:{k=0;break}case 2:case 1:{k=1;break}default:k=3}c[rb+644>>2]=k;m=0;while(1){c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=921;break}else k=-2147483648;else{if(k){Xa=921;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+208+(m<<2)>>1]=k;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=926;break}else k=-2147483648;else{if(k){Xa=926;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+208+(m<<2)+2>>1]=k;Xa=c[rb+644>>2]|0;c[rb+644>>2]=Xa+-1;if(!Xa){Xa=928;break}else m=m+1|0}if((Xa|0)==921){Xa=0;sa=1;break}else if((Xa|0)==926){Xa=0;sa=1;break}else if((Xa|0)==928){switch(c[u+180>>2]|0){case 0:{k=0;break}case 2:case 1:{k=1;break}default:k=3}c[rb+644>>2]=k;m=0;while(1){c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=936;break}else k=-2147483648;else{if(k){Xa=936;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+224+(m<<2)>>1]=k;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=941;break}else k=-2147483648;else{if(k){Xa=941;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+224+(m<<2)+2>>1]=k;Xa=c[rb+644>>2]|0;c[rb+644>>2]=Xa+-1;if(!Xa){Xa=943;break}else m=m+1|0}if((Xa|0)==936){Xa=0;sa=1;break}else if((Xa|0)==941){Xa=0;sa=1;break}else if((Xa|0)==943){switch(c[u+184>>2]|0){case 0:{k=0;break}case 2:case 1:{k=1;break}default:k=3}c[rb+644>>2]=k;m=0;while(1){c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=951;break}else k=-2147483648;else{if(k){Xa=951;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+240+(m<<2)>>1]=k;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=956;break}else k=-2147483648;else{if(k){Xa=956;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+240+(m<<2)+2>>1]=k;Xa=c[rb+644>>2]|0;c[rb+644>>2]=Xa+-1;if(!Xa){Xa=958;break}else m=m+1|0}if((Xa|0)==951){Xa=0;sa=1;break}else if((Xa|0)==956){Xa=0;sa=1;break}else if((Xa|0)==958){Xa=0;switch(c[u+188>>2]|0){case 0:{k=0;break}case 2:case 1:{k=1;break}default:k=3}c[rb+644>>2]=k;m=0;while(1){c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=966;break}else k=-2147483648;else{if(k){Xa=966;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+256+(m<<2)>>1]=k;c[rb+680>>2]=0;k=Na(rb+624|0,rb+680|0)|0;l=c[rb+680>>2]|0;if((l|0)==-1)if(!k){Xa=971;break}else k=-2147483648;else{if(k){Xa=971;break}k=(l&1|0)!=0?(l+1|0)>>>1:0-((l+1|0)>>>1)|0}b[u+256+(m<<2)+2>>1]=k;Wa=c[rb+644>>2]|0;c[rb+644>>2]=Wa+-1;if(!Wa){sa=0;break L}else m=m+1|0}if((Xa|0)==966){Xa=0;sa=1;break}else if((Xa|0)==971){Xa=0;sa=1;break}}}}}else sa=1;while(0);k=sa}if(k){Ea=1;Xa=1092;break I}if((r|0)!=1){if(Na(rb+624|0,rb+680|0)|0){Xa=1054;break I}k=c[rb+680>>2]|0;if(k>>>0>47){Xa=1054;break I}Wa=a[((r|0)==0?5624:5576)+k>>0]|0;c[rb+604>>2]=Wa&255;c[u+4>>2]=Wa&255;if(!(Wa<<24>>24))break}else{Wa=c[u>>2]|0;c[u+4>>2]=((Wa+-7|0)>>>0>11?((Wa+-7|0)>>>2)+268435453|0:(Wa+-7|0)>>>2)<<4|(Wa>>>0>18?15:0)}c[rb+680>>2]=0;Wa=Na(rb+624|0,rb+680|0)|0;k=c[rb+680>>2]|0;if((Wa|0)!=0|(k|0)==-1){Xa=1058;break I}k=(k&1|0)!=0?(k+1|0)>>>1:0-((k+1|0)>>>1)|0;if((k+26|0)>>>0>51){Ea=1;Xa=1092;break I}c[u+8>>2]=k;l=c[u+4>>2]|0;M:do if((c[u>>2]|0)>>>0>6){k=c[xa+(t*216|0)+200>>2]|0;do if(!k){m=0;n=0}else{if((c[xa+(t*216|0)+4>>2]|0)!=(c[k+4>>2]|0)){m=0;n=0;break}m=b[k+38>>1]|0;n=1}while(0);k=c[xa+(t*216|0)+204>>2]|0;do if(!k)k=m;else{if((c[xa+(t*216|0)+4>>2]|0)!=(c[k+4>>2]|0)){k=m;break}k=b[k+48>>1]|0;if(!n)break;k=m+1+k>>1}while(0);k=Oa(rb+624|0,u+1864|0,k,16)|0;if(k&15){qa=k;break}b[u+320>>1]=k>>>4&255;o=3;m=0;while(1){n=l>>>1;if(l&1){k=Oa(rb+624|0,u+328+(m<<6)+4|0,La(s,m,u+272|0)|0,15)|0;c[u+1992+(m<<2)>>2]=k>>>15;if(k&15){qa=k;break M}b[u+272+(m<<1)>>1]=k>>>4&255;k=m|1;l=Oa(rb+624|0,u+328+(k<<6)+4|0,La(s,k,u+272|0)|0,15)|0;c[u+1992+(k<<2)>>2]=l>>>15;if(l&15){qa=l;break M}b[u+272+(k<<1)>>1]=l>>>4&255;k=m|2;l=Oa(rb+624|0,u+328+(k<<6)+4|0,La(s,k,u+272|0)|0,15)|0;c[u+1992+(k<<2)>>2]=l>>>15;if(l&15){qa=l;break M}b[u+272+(k<<1)>>1]=l>>>4&255;k=m|3;l=Oa(rb+624|0,u+328+(k<<6)+4|0,La(s,k,u+272|0)|0,15)|0;c[u+1992+(k<<2)>>2]=l>>>15;if(l&15){qa=l;break M}b[u+272+(k<<1)>>1]=l>>>4&255}k=m+4|0;if(!o){va=n;Ba=k;Xa=1080;break}else{l=n;o=o+-1|0;m=k}}}else{o=3;m=0;while(1){n=l>>>1;if(l&1){k=Oa(rb+624|0,u+328+(m<<6)|0,La(s,m,u+272|0)|0,16)|0;c[u+1992+(m<<2)>>2]=k>>>16;if(k&15){qa=k;break M}b[u+272+(m<<1)>>1]=k>>>4&255;k=m|1;l=Oa(rb+624|0,u+328+(k<<6)|0,La(s,k,u+272|0)|0,16)|0;c[u+1992+(k<<2)>>2]=l>>>16;if(l&15){qa=l;break M}b[u+272+(k<<1)>>1]=l>>>4&255;k=m|2;l=Oa(rb+624|0,u+328+(k<<6)|0,La(s,k,u+272|0)|0,16)|0;c[u+1992+(k<<2)>>2]=l>>>16;if(l&15){qa=l;break M}b[u+272+(k<<1)>>1]=l>>>4&255;k=m|3;l=Oa(rb+624|0,u+328+(k<<6)|0,La(s,k,u+272|0)|0,16)|0;c[u+1992+(k<<2)>>2]=l>>>16;if(l&15){qa=l;break M}b[u+272+(k<<1)>>1]=l>>>4&255}k=m+4|0;if(!o){va=n;Ba=k;Xa=1080;break}else{l=n;o=o+-1|0;m=k}}}while(0);N:do if((Xa|0)==1080){Xa=0;if(va&3){k=Oa(rb+624|0,u+1928|0,-1,4)|0;if(k&15){qa=k;break}b[u+322>>1]=k>>>4&255;k=Oa(rb+624|0,u+1944|0,-1,4)|0;if(k&15){qa=k;break}b[u+324>>1]=k>>>4&255}if(!(va&2)){qa=0;break}else{l=7;m=Ba}while(1){k=Oa(rb+624|0,u+328+(m<<6)+4|0,La(s,m,u+272|0)|0,15)|0;if(k&15){qa=k;break N}b[u+272+(m<<1)>>1]=k>>>4&255;c[u+1992+(m<<2)>>2]=k>>>15;if(!l){qa=0;break}else{l=l+-1|0;m=m+1|0}}}while(0);c[v>>2]=((c[rb+624+4>>2]|0)-(c[rb+624>>2]|0)<<3)+(c[B>>2]|0);if(qa){Ea=qa;Xa=1092;break I}}else{while(1){if(!(c[B>>2]|0)){l=0;m=u+328|0;break}if(Ma(rb+624|0,1)|0){Ea=1;Xa=1092;break I}}while(1){k=Ma(rb+624|0,8)|0;c[rb+604>>2]=k;if((k|0)==-1){Ea=1;Xa=1092;break I}c[m>>2]=k;l=l+1|0;if(l>>>0>=384)break;else m=m+4|0}}while(0);ma=0;na=0}k=Ka((c[e+1212>>2]|0)+(t*216|0)|0,u,e+1336|0,e+1220|0,rb+164|0,t,c[(c[e+12>>2]|0)+64>>2]|0,rb+172+(0-(rb+172)&15)|0)|0;if(k){ta=k;break}q=c[e+1212>>2]|0;w=((c[q+(t*216|0)+196>>2]|0)==1&1)+w|0;o=c[A>>2]<<3;p=c[v>>2]|0;do if((o|0)==(p|0))k=0;else{if((o-p|0)>>>0>8){k=1;break}l=c[rb+624+4>>2]|0;do if((o-p|0)>0){m=c[B>>2]|0;k=d[l>>0]<<m+24;if((o-p+-8+m|0)>0){n=o-p+-8+m|0;m=m+24|0}else break;while(1){l=l+1|0;m=m+-8|0;k=d[l>>0]<<m|k;if((n|0)<=8)break;else n=n+-8|0}}else k=0;while(0);k=(k>>>(32-(o-p)|0)|0)!=(1<<o-p+-1|0)&1}while(0);l=(ma|k|0)!=0;switch(c[e+1372>>2]|0){case 7:case 2:{c[e+1200>>2]=t;break}default:{}}m=c[e+1172>>2]|0;oa=c[e+1176>>2]|0;n=c[m+(t<<2)>>2]|0;k=t;do{k=k+1|0;if(k>>>0>=oa>>>0)break}while((c[m+(k<<2)>>2]|0)!=(n|0));t=(k|0)==(oa|0)?0:k;if(!((t|0)!=0|l^1)){ta=1;break}if(!l){Xa=1108;break}else{m=ma;n=na}}do if((Xa|0)==1054){Ea=1;Xa=1092}else if((Xa|0)==1058){Ea=1;Xa=1092}else if((Xa|0)==1108){k=(c[e+1196>>2]|0)+w|0;if(k>>>0>oa>>>0){ta=1;break}c[e+1196>>2]=k;ta=0}while(0);if((Xa|0)==1092)ta=Ea;if(!ta){do if(!(c[e+1404>>2]|0)){if((c[e+1196>>2]|0)==(c[e+1176>>2]|0))break;else ka=0;i=rb;return ka|0}else{k=c[e+1176>>2]|0;if(!k)break;l=c[e+1212>>2]|0;m=0;n=0;do{n=((c[l+(m*216|0)+196>>2]|0)!=0&1)+n|0;m=m+1|0}while((m|0)!=(k|0));if((n|0)==(k|0))break;else ka=0;i=rb;return ka|0}while(0);c[e+1180>>2]=1;Ua=e+16|0;Wa=e+1188|0;Ta=e+1212|0;Va=e+1336|0;break i}m=c[e+1368>>2]|0;p=c[e+1192>>2]|0;k=c[e+1200>>2]|0;O:do if(!k)k=m;else{l=0;do{do{k=k+-1|0;if(k>>>0<=m>>>0)break O}while((c[(c[e+1212>>2]|0)+(k*216|0)+4>>2]|0)!=(p|0));l=l+1|0;qb=c[(c[e+16>>2]|0)+52>>2]|0}while(l>>>0<(qb>>>0>10?qb:10)>>>0)}while(0);o=c[e+1212>>2]|0;while(1){if((c[o+(k*216|0)+4>>2]|0)!=(p|0)){ka=3;Xa=1494;break}l=o+(k*216|0)+196|0;m=c[l>>2]|0;if(!m){ka=3;Xa=1494;break}c[l>>2]=m+-1;l=c[e+1172>>2]|0;m=c[e+1176>>2]|0;n=c[l+(k<<2)>>2]|0;do{k=k+1|0;if(k>>>0>=m>>>0)break}while((c[l+(k<<2)>>2]|0)!=(n|0));k=(k|0)==(m|0)?0:k;if(!k){ka=3;Xa=1494;break}}if((Xa|0)==1494){i=rb;return ka|0}}}while(0);e=3;i=rb;return e|0}default:{e=0;i=rb;return e|0}}while(0);ka=c[Va+4>>2]|0;la=Va+8|0;k=c[la>>2]|0;ma=Z(k,ka)|0;if(k){na=rb+680+120|0;oa=rb+680+112|0;pa=rb+680+104|0;qa=rb+680+96|0;ra=rb+680+88|0;sa=rb+680+80|0;ta=rb+680+72|0;ua=rb+680+64|0;va=rb+680+56|0;wa=rb+680+48|0;xa=rb+680+40|0;ya=rb+680+32|0;za=rb+680+124|0;Aa=rb+680+116|0;Ba=rb+680+108|0;Ca=rb+680+92|0;Da=rb+680+84|0;Ea=rb+680+76|0;Fa=rb+680+60|0;Ga=rb+680+52|0;Ha=rb+680+44|0;Ia=rb+680+28|0;Ja=rb+680+20|0;Pa=rb+680+12|0;Qa=Z(ka,-48)|0;Ra=rb+644+24|0;Sa=rb+644+12|0;ha=0;ia=0;ja=c[Ta>>2]|0;while(1){m=c[ja+8>>2]|0;P:do if((m|0)!=1){ga=ja+200|0;j=c[ga>>2]|0;do if(!j)l=1;else{if((m|0)==2?(c[ja+4>>2]|0)!=(c[j+4>>2]|0):0){l=1;break}l=5}while(0);fa=ja+204|0;ca=c[fa>>2]|0;do if(ca){if((m|0)==2?(c[ja+4>>2]|0)!=(c[ca+4>>2]|0):0)break;l=l|2}while(0);ea=(l&2|0)==0;Q:do if(ea){c[rb+680+24>>2]=0;c[rb+680+16>>2]=0;c[rb+680+8>>2]=0;c[rb+680>>2]=0;q=0}else{do if((c[ja>>2]|0)>>>0<=5){if((c[ca>>2]|0)>>>0>5)break;do if(!(b[ja+28>>1]|0)){if(b[ca+48>>1]|0){m=2;break}if((c[ja+116>>2]|0)!=(c[ca+124>>2]|0)){m=1;break}Xa=(b[ja+132>>1]|0)-(b[ca+172>>1]|0)|0;if((((Xa|0)<0?0-Xa|0:Xa)|0)>3){m=1;break}m=(b[ja+134>>1]|0)-(b[ca+174>>1]|0)|0;m=(((m|0)<0?0-m|0:m)|0)>3&1}else m=2;while(0);c[rb+680>>2]=m;do if(!(b[ja+30>>1]|0)){if(b[ca+50>>1]|0){n=2;break}if((c[ja+116>>2]|0)!=(c[ca+124>>2]|0)){n=1;break}Xa=(b[ja+136>>1]|0)-(b[ca+176>>1]|0)|0;if((((Xa|0)<0?0-Xa|0:Xa)|0)>3){n=1;break}n=(b[ja+138>>1]|0)-(b[ca+178>>1]|0)|0;n=(((n|0)<0?0-n|0:n)|0)>3&1}else n=2;while(0);c[rb+680+8>>2]=n;do if(!(b[ja+36>>1]|0)){if(b[ca+56>>1]|0){o=2;break}if((c[ja+120>>2]|0)!=(c[ca+128>>2]|0)){o=1;break}Xa=(b[ja+148>>1]|0)-(b[ca+188>>1]|0)|0;if((((Xa|0)<0?0-Xa|0:Xa)|0)>3){o=1;break}o=(b[ja+150>>1]|0)-(b[ca+190>>1]|0)|0;o=(((o|0)<0?0-o|0:o)|0)>3&1}else o=2;while(0);c[rb+680+16>>2]=o;do if(!(b[ja+38>>1]|0)){if(b[ca+58>>1]|0){p=2;break}if((c[ja+120>>2]|0)!=(c[ca+128>>2]|0)){p=1;break}Xa=(b[ja+152>>1]|0)-(b[ca+192>>1]|0)|0;if((((Xa|0)<0?0-Xa|0:Xa)|0)>3){p=1;break}p=(b[ja+154>>1]|0)-(b[ca+194>>1]|0)|0;p=(((p|0)<0?0-p|0:p)|0)>3&1}else p=2;while(0);c[rb+680+24>>2]=p;q=(n|m|o|p|0)!=0&1;break Q}while(0);c[rb+680+24>>2]=4;c[rb+680+16>>2]=4;c[rb+680+8>>2]=4;c[rb+680>>2]=4;q=1}while(0);da=(l&4|0)==0;R:do if(da){c[rb+680+100>>2]=0;c[rb+680+68>>2]=0;c[rb+680+36>>2]=0;c[rb+680+4>>2]=0;$a=c[ja>>2]|0;ib=q;Xa=1194}else{p=c[ja>>2]|0;do if(p>>>0<=5){if((c[j>>2]|0)>>>0>5)break;do if(!(b[ja+28>>1]|0)){if(b[j+38>>1]|0){l=2;break}if((c[ja+116>>2]|0)!=(c[j+120>>2]|0)){l=1;break}gb=(b[ja+132>>1]|0)-(b[j+152>>1]|0)|0;if((((gb|0)<0?0-gb|0:gb)|0)>3){l=1;break}l=(b[ja+134>>1]|0)-(b[j+154>>1]|0)|0;l=(((l|0)<0?0-l|0:l)|0)>3&1}else l=2;while(0);c[rb+680+4>>2]=l;do if(!(b[ja+32>>1]|0)){if(b[j+42>>1]|0){m=2;break}if((c[ja+116>>2]|0)!=(c[j+120>>2]|0)){m=1;break}gb=(b[ja+140>>1]|0)-(b[j+160>>1]|0)|0;if((((gb|0)<0?0-gb|0:gb)|0)>3){m=1;break}m=(b[ja+142>>1]|0)-(b[j+162>>1]|0)|0;m=(((m|0)<0?0-m|0:m)|0)>3&1}else m=2;while(0);c[rb+680+36>>2]=m;do if(!(b[ja+44>>1]|0)){if(b[j+54>>1]|0){n=2;break}if((c[ja+124>>2]|0)!=(c[j+128>>2]|0)){n=1;break}gb=(b[ja+164>>1]|0)-(b[j+184>>1]|0)|0;if((((gb|0)<0?0-gb|0:gb)|0)>3){n=1;break}n=(b[ja+166>>1]|0)-(b[j+186>>1]|0)|0;n=(((n|0)<0?0-n|0:n)|0)>3&1}else n=2;while(0);c[rb+680+68>>2]=n;do if(!(b[ja+48>>1]|0)){if(b[j+58>>1]|0){o=2;break}if((c[ja+124>>2]|0)!=(c[j+128>>2]|0)){o=1;break}gb=(b[ja+172>>1]|0)-(b[j+192>>1]|0)|0;if((((gb|0)<0?0-gb|0:gb)|0)>3){o=1;break}o=(b[ja+174>>1]|0)-(b[j+194>>1]|0)|0;o=(((o|0)<0?0-o|0:o)|0)>3&1}else o=2;while(0);c[rb+680+100>>2]=o;if(q){gb=p;Ya=q;Xa=1196;break R}gb=p;Ya=(m|l|n|o|0)!=0&1;Xa=1196;break R}while(0);c[rb+680+100>>2]=4;c[rb+680+68>>2]=4;c[rb+680+36>>2]=4;c[rb+680+4>>2]=4;$a=p;ib=1;Xa=1194}while(0);if((Xa|0)==1194){Xa=0;if($a>>>0>5){c[na>>2]=3;c[oa>>2]=3;c[pa>>2]=3;c[qa>>2]=3;c[ra>>2]=3;c[sa>>2]=3;c[ta>>2]=3;c[ua>>2]=3;c[va>>2]=3;c[wa>>2]=3;c[xa>>2]=3;c[ya>>2]=3;c[za>>2]=3;c[Aa>>2]=3;c[Ba>>2]=3;c[Ca>>2]=3;c[Da>>2]=3;c[Ea>>2]=3;c[Fa>>2]=3;c[Ga>>2]=3;c[Ha>>2]=3;c[Ia>>2]=3;c[Ja>>2]=3;c[Pa>>2]=3}else{gb=$a;Ya=ib;Xa=1196}}do if((Xa|0)==1196){Xa=0;S:do if(gb>>>0<2){l=ja+28|0;n=b[ja+32>>1]|0;if(!(n<<16>>16))m=(b[l>>1]|0)!=0?2:0;else m=2;c[ya>>2]=m;o=b[ja+34>>1]|0;if(!(o<<16>>16))J=(b[ja+30>>1]|0)!=0?2:0;else J=2;c[xa>>2]=J;p=b[ja+40>>1]|0;if(!(p<<16>>16))I=(b[ja+36>>1]|0)!=0?2:0;else I=2;c[wa>>2]=I;q=b[ja+42>>1]|0;if(!(q<<16>>16))H=(b[ja+38>>1]|0)!=0?2:0;else H=2;c[va>>2]=H;r=b[ja+44>>1]|0;G=(r|n)<<16>>16!=0?2:0;c[ua>>2]=G;s=b[ja+46>>1]|0;F=(s|o)<<16>>16!=0?2:0;c[ta>>2]=F;t=b[ja+52>>1]|0;f=(t|p)<<16>>16!=0?2:0;c[sa>>2]=f;u=b[ja+54>>1]|0;E=(u|q)<<16>>16!=0?2:0;c[ra>>2]=E;v=b[ja+48>>1]|0;D=(v|r)<<16>>16!=0?2:0;c[qa>>2]=D;w=b[ja+50>>1]|0;C=(w|s)<<16>>16!=0?2:0;c[pa>>2]=C;g=b[ja+56>>1]|0;B=t<<16>>16!=0|g<<16>>16==0^1?2:0;c[oa>>2]=B;x=(b[ja+58>>1]|0)==0;A=u<<16>>16!=0|x^1?2:0;c[na>>2]=A;y=b[ja+30>>1]|0;if(!(y<<16>>16))z=(b[l>>1]|0)!=0?2:0;else z=2;c[Pa>>2]=z;aa=b[ja+36>>1]|0;ba=(aa|y)<<16>>16!=0?2:0;c[Ja>>2]=ba;aa=(b[ja+38>>1]|aa)<<16>>16!=0?2:0;c[Ia>>2]=aa;y=n<<16>>16!=0|o<<16>>16==0^1?2:0;c[Ha>>2]=y;o=o<<16>>16!=0|p<<16>>16==0^1?2:0;c[Ga>>2]=o;$=p<<16>>16!=0|q<<16>>16==0^1?2:0;c[Fa>>2]=$;r=(s|r)<<16>>16!=0?2:0;c[Ea>>2]=r;p=(t|s)<<16>>16!=0?2:0;c[Da>>2]=p;s=(u|t)<<16>>16!=0?2:0;c[Ca>>2]=s;q=(w|v)<<16>>16!=0?2:0;c[Ba>>2]=q;n=g<<16>>16==0?(w<<16>>16!=0?2:0):2;c[Aa>>2]=n;l=x?(g<<16>>16!=0?2:0):2;c[za>>2]=l;v=r;g=$;x=o;w=F;u=G;t=H;r=I;o=J}else switch(gb|0){case 2:{y=ja+28|0;B=b[ja+32>>1]|0;if(!(B<<16>>16))l=(b[y>>1]|0)!=0;else l=1;K=l?2:0;c[ya>>2]=K;A=b[ja+34>>1]|0;if(!(A<<16>>16))l=(b[ja+30>>1]|0)!=0;else l=1;o=l?2:0;c[xa>>2]=o;x=b[ja+40>>1]|0;if(!(x<<16>>16))l=(b[ja+36>>1]|0)!=0;else l=1;r=l?2:0;c[wa>>2]=r;s=b[ja+42>>1]|0;if(!(s<<16>>16))J=(b[ja+38>>1]|0)!=0?2:0;else J=2;c[va>>2]=J;t=b[ja+48>>1]|0;if(!(t<<16>>16))D=(b[ja+44>>1]|0)!=0?2:0;else D=2;c[qa>>2]=D;u=b[ja+50>>1]|0;if(!(u<<16>>16))C=(b[ja+46>>1]|0)!=0?2:0;else C=2;c[pa>>2]=C;v=b[ja+56>>1]|0;if(!(v<<16>>16))G=(b[ja+52>>1]|0)!=0?2:0;else G=2;c[oa>>2]=G;w=(b[ja+58>>1]|0)==0;if(w)F=(b[ja+54>>1]|0)!=0?2:0;else F=2;c[na>>2]=F;g=b[ja+44>>1]|0;l=b[ja+166>>1]|0;m=b[ja+142>>1]|0;do if(!((g|B)<<16>>16)){ba=(b[ja+164>>1]|0)-(b[ja+140>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){I=1;break}if((((l-m|0)<0?0-(l-m)|0:l-m|0)|0)>3){I=1;break}I=(c[ja+124>>2]|0)!=(c[ja+116>>2]|0)&1}else I=2;while(0);c[ua>>2]=I;q=b[ja+46>>1]|0;l=b[ja+170>>1]|0;m=b[ja+146>>1]|0;do if(!((q|A)<<16>>16)){ba=(b[ja+168>>1]|0)-(b[ja+144>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){H=1;break}if((((l-m|0)<0?0-(l-m)|0:l-m|0)|0)>3){H=1;break}H=(c[ja+124>>2]|0)!=(c[ja+116>>2]|0)&1}else H=2;while(0);c[ta>>2]=H;p=b[ja+52>>1]|0;l=b[ja+182>>1]|0;m=b[ja+158>>1]|0;do if(!((p|x)<<16>>16)){ba=(b[ja+180>>1]|0)-(b[ja+156>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){f=1;break}if((((l-m|0)<0?0-(l-m)|0:l-m|0)|0)>3){f=1;break}f=(c[ja+128>>2]|0)!=(c[ja+120>>2]|0)&1}else f=2;while(0);c[sa>>2]=f;n=b[ja+54>>1]|0;l=b[ja+186>>1]|0;m=b[ja+162>>1]|0;do if(!((n|s)<<16>>16)){ba=(b[ja+184>>1]|0)-(b[ja+160>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){E=1;break}if((((l-m|0)<0?0-(l-m)|0:l-m|0)|0)>3){E=1;break}E=(c[ja+128>>2]|0)!=(c[ja+120>>2]|0)&1}else E=2;while(0);c[ra>>2]=E;l=b[ja+30>>1]|0;if(!(l<<16>>16))z=(b[y>>1]|0)!=0?2:0;else z=2;c[Pa>>2]=z;aa=b[ja+36>>1]|0;ba=(aa|l)<<16>>16!=0?2:0;c[Ja>>2]=ba;aa=(b[ja+38>>1]|aa)<<16>>16!=0?2:0;c[Ia>>2]=aa;y=B<<16>>16!=0|A<<16>>16==0^1?2:0;c[Ha>>2]=y;A=A<<16>>16!=0|x<<16>>16==0^1?2:0;c[Ga>>2]=A;x=x<<16>>16!=0|s<<16>>16==0^1?2:0;c[Fa>>2]=x;g=(q|g)<<16>>16!=0?2:0;c[Ea>>2]=g;B=(p|q)<<16>>16!=0?2:0;c[Da>>2]=B;s=(n|p)<<16>>16!=0?2:0;c[Ca>>2]=s;q=t<<16>>16!=0|u<<16>>16==0^1?2:0;c[Ba>>2]=q;n=v<<16>>16==0?(u<<16>>16!=0?2:0):2;c[Aa>>2]=n;l=w?(v<<16>>16!=0?2:0):2;c[za>>2]=l;p=B;v=g;g=x;x=A;A=F;B=G;w=H;u=I;t=J;m=K;break S}case 3:{l=ja+28|0;n=b[ja+32>>1]|0;if(!(n<<16>>16))m=(b[l>>1]|0)!=0?2:0;else m=2;c[ya>>2]=m;u=b[ja+34>>1]|0;if(!(u<<16>>16))O=(b[ja+30>>1]|0)!=0?2:0;else O=2;c[xa>>2]=O;v=b[ja+40>>1]|0;if(!(v<<16>>16))N=(b[ja+36>>1]|0)!=0?2:0;else N=2;c[wa>>2]=N;o=b[ja+42>>1]|0;if(!(o<<16>>16))M=(b[ja+38>>1]|0)!=0?2:0;else M=2;c[va>>2]=M;p=b[ja+44>>1]|0;L=(p|n)<<16>>16!=0?2:0;c[ua>>2]=L;w=b[ja+46>>1]|0;K=(w|u)<<16>>16!=0?2:0;c[ta>>2]=K;g=b[ja+52>>1]|0;f=(g|v)<<16>>16!=0?2:0;c[sa>>2]=f;q=b[ja+54>>1]|0;E=(q|o)<<16>>16!=0?2:0;c[ra>>2]=E;r=b[ja+48>>1]|0;D=(r|p)<<16>>16!=0?2:0;c[qa>>2]=D;y=b[ja+50>>1]|0;C=w<<16>>16!=0|y<<16>>16==0^1?2:0;c[pa>>2]=C;F=b[ja+56>>1]|0;B=(F|g)<<16>>16!=0?2:0;c[oa>>2]=B;s=(b[ja+58>>1]|0)==0;A=q<<16>>16!=0|s^1?2:0;c[na>>2]=A;t=b[ja+30>>1]|0;if(!(t<<16>>16))z=(b[l>>1]|0)!=0?2:0;else z=2;c[Pa>>2]=z;ba=b[ja+36>>1]|0;J=(b[ja+38>>1]|0)==0?(ba<<16>>16!=0?2:0):2;c[Ia>>2]=J;I=n<<16>>16!=0|u<<16>>16==0^1?2:0;c[Ha>>2]=I;H=v<<16>>16!=0|o<<16>>16==0^1?2:0;c[Fa>>2]=H;G=(w|p)<<16>>16!=0?2:0;c[Ea>>2]=G;x=(q|g)<<16>>16!=0?2:0;c[Ca>>2]=x;q=y<<16>>16==0?(r<<16>>16!=0?2:0):2;c[Ba>>2]=q;l=s?(F<<16>>16!=0?2:0):2;c[za>>2]=l;n=b[ja+150>>1]|0;o=b[ja+138>>1]|0;do if(!((ba|t)<<16>>16)){ba=(b[ja+148>>1]|0)-(b[ja+136>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){t=1;break}if((((n-o|0)<0?0-(n-o)|0:n-o|0)|0)>3){t=1;break}t=(c[ja+120>>2]|0)!=(c[ja+116>>2]|0)&1}else t=2;while(0);c[Ja>>2]=t;n=b[ja+158>>1]|0;o=b[ja+146>>1]|0;do if(!((v|u)<<16>>16)){ba=(b[ja+156>>1]|0)-(b[ja+144>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){r=1;break}if((((n-o|0)<0?0-(n-o)|0:n-o|0)|0)>3){r=1;break}r=(c[ja+120>>2]|0)!=(c[ja+116>>2]|0)&1}else r=2;while(0);c[Ga>>2]=r;n=b[ja+182>>1]|0;o=b[ja+170>>1]|0;do if(!((g|w)<<16>>16)){ba=(b[ja+180>>1]|0)-(b[ja+168>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){p=1;break}if((((n-o|0)<0?0-(n-o)|0:n-o|0)|0)>3){p=1;break}p=(c[ja+128>>2]|0)!=(c[ja+124>>2]|0)&1}else p=2;while(0);c[Da>>2]=p;n=b[ja+190>>1]|0;o=b[ja+178>>1]|0;do if(!((F|y)<<16>>16)){ba=(b[ja+188>>1]|0)-(b[ja+176>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){n=1;break}if((((n-o|0)<0?0-(n-o)|0:n-o|0)|0)>3){n=1;break}n=(c[ja+128>>2]|0)!=(c[ja+124>>2]|0)&1}else n=2;while(0);c[Aa>>2]=n;s=x;v=G;g=H;x=r;y=I;aa=J;ba=t;w=K;u=L;t=M;r=N;o=O;break S}default:{y=b[ja+32>>1]|0;l=b[ja+28>>1]|0;F=b[ja+142>>1]|0;n=b[ja+134>>1]|0;do if(!((l|y)<<16>>16)){ba=(b[ja+140>>1]|0)-(b[ja+132>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){m=1;break}m=(((F-n|0)<0?0-(F-n)|0:F-n|0)|0)>3&1}else m=2;while(0);c[ya>>2]=m;G=b[ja+34>>1]|0;p=b[ja+30>>1]|0;H=b[ja+146>>1]|0;q=b[ja+138>>1]|0;do if(!((p|G)<<16>>16)){ba=(b[ja+144>>1]|0)-(b[ja+136>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){o=1;break}o=(((H-q|0)<0?0-(H-q)|0:H-q|0)|0)>3&1}else o=2;while(0);c[xa>>2]=o;I=b[ja+40>>1]|0;s=b[ja+36>>1]|0;J=b[ja+158>>1]|0;v=b[ja+150>>1]|0;do if(!((s|I)<<16>>16)){ba=(b[ja+156>>1]|0)-(b[ja+148>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){r=1;break}r=(((J-v|0)<0?0-(J-v)|0:J-v|0)|0)>3&1}else r=2;while(0);c[wa>>2]=r;K=b[ja+42>>1]|0;g=b[ja+38>>1]|0;L=b[ja+162>>1]|0;x=b[ja+154>>1]|0;do if(!((g|K)<<16>>16)){ba=(b[ja+160>>1]|0)-(b[ja+152>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){t=1;break}t=(((L-x|0)<0?0-(L-x)|0:L-x|0)|0)>3&1}else t=2;while(0);c[va>>2]=t;M=b[ja+44>>1]|0;N=b[ja+166>>1]|0;do if(!((M|y)<<16>>16)){ba=(b[ja+164>>1]|0)-(b[ja+140>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){u=1;break}if((((N-F|0)<0?0-(N-F)|0:N-F|0)|0)>3){u=1;break}u=(c[ja+124>>2]|0)!=(c[ja+116>>2]|0)&1}else u=2;while(0);c[ua>>2]=u;O=b[ja+46>>1]|0;P=b[ja+170>>1]|0;do if(!((O|G)<<16>>16)){ba=(b[ja+168>>1]|0)-(b[ja+144>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){w=1;break}if((((P-H|0)<0?0-(P-H)|0:P-H|0)|0)>3){w=1;break}w=(c[ja+124>>2]|0)!=(c[ja+116>>2]|0)&1}else w=2;while(0);c[ta>>2]=w;Q=b[ja+52>>1]|0;h=b[ja+182>>1]|0;do if(!((Q|I)<<16>>16)){ba=(b[ja+180>>1]|0)-(b[ja+156>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){f=1;break}if((((h-J|0)<0?0-(h-J)|0:h-J|0)|0)>3){f=1;break}f=(c[ja+128>>2]|0)!=(c[ja+120>>2]|0)&1}else f=2;while(0);c[sa>>2]=f;R=b[ja+54>>1]|0;S=b[ja+186>>1]|0;do if(!((R|K)<<16>>16)){ba=(b[ja+184>>1]|0)-(b[ja+160>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){E=1;break}if((((S-L|0)<0?0-(S-L)|0:S-L|0)|0)>3){E=1;break}E=(c[ja+128>>2]|0)!=(c[ja+120>>2]|0)&1}else E=2;while(0);c[ra>>2]=E;T=b[ja+48>>1]|0;U=b[ja+174>>1]|0;do if(!((T|M)<<16>>16)){ba=(b[ja+172>>1]|0)-(b[ja+164>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){D=1;break}D=(((U-N|0)<0?0-(U-N)|0:U-N|0)|0)>3&1}else D=2;while(0);c[qa>>2]=D;V=b[ja+50>>1]|0;W=b[ja+178>>1]|0;do if(!((V|O)<<16>>16)){ba=(b[ja+176>>1]|0)-(b[ja+168>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){C=1;break}C=(((W-P|0)<0?0-(W-P)|0:W-P|0)|0)>3&1}else C=2;while(0);c[pa>>2]=C;X=b[ja+56>>1]|0;Y=b[ja+190>>1]|0;do if(!((X|Q)<<16>>16)){ba=(b[ja+188>>1]|0)-(b[ja+180>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){B=1;break}B=(((Y-h|0)<0?0-(Y-h)|0:Y-h|0)|0)>3&1}else B=2;while(0);c[oa>>2]=B;_=b[ja+58>>1]|0;$=b[ja+194>>1]|0;do if(!((_|R)<<16>>16)){ba=(b[ja+192>>1]|0)-(b[ja+184>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){A=1;break}A=((($-S|0)<0?0-($-S)|0:$-S|0)|0)>3&1}else A=2;while(0);c[na>>2]=A;do if(!((p|l)<<16>>16)){ba=(b[ja+136>>1]|0)-(b[ja+132>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){z=1;break}z=(((q-n|0)<0?0-(q-n)|0:q-n|0)|0)>3&1}else z=2;while(0);c[Pa>>2]=z;do if(!((s|p)<<16>>16)){ba=(b[ja+148>>1]|0)-(b[ja+136>>1]|0)|0;if((((ba|0)<0?0-ba|0:ba)|0)>3){ba=1;break}if((((v-q|0)<0?0-(v-q)|0:v-q|0)|0)>3){ba=1;break}ba=(c[ja+120>>2]|0)!=(c[ja+116>>2]|0)&1}else ba=2;while(0);c[Ja>>2]=ba;do if(!((g|s)<<16>>16)){aa=(b[ja+152>>1]|0)-(b[ja+148>>1]|0)|0;if((((aa|0)<0?0-aa|0:aa)|0)>3){aa=1;break}aa=(((x-v|0)<0?0-(x-v)|0:x-v|0)|0)>3&1}else aa=2;while(0);c[Ia>>2]=aa;do if(!((G|y)<<16>>16)){y=(b[ja+144>>1]|0)-(b[ja+140>>1]|0)|0;if((((y|0)<0?0-y|0:y)|0)>3){y=1;break}y=(((H-F|0)<0?0-(H-F)|0:H-F|0)|0)>3&1}else y=2;while(0);c[Ha>>2]=y;do if(!((I|G)<<16>>16)){G=(b[ja+156>>1]|0)-(b[ja+144>>1]|0)|0;if((((G|0)<0?0-G|0:G)|0)>3){x=1;break}if((((J-H|0)<0?0-(J-H)|0:J-H|0)|0)>3){x=1;break}x=(c[ja+120>>2]|0)!=(c[ja+116>>2]|0)&1}else x=2;while(0);c[Ga>>2]=x;do if(!((K|I)<<16>>16)){K=(b[ja+160>>1]|0)-(b[ja+156>>1]|0)|0;if((((K|0)<0?0-K|0:K)|0)>3){g=1;break}g=(((L-J|0)<0?0-(L-J)|0:L-J|0)|0)>3&1}else g=2;while(0);c[Fa>>2]=g;do if(!((O|M)<<16>>16)){M=(b[ja+168>>1]|0)-(b[ja+164>>1]|0)|0;if((((M|0)<0?0-M|0:M)|0)>3){v=1;break}v=(((P-N|0)<0?0-(P-N)|0:P-N|0)|0)>3&1}else v=2;while(0);c[Ea>>2]=v;do if(!((Q|O)<<16>>16)){O=(b[ja+180>>1]|0)-(b[ja+168>>1]|0)|0;if((((O|0)<0?0-O|0:O)|0)>3){p=1;break}if((((h-P|0)<0?0-(h-P)|0:h-P|0)|0)>3){p=1;break}p=(c[ja+128>>2]|0)!=(c[ja+124>>2]|0)&1}else p=2;while(0);c[Da>>2]=p;do if(!((R|Q)<<16>>16)){R=(b[ja+184>>1]|0)-(b[ja+180>>1]|0)|0;if((((R|0)<0?0-R|0:R)|0)>3){s=1;break}s=(((S-h|0)<0?0-(S-h)|0:S-h|0)|0)>3&1}else s=2;while(0);c[Ca>>2]=s;do if(!((V|T)<<16>>16)){T=(b[ja+176>>1]|0)-(b[ja+172>>1]|0)|0;if((((T|0)<0?0-T|0:T)|0)>3){q=1;break}q=(((W-U|0)<0?0-(W-U)|0:W-U|0)|0)>3&1}else q=2;while(0);c[Ba>>2]=q;do if(!((X|V)<<16>>16)){V=(b[ja+188>>1]|0)-(b[ja+176>>1]|0)|0;if((((V|0)<0?0-V|0:V)|0)>3){n=1;break}if((((Y-W|0)<0?0-(Y-W)|0:Y-W|0)|0)>3){n=1;break}n=(c[ja+128>>2]|0)!=(c[ja+124>>2]|0)&1}else n=2;while(0);c[Aa>>2]=n;do if(!((_|X)<<16>>16)){_=(b[ja+192>>1]|0)-(b[ja+188>>1]|0)|0;if((((_|0)<0?0-_|0:_)|0)>3){l=1;break}l=((($-Y|0)<0?0-($-Y)|0:$-Y|0)|0)>3&1}else l=2;while(0);c[za>>2]=l;break S}}while(0);if(Ya)break;if(!(n|l|q|s|p|v|g|x|y|aa|ba|z|A|B|C|D|E|f|w|u|t|r|o|m))break P}while(0);J=ja+20|0;l=c[J>>2]|0;K=ja+12|0;m=c[K>>2]|0;n=(m+l|0)<0?0:(m+l|0)>51?51:m+l|0;L=ja+16|0;o=c[L>>2]|0;p=d[7574+n>>0]|0;c[rb+644+28>>2]=p;q=d[7626+((o+l|0)<0?0:(o+l|0)>51?51:o+l|0)>>0]|0;c[rb+644+32>>2]=q;c[rb+644+24>>2]=7678+(n*3|0);do if(!ea){k=c[ca+20>>2]|0;if((k|0)==(l|0)){c[rb+644+4>>2]=p;c[rb+644+8>>2]=q;c[rb+644>>2]=7678+(n*3|0);break}else{ca=((l+1+k|0)>>>1)+m|0;ca=(ca|0)<0?0:(ca|0)>51?51:ca;ba=((l+1+k|0)>>>1)+o|0;c[rb+644+4>>2]=d[7574+ca>>0];c[rb+644+8>>2]=d[7626+((ba|0)<0?0:(ba|0)>51?51:ba)>>0];c[rb+644>>2]=7678+(ca*3|0);break}}while(0);do if(!da){k=c[j+20>>2]|0;if((k|0)==(l|0)){c[rb+644+16>>2]=p;c[rb+644+20>>2]=q;c[Sa>>2]=7678+(n*3|0);break}else{j=((l+1+k|0)>>>1)+m|0;j=(j|0)<0?0:(j|0)>51?51:j;ca=((l+1+k|0)>>>1)+o|0;c[rb+644+16>>2]=d[7574+j>>0];c[rb+644+20>>2]=d[7626+((ca|0)<0?0:(ca|0)>51?51:ca)>>0];c[rb+644+12>>2]=7678+(j*3|0);break}}while(0);I=Z(ia,ka)|0;f=3;F=0;G=(c[Va>>2]|0)+((I<<8)+(ha<<4))|0;H=rb+680|0;while(1){k=c[H+4>>2]|0;if(k)ab(G,k,Sa,ka<<4);k=c[H+12>>2]|0;if(k)ab(G+4|0,k,Ra,ka<<4);D=H+16|0;k=c[H+20>>2]|0;if(k)ab(G+8|0,k,Ra,ka<<4);E=H+24|0;k=c[H+28>>2]|0;if(k)ab(G+12|0,k,Ra,ka<<4);B=c[H>>2]|0;C=H+8|0;k=c[C>>2]|0;T:do if((B|0)==(k|0)){if((B|0)!=(c[D>>2]|0)){Xa=1399;break}if((B|0)!=(c[E>>2]|0)){Xa=1399;break}if(!B)break;if(B>>>0<4){q=d[(c[rb+644+(F*12|0)>>2]|0)+(B+-1)>>0]|0;r=rb+644+(F*12|0)+4|0;s=rb+644+(F*12|0)+8|0;p=G;x=16;while(1){l=p+(0-(ka<<4)<<1)|0;t=p+(0-(ka<<4))|0;o=p+(ka<<4)|0;u=a[o>>0]|0;v=d[t>>0]|0;w=d[p>>0]|0;do if(((v-w|0)<0?0-(v-w)|0:v-w|0)>>>0<(c[r>>2]|0)>>>0){g=d[l>>0]|0;m=c[s>>2]|0;if(((g-v|0)<0?0-(g-v)|0:g-v|0)>>>0>=m>>>0)break;if((((u&255)-w|0)<0?0-((u&255)-w)|0:(u&255)-w|0)>>>0>=m>>>0)break;n=d[p+Qa>>0]|0;if(((n-v|0)<0?0-(n-v)|0:n-v|0)>>>0<m>>>0){a[l>>0]=((((v+1+w|0)>>>1)-(g<<1)+n>>1|0)<(0-q|0)?0-q|0:(((v+1+w|0)>>>1)-(g<<1)+n>>1|0)>(q|0)?q:((v+1+w|0)>>>1)-(g<<1)+n>>1)+g;m=c[s>>2]|0;l=q+1|0}else l=q;n=d[p+(ka<<5)>>0]|0;if(((n-w|0)<0?0-(n-w)|0:n-w|0)>>>0<m>>>0){a[o>>0]=((((v+1+w|0)>>>1)-((u&255)<<1)+n>>1|0)<(0-q|0)?0-q|0:(((v+1+w|0)>>>1)-((u&255)<<1)+n>>1|0)>(q|0)?q:((v+1+w|0)>>>1)-((u&255)<<1)+n>>1)+(u&255);l=l+1|0}ca=0-l|0;ca=(4-(u&255)+(w-v<<2)+g>>3|0)<(ca|0)?ca:(4-(u&255)+(w-v<<2)+g>>3|0)>(l|0)?l:4-(u&255)+(w-v<<2)+g>>3;j=a[6294+((w|512)-ca)>>0]|0;a[t>>0]=a[6294+(ca+(v|512))>>0]|0;a[p>>0]=j}while(0);x=x+-1|0;if(!x)break T;else p=p+1|0}}o=rb+644+(F*12|0)+4|0;p=rb+644+(F*12|0)+8|0;n=G;A=16;while(1){q=n+(0-(ka<<4)<<1)|0;r=n+(0-(ka<<4))|0;s=n+(ka<<4)|0;t=a[s>>0]|0;u=d[r>>0]|0;v=d[n>>0]|0;l=(u-v|0)<0?0-(u-v)|0:u-v|0;m=c[o>>2]|0;U:do if(l>>>0<m>>>0){w=d[q>>0]|0;g=c[p>>2]|0;if(((w-u|0)<0?0-(w-u)|0:w-u|0)>>>0>=g>>>0)break;if((((t&255)-v|0)<0?0-((t&255)-v)|0:(t&255)-v|0)>>>0>=g>>>0)break;x=n+Qa|0;y=n+(ka<<5)|0;z=a[y>>0]|0;do if(l>>>0<((m>>>2)+2|0)>>>0){l=d[x>>0]|0;if(((l-u|0)<0?0-(l-u)|0:l-u|0)>>>0<g>>>0){a[r>>0]=((t&255)+4+(v+u+w<<1)+l|0)>>>3;a[q>>0]=(v+u+w+2+l|0)>>>2;a[x>>0]=(v+u+w+4+(l*3|0)+(d[n+(0-(ka<<4)<<2)>>0]<<1)|0)>>>3}else a[r>>0]=(u+2+(t&255)+(w<<1)|0)>>>2;if((((z&255)-v|0)<0?0-((z&255)-v)|0:(z&255)-v|0)>>>0>=(c[p>>2]|0)>>>0)break;a[n>>0]=((v+u+(t&255)<<1)+4+w+(z&255)|0)>>>3;a[s>>0]=(v+u+(t&255)+2+(z&255)|0)>>>2;a[y>>0]=(v+u+(t&255)+4+((z&255)*3|0)+(d[n+(ka*48|0)>>0]<<1)|0)>>>3;break U}else a[r>>0]=(u+2+(t&255)+(w<<1)|0)>>>2;while(0);a[n>>0]=(v+2+((t&255)<<1)+w|0)>>>2}while(0);A=A+-1|0;if(!A)break;else n=n+1|0}}else Xa=1399;while(0);do if((Xa|0)==1399){Xa=0;if(B){bb(G,B,rb+644+(F*12|0)|0,ka<<4);k=c[C>>2]|0}if(k)bb(G+4|0,k,rb+644+(F*12|0)|0,ka<<4);k=c[D>>2]|0;if(k)bb(G+8|0,k,rb+644+(F*12|0)|0,ka<<4);k=c[E>>2]|0;if(!k)break;bb(G+12|0,k,rb+644+(F*12|0)|0,ka<<4)}while(0);if(!f)break;else{f=f+-1|0;F=2;G=G+(ka<<6)|0;H=H+32|0}}s=c[ja+24>>2]|0;q=c[J>>2]|0;r=c[80+(((q+s|0)<0?0:(q+s|0)>51?51:q+s|0)<<2)>>2]|0;o=c[K>>2]|0;p=(o+r|0)<0?0:(o+r|0)>51?51:o+r|0;l=c[L>>2]|0;m=d[7574+p>>0]|0;c[rb+644+28>>2]=m;n=d[7626+((l+r|0)<0?0:(l+r|0)>51?51:l+r|0)>>0]|0;c[rb+644+32>>2]=n;c[rb+644+24>>2]=7678+(p*3|0);do if(!ea){k=c[(c[fa>>2]|0)+20>>2]|0;if((k|0)==(q|0)){c[rb+644+4>>2]=m;c[rb+644+8>>2]=n;c[rb+644>>2]=7678+(p*3|0);break}else{ea=(r+1+(c[80+(((k+s|0)<0?0:(k+s|0)>51?51:k+s|0)<<2)>>2]|0)|0)>>>1;fa=(ea+o|0)<0?0:(ea+o|0)>51?51:ea+o|0;c[rb+644+4>>2]=d[7574+fa>>0];c[rb+644+8>>2]=d[7626+((ea+l|0)<0?0:(ea+l|0)>51?51:ea+l|0)>>0];c[rb+644>>2]=7678+(fa*3|0);break}}while(0);do if(!da){k=c[(c[ga>>2]|0)+20>>2]|0;if((k|0)==(q|0)){c[rb+644+16>>2]=m;c[rb+644+20>>2]=n;c[Sa>>2]=7678+(p*3|0);break}else{fa=(r+1+(c[80+(((k+s|0)<0?0:(k+s|0)>51?51:k+s|0)<<2)>>2]|0)|0)>>>1;ga=(fa+o|0)<0?0:(fa+o|0)>51?51:fa+o|0;c[rb+644+16>>2]=d[7574+ga>>0];c[rb+644+20>>2]=d[7626+((fa+l|0)<0?0:(fa+l|0)>51?51:fa+l|0)>>0];c[rb+644+12>>2]=7678+(ga*3|0);break}}while(0);q=c[Va>>2]|0;p=(ha<<3)+(ma<<8)+(I<<6)|0;o=q+(p+(ma<<6))|0;p=q+p|0;q=0;r=rb+680|0;s=0;while(1){k=r+4|0;l=c[k>>2]|0;if(l){cb(p,l,Sa,ka<<3);cb(o,c[k>>2]|0,Sa,ka<<3)}k=r+36|0;l=c[k>>2]|0;if(l){cb(p+(ka<<4)|0,l,Sa,ka<<3);cb(o+(ka<<4)|0,c[k>>2]|0,Sa,ka<<3)}n=r+16|0;k=r+20|0;l=c[k>>2]|0;if(l){cb(p+4|0,l,Ra,ka<<3);cb(o+4|0,c[k>>2]|0,Ra,ka<<3)}k=r+52|0;l=c[k>>2]|0;if(l){cb(p+(ka<<4|4)|0,l,Ra,ka<<3);cb(o+(ka<<4|4)|0,c[k>>2]|0,Ra,ka<<3)}l=c[r>>2]|0;m=r+8|0;k=c[m>>2]|0;do if((l|0)==(k|0)){if((l|0)!=(c[n>>2]|0)){Xa=1430;break}if((l|0)!=(c[r+24>>2]|0)){Xa=1430;break}if(!l)break;ga=rb+644+(q*12|0)|0;db(p,l,ga,ka<<3);db(o,c[r>>2]|0,ga,ka<<3)}else Xa=1430;while(0);do if((Xa|0)==1430){Xa=0;if(l){k=rb+644+(q*12|0)|0;eb(p,l,k,ka<<3);eb(o,c[r>>2]|0,k,ka<<3);k=c[m>>2]|0}if(k){ga=rb+644+(q*12|0)|0;eb(p+2|0,k,ga,ka<<3);eb(o+2|0,c[m>>2]|0,ga,ka<<3)}k=c[n>>2]|0;if(k){ga=rb+644+(q*12|0)|0;eb(p+4|0,k,ga,ka<<3);eb(o+4|0,c[n>>2]|0,ga,ka<<3)}k=r+24|0;l=c[k>>2]|0;if(!l)break;ga=rb+644+(q*12|0)|0;eb(p+6|0,l,ga,ka<<3);eb(o+6|0,c[k>>2]|0,ga,ka<<3)}while(0);s=s+1|0;if((s|0)==2)break;else{o=o+(ka<<5)|0;p=p+(ka<<5)|0;q=2;r=r+64|0}}k=c[la>>2]|0}while(0);l=ha+1|0;ia=((l|0)==(ka|0)&1)+ia|0;if(ia>>>0>=k>>>0)break;else{ha=(l|0)==(ka|0)?0:l;ja=ja+216|0}}}c[e+1196>>2]=0;c[e+1192>>2]=0;m=c[e+1176>>2]|0;if(m){k=c[Ta>>2]|0;l=0;do{c[k+(l*216|0)+4>>2]=0;c[k+(l*216|0)+196>>2]=0;l=l+1|0}while((l|0)!=(m|0))}t=c[Ua>>2]|0;V:do if(!(c[e+1652>>2]|0))u=0;else{k=0;W:while(1){switch(c[e+1656+(k*20|0)>>2]|0){case 5:{u=1;break V}case 0:break W;default:{}}k=k+1|0}u=0}while(0);X:do switch(c[t+16>>2]|0){case 0:{if((c[e+1360>>2]|0)!=5){k=c[e+1284>>2]|0;l=c[e+1388>>2]|0;if(k>>>0>l>>>0?(kb=c[t+20>>2]|0,(k-l|0)>>>0>=kb>>>1>>>0):0){ob=e+1284|0;pb=l;qb=(c[e+1288>>2]|0)+kb|0}else{jb=e+1284|0;lb=l;mb=k;Xa=1454}}else{c[e+1288>>2]=0;c[e+1284>>2]=0;jb=e+1284|0;lb=c[e+1388>>2]|0;mb=0;Xa=1454}do if((Xa|0)==1454){if(lb>>>0>mb>>>0?(nb=c[t+20>>2]|0,(lb-mb|0)>>>0>nb>>>1>>>0):0){ob=jb;pb=lb;qb=(c[e+1288>>2]|0)-nb|0;break}ob=jb;pb=lb;qb=c[e+1288>>2]|0}while(0);if(!(c[e+1364>>2]|0)){k=c[e+1392>>2]|0;k=qb+pb+((k|0)<0?k:0)|0;break X}c[e+1288>>2]=qb;k=c[e+1392>>2]|0;if(!u){c[ob>>2]=pb;k=qb+pb+((k|0)<0?k:0)|0;break X}else{c[e+1288>>2]=0;c[ob>>2]=(k|0)<0?0-k|0:0;k=0;break X}}case 1:{if((c[e+1360>>2]|0)!=5){k=c[e+1296>>2]|0;if((c[e+1292>>2]|0)>>>0>(c[e+1380>>2]|0)>>>0)k=(c[t+12>>2]|0)+k|0}else k=0;p=c[t+36>>2]|0;if(!p)l=0;else l=(c[e+1380>>2]|0)+k|0;s=(c[e+1364>>2]|0)==0;o=(((l|0)!=0&s)<<31>>31)+l|0;if(o){r=((o+-1|0)>>>0)%(p>>>0)|0;q=((o+-1|0)>>>0)/(p>>>0)|0}else{r=0;q=0}if(!p)l=0;else{m=c[t+40>>2]|0;l=0;n=0;do{l=(c[m+(n<<2)>>2]|0)+l|0;n=n+1|0}while((n|0)!=(p|0))}if(o){l=Z(l,q)|0;m=c[t+40>>2]|0;n=0;do{l=(c[m+(n<<2)>>2]|0)+l|0;n=n+1|0}while(n>>>0<=r>>>0)}else l=0;if(s)m=(c[t+28>>2]|0)+l|0;else m=l;l=(c[e+1400>>2]|0)+(c[t+32>>2]|0)|0;if(!u){qb=((l|0)<0?l:0)+m+(c[e+1396>>2]|0)|0;c[e+1296>>2]=k;c[e+1292>>2]=c[e+1380>>2];k=qb;break X}else{c[e+1296>>2]=0;c[e+1292>>2]=0;k=0;break X}}default:{if((c[e+1360>>2]|0)==5){l=e+1296|0;m=0;k=0}else{n=c[e+1380>>2]|0;k=c[e+1296>>2]|0;if((c[e+1292>>2]|0)>>>0>n>>>0)k=(c[t+12>>2]|0)+k|0;l=e+1296|0;m=k;k=(((c[e+1364>>2]|0)==0)<<31>>31)+(k+n<<1)|0}if(!u){c[l>>2]=m;c[e+1292>>2]=c[e+1380>>2];break X}else{c[l>>2]=0;c[e+1292>>2]=0;k=0;break X}}}while(0);do if(c[Wa>>2]|0){m=c[e+1380>>2]|0;n=c[e+1360>>2]|0;o=c[e+1208>>2]|0;p=c[e+1204>>2]|0;l=c[Va>>2]|0;if(!(c[e+1364>>2]|0)){Za(e+1220|0,0,l,m,k,(n|0)==5&1,o,p);break}else{Za(e+1220|0,e+1644|0,l,m,k,(n|0)==5&1,o,p);break}}while(0);c[e+1184>>2]=0;c[Wa>>2]=0;e=1;i=rb;return e|0}function jb(a){a=a|0;var b=0;b=ub(a)|0;c[854]=b;c[853]=b;c[852]=a;c[855]=b+a;return b|0}
function kb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;x=i;i=i+16|0;c[852]=a;b=c[853]|0;c[848]=b;c[849]=a;d=a;a:while(1){a=c[858]|0;c[850]=a;p=c[856]|0;b:do if(!((b|0)==0|(d|0)==0|(p|0)==0)?(v=c[p>>2]|0,(v|0)!=0):0){c[859]=0;c[x>>2]=0;c[p+3392>>2]=c[851];c:do if((v|0)==2){a=0;w=5}else{e=a;a=1;d:while(1){m=ib(p+8|0,b,d,e,x)|0;o=c[x>>2]|0;b=b+o|0;n=d-o|0;n=(n|0)<0?0:n;c[859]=b;switch(m|0){case 5:{w=31;break b}case 2:{w=7;break c}case 1:{w=10;break d}case 4:{m=0;e:while(1){e=c[p+8+148+(m<<2)>>2]|0;f:do if((e|0)!=0?(u=c[p+8+20+(c[e+4>>2]<<2)>>2]|0,(u|0)!=0):0){j=c[u+52>>2]|0;k=Z(c[u+56>>2]|0,j)|0;l=c[e+12>>2]|0;if(l>>>0<=1){d=0;break e}d=c[e+16>>2]|0;switch(d|0){case 0:{d=c[e+20>>2]|0;e=0;while(1){if((c[d+(e<<2)>>2]|0)>>>0>k>>>0)break f;e=e+1|0;if(e>>>0>=l>>>0){d=0;break e}}}case 2:{h=c[e+24>>2]|0;d=c[e+28>>2]|0;g=0;while(1){e=c[h+(g<<2)>>2]|0;f=c[d+(g<<2)>>2]|0;if(!(e>>>0<=f>>>0&f>>>0<k>>>0))break f;g=g+1|0;if(((e>>>0)%(j>>>0)|0)>>>0>((f>>>0)%(j>>>0)|0)>>>0)break f;if(g>>>0>=(l+-1|0)>>>0){d=0;break e}}}default:{if((d+-3|0)>>>0<3)if((c[e+36>>2]|0)>>>0>k>>>0)break f;else{d=0;break e}if((d|0)!=6){d=0;break e}if((c[e+40>>2]|0)>>>0<k>>>0)break f;else{d=0;break e}}}}while(0);m=m+1|0;if(m>>>0>=256){d=1;break}}a=((d|0)==0|n|0)==0?-2:a;break}default:{}}if(!n)break;if((c[p>>2]|0)==2){a=o;w=5;break c}e=c[850]|0;d=n}if((w|0)==10){w=0;c[p+4>>2]=(c[p+4>>2]|0)+1;a=(n|0)==0?2:3}switch(a|0){case -2:case 1:break a;case 4:{w=34;break}case 3:{w=70;break}case 2:break;default:break b}}while(0);if((w|0)==5){c[p>>2]=1;b=b+a|0;c[859]=b;w=7}do if((w|0)==7){if((c[p+1288>>2]|0)!=0?(c[p+1244>>2]|0)!=(c[p+1248>>2]|0):0){c[p+1288>>2]=0;c[p>>2]=2;w=70;break}w=34}while(0);if((w|0)==34){w=0;b=c[856]|0;if(!b)break;d=c[b+24>>2]|0;if(!d)break;if(!(c[b+20>>2]|0))break;c[861]=c[d+52>>2]<<4;c[862]=c[d+56>>2]<<4;if(c[d+80>>2]|0){p=c[d+84>>2]|0;if(((p|0)!=0?(c[p+24>>2]|0)!=0:0)?(c[p+32>>2]|0)!=0:0)c[863]=1;else c[863]=0;b=c[d+84>>2]|0;if(((b|0)!=0?(c[b+24>>2]|0)!=0:0)?(c[b+36>>2]|0)!=0:0)b=c[b+48>>2]|0;else b=2}else{c[863]=0;b=2}c[864]=b;if(!(c[d+60>>2]|0)){c[867]=0;c[868]=0;c[869]=0;c[870]=0;b=0}else{c[867]=1;c[868]=c[d+64>>2]<<1;c[869]=(c[d+52>>2]<<4)-((c[d+68>>2]|0)+(c[d+64>>2]|0)<<1);c[870]=c[d+72>>2]<<1;b=(c[d+56>>2]<<4)-((c[d+76>>2]|0)+(c[d+72>>2]|0)<<1)|0}c[871]=b;g:do if(((c[d+80>>2]|0)!=0?(q=c[d+84>>2]|0,(q|0)!=0):0)?(c[q>>2]|0)!=0:0){b=c[q+4>>2]|0;do switch(b|0){case 1:case 0:{a=b;break g}case 2:{a=11;b=12;break g}case 3:{a=11;b=10;break g}case 4:{a=11;b=16;break g}case 5:{a=33;b=40;break g}case 6:{a=11;b=24;break g}case 7:{a=11;b=20;break g}case 8:{a=11;b=32;break g}case 9:{a=33;b=80;break g}case 10:{a=11;b=18;break g}case 11:{a=11;b=15;break g}case 12:{a=33;b=64;break g}case 13:{a=99;b=160;break g}case 255:{b=c[q+8>>2]|0;p=c[q+12>>2]|0;a=(b|0)==0|(p|0)==0?0:p;b=(b|0)==0|(p|0)==0?0:b;break g}default:{a=0;b=0;break g}}while(0)}else{a=1;b=1}while(0);c[865]=b;c[866]=a;c[860]=c[d>>2];ra();p=c[859]|0;c[849]=(c[848]|0)-p+(c[849]|0);c[848]=p;break}else if((w|0)==70){w=0;p=b;c[849]=(c[848]|0)-p+(c[849]|0);c[848]=p}c[849]=0;c[858]=(c[858]|0)+1;b=c[856]|0;if((((b|0)!=0?(r=c[b+1248>>2]|0,r>>>0<(c[b+1244>>2]|0)>>>0):0)?(s=c[b+1240>>2]|0,c[b+1248>>2]=r+1,(s+(r<<4)|0)!=0):0)?(t=c[s+(r<<4)>>2]|0,(t|0)!=0):0){e=s+(r<<4)+8|0;f=s+(r<<4)+12|0;a=s+(r<<4)+4|0;b=t;while(1){p=c[e>>2]|0;o=c[f>>2]|0;n=c[a>>2]|0;c[872]=b;c[873]=n;c[874]=o;c[875]=p;c[857]=(c[857]|0)+1;ga(b|0,c[861]|0,c[862]|0);b=c[856]|0;if(!b)break b;a=c[b+1248>>2]|0;if(a>>>0>=(c[b+1244>>2]|0)>>>0)break b;d=c[b+1240>>2]|0;c[b+1248>>2]=a+1;if(!(d+(a<<4)|0))break b;b=c[d+(a<<4)>>2]|0;if(!b)break b;e=d+(a<<4)+8|0;f=d+(a<<4)+12|0;a=d+(a<<4)+4|0}}}else w=31;while(0);if((w|0)==31)w=0;a=c[849]|0;if(!a){w=84;break}b=c[848]|0;d=a}if((w|0)==84){i=x;return}c[849]=0;i=x;return}function lb(){var d=0,e=0,f=0,g=0,h=0,j=0;j=i;i=i+16|0;g=ub(3396)|0;if(g){xb(g+8|0,0,3388)|0;c[g+16>>2]=32;c[g+12>>2]=256;c[g+1340>>2]=1;f=ub(2112)|0;c[g+3384>>2]=f;if(f){c[g>>2]=1;c[g+4>>2]=0;c[856]=g;c[857]=1;c[858]=1;h=0;i=j;return h|0}f=0;do{e=g+8+20+(f<<2)|0;d=c[e>>2]|0;if(d){vb(c[d+40>>2]|0);c[(c[e>>2]|0)+40>>2]=0;vb(c[(c[e>>2]|0)+84>>2]|0);c[(c[e>>2]|0)+84>>2]=0;vb(c[e>>2]|0);c[e>>2]=0}f=f+1|0}while((f|0)!=32);f=0;do{d=g+8+148+(f<<2)|0;e=c[d>>2]|0;if(e){vb(c[e+20>>2]|0);c[(c[d>>2]|0)+20>>2]=0;vb(c[(c[d>>2]|0)+24>>2]|0);c[(c[d>>2]|0)+24>>2]=0;vb(c[(c[d>>2]|0)+28>>2]|0);c[(c[d>>2]|0)+28>>2]=0;vb(c[(c[d>>2]|0)+44>>2]|0);c[(c[d>>2]|0)+44>>2]=0;vb(c[d>>2]|0);c[d>>2]=0}f=f+1|0}while((f|0)!=256);vb(c[g+3384>>2]|0);c[g+3384>>2]=0;vb(c[g+1220>>2]|0);c[g+1220>>2]=0;vb(c[g+1180>>2]|0);c[g+1180>>2]=0;d=c[g+1228>>2]|0;if((d|0)!=0?(c[g+1256>>2]|0)!=-1:0){e=0;do{vb(c[d+(e*40|0)+4>>2]|0);d=c[g+1228>>2]|0;c[d+(e*40|0)+4>>2]=0;e=e+1|0}while(e>>>0<((c[g+1256>>2]|0)+1|0)>>>0)}vb(d);c[g+1228>>2]=0;vb(c[g+1232>>2]|0);c[g+1232>>2]=0;vb(c[g+1240>>2]|0);vb(g)}d=c[892]|0;do if(!d){d=a[3626]|0;a[3626]=d+255|d;d=c[888]|0;if(!(d&8)){c[890]=0;c[889]=0;e=c[899]|0;c[895]=e;c[893]=e;d=e+(c[900]|0)|0;c[892]=d;break}c[888]=d|32;h=-1;i=j;return h|0}else e=c[893]|0;while(0);if((d-e|0)>>>0<29){if((xa[c[3588>>2]&3](3552,7834,29)|0)>>>0<29){h=-1;i=j;return h|0}}else{d=7834;f=e+29|0;do{a[e>>0]=a[d>>0]|0;e=e+1|0;d=d+1|0}while((e|0)<(f|0));c[893]=(c[893]|0)+29}f=a[3627]|0;if(f<<24>>24!=10){d=c[893]|0;e=c[892]|0;if(d>>>0<e>>>0){c[893]=d+1;a[d>>0]=10;h=-1;i=j;return h|0}}else e=c[892]|0;a[j>>0]=10;do if(!e){f=b[1813]|0;a[3626]=((f&65535)<<24>>24)+255|(f&65535)<<24>>24;d=c[888]|0;if(!(d&8)){c[890]=0;c[889]=0;g=c[899]|0;c[895]=g;c[893]=g;e=g+(c[900]|0)|0;c[892]=e;d=(f&65535)>>>8&255;h=32;break}else{c[888]=d|32;break}}else{g=c[893]|0;d=f;h=32}while(0);do if((h|0)==32)if(g>>>0>=e>>>0|d<<24>>24==10){xa[c[3588>>2]&3](3552,j,1)|0;break}else{c[893]=g+1;a[g>>0]=10;break}while(0);h=-1;i=j;return h|0}function mb(){return}function nb(){return 2}function ob(){return 3}function pb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0;k=i;i=i+48|0;g=c[a+28>>2]|0;c[k+32>>2]=g;g=(c[a+20>>2]|0)-g|0;c[k+32+4>>2]=g;c[k+32+8>>2]=b;c[k+32+12>>2]=d;j=k+32|0;f=2;g=g+d|0;while(1){if(!(c[876]|0)){c[k+16>>2]=c[a+60>>2];c[k+16+4>>2]=j;c[k+16+8>>2]=f;b=ua(146,k+16|0)|0;if(b>>>0>4294963200){if(!(c[876]|0))e=3548;else e=c[(ia()|0)+60>>2]|0;c[e>>2]=0-b;b=-1}}else{oa(1,a|0);c[k>>2]=c[a+60>>2];c[k+4>>2]=j;c[k+8>>2]=f;b=ua(146,k|0)|0;if(b>>>0>4294963200){if(!(c[876]|0))e=3548;else e=c[(ia()|0)+60>>2]|0;c[e>>2]=0-b;b=-1}ha(0)}if((g|0)==(b|0)){b=13;break}if((b|0)<0){b=15;break}g=g-b|0;e=c[j+4>>2]|0;if(b>>>0<=e>>>0)if((f|0)==2){c[a+28>>2]=(c[a+28>>2]|0)+b;h=e;e=j;f=2}else{h=e;e=j}else{h=c[a+44>>2]|0;c[a+28>>2]=h;c[a+20>>2]=h;h=c[j+12>>2]|0;b=b-e|0;e=j+8|0;f=f+-1|0}c[e>>2]=(c[e>>2]|0)+b;c[e+4>>2]=h-b;j=e}if((b|0)==13){j=c[a+44>>2]|0;c[a+16>>2]=j+(c[a+48>>2]|0);c[a+28>>2]=j;c[a+20>>2]=j}else if((b|0)==15){c[a+16>>2]=0;c[a+28>>2]=0;c[a+20>>2]=0;c[a>>2]=c[a>>2]|32;if((f|0)==2)d=0;else d=d-(c[j+4>>2]|0)|0}i=k;return d|0}function qb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;f=i;i=i+80|0;c[b+36>>2]=3;if((c[b>>2]&64|0)==0?(c[f>>2]=c[b+60>>2],c[f+4>>2]=21505,c[f+8>>2]=f+12,(qa(54,f|0)|0)!=0):0)a[b+75>>0]=-1;e=pb(b,d,e)|0;i=f;return e|0}function rb(a){a=a|0;var b=0,d=0;d=i;i=i+16|0;c[d>>2]=c[a+60>>2];a=ja(6,d|0)|0;if(a>>>0>4294963200){if(!(c[876]|0))b=3548;else b=c[(ia()|0)+60>>2]|0;c[b>>2]=0-a;a=-1}i=d;return a|0}function sb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;f=i;i=i+32|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=f+20;c[f+16>>2]=d;b=sa(140,f|0)|0;if(b>>>0<=4294963200)if((b|0)<0)e=7;else a=c[f+20>>2]|0;else{if(!(c[876]|0))a=3548;else a=c[(ia()|0)+60>>2]|0;c[a>>2]=0-b;e=7}if((e|0)==7){c[f+20>>2]=-1;a=-1}i=f;return a|0}function tb(a){a=a|0;return}function ub(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;do if(a>>>0<245){n=a>>>0<11?16:a+11&-8;g=c[916]|0;if(g>>>(n>>>3)&3){a=(g>>>(n>>>3)&1^1)+(n>>>3)<<1;b=c[3704+(a+2<<2)>>2]|0;d=c[b+8>>2]|0;do if((3704+(a<<2)|0)!=(d|0)){if(d>>>0<(c[920]|0)>>>0)la();if((c[d+12>>2]|0)==(b|0)){c[d+12>>2]=3704+(a<<2);c[3704+(a+2<<2)>>2]=d;break}else la()}else c[916]=g&~(1<<(g>>>(n>>>3)&1^1)+(n>>>3));while(0);F=(g>>>(n>>>3)&1^1)+(n>>>3)<<3;c[b+4>>2]=F|3;c[b+(F|4)>>2]=c[b+(F|4)>>2]|1;F=b+8|0;return F|0}b=c[918]|0;if(n>>>0>b>>>0){if(g>>>(n>>>3)){a=g>>>(n>>>3)<<(n>>>3)&(2<<(n>>>3)|0-(2<<(n>>>3)));f=((a&0-a)+-1|0)>>>(((a&0-a)+-1|0)>>>12&16);e=f>>>(f>>>5&8)>>>(f>>>(f>>>5&8)>>>2&4);e=(f>>>5&8|((a&0-a)+-1|0)>>>12&16|f>>>(f>>>5&8)>>>2&4|e>>>1&2|e>>>(e>>>1&2)>>>1&1)+(e>>>(e>>>1&2)>>>(e>>>(e>>>1&2)>>>1&1))|0;f=c[3704+((e<<1)+2<<2)>>2]|0;a=c[f+8>>2]|0;do if((3704+(e<<1<<2)|0)!=(a|0)){if(a>>>0<(c[920]|0)>>>0)la();if((c[a+12>>2]|0)==(f|0)){c[a+12>>2]=3704+(e<<1<<2);c[3704+((e<<1)+2<<2)>>2]=a;h=c[918]|0;break}else la()}else{c[916]=g&~(1<<e);h=b}while(0);c[f+4>>2]=n|3;c[f+(n|4)>>2]=(e<<3)-n|1;c[f+(e<<3)>>2]=(e<<3)-n;if(h){d=c[921]|0;b=h>>>3;a=c[916]|0;if(a&1<<b){a=c[3704+((b<<1)+2<<2)>>2]|0;if(a>>>0<(c[920]|0)>>>0)la();else{i=3704+((b<<1)+2<<2)|0;j=a}}else{c[916]=a|1<<b;i=3704+((b<<1)+2<<2)|0;j=3704+(b<<1<<2)|0}c[i>>2]=d;c[j+12>>2]=d;c[d+8>>2]=j;c[d+12>>2]=3704+(b<<1<<2)}c[918]=(e<<3)-n;c[921]=f+n;F=f+8|0;return F|0}a=c[917]|0;if(a){i=((a&0-a)+-1|0)>>>(((a&0-a)+-1|0)>>>12&16);j=i>>>(i>>>5&8)>>>(i>>>(i>>>5&8)>>>2&4);j=c[3968+((i>>>5&8|((a&0-a)+-1|0)>>>12&16|i>>>(i>>>5&8)>>>2&4|j>>>1&2|j>>>(j>>>1&2)>>>1&1)+(j>>>(j>>>1&2)>>>(j>>>(j>>>1&2)>>>1&1))<<2)>>2]|0;i=(c[j+4>>2]&-8)-n|0;b=j;while(1){a=c[b+16>>2]|0;if(!a){a=c[b+20>>2]|0;if(!a)break}b=(c[a+4>>2]&-8)-n|0;F=b>>>0<i>>>0;i=F?b:i;b=a;j=F?a:j}f=c[920]|0;if(j>>>0<f>>>0)la();h=j+n|0;if(j>>>0>=h>>>0)la();g=c[j+24>>2]|0;a=c[j+12>>2]|0;do if((a|0)==(j|0)){b=j+20|0;a=c[b>>2]|0;if(!a){b=j+16|0;a=c[b>>2]|0;if(!a){k=0;break}}while(1){d=a+20|0;e=c[d>>2]|0;if(e){a=e;b=d;continue}d=a+16|0;e=c[d>>2]|0;if(!e)break;else{a=e;b=d}}if(b>>>0<f>>>0)la();else{c[b>>2]=0;k=a;break}}else{b=c[j+8>>2]|0;if(b>>>0<f>>>0)la();if((c[b+12>>2]|0)!=(j|0))la();if((c[a+8>>2]|0)==(j|0)){c[b+12>>2]=a;c[a+8>>2]=b;k=a;break}else la()}while(0);do if(g){a=c[j+28>>2]|0;if((j|0)==(c[3968+(a<<2)>>2]|0)){c[3968+(a<<2)>>2]=k;if(!k){c[917]=c[917]&~(1<<a);break}}else{if(g>>>0<(c[920]|0)>>>0)la();if((c[g+16>>2]|0)==(j|0))c[g+16>>2]=k;else c[g+20>>2]=k;if(!k)break}b=c[920]|0;if(k>>>0<b>>>0)la();c[k+24>>2]=g;a=c[j+16>>2]|0;do if(a)if(a>>>0<b>>>0)la();else{c[k+16>>2]=a;c[a+24>>2]=k;break}while(0);a=c[j+20>>2]|0;if(a)if(a>>>0<(c[920]|0)>>>0)la();else{c[k+20>>2]=a;c[a+24>>2]=k;break}}while(0);if(i>>>0<16){F=i+n|0;c[j+4>>2]=F|3;F=j+(F+4)|0;c[F>>2]=c[F>>2]|1}else{c[j+4>>2]=n|3;c[j+(n|4)>>2]=i|1;c[j+(i+n)>>2]=i;b=c[918]|0;if(b){d=c[921]|0;a=c[916]|0;if(a&1<<(b>>>3)){a=c[3704+((b>>>3<<1)+2<<2)>>2]|0;if(a>>>0<(c[920]|0)>>>0)la();else{l=3704+((b>>>3<<1)+2<<2)|0;m=a}}else{c[916]=a|1<<(b>>>3);l=3704+((b>>>3<<1)+2<<2)|0;m=3704+(b>>>3<<1<<2)|0}c[l>>2]=d;c[m+12>>2]=d;c[d+8>>2]=m;c[d+12>>2]=3704+(b>>>3<<1<<2)}c[918]=i;c[921]=h}F=j+8|0;return F|0}else i=n}else i=n}else if(a>>>0<=4294967231){k=a+11&-8;i=c[917]|0;if(i){if((a+11|0)>>>8)if(k>>>0>16777215)h=31;else{h=(a+11|0)>>>8<<((((a+11|0)>>>8)+1048320|0)>>>16&8);h=14-((h+520192|0)>>>16&4|(((a+11|0)>>>8)+1048320|0)>>>16&8|((h<<((h+520192|0)>>>16&4))+245760|0)>>>16&2)+(h<<((h+520192|0)>>>16&4)<<(((h<<((h+520192|0)>>>16&4))+245760|0)>>>16&2)>>>15)|0;h=k>>>(h+7|0)&1|h<<1}else h=0;a=c[3968+(h<<2)>>2]|0;a:do if(!a){b=0-k|0;d=0;a=0;w=86}else{b=0-k|0;d=0;f=k<<((h|0)==31?0:25-(h>>>1)|0);g=a;a=0;while(1){e=c[g+4>>2]&-8;if((e-k|0)>>>0<b>>>0)if((e|0)==(k|0)){b=e-k|0;e=g;a=g;w=90;break a}else{b=e-k|0;a=g}w=c[g+20>>2]|0;g=c[g+16+(f>>>31<<2)>>2]|0;d=(w|0)==0|(w|0)==(g|0)?d:w;if(!g){w=86;break}else f=f<<1}}while(0);if((w|0)==86){if((d|0)==0&(a|0)==0){a=2<<h;if(!((a|0-a)&i)){i=k;break}m=((a|0-a)&i&0-((a|0-a)&i))+-1|0;a=m>>>(m>>>12&16)>>>(m>>>(m>>>12&16)>>>5&8);d=a>>>(a>>>2&4)>>>(a>>>(a>>>2&4)>>>1&2);d=c[3968+((m>>>(m>>>12&16)>>>5&8|m>>>12&16|a>>>2&4|a>>>(a>>>2&4)>>>1&2|d>>>1&1)+(d>>>(d>>>1&1))<<2)>>2]|0;a=0}if(!d){i=b;j=a}else{e=d;w=90}}if((w|0)==90)while(1){w=0;m=(c[e+4>>2]&-8)-k|0;d=m>>>0<b>>>0;b=d?m:b;a=d?e:a;d=c[e+16>>2]|0;if(d){e=d;w=90;continue}e=c[e+20>>2]|0;if(!e){i=b;j=a;break}else w=90}if((j|0)!=0?i>>>0<((c[918]|0)-k|0)>>>0:0){f=c[920]|0;if(j>>>0<f>>>0)la();h=j+k|0;if(j>>>0>=h>>>0)la();g=c[j+24>>2]|0;a=c[j+12>>2]|0;do if((a|0)==(j|0)){b=j+20|0;a=c[b>>2]|0;if(!a){b=j+16|0;a=c[b>>2]|0;if(!a){n=0;break}}while(1){d=a+20|0;e=c[d>>2]|0;if(e){a=e;b=d;continue}d=a+16|0;e=c[d>>2]|0;if(!e)break;else{a=e;b=d}}if(b>>>0<f>>>0)la();else{c[b>>2]=0;n=a;break}}else{b=c[j+8>>2]|0;if(b>>>0<f>>>0)la();if((c[b+12>>2]|0)!=(j|0))la();if((c[a+8>>2]|0)==(j|0)){c[b+12>>2]=a;c[a+8>>2]=b;n=a;break}else la()}while(0);do if(g){a=c[j+28>>2]|0;if((j|0)==(c[3968+(a<<2)>>2]|0)){c[3968+(a<<2)>>2]=n;if(!n){c[917]=c[917]&~(1<<a);break}}else{if(g>>>0<(c[920]|0)>>>0)la();if((c[g+16>>2]|0)==(j|0))c[g+16>>2]=n;else c[g+20>>2]=n;if(!n)break}b=c[920]|0;if(n>>>0<b>>>0)la();c[n+24>>2]=g;a=c[j+16>>2]|0;do if(a)if(a>>>0<b>>>0)la();else{c[n+16>>2]=a;c[a+24>>2]=n;break}while(0);a=c[j+20>>2]|0;if(a)if(a>>>0<(c[920]|0)>>>0)la();else{c[n+20>>2]=a;c[a+24>>2]=n;break}}while(0);b:do if(i>>>0>=16){c[j+4>>2]=k|3;c[j+(k|4)>>2]=i|1;c[j+(i+k)>>2]=i;b=i>>>3;if(i>>>0<256){a=c[916]|0;if(a&1<<b){a=c[3704+((b<<1)+2<<2)>>2]|0;if(a>>>0<(c[920]|0)>>>0)la();else{p=3704+((b<<1)+2<<2)|0;q=a}}else{c[916]=a|1<<b;p=3704+((b<<1)+2<<2)|0;q=3704+(b<<1<<2)|0}c[p>>2]=h;c[q+12>>2]=h;c[j+(k+8)>>2]=q;c[j+(k+12)>>2]=3704+(b<<1<<2);break}a=i>>>8;if(a)if(i>>>0>16777215)e=31;else{e=a<<((a+1048320|0)>>>16&8)<<(((a<<((a+1048320|0)>>>16&8))+520192|0)>>>16&4);e=14-(((a<<((a+1048320|0)>>>16&8))+520192|0)>>>16&4|(a+1048320|0)>>>16&8|(e+245760|0)>>>16&2)+(e<<((e+245760|0)>>>16&2)>>>15)|0;e=i>>>(e+7|0)&1|e<<1}else e=0;a=3968+(e<<2)|0;c[j+(k+28)>>2]=e;c[j+(k+20)>>2]=0;c[j+(k+16)>>2]=0;b=c[917]|0;d=1<<e;if(!(b&d)){c[917]=b|d;c[a>>2]=h;c[j+(k+24)>>2]=a;c[j+(k+12)>>2]=h;c[j+(k+8)>>2]=h;break}a=c[a>>2]|0;c:do if((c[a+4>>2]&-8|0)!=(i|0)){e=i<<((e|0)==31?0:25-(e>>>1)|0);while(1){d=a+16+(e>>>31<<2)|0;b=c[d>>2]|0;if(!b)break;if((c[b+4>>2]&-8|0)==(i|0)){s=b;break c}else{e=e<<1;a=b}}if(d>>>0<(c[920]|0)>>>0)la();else{c[d>>2]=h;c[j+(k+24)>>2]=a;c[j+(k+12)>>2]=h;c[j+(k+8)>>2]=h;break b}}else s=a;while(0);a=s+8|0;b=c[a>>2]|0;F=c[920]|0;if(b>>>0>=F>>>0&s>>>0>=F>>>0){c[b+12>>2]=h;c[a>>2]=h;c[j+(k+8)>>2]=b;c[j+(k+12)>>2]=s;c[j+(k+24)>>2]=0;break}else la()}else{F=i+k|0;c[j+4>>2]=F|3;F=j+(F+4)|0;c[F>>2]=c[F>>2]|1}while(0);F=j+8|0;return F|0}else i=k}else i=k}else i=-1;while(0);d=c[918]|0;if(d>>>0>=i>>>0){a=d-i|0;b=c[921]|0;if(a>>>0>15){c[921]=b+i;c[918]=a;c[b+(i+4)>>2]=a|1;c[b+d>>2]=a;c[b+4>>2]=i|3}else{c[918]=0;c[921]=0;c[b+4>>2]=d|3;c[b+(d+4)>>2]=c[b+(d+4)>>2]|1}F=b+8|0;return F|0}a=c[919]|0;if(a>>>0>i>>>0){E=a-i|0;c[919]=E;F=c[922]|0;c[922]=F+i;c[F+(i+4)>>2]=E|1;c[F+4>>2]=i|3;F=F+8|0;return F|0}do if(!(c[1034]|0)){a=ta(30)|0;if(!(a+-1&a)){c[1036]=a;c[1035]=a;c[1037]=-1;c[1038]=-1;c[1039]=0;c[1027]=0;c[1034]=(na(0)|0)&-16^1431655768;break}else la()}while(0);f=i+48|0;e=c[1036]|0;g=i+47|0;h=e+g&0-e;if(h>>>0<=i>>>0){F=0;return F|0}a=c[1026]|0;if((a|0)!=0?(s=c[1024]|0,(s+h|0)>>>0<=s>>>0|(s+h|0)>>>0>a>>>0):0){F=0;return F|0}d:do if(!(c[1027]&4)){d=c[922]|0;e:do if(d){a=4112;while(1){b=c[a>>2]|0;if(b>>>0<=d>>>0?(o=a+4|0,(b+(c[o>>2]|0)|0)>>>0>d>>>0):0)break;a=c[a+8>>2]|0;if(!a){w=174;break e}}b=e+g-(c[919]|0)&0-e;if(b>>>0<2147483647){d=ma(b|0)|0;s=(d|0)==((c[a>>2]|0)+(c[o>>2]|0)|0);a=s?b:0;if(s){if((d|0)!=(-1|0)){q=d;p=a;w=194;break d}}else w=184}else a=0}else w=174;while(0);do if((w|0)==174){e=ma(0)|0;if((e|0)!=(-1|0)){a=c[1035]|0;if(!(a+-1&e))b=h;else b=h-e+(a+-1+e&0-a)|0;a=c[1024]|0;d=a+b|0;if(b>>>0>i>>>0&b>>>0<2147483647){s=c[1026]|0;if((s|0)!=0?d>>>0<=a>>>0|d>>>0>s>>>0:0){a=0;break}d=ma(b|0)|0;a=(d|0)==(e|0)?b:0;if((d|0)==(e|0)){q=e;p=a;w=194;break d}else w=184}else a=0}else a=0}while(0);f:do if((w|0)==184){e=0-b|0;do if(f>>>0>b>>>0&(b>>>0<2147483647&(d|0)!=(-1|0))?(r=c[1036]|0,r=g-b+r&0-r,r>>>0<2147483647):0)if((ma(r|0)|0)==(-1|0)){ma(e|0)|0;break f}else{b=r+b|0;break}while(0);if((d|0)!=(-1|0)){q=d;p=b;w=194;break d}}while(0);c[1027]=c[1027]|4;w=191}else{a=0;w=191}while(0);if((((w|0)==191?h>>>0<2147483647:0)?(t=ma(h|0)|0,u=ma(0)|0,t>>>0<u>>>0&((t|0)!=(-1|0)&(u|0)!=(-1|0))):0)?(v=(u-t|0)>>>0>(i+40|0)>>>0,v):0){q=t;p=v?u-t|0:a;w=194}if((w|0)==194){a=(c[1024]|0)+p|0;c[1024]=a;if(a>>>0>(c[1025]|0)>>>0)c[1025]=a;g=c[922]|0;g:do if(g){f=4112;while(1){a=c[f>>2]|0;b=f+4|0;d=c[b>>2]|0;if((q|0)==(a+d|0)){w=204;break}e=c[f+8>>2]|0;if(!e)break;else f=e}if(((w|0)==204?(c[f+12>>2]&8|0)==0:0)?g>>>0<q>>>0&g>>>0>=a>>>0:0){c[b>>2]=d+p;F=(c[919]|0)+p|0;E=(g+8&7|0)==0?0:0-(g+8)&7;c[922]=g+E;c[919]=F-E;c[g+(E+4)>>2]=F-E|1;c[g+(F+4)>>2]=40;c[923]=c[1038];break}a=c[920]|0;if(q>>>0<a>>>0){c[920]=q;l=q}else l=a;b=q+p|0;a=4112;while(1){if((c[a>>2]|0)==(b|0)){w=212;break}a=c[a+8>>2]|0;if(!a){a=4112;break}}if((w|0)==212)if(!(c[a+12>>2]&8)){c[a>>2]=q;n=a+4|0;c[n>>2]=(c[n>>2]|0)+p;n=q+8|0;n=(n&7|0)==0?0:0-n&7;j=q+(p+8)|0;j=(j&7|0)==0?0:0-j&7;a=q+(j+p)|0;m=n+i|0;o=q+m|0;k=a-(q+n)-i|0;c[q+(n+4)>>2]=i|3;h:do if((a|0)!=(g|0)){if((a|0)==(c[921]|0)){F=(c[918]|0)+k|0;c[918]=F;c[921]=o;c[q+(m+4)>>2]=F|1;c[q+(F+m)>>2]=F;break}h=p+4|0;i=c[q+(j+h)>>2]|0;if((i&3|0)==1){i:do if(i>>>0>=256){g=c[q+((j|24)+p)>>2]|0;b=c[q+(p+12+j)>>2]|0;do if((b|0)==(a|0)){d=q+((j|16)+h)|0;b=c[d>>2]|0;if(!b){d=q+((j|16)+p)|0;b=c[d>>2]|0;if(!b){C=0;break}}while(1){e=b+20|0;f=c[e>>2]|0;if(f){b=f;d=e;continue}e=b+16|0;f=c[e>>2]|0;if(!f)break;else{b=f;d=e}}if(d>>>0<l>>>0)la();else{c[d>>2]=0;C=b;break}}else{d=c[q+((j|8)+p)>>2]|0;if(d>>>0<l>>>0)la();if((c[d+12>>2]|0)!=(a|0))la();if((c[b+8>>2]|0)==(a|0)){c[d+12>>2]=b;c[b+8>>2]=d;C=b;break}else la()}while(0);if(!g)break;b=c[q+(p+28+j)>>2]|0;do if((a|0)!=(c[3968+(b<<2)>>2]|0)){if(g>>>0<(c[920]|0)>>>0)la();if((c[g+16>>2]|0)==(a|0))c[g+16>>2]=C;else c[g+20>>2]=C;if(!C)break i}else{c[3968+(b<<2)>>2]=C;if(C)break;c[917]=c[917]&~(1<<b);break i}while(0);b=c[920]|0;if(C>>>0<b>>>0)la();c[C+24>>2]=g;a=c[q+((j|16)+p)>>2]|0;do if(a)if(a>>>0<b>>>0)la();else{c[C+16>>2]=a;c[a+24>>2]=C;break}while(0);a=c[q+((j|16)+h)>>2]|0;if(!a)break;if(a>>>0<(c[920]|0)>>>0)la();else{c[C+20>>2]=a;c[a+24>>2]=C;break}}else{b=c[q+((j|8)+p)>>2]|0;d=c[q+(p+12+j)>>2]|0;do if((b|0)!=(3704+(i>>>3<<1<<2)|0)){if(b>>>0<l>>>0)la();if((c[b+12>>2]|0)==(a|0))break;la()}while(0);if((d|0)==(b|0)){c[916]=c[916]&~(1<<(i>>>3));break}do if((d|0)==(3704+(i>>>3<<1<<2)|0))A=d+8|0;else{if(d>>>0<l>>>0)la();if((c[d+8>>2]|0)==(a|0)){A=d+8|0;break}la()}while(0);c[b+12>>2]=d;c[A>>2]=b}while(0);a=q+((i&-8|j)+p)|0;f=(i&-8)+k|0}else f=k;b=a+4|0;c[b>>2]=c[b>>2]&-2;c[q+(m+4)>>2]=f|1;c[q+(f+m)>>2]=f;b=f>>>3;if(f>>>0<256){a=c[916]|0;do if(!(a&1<<b)){c[916]=a|1<<b;D=3704+((b<<1)+2<<2)|0;E=3704+(b<<1<<2)|0}else{a=c[3704+((b<<1)+2<<2)>>2]|0;if(a>>>0>=(c[920]|0)>>>0){D=3704+((b<<1)+2<<2)|0;E=a;break}la()}while(0);c[D>>2]=o;c[E+12>>2]=o;c[q+(m+8)>>2]=E;c[q+(m+12)>>2]=3704+(b<<1<<2);break}a=f>>>8;do if(!a)e=0;else{if(f>>>0>16777215){e=31;break}e=a<<((a+1048320|0)>>>16&8)<<(((a<<((a+1048320|0)>>>16&8))+520192|0)>>>16&4);e=14-(((a<<((a+1048320|0)>>>16&8))+520192|0)>>>16&4|(a+1048320|0)>>>16&8|(e+245760|0)>>>16&2)+(e<<((e+245760|0)>>>16&2)>>>15)|0;e=f>>>(e+7|0)&1|e<<1}while(0);a=3968+(e<<2)|0;c[q+(m+28)>>2]=e;c[q+(m+20)>>2]=0;c[q+(m+16)>>2]=0;b=c[917]|0;d=1<<e;if(!(b&d)){c[917]=b|d;c[a>>2]=o;c[q+(m+24)>>2]=a;c[q+(m+12)>>2]=o;c[q+(m+8)>>2]=o;break}a=c[a>>2]|0;j:do if((c[a+4>>2]&-8|0)!=(f|0)){e=f<<((e|0)==31?0:25-(e>>>1)|0);while(1){d=a+16+(e>>>31<<2)|0;b=c[d>>2]|0;if(!b)break;if((c[b+4>>2]&-8|0)==(f|0)){F=b;break j}else{e=e<<1;a=b}}if(d>>>0<(c[920]|0)>>>0)la();else{c[d>>2]=o;c[q+(m+24)>>2]=a;c[q+(m+12)>>2]=o;c[q+(m+8)>>2]=o;break h}}else F=a;while(0);a=F+8|0;b=c[a>>2]|0;E=c[920]|0;if(b>>>0>=E>>>0&F>>>0>=E>>>0){c[b+12>>2]=o;c[a>>2]=o;c[q+(m+8)>>2]=b;c[q+(m+12)>>2]=F;c[q+(m+24)>>2]=0;break}else la()}else{F=(c[919]|0)+k|0;c[919]=F;c[922]=o;c[q+(m+4)>>2]=F|1}while(0);F=q+(n|8)|0;return F|0}else a=4112;while(1){b=c[a>>2]|0;if(b>>>0<=g>>>0?(x=c[a+4>>2]|0,(b+x|0)>>>0>g>>>0):0)break;a=c[a+8>>2]|0}f=b+(x+-47+((b+(x+-39)&7|0)==0?0:0-(b+(x+-39))&7))|0;f=f>>>0<(g+16|0)>>>0?g:f;F=q+8|0;F=(F&7|0)==0?0:0-F&7;E=p+-40-F|0;c[922]=q+F;c[919]=E;c[q+(F+4)>>2]=E|1;c[q+(p+-36)>>2]=40;c[923]=c[1038];c[f+4>>2]=27;c[f+8>>2]=c[1028];c[f+8+4>>2]=c[1029];c[f+8+8>>2]=c[1030];c[f+8+12>>2]=c[1031];c[1028]=q;c[1029]=p;c[1031]=0;c[1030]=f+8;c[f+28>>2]=7;if((f+32|0)>>>0<(b+x|0)>>>0){a=f+28|0;do{F=a;a=a+4|0;c[a>>2]=7}while((F+8|0)>>>0<(b+x|0)>>>0)}if((f|0)!=(g|0)){c[f+4>>2]=c[f+4>>2]&-2;c[g+4>>2]=f-g|1;c[f>>2]=f-g;if((f-g|0)>>>0<256){a=c[916]|0;if(a&1<<((f-g|0)>>>3)){a=c[3704+(((f-g|0)>>>3<<1)+2<<2)>>2]|0;if(a>>>0<(c[920]|0)>>>0)la();else{y=3704+(((f-g|0)>>>3<<1)+2<<2)|0;z=a}}else{c[916]=a|1<<((f-g|0)>>>3);y=3704+(((f-g|0)>>>3<<1)+2<<2)|0;z=3704+((f-g|0)>>>3<<1<<2)|0}c[y>>2]=g;c[z+12>>2]=g;c[g+8>>2]=z;c[g+12>>2]=3704+((f-g|0)>>>3<<1<<2);break}if((f-g|0)>>>8)if((f-g|0)>>>0>16777215)e=31;else{e=(f-g|0)>>>8<<((((f-g|0)>>>8)+1048320|0)>>>16&8);e=14-((e+520192|0)>>>16&4|(((f-g|0)>>>8)+1048320|0)>>>16&8|((e<<((e+520192|0)>>>16&4))+245760|0)>>>16&2)+(e<<((e+520192|0)>>>16&4)<<(((e<<((e+520192|0)>>>16&4))+245760|0)>>>16&2)>>>15)|0;e=(f-g|0)>>>(e+7|0)&1|e<<1}else e=0;a=3968+(e<<2)|0;c[g+28>>2]=e;c[g+20>>2]=0;c[g+16>>2]=0;b=c[917]|0;d=1<<e;if(!(b&d)){c[917]=b|d;c[a>>2]=g;c[g+24>>2]=a;c[g+12>>2]=g;c[g+8>>2]=g;break}a=c[a>>2]|0;k:do if((c[a+4>>2]&-8|0)!=(f-g|0)){e=f-g<<((e|0)==31?0:25-(e>>>1)|0);while(1){d=a+16+(e>>>31<<2)|0;b=c[d>>2]|0;if(!b)break;if((c[b+4>>2]&-8|0)==(f-g|0)){B=b;break k}else{e=e<<1;a=b}}if(d>>>0<(c[920]|0)>>>0)la();else{c[d>>2]=g;c[g+24>>2]=a;c[g+12>>2]=g;c[g+8>>2]=g;break g}}else B=a;while(0);a=B+8|0;b=c[a>>2]|0;F=c[920]|0;if(b>>>0>=F>>>0&B>>>0>=F>>>0){c[b+12>>2]=g;c[a>>2]=g;c[g+8>>2]=b;c[g+12>>2]=B;c[g+24>>2]=0;break}else la()}}else{F=c[920]|0;if((F|0)==0|q>>>0<F>>>0)c[920]=q;c[1028]=q;c[1029]=p;c[1031]=0;c[925]=c[1034];c[924]=-1;a=0;do{F=a<<1;c[3704+(F+3<<2)>>2]=3704+(F<<2);c[3704+(F+2<<2)>>2]=3704+(F<<2);a=a+1|0}while((a|0)!=32);F=q+8|0;F=(F&7|0)==0?0:0-F&7;E=p+-40-F|0;c[922]=q+F;c[919]=E;c[q+(F+4)>>2]=E|1;c[q+(p+-36)>>2]=40;c[923]=c[1038]}while(0);a=c[919]|0;if(a>>>0>i>>>0){E=a-i|0;c[919]=E;F=c[922]|0;c[922]=F+i;c[F+(i+4)>>2]=E|1;c[F+4>>2]=i|3;F=F+8|0;return F|0}}if(!(c[876]|0))a=3548;else a=c[(ia()|0)+60>>2]|0;c[a>>2]=12;F=0;return F|0}function vb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;if(!a)return;i=c[920]|0;if((a+-8|0)>>>0<i>>>0)la();p=c[a+-4>>2]|0;if((p&3|0)==1)la();o=a+((p&-8)+-8)|0;do if(!(p&1)){k=c[a+-8>>2]|0;if(!(p&3))return;l=a+(-8-k)|0;m=k+(p&-8)|0;if(l>>>0<i>>>0)la();if((l|0)==(c[921]|0)){b=c[a+((p&-8)+-4)>>2]|0;if((b&3|0)!=3){t=l;g=m;break}c[918]=m;c[a+((p&-8)+-4)>>2]=b&-2;c[a+(-8-k+4)>>2]=m|1;c[o>>2]=m;return}if(k>>>0<256){b=c[a+(-8-k+8)>>2]|0;d=c[a+(-8-k+12)>>2]|0;if((b|0)!=(3704+(k>>>3<<1<<2)|0)){if(b>>>0<i>>>0)la();if((c[b+12>>2]|0)!=(l|0))la()}if((d|0)==(b|0)){c[916]=c[916]&~(1<<(k>>>3));t=l;g=m;break}if((d|0)!=(3704+(k>>>3<<1<<2)|0)){if(d>>>0<i>>>0)la();if((c[d+8>>2]|0)!=(l|0))la();else e=d+8|0}else e=d+8|0;c[b+12>>2]=d;c[e>>2]=b;t=l;g=m;break}h=c[a+(-8-k+24)>>2]|0;b=c[a+(-8-k+12)>>2]|0;do if((b|0)==(l|0)){b=c[a+(-8-k+20)>>2]|0;if(!b){b=c[a+(-8-k+16)>>2]|0;if(!b){j=0;break}else f=a+(-8-k+16)|0}else f=a+(-8-k+20)|0;while(1){d=b+20|0;e=c[d>>2]|0;if(e){b=e;f=d;continue}d=b+16|0;e=c[d>>2]|0;if(!e)break;else{b=e;f=d}}if(f>>>0<i>>>0)la();else{c[f>>2]=0;j=b;break}}else{d=c[a+(-8-k+8)>>2]|0;if(d>>>0<i>>>0)la();if((c[d+12>>2]|0)!=(l|0))la();if((c[b+8>>2]|0)==(l|0)){c[d+12>>2]=b;c[b+8>>2]=d;j=b;break}else la()}while(0);if(h){b=c[a+(-8-k+28)>>2]|0;if((l|0)==(c[3968+(b<<2)>>2]|0)){c[3968+(b<<2)>>2]=j;if(!j){c[917]=c[917]&~(1<<b);t=l;g=m;break}}else{if(h>>>0<(c[920]|0)>>>0)la();if((c[h+16>>2]|0)==(l|0))c[h+16>>2]=j;else c[h+20>>2]=j;if(!j){t=l;g=m;break}}d=c[920]|0;if(j>>>0<d>>>0)la();c[j+24>>2]=h;b=c[a+(-8-k+16)>>2]|0;do if(b)if(b>>>0<d>>>0)la();else{c[j+16>>2]=b;c[b+24>>2]=j;break}while(0);b=c[a+(-8-k+20)>>2]|0;if(b)if(b>>>0<(c[920]|0)>>>0)la();else{c[j+20>>2]=b;c[b+24>>2]=j;t=l;g=m;break}else{t=l;g=m}}else{t=l;g=m}}else{t=a+-8|0;g=p&-8}while(0);if(t>>>0>=o>>>0)la();e=c[a+((p&-8)+-4)>>2]|0;if(!(e&1))la();if(!(e&2)){if((o|0)==(c[922]|0)){u=(c[919]|0)+g|0;c[919]=u;c[922]=t;c[t+4>>2]=u|1;if((t|0)!=(c[921]|0))return;c[921]=0;c[918]=0;return}if((o|0)==(c[921]|0)){u=(c[918]|0)+g|0;c[918]=u;c[921]=t;c[t+4>>2]=u|1;c[t+u>>2]=u;return}g=(e&-8)+g|0;do if(e>>>0>=256){h=c[a+((p&-8)+16)>>2]|0;b=c[a+(p&-8|4)>>2]|0;do if((b|0)==(o|0)){b=c[a+((p&-8)+12)>>2]|0;if(!b){b=c[a+((p&-8)+8)>>2]|0;if(!b){q=0;break}else f=a+((p&-8)+8)|0}else f=a+((p&-8)+12)|0;while(1){d=b+20|0;e=c[d>>2]|0;if(e){b=e;f=d;continue}d=b+16|0;e=c[d>>2]|0;if(!e)break;else{b=e;f=d}}if(f>>>0<(c[920]|0)>>>0)la();else{c[f>>2]=0;q=b;break}}else{d=c[a+(p&-8)>>2]|0;if(d>>>0<(c[920]|0)>>>0)la();if((c[d+12>>2]|0)!=(o|0))la();if((c[b+8>>2]|0)==(o|0)){c[d+12>>2]=b;c[b+8>>2]=d;q=b;break}else la()}while(0);if(h){b=c[a+((p&-8)+20)>>2]|0;if((o|0)==(c[3968+(b<<2)>>2]|0)){c[3968+(b<<2)>>2]=q;if(!q){c[917]=c[917]&~(1<<b);break}}else{if(h>>>0<(c[920]|0)>>>0)la();if((c[h+16>>2]|0)==(o|0))c[h+16>>2]=q;else c[h+20>>2]=q;if(!q)break}d=c[920]|0;if(q>>>0<d>>>0)la();c[q+24>>2]=h;b=c[a+((p&-8)+8)>>2]|0;do if(b)if(b>>>0<d>>>0)la();else{c[q+16>>2]=b;c[b+24>>2]=q;break}while(0);b=c[a+((p&-8)+12)>>2]|0;if(b)if(b>>>0<(c[920]|0)>>>0)la();else{c[q+20>>2]=b;c[b+24>>2]=q;break}}}else{d=c[a+(p&-8)>>2]|0;b=c[a+(p&-8|4)>>2]|0;if((d|0)!=(3704+(e>>>3<<1<<2)|0)){if(d>>>0<(c[920]|0)>>>0)la();if((c[d+12>>2]|0)!=(o|0))la()}if((b|0)==(d|0)){c[916]=c[916]&~(1<<(e>>>3));break}if((b|0)!=(3704+(e>>>3<<1<<2)|0)){if(b>>>0<(c[920]|0)>>>0)la();if((c[b+8>>2]|0)!=(o|0))la();else n=b+8|0}else n=b+8|0;c[d+12>>2]=b;c[n>>2]=d}while(0);c[t+4>>2]=g|1;c[t+g>>2]=g;if((t|0)==(c[921]|0)){c[918]=g;return}}else{c[a+((p&-8)+-4)>>2]=e&-2;c[t+4>>2]=g|1;c[t+g>>2]=g}d=g>>>3;if(g>>>0<256){b=c[916]|0;if(b&1<<d){b=c[3704+((d<<1)+2<<2)>>2]|0;if(b>>>0<(c[920]|0)>>>0)la();else{r=3704+((d<<1)+2<<2)|0;s=b}}else{c[916]=b|1<<d;r=3704+((d<<1)+2<<2)|0;s=3704+(d<<1<<2)|0}c[r>>2]=t;c[s+12>>2]=t;c[t+8>>2]=s;c[t+12>>2]=3704+(d<<1<<2);return}b=g>>>8;if(b)if(g>>>0>16777215)f=31;else{f=b<<((b+1048320|0)>>>16&8)<<(((b<<((b+1048320|0)>>>16&8))+520192|0)>>>16&4);f=14-(((b<<((b+1048320|0)>>>16&8))+520192|0)>>>16&4|(b+1048320|0)>>>16&8|(f+245760|0)>>>16&2)+(f<<((f+245760|0)>>>16&2)>>>15)|0;f=g>>>(f+7|0)&1|f<<1}else f=0;b=3968+(f<<2)|0;c[t+28>>2]=f;c[t+20>>2]=0;c[t+16>>2]=0;d=c[917]|0;e=1<<f;a:do if(d&e){b=c[b>>2]|0;b:do if((c[b+4>>2]&-8|0)!=(g|0)){f=g<<((f|0)==31?0:25-(f>>>1)|0);while(1){e=b+16+(f>>>31<<2)|0;d=c[e>>2]|0;if(!d)break;if((c[d+4>>2]&-8|0)==(g|0)){u=d;break b}else{f=f<<1;b=d}}if(e>>>0<(c[920]|0)>>>0)la();else{c[e>>2]=t;c[t+24>>2]=b;c[t+12>>2]=t;c[t+8>>2]=t;break a}}else u=b;while(0);b=u+8|0;d=c[b>>2]|0;s=c[920]|0;if(d>>>0>=s>>>0&u>>>0>=s>>>0){c[d+12>>2]=t;c[b>>2]=t;c[t+8>>2]=d;c[t+12>>2]=u;c[t+24>>2]=0;break}else la()}else{c[917]=d|e;c[b>>2]=t;c[t+24>>2]=b;c[t+12>>2]=t;c[t+8>>2]=t}while(0);u=(c[924]|0)+-1|0;c[924]=u;if(!u)b=4120;else return;while(1){b=c[b>>2]|0;if(!b)break;else b=b+8|0}c[924]=-1;return}function wb(){}function xb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=b+e|0;if((e|0)>=20){d=d&255;g=b&3;h=d|d<<8|d<<16|d<<24;if(g){g=b+4-g|0;while((b|0)<(g|0)){a[b>>0]=d;b=b+1|0}}while((b|0)<(f&~3|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return b-e|0}function yb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;if((e|0)>=4096)return pa(b|0,d|0,e|0)|0;f=b|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}while((e|0)>=4){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0;e=e-4|0}}while((e|0)>0){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}return f|0}function zb(a,b){a=a|0;b=b|0;return wa[a&1](b|0)|0}function Ab(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return xa[a&3](b|0,c|0,d|0)|0}function Bb(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;ya[a&3](b|0,c|0,d|0,e|0,f|0)}function Cb(a,b){a=a|0;b=b|0;za[a&1](b|0)}function Db(a){a=a|0;aa(0);return 0}function Eb(a,b,c){a=a|0;b=b|0;c=c|0;aa(1);return 0}function Fb(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;aa(2)}function Gb(a){a=a|0;aa(3)}
function fb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;l=c[b+4>>2]|0;m=c[b+8>>2]|0;switch(d|0){case 0:case 5:{e=3;break}default:if(!(c[a+3384>>2]|0))k=0;else e=3}if((e|0)==3){f=c[a+1224>>2]|0;g=0;do{e=c[f+(g<<2)>>2]|0;if((e|0)!=0?(c[e+20>>2]|0)>>>0>1:0)e=c[e>>2]|0;else e=0;g=g+1|0}while(g>>>0<16&(e|0)==0);k=e}i=c[a+1176>>2]|0;a:do if(!i){f=0;g=0;e=0}else{h=c[a+1212>>2]|0;f=0;g=0;e=0;do{if(c[h+(g*216|0)+196>>2]|0)break a;g=g+1|0;f=f+1|0;e=((f|0)==(l|0)&1)+e|0;f=(f|0)==(l|0)?0:f}while(g>>>0<i>>>0)}while(0);if((g|0)==(i|0)){switch(d|0){case 2:case 7:{if((k|0)==0|(c[a+3384>>2]|0)==0)e=16;else e=17;break}default:if(!k)e=16;else e=17}if((e|0)==16)xb(c[b>>2]|0,-128,Z(l*384|0,m)|0)|0;else if((e|0)==17)yb(c[b>>2]|0,k|0,Z(l*384|0,m)|0)|0;g=c[a+1176>>2]|0;c[a+1204>>2]=g;if(!g)return;e=c[a+1212>>2]|0;f=0;do{c[e+(f*216|0)+8>>2]=1;f=f+1|0}while((f|0)!=(g|0));return}h=c[a+1212>>2]|0;i=Z(e,l)|0;if(f){g=f;do{g=g+-1|0;j=g+i|0;gb(h+(j*216|0)|0,b,e,g,d,k);c[h+(j*216|0)+196>>2]=1;c[a+1204>>2]=(c[a+1204>>2]|0)+1}while((g|0)!=0)}f=f+1|0;if(f>>>0<l>>>0)do{g=f+i|0;if(!(c[h+(g*216|0)+196>>2]|0)){gb(h+(g*216|0)|0,b,e,f,d,k);c[h+(g*216|0)+196>>2]=1;c[a+1204>>2]=(c[a+1204>>2]|0)+1}f=f+1|0}while((f|0)!=(l|0));if(e){if(l){f=e+-1|0;g=Z(f,l)|0;i=0;do{h=f;j=(c[a+1212>>2]|0)+((i+g|0)*216|0)|0;while(1){gb(j,b,h,i,d,k);c[j+196>>2]=1;c[a+1204>>2]=(c[a+1204>>2]|0)+1;if(!h)break;else{h=h+-1|0;j=j+((0-l|0)*216|0)|0}}i=i+1|0}while((i|0)!=(l|0))}}else e=0;e=e+1|0;if(e>>>0>=m>>>0)return;if(!l)return;do{h=c[a+1212>>2]|0;g=Z(e,l)|0;i=0;do{f=i+g|0;if(!(c[h+(f*216|0)+196>>2]|0)){gb(h+(f*216|0)|0,b,e,i,d,k);c[h+(f*216|0)+196>>2]=1;c[a+1204>>2]=(c[a+1204>>2]|0)+1}i=i+1|0}while((i|0)!=(l|0));e=e+1|0}while((e|0)!=(m|0));return}function gb(b,e,f,g,h,j){b=b|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0;R=i;i=i+480|0;P=c[e+4>>2]|0;k=c[e+8>>2]|0;n=(Z(P,f)|0)+g|0;Q=Z(k,P)|0;r=c[e>>2]|0;c[e+12>>2]=r+((n-((n>>>0)%(P>>>0)|0)<<8)+(((n>>>0)%(P>>>0)|0)<<4));n=(((n>>>0)%(P>>>0)|0)<<3)+(Q<<8)+(n-((n>>>0)%(P>>>0)|0)<<6)|0;c[e+16>>2]=r+n;c[e+20>>2]=r+(n+(Q<<6));n=(Z(f<<8,P)|0)+(g<<4)|0;c[b+20>>2]=40;c[b+8>>2]=0;c[b>>2]=6;c[b+12>>2]=0;c[b+16>>2]=0;c[b+24>>2]=0;a:do switch(h|0){case 2:case 7:{xb(R+96|0,0,384)|0;break}default:{c[R+24>>2]=0;c[R+4>>2]=P;c[R+8>>2]=k;c[R>>2]=j;if(!j){xb(R+96|0,0,384)|0;break a}Wa(R+96|0,R+24|0,R,g<<4,f<<4,0,0,16,16);$a(e,R+96|0);i=R;return}}while(0);j=R+32|0;h=j+64|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(h|0));if((f|0)!=0?(c[b+((0-P|0)*216|0)+196>>2]|0)!=0:0){z=n-(P<<4)|3;w=(d[r+(n-(P<<4)|1)>>0]|0)+(d[r+(n-(P<<4))>>0]|0)+(d[r+((n-(P<<4)|1)+1)>>0]|0)+(d[r+z>>0]|0)|0;C=n-(P<<4)|7;z=(d[r+(z+2)>>0]|0)+(d[r+(z+1)>>0]|0)+(d[r+(z+3)>>0]|0)+(d[r+C>>0]|0)|0;A=(d[r+(C+2)>>0]|0)+(d[r+(C+1)>>0]|0)+(d[r+(C+3)>>0]|0)+(d[r+(C+4)>>0]|0)|0;C=(d[r+(C+6)>>0]|0)+(d[r+(C+5)>>0]|0)+(d[r+(C+7)>>0]|0)+(d[r+(n-(P<<4)|15)>>0]|0)|0;c[R+32>>2]=A+(z+w)+C;c[R+32+4>>2]=z+w-A-C;j=A+(z+w)+C|0;h=z+w-A-C|0;y=1}else{j=0;h=0;w=0;z=0;A=0;C=0;y=0}if((k+-1|0)!=(f|0)?(c[b+(P*216|0)+196>>2]|0)!=0:0){B=n+(P<<8)|3;u=(d[r+(n+(P<<8)|1)>>0]|0)+(d[r+(n+(P<<8))>>0]|0)+(d[r+((n+(P<<8)|1)+1)>>0]|0)+(d[r+B>>0]|0)|0;E=n+(P<<8)|7;B=(d[r+(B+2)>>0]|0)+(d[r+(B+1)>>0]|0)+(d[r+(B+3)>>0]|0)+(d[r+E>>0]|0)|0;D=(d[r+(E+2)>>0]|0)+(d[r+(E+1)>>0]|0)+(d[r+(E+3)>>0]|0)+(d[r+(E+4)>>0]|0)|0;E=(d[r+(E+6)>>0]|0)+(d[r+(E+5)>>0]|0)+(d[r+(E+7)>>0]|0)+(d[r+(n+(P<<8)|15)>>0]|0)|0;j=D+(B+u)+j+E|0;c[R+32>>2]=j;h=B+u-D-E+h|0;c[R+32+4>>2]=h;x=1;s=y+1|0}else{x=0;u=0;B=0;D=0;E=0;s=y}if((g|0)!=0?(c[b+-20>>2]|0)!=0:0){v=(d[r+(n+-1+(P<<4))>>0]|0)+(d[r+(n+-1)>>0]|0)+(d[r+(n+-1+(P<<5))>>0]|0)+(d[r+(n+-1+(P*48|0))>>0]|0)|0;I=n+-1+(P<<6)|0;F=(d[r+(I+(P<<4))>>0]|0)+(d[r+I>>0]|0)+(d[r+(I+(P<<5))>>0]|0)+(d[r+(I+(P*48|0))>>0]|0)|0;G=(d[r+(I+(P<<6)+(P<<4))>>0]|0)+(d[r+(I+(P<<6))>>0]|0)+(d[r+(I+(P<<6)+(P<<5))>>0]|0)+(d[r+(I+(P<<6)+(P*48|0))>>0]|0)|0;I=I+(P<<6)+(P<<6)|0;I=(d[r+(I+(P<<4))>>0]|0)+(d[r+I>>0]|0)+(d[r+(I+(P<<5))>>0]|0)+(d[r+(I+(P*48|0))>>0]|0)|0;j=G+(F+v)+j+I|0;c[R+32>>2]=j;c[R+32+16>>2]=F+v-G-I;l=F+v-G-I|0;m=s+1|0;t=1}else{l=0;m=s;v=0;F=0;G=0;I=0;t=0}do if((P+-1|0)!=(g|0)?(c[b+412>>2]|0)!=0:0){q=(d[r+(n+16+(P<<4))>>0]|0)+(d[r+(n+16)>>0]|0)+(d[r+(n+16+(P<<5))>>0]|0)+(d[r+(n+16+(P*48|0))>>0]|0)|0;n=n+16+(P<<6)|0;o=(d[r+(n+(P<<4))>>0]|0)+(d[r+n>>0]|0)+(d[r+(n+(P<<5))>>0]|0)+(d[r+(n+(P*48|0))>>0]|0)|0;p=(d[r+(n+(P<<6)+(P<<4))>>0]|0)+(d[r+(n+(P<<6))>>0]|0)+(d[r+(n+(P<<6)+(P<<5))>>0]|0)+(d[r+(n+(P<<6)+(P*48|0))>>0]|0)|0;n=n+(P<<6)+(P<<6)|0;n=(d[r+(n+(P<<4))>>0]|0)+(d[r+n>>0]|0)+(d[r+(n+(P<<5))>>0]|0)+(d[r+(n+(P*48|0))>>0]|0)|0;r=m+1|0;k=t+1|0;j=p+(o+q)+j+n|0;c[R+32>>2]=j;l=o+q-p-n+l|0;c[R+32+16>>2]=l;b=(s|0)==0;m=(t|0)!=0;if(!(b&m)){if(!b){b=m;n=1;m=r;r=21;break}}else c[R+32+4>>2]=G+I+F+v-q-o-p-n>>5;p=R+32+16|0;o=m;m=(y|0)!=0;n=(x|0)!=0;b=1;h=r;r=27}else r=17;while(0);if((r|0)==17){k=(t|0)!=0;if(!s){o=k;q=0;h=m;k=t;r=23}else{b=k;n=0;k=t;r=21}}if((r|0)==21){c[R+32+4>>2]=h>>s+3;o=b;q=n;h=m;r=23}do if((r|0)==23){b=(k|0)==0;m=(y|0)!=0;n=(x|0)!=0;if(n&(m&b)){c[R+32+16>>2]=A+C+z+w-E-D-B-u>>5;O=o;m=1;n=1;N=q;break}if(b){O=o;N=q}else{p=R+32+16|0;b=q;r=27}}while(0);if((r|0)==27){c[p>>2]=l>>k+3;O=o;N=b}switch(h|0){case 1:{k=j>>4;c[R+32>>2]=k;break}case 2:{k=j>>5;c[R+32>>2]=k;break}case 3:{k=j*21>>10;c[R+32>>2]=k;break}default:{k=j>>6;c[R+32>>2]=k}}L=R+32+4|0;j=c[L>>2]|0;M=R+32+16|0;h=c[M>>2]|0;if(!(h|j)){c[R+32+60>>2]=k;c[R+32+56>>2]=k;c[R+32+52>>2]=k;c[R+32+48>>2]=k;c[R+32+44>>2]=k;c[R+32+40>>2]=k;c[R+32+36>>2]=k;c[R+32+32>>2]=k;c[R+32+28>>2]=k;c[R+32+24>>2]=k;c[R+32+20>>2]=k;c[M>>2]=k;c[R+32+12>>2]=k;c[R+32+8>>2]=k;c[L>>2]=k;h=0;k=R+96|0;b=R+32|0}else{J=j+k|0;K=(j>>1)+k|0;b=k-(j>>1)|0;k=k-j|0;c[R+32>>2]=J+h;c[M>>2]=(h>>1)+J;c[R+32+32>>2]=J-(h>>1);c[R+32+48>>2]=J-h;c[L>>2]=K+h;c[R+32+20>>2]=K+(h>>1);c[R+32+36>>2]=K-(h>>1);c[R+32+52>>2]=K-h;c[R+32+8>>2]=b+h;c[R+32+24>>2]=b+(h>>1);c[R+32+40>>2]=b-(h>>1);c[R+32+56>>2]=b-h;c[R+32+12>>2]=k+h;c[R+32+28>>2]=(h>>1)+k;c[R+32+44>>2]=k-(h>>1);c[R+32+60>>2]=k-h;h=0;k=R+96|0;b=R+32|0}while(1){j=c[b+((h>>>2&3)<<2)>>2]|0;a[k>>0]=(j|0)<0?0:(j|0)>255?-1:j&255;j=h+1|0;if((j|0)==256)break;else{h=j;k=k+1|0;b=(j&63|0)==0?b+16|0:b}}K=0-(P<<3)|3;J=(P<<4)+-1+(P<<4)|0;t=z;b=A;k=C;r=B;o=D;l=E;H=0;s=F;q=G;p=I;G=(c[e>>2]|0)+((Z(f<<6,P)|0)+(g<<3)+(Q<<8))|0;while(1){j=R+32|0;h=j+64|0;do{c[j>>2]=0;j=j+4|0}while((j|0)<(h|0));if(m){w=(d[G+(0-(P<<3)|1)>>0]|0)+(d[G+(0-(P<<3))>>0]|0)|0;D=(d[G+K>>0]|0)+(d[G+((0-(P<<3)|1)+1)>>0]|0)|0;E=(d[G+(K+2)>>0]|0)+(d[G+(K+1)>>0]|0)|0;F=(d[G+(0-(P<<3)|7)>>0]|0)+(d[G+(K+3)>>0]|0)|0;c[R+32>>2]=E+(D+w)+F;c[L>>2]=D+w-E-F;j=E+(D+w)+F|0;h=D+w-E-F|0;b=1}else{j=0;h=0;D=t;E=b;F=k;b=0}if(n){u=(d[G+(P<<6|1)>>0]|0)+(d[G+(P<<6)>>0]|0)|0;A=(d[G+(P<<6|3)>>0]|0)+(d[G+((P<<6|1)+1)>>0]|0)|0;B=(d[G+((P<<6|3)+2)>>0]|0)+(d[G+((P<<6|3)+1)>>0]|0)|0;C=(d[G+(P<<6|7)>>0]|0)+(d[G+((P<<6|3)+3)>>0]|0)|0;j=B+(A+u)+j+C|0;c[R+32>>2]=j;k=A+u-B-C+h|0;c[L>>2]=k;b=b+1|0}else{k=h;A=r;B=o;C=l}if(O){v=(d[G+((P<<3)+-1)>>0]|0)+(d[G+-1>>0]|0)|0;x=(d[G+((P<<4)+-1+(P<<3))>>0]|0)+(d[G+((P<<4)+-1)>>0]|0)|0;y=(d[G+(J+(P<<3))>>0]|0)+(d[G+J>>0]|0)|0;z=(d[G+(J+(P<<4)+(P<<3))>>0]|0)+(d[G+(J+(P<<4))>>0]|0)|0;o=y+(x+v)+j+z|0;c[R+32>>2]=o;c[M>>2]=x+v-y-z;l=x+v-y-z|0;j=b+1|0;h=1}else{o=j;l=0;j=b;x=s;y=q;z=p;h=0}do if(N){p=(d[G+((P<<3)+8)>>0]|0)+(d[G+8>>0]|0)|0;q=(d[G+((P<<4|8)+(P<<3))>>0]|0)+(d[G+(P<<4|8)>>0]|0)|0;r=(d[G+((P<<4|8)+(P<<4)+(P<<3))>>0]|0)+(d[G+((P<<4|8)+(P<<4))>>0]|0)|0;s=(d[G+((P<<4|8)+(P<<4)+(P<<4)+(P<<3))>>0]|0)+(d[G+((P<<4|8)+(P<<4)+(P<<4))>>0]|0)|0;j=j+1|0;h=h+1|0;t=r+(q+p)+o+s|0;c[R+32>>2]=t;l=q+p-r-s+l|0;c[M>>2]=l;o=(b|0)==0;if(!(O&o))if(o){b=t;r=53;break}else{o=t;r=49;break}else{k=y+z+x+v-p-q-r-s>>4;c[L>>2]=k;b=t;r=53;break}}else if(!b){p=k;b=o;r=50}else r=49;while(0);if((r|0)==49){p=k>>b+2;c[L>>2]=p;b=o;r=50}do if((r|0)==50){r=0;k=(h|0)==0;if(!(n&(m&k)))if(k){k=p;h=l;break}else{k=p;r=53;break}else{h=E+F+D+w-C-B-A-u>>4;c[M>>2]=h;k=p;break}}while(0);if((r|0)==53){h=l>>h+2;c[M>>2]=h}switch(j|0){case 1:{j=b>>3;c[R+32>>2]=j;break}case 2:{j=b>>4;c[R+32>>2]=j;break}case 3:{j=b*21>>9;c[R+32>>2]=j;break}default:{j=b>>5;c[R+32>>2]=j}}if(!(h|k)){c[R+32+60>>2]=j;c[R+32+56>>2]=j;c[R+32+52>>2]=j;c[R+32+48>>2]=j;c[R+32+44>>2]=j;c[R+32+40>>2]=j;c[R+32+36>>2]=j;c[R+32+32>>2]=j;c[R+32+28>>2]=j;c[R+32+24>>2]=j;c[R+32+20>>2]=j;c[M>>2]=j;c[R+32+12>>2]=j;c[R+32+8>>2]=j;c[L>>2]=j}else{s=k+j|0;I=k>>1;t=I+j|0;I=j-I|0;f=j-k|0;c[R+32>>2]=s+h;g=h>>1;c[M>>2]=g+s;c[R+32+32>>2]=s-g;c[R+32+48>>2]=s-h;c[L>>2]=t+h;c[R+32+20>>2]=t+g;c[R+32+36>>2]=t-g;c[R+32+52>>2]=t-h;c[R+32+8>>2]=I+h;c[R+32+24>>2]=I+g;c[R+32+40>>2]=I-g;c[R+32+56>>2]=I-h;c[R+32+12>>2]=f+h;c[R+32+28>>2]=g+f;c[R+32+44>>2]=f-g;c[R+32+60>>2]=f-h}h=0;k=R+96+((H<<6)+256)|0;b=R+32|0;while(1){j=c[b+((h>>>1&3)<<2)>>2]|0;a[k>>0]=(j|0)<0?0:(j|0)>255?-1:j&255;j=h+1|0;if((j|0)==64)break;else{h=j;k=k+1|0;b=(j&15|0)==0?b+16|0:b}}H=H+1|0;if((H|0)==2)break;else{t=D;b=E;k=F;r=A;o=B;l=C;s=x;q=y;p=z;G=G+(Q<<6)|0}}$a(e,R+96|0);i=R;return}function hb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=Na(a,b)|0;if(d){b=d;return b|0}f=(c[b>>2]|0)+1|0;c[b>>2]=f;if(f>>>0>32){b=1;return b|0}d=Ma(a,4)|0;if((d|0)==-1){b=1;return b|0}c[b+4>>2]=d;d=Ma(a,4)|0;if((d|0)==-1){b=1;return b|0}c[b+8>>2]=d;a:do if(c[b>>2]|0){f=0;while(1){e=b+12+(f<<2)|0;d=Na(a,e)|0;if(d){e=17;break}d=c[e>>2]|0;if((d|0)==-1){d=1;e=17;break}c[e>>2]=d+1;c[e>>2]=d+1<<(c[b+4>>2]|0)+6;e=b+140+(f<<2)|0;d=Na(a,e)|0;if(d){e=17;break}d=c[e>>2]|0;if((d|0)==-1){d=1;e=17;break}c[e>>2]=d+1;c[e>>2]=d+1<<(c[b+8>>2]|0)+4;d=Ma(a,1)|0;if((d|0)==-1){d=1;e=17;break}c[b+268+(f<<2)>>2]=(d|0)==1&1;f=f+1|0;if(f>>>0>=(c[b>>2]|0)>>>0)break a}if((e|0)==17)return d|0}while(0);d=Ma(a,5)|0;if((d|0)==-1){b=1;return b|0}c[b+396>>2]=d+1;d=Ma(a,5)|0;if((d|0)==-1){b=1;return b|0}c[b+400>>2]=d+1;d=Ma(a,5)|0;if((d|0)==-1){b=1;return b|0}c[b+404>>2]=d+1;d=Ma(a,5)|0;if((d|0)==-1){b=1;return b|0}c[b+408>>2]=d;b=0;return b|0}

// EMSCRIPTEN_END_FUNCS
var wa=[Db,rb];var xa=[Eb,qb,sb,pb];var ya=[Fb,Ya,Xa,Fb];var za=[Gb,tb];return{_free:vb,_broadwayGetMajorVersion:nb,_broadwayExit:mb,_memset:xb,_broadwayCreateStream:jb,_malloc:ub,_memcpy:yb,_broadwayGetMinorVersion:ob,_broadwayPlayStream:kb,_broadwayInit:lb,runPostSets:wb,stackAlloc:Aa,stackSave:Ba,stackRestore:Ca,establishStackSpace:Da,setThrew:Ea,setTempRet0:Ha,getTempRet0:Ia,dynCall_ii:zb,dynCall_iiii:Ab,dynCall_viiiii:Bb,dynCall_vi:Cb}})


// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg,Module.asmLibraryArg,buffer);var _free=Module["_free"]=asm["_free"];var runPostSets=Module["runPostSets"]=asm["runPostSets"];var _broadwayGetMajorVersion=Module["_broadwayGetMajorVersion"]=asm["_broadwayGetMajorVersion"];var _broadwayExit=Module["_broadwayExit"]=asm["_broadwayExit"];var _broadwayGetMinorVersion=Module["_broadwayGetMinorVersion"]=asm["_broadwayGetMinorVersion"];var _memset=Module["_memset"]=asm["_memset"];var _broadwayCreateStream=Module["_broadwayCreateStream"]=asm["_broadwayCreateStream"];var _malloc=Module["_malloc"]=asm["_malloc"];var _memcpy=Module["_memcpy"]=asm["_memcpy"];var _broadwayPlayStream=Module["_broadwayPlayStream"]=asm["_broadwayPlayStream"];var _broadwayInit=Module["_broadwayInit"]=asm["_broadwayInit"];var dynCall_ii=Module["dynCall_ii"]=asm["dynCall_ii"];var dynCall_iiii=Module["dynCall_iiii"]=asm["dynCall_iiii"];var dynCall_viiiii=Module["dynCall_viiiii"]=asm["dynCall_viiiii"];var dynCall_vi=Module["dynCall_vi"]=asm["dynCall_vi"];Runtime.stackAlloc=asm["stackAlloc"];Runtime.stackSave=asm["stackSave"];Runtime.stackRestore=asm["stackRestore"];Runtime.establishStackSpace=asm["establishStackSpace"];Runtime.setTempRet0=asm["setTempRet0"];Runtime.getTempRet0=asm["getTempRet0"];function ExitStatus(status){this.name="ExitStatus";this.message="Program terminated with exit("+status+")";this.status=status}ExitStatus.prototype=new Error;ExitStatus.prototype.constructor=ExitStatus;var initialStackTop;var preloadStartTime=null;var calledMain=false;dependenciesFulfilled=function runCaller(){if(!Module["calledRun"])run();if(!Module["calledRun"])dependenciesFulfilled=runCaller};Module["callMain"]=Module.callMain=function callMain(args){assert(runDependencies==0,"cannot call main when async dependencies remain! (listen on __ATMAIN__)");assert(__ATPRERUN__.length==0,"cannot call main when preRun functions remain to be called");args=args||[];ensureInitRuntime();var argc=args.length+1;function pad(){for(var i=0;i<4-1;i++){argv.push(0)}}var argv=[allocate(intArrayFromString(Module["thisProgram"]),"i8",ALLOC_NORMAL)];pad();for(var i=0;i<argc-1;i=i+1){argv.push(allocate(intArrayFromString(args[i]),"i8",ALLOC_NORMAL));pad()}argv.push(0);argv=allocate(argv,"i32",ALLOC_NORMAL);try{var ret=Module["_main"](argc,argv,0);exit(ret,true)}catch(e){if(e instanceof ExitStatus){return}else if(e=="SimulateInfiniteLoop"){Module["noExitRuntime"]=true;return}else{if(e&&typeof e==="object"&&e.stack)Module.printErr("exception thrown: "+[e,e.stack]);throw e}}finally{calledMain=true}};function run(args){args=args||Module["arguments"];if(preloadStartTime===null)preloadStartTime=Date.now();if(runDependencies>0){return}preRun();if(runDependencies>0)return;if(Module["calledRun"])return;function doRun(){if(Module["calledRun"])return;Module["calledRun"]=true;if(ABORT)return;ensureInitRuntime();preMain();if(Module["onRuntimeInitialized"])Module["onRuntimeInitialized"]();if(Module["_main"]&&shouldRunNow)Module["callMain"](args);postRun()}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout((function(){setTimeout((function(){Module["setStatus"]("")}),1);doRun()}),1)}else{doRun()}}Module["run"]=Module.run=run;function exit(status,implicit){if(implicit&&Module["noExitRuntime"]){return}if(Module["noExitRuntime"]){}else{ABORT=true;EXITSTATUS=status;STACKTOP=initialStackTop;exitRuntime();if(Module["onExit"])Module["onExit"](status)}if(ENVIRONMENT_IS_NODE){process["stdout"]["once"]("drain",(function(){process["exit"](status)}));console.log(" ");setTimeout((function(){process["exit"](status)}),500)}else if(ENVIRONMENT_IS_SHELL&&typeof quit==="function"){quit(status)}throw new ExitStatus(status)}Module["exit"]=Module.exit=exit;var abortDecorators=[];function abort(what){if(what!==undefined){Module.print(what);Module.printErr(what);what=JSON.stringify(what)}else{what=""}ABORT=true;EXITSTATUS=1;var extra="\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";var output="abort("+what+") at "+stackTrace()+extra;if(abortDecorators){abortDecorators.forEach((function(decorator){output=decorator(output,what)}))}throw output}Module["abort"]=Module.abort=abort;if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].pop()()}}var shouldRunNow=false;if(Module["noInitialRun"]){shouldRunNow=false}Module["noExitRuntime"]=true;run()




       return Module;
    })();
    
    var resultModule = global.Module || Module;

    resultModule._broadwayOnHeadersDecoded = par_broadwayOnHeadersDecoded;
    resultModule._broadwayOnPictureDecoded = par_broadwayOnPictureDecoded;
    
    return resultModule;
  };

  return (function(){
    "use strict";
  
  
  var nowValue = function(){
    return (new Date()).getTime();
  };
  
  if (typeof performance != "undefined"){
    if (performance.now){
      nowValue = function(){
        return performance.now();
      };
    };
  };
  
  
  var Decoder = function(parOptions){
    this.options = parOptions || {};
    
    this.now = nowValue;
    
    var asmInstance;
    
    var fakeWindow = {
    };
    
    var onPicFun = function ($buffer, width, height) {
      var buffer = this.pictureBuffers[$buffer];
      if (!buffer) {
        buffer = this.pictureBuffers[$buffer] = toU8Array($buffer, (width * height * 3) / 2);
      };
      
      var infos;
      var doInfo = false;
      if (this.infoAr.length){
        doInfo = true;
        infos = this.infoAr;
      };
      this.infoAr = [];
      
      if (this.options.rgb){
        if (!asmInstance){
          asmInstance = getAsm(width, height);
        };
        asmInstance.inp.set(buffer);
        asmInstance.doit();

        var copyU8 = new Uint8Array(asmInstance.outSize);
        copyU8.set( asmInstance.out );
        
        if (doInfo){
          infos[0].finishDecoding = nowValue();
        };
        
        this.onPictureDecoded(copyU8, width, height, infos);
        return;
        
      };
      
      if (doInfo){
        infos[0].finishDecoding = nowValue();
      };
      this.onPictureDecoded(buffer, width, height, infos);
    }.bind(this);
    
    var ignore = false;
    
    if (this.options.sliceMode){
      onPicFun = function ($buffer, width, height, $sliceInfo) {
        if (ignore){
          return;
        };
        var buffer = this.pictureBuffers[$buffer];
        if (!buffer) {
          buffer = this.pictureBuffers[$buffer] = toU8Array($buffer, (width * height * 3) / 2);
        };
        var sliceInfo = this.pictureBuffers[$sliceInfo];
        if (!sliceInfo) {
          sliceInfo = this.pictureBuffers[$sliceInfo] = toU32Array($sliceInfo, 18);
        };

        var infos;
        var doInfo = false;
        if (this.infoAr.length){
          doInfo = true;
          infos = this.infoAr;
        };
        this.infoAr = [];

        /*if (this.options.rgb){
        
        no rgb in slice mode

        };*/

        infos[0].finishDecoding = nowValue();
        var sliceInfoAr = [];
        for (var i = 0; i < 20; ++i){
          sliceInfoAr.push(sliceInfo[i]);
        };
        infos[0].sliceInfoAr = sliceInfoAr;

        this.onPictureDecoded(buffer, width, height, infos);
      }.bind(this);
    };
    
    var Module = getModule.apply(fakeWindow, [function () {
    }, onPicFun]);
    

    var HEAP8 = Module.HEAP8;
    var HEAPU8 = Module.HEAPU8;
    var HEAP16 = Module.HEAP16;
    var HEAP32 = Module.HEAP32;

    
    var MAX_STREAM_BUFFER_LENGTH = 1024 * 1024;
  
    // from old constructor
    Module._broadwayInit();
    
    /**
   * Creates a typed array from a HEAP8 pointer. 
   */
    function toU8Array(ptr, length) {
      return HEAPU8.subarray(ptr, ptr + length);
    };
    function toU32Array(ptr, length) {
      //var tmp = HEAPU8.subarray(ptr, ptr + (length * 4));
      return new Uint32Array(HEAPU8.buffer, ptr, length);
    };
    this.streamBuffer = toU8Array(Module._broadwayCreateStream(MAX_STREAM_BUFFER_LENGTH), MAX_STREAM_BUFFER_LENGTH);
    this.pictureBuffers = {};
    // collect extra infos that are provided with the nal units
    this.infoAr = [];
    
    this.onPictureDecoded = function (buffer, width, height, infos) {
      
    };
    
    /**
     * Decodes a stream buffer. This may be one single (unframed) NAL unit without the
     * start code, or a sequence of NAL units with framing start code prefixes. This
     * function overwrites stream buffer allocated by the codec with the supplied buffer.
     */
    
    var sliceNum = 0;
    if (this.options.sliceMode){
      sliceNum = this.options.sliceNum;
      
      this.decode = function decode(typedAr, parInfo, copyDoneFun) {
        this.infoAr.push(parInfo);
        parInfo.startDecoding = nowValue();
        var nals = parInfo.nals;
        var i;
        if (!nals){
          nals = [];
          parInfo.nals = nals;
          var l = typedAr.length;
          var foundSomething = false;
          var lastFound = 0;
          var lastStart = 0;
          for (i = 0; i < l; ++i){
            if (typedAr[i] === 1){
              if (
                typedAr[i - 1] === 0 &&
                typedAr[i - 2] === 0
              ){
                var startPos = i - 2;
                if (typedAr[i - 3] === 0){
                  startPos = i - 3;
                };
                // its a nal;
                if (foundSomething){
                  nals.push({
                    offset: lastFound,
                    end: startPos,
                    type: typedAr[lastStart] & 31
                  });
                };
                lastFound = startPos;
                lastStart = startPos + 3;
                if (typedAr[i - 3] === 0){
                  lastStart = startPos + 4;
                };
                foundSomething = true;
              };
            };
          };
          if (foundSomething){
            nals.push({
              offset: lastFound,
              end: i,
              type: typedAr[lastStart] & 31
            });
          };
        };
        
        var currentSlice = 0;
        var playAr;
        var offset = 0;
        for (i = 0; i < nals.length; ++i){
          if (nals[i].type === 1 || nals[i].type === 5){
            if (currentSlice === sliceNum){
              playAr = typedAr.subarray(nals[i].offset, nals[i].end);
              this.streamBuffer[offset] = 0;
              offset += 1;
              this.streamBuffer.set(playAr, offset);
              offset += playAr.length;
            };
            currentSlice += 1;
          }else{
            playAr = typedAr.subarray(nals[i].offset, nals[i].end);
            this.streamBuffer[offset] = 0;
            offset += 1;
            this.streamBuffer.set(playAr, offset);
            offset += playAr.length;
            Module._broadwayPlayStream(offset);
            offset = 0;
          };
        };
        copyDoneFun();
        Module._broadwayPlayStream(offset);
      };
      
    }else{
      this.decode = function decode(typedAr, parInfo) {
        // console.info("Decoding: " + buffer.length);
        // collect infos
        if (parInfo){
          this.infoAr.push(parInfo);
          parInfo.startDecoding = nowValue();
        };

        this.streamBuffer.set(typedAr);
        Module._broadwayPlayStream(typedAr.length);
      };
    };

  };

  
  Decoder.prototype = {
    
  };
  
  
  
  
  /*
  
    asm.js implementation of a yuv to rgb convertor
    provided by @soliton4
    
    based on 
    http://www.wordsaretoys.com/2013/10/18/making-yuv-conversion-a-little-faster/
  
  */
  
  
  // factory to create asm.js yuv -> rgb convertor for a given resolution
  var asmInstances = {};
  var getAsm = function(parWidth, parHeight){
    var idStr = "" + parWidth + "x" + parHeight;
    if (asmInstances[idStr]){
      return asmInstances[idStr];
    };

    var lumaSize = parWidth * parHeight;
    var chromaSize = (lumaSize|0) >> 2;

    var inpSize = lumaSize + chromaSize + chromaSize;
    var outSize = parWidth * parHeight * 4;
    var cacheSize = Math.pow(2, 24) * 4;
    var size = inpSize + outSize + cacheSize;

    var chunkSize = Math.pow(2, 24);
    var heapSize = chunkSize;
    while (heapSize < size){
      heapSize += chunkSize;
    };
    var heap = new ArrayBuffer(heapSize);

    var res = asmFactory(global, {}, heap);
    res.init(parWidth, parHeight);
    asmInstances[idStr] = res;

    res.heap = heap;
    res.out = new Uint8Array(heap, 0, outSize);
    res.inp = new Uint8Array(heap, outSize, inpSize);
    res.outSize = outSize;

    return res;
  };


  function asmFactory(stdlib, foreign, heap) {
    "use asm";

    var imul = stdlib.Math.imul;
    var min = stdlib.Math.min;
    var max = stdlib.Math.max;
    var pow = stdlib.Math.pow;
    var out = new stdlib.Uint8Array(heap);
    var out32 = new stdlib.Uint32Array(heap);
    var inp = new stdlib.Uint8Array(heap);
    var mem = new stdlib.Uint8Array(heap);
    var mem32 = new stdlib.Uint32Array(heap);

    // for double algo
    /*var vt = 1.370705;
    var gt = 0.698001;
    var gt2 = 0.337633;
    var bt = 1.732446;*/

    var width = 0;
    var height = 0;
    var lumaSize = 0;
    var chromaSize = 0;
    var inpSize = 0;
    var outSize = 0;

    var inpStart = 0;
    var outStart = 0;

    var widthFour = 0;

    var cacheStart = 0;


    function init(parWidth, parHeight){
      parWidth = parWidth|0;
      parHeight = parHeight|0;

      var i = 0;
      var s = 0;

      width = parWidth;
      widthFour = imul(parWidth, 4)|0;
      height = parHeight;
      lumaSize = imul(width|0, height|0)|0;
      chromaSize = (lumaSize|0) >> 2;
      outSize = imul(imul(width, height)|0, 4)|0;
      inpSize = ((lumaSize + chromaSize)|0 + chromaSize)|0;

      outStart = 0;
      inpStart = (outStart + outSize)|0;
      cacheStart = (inpStart + inpSize)|0;

      // initializing memory (to be on the safe side)
      s = ~~(+pow(+2, +24));
      s = imul(s, 4)|0;

      for (i = 0|0; ((i|0) < (s|0))|0; i = (i + 4)|0){
        mem32[((cacheStart + i)|0) >> 2] = 0;
      };
    };

    function doit(){
      var ystart = 0;
      var ustart = 0;
      var vstart = 0;

      var y = 0;
      var yn = 0;
      var u = 0;
      var v = 0;

      var o = 0;

      var line = 0;
      var col = 0;

      var usave = 0;
      var vsave = 0;

      var ostart = 0;
      var cacheAdr = 0;

      ostart = outStart|0;

      ystart = inpStart|0;
      ustart = (ystart + lumaSize|0)|0;
      vstart = (ustart + chromaSize)|0;

      for (line = 0; (line|0) < (height|0); line = (line + 2)|0){
        usave = ustart;
        vsave = vstart;
        for (col = 0; (col|0) < (width|0); col = (col + 2)|0){
          y = inp[ystart >> 0]|0;
          yn = inp[((ystart + width)|0) >> 0]|0;

          u = inp[ustart >> 0]|0;
          v = inp[vstart >> 0]|0;

          cacheAdr = (((((y << 16)|0) + ((u << 8)|0))|0) + v)|0;
          o = mem32[((cacheStart + cacheAdr)|0) >> 2]|0;
          if (o){}else{
            o = yuv2rgbcalc(y,u,v)|0;
            mem32[((cacheStart + cacheAdr)|0) >> 2] = o|0;
          };
          mem32[ostart >> 2] = o;

          cacheAdr = (((((yn << 16)|0) + ((u << 8)|0))|0) + v)|0;
          o = mem32[((cacheStart + cacheAdr)|0) >> 2]|0;
          if (o){}else{
            o = yuv2rgbcalc(yn,u,v)|0;
            mem32[((cacheStart + cacheAdr)|0) >> 2] = o|0;
          };
          mem32[((ostart + widthFour)|0) >> 2] = o;

          //yuv2rgb5(y, u, v, ostart);
          //yuv2rgb5(yn, u, v, (ostart + widthFour)|0);
          ostart = (ostart + 4)|0;

          // next step only for y. u and v stay the same
          ystart = (ystart + 1)|0;
          y = inp[ystart >> 0]|0;
          yn = inp[((ystart + width)|0) >> 0]|0;

          //yuv2rgb5(y, u, v, ostart);
          cacheAdr = (((((y << 16)|0) + ((u << 8)|0))|0) + v)|0;
          o = mem32[((cacheStart + cacheAdr)|0) >> 2]|0;
          if (o){}else{
            o = yuv2rgbcalc(y,u,v)|0;
            mem32[((cacheStart + cacheAdr)|0) >> 2] = o|0;
          };
          mem32[ostart >> 2] = o;

          //yuv2rgb5(yn, u, v, (ostart + widthFour)|0);
          cacheAdr = (((((yn << 16)|0) + ((u << 8)|0))|0) + v)|0;
          o = mem32[((cacheStart + cacheAdr)|0) >> 2]|0;
          if (o){}else{
            o = yuv2rgbcalc(yn,u,v)|0;
            mem32[((cacheStart + cacheAdr)|0) >> 2] = o|0;
          };
          mem32[((ostart + widthFour)|0) >> 2] = o;
          ostart = (ostart + 4)|0;

          //all positions inc 1

          ystart = (ystart + 1)|0;
          ustart = (ustart + 1)|0;
          vstart = (vstart + 1)|0;
        };
        ostart = (ostart + widthFour)|0;
        ystart = (ystart + width)|0;

      };

    };

    function yuv2rgbcalc(y, u, v){
      y = y|0;
      u = u|0;
      v = v|0;

      var r = 0;
      var g = 0;
      var b = 0;

      var o = 0;

      var a0 = 0;
      var a1 = 0;
      var a2 = 0;
      var a3 = 0;
      var a4 = 0;

      a0 = imul(1192, (y - 16)|0)|0;
      a1 = imul(1634, (v - 128)|0)|0;
      a2 = imul(832, (v - 128)|0)|0;
      a3 = imul(400, (u - 128)|0)|0;
      a4 = imul(2066, (u - 128)|0)|0;

      r = (((a0 + a1)|0) >> 10)|0;
      g = (((((a0 - a2)|0) - a3)|0) >> 10)|0;
      b = (((a0 + a4)|0) >> 10)|0;

      if ((((r & 255)|0) != (r|0))|0){
        r = min(255, max(0, r|0)|0)|0;
      };
      if ((((g & 255)|0) != (g|0))|0){
        g = min(255, max(0, g|0)|0)|0;
      };
      if ((((b & 255)|0) != (b|0))|0){
        b = min(255, max(0, b|0)|0)|0;
      };

      o = 255;
      o = (o << 8)|0;
      o = (o + b)|0;
      o = (o << 8)|0;
      o = (o + g)|0;
      o = (o << 8)|0;
      o = (o + r)|0;

      return o|0;

    };



    return {
      init: init,
      doit: doit
    };
  };

  
  /*
    potential worker initialization
  
  */
  
  
  if (typeof self != "undefined"){
    var isWorker = false;
    var decoder;
    var reuseMemory = false;
    var sliceMode = false;
    var sliceNum = 0;
    var sliceCnt = 0;
    var lastSliceNum = 0;
    var sliceInfoAr;
    var lastBuf;
    var awaiting = 0;
    var pile = [];
    var startDecoding;
    var finishDecoding;
    var timeDecoding;
    
    var memAr = [];
    var getMem = function(length){
      if (memAr.length){
        var u = memAr.shift();
        while (u && u.byteLength !== length){
          u = memAr.shift();
        };
        if (u){
          return u;
        };
      };
      return new ArrayBuffer(length);
    }; 
    
    var copySlice = function(source, target, infoAr, width, height){
      
      var length = width * height;
      var length4 = length / 4
      var plane2 = length;
      var plane3 = length + length4;
      
      var copy16 = function(parBegin, parEnd){
        var i = 0;
        for (i = 0; i < 16; ++i){
          var begin = parBegin + (width * i);
          var end = parEnd + (width * i)
          target.set(source.subarray(begin, end), begin);
        };
      };
      var copy8 = function(parBegin, parEnd){
        var i = 0;
        for (i = 0; i < 8; ++i){
          var begin = parBegin + ((width / 2) * i);
          var end = parEnd + ((width / 2) * i)
          target.set(source.subarray(begin, end), begin);
        };
      };
      var copyChunk = function(begin, end){
        target.set(source.subarray(begin, end), begin);
      };
      
      var begin = infoAr[0];
      var end = infoAr[1];
      if (end > 0){
        copy16(begin, end);
        copy8(infoAr[2], infoAr[3]);
        copy8(infoAr[4], infoAr[5]);
      };
      begin = infoAr[6];
      end = infoAr[7];
      if (end > 0){
        copy16(begin, end);
        copy8(infoAr[8], infoAr[9]);
        copy8(infoAr[10], infoAr[11]);
      };
      
      begin = infoAr[12];
      end = infoAr[15];
      if (end > 0){
        copyChunk(begin, end);
        copyChunk(infoAr[13], infoAr[16]);
        copyChunk(infoAr[14], infoAr[17]);
      };
      
    };
    
    var sliceMsgFun = function(){};
    
    var setSliceCnt = function(parSliceCnt){
      sliceCnt = parSliceCnt;
      lastSliceNum = sliceCnt - 1;
    };
    
    
    self.addEventListener('message', function(e) {
      
      if (isWorker){
        if (reuseMemory){
          if (e.data.reuse){
            memAr.push(e.data.reuse);
          };
        };
        if (e.data.buf){
          if (sliceMode && awaiting !== 0){
            pile.push(e.data);
          }else{
            decoder.decode(
              new Uint8Array(e.data.buf, e.data.offset || 0, e.data.length), 
              e.data.info, 
              function(){
                if (sliceMode && sliceNum !== lastSliceNum){
                  postMessage(e.data, [e.data.buf]);
                };
              }
            );
          };
          return;
        };
        
        if (e.data.slice){
          // update ref pic
          var copyStart = nowValue();
          copySlice(new Uint8Array(e.data.slice), lastBuf, e.data.infos[0].sliceInfoAr, e.data.width, e.data.height);
          // is it the one? then we need to update it
          if (e.data.theOne){
            copySlice(lastBuf, new Uint8Array(e.data.slice), sliceInfoAr, e.data.width, e.data.height);
            if (timeDecoding > e.data.infos[0].timeDecoding){
              e.data.infos[0].timeDecoding = timeDecoding;
            };
            e.data.infos[0].timeCopy += (nowValue() - copyStart);
          };
          // move on
          postMessage(e.data, [e.data.slice]);
          
          // next frame in the pipe?
          awaiting -= 1;
          if (awaiting === 0 && pile.length){
            var data = pile.shift();
            decoder.decode(
              new Uint8Array(data.buf, data.offset || 0, data.length), 
              data.info, 
              function(){
                if (sliceMode && sliceNum !== lastSliceNum){
                  postMessage(data, [data.buf]);
                };
              }
            );
          };
          return;
        };
        
        if (e.data.setSliceCnt){
          setSliceCnt(e.data.sliceCnt);
          return;
        };
        
      }else{
        if (e.data && e.data.type === "Broadway.js - Worker init"){
          isWorker = true;
          decoder = new Decoder(e.data.options);
          
          if (e.data.options.sliceMode){
            reuseMemory = true;
            sliceMode = true;
            sliceNum = e.data.options.sliceNum;
            setSliceCnt(e.data.options.sliceCnt);

            decoder.onPictureDecoded = function (buffer, width, height, infos) {
              
              // buffer needs to be copied because we give up ownership
              var copyU8 = new Uint8Array(getMem(buffer.length));
              copySlice(buffer, copyU8, infos[0].sliceInfoAr, width, height);
              
              startDecoding = infos[0].startDecoding;
              finishDecoding = infos[0].finishDecoding;
              timeDecoding = finishDecoding - startDecoding;
              infos[0].timeDecoding = timeDecoding;
              infos[0].timeCopy = 0;
              
              postMessage({
                slice: copyU8.buffer,
                sliceNum: sliceNum,
                width: width, 
                height: height, 
                infos: infos
              }, [copyU8.buffer]); // 2nd parameter is used to indicate transfer of ownership
              
              awaiting = sliceCnt - 1;
              
              lastBuf = buffer;
              sliceInfoAr = infos[0].sliceInfoAr;

            };
            
          }else if (e.data.options.reuseMemory){
            reuseMemory = true;
            decoder.onPictureDecoded = function (buffer, width, height, infos) {
              
              // buffer needs to be copied because we give up ownership
              var copyU8 = new Uint8Array(getMem(buffer.length));
              copyU8.set( buffer, 0, buffer.length );

              postMessage({
                buf: copyU8.buffer, 
                length: buffer.length,
                width: width, 
                height: height, 
                infos: infos
              }, [copyU8.buffer]); // 2nd parameter is used to indicate transfer of ownership

            };
            
          }else{
            decoder.onPictureDecoded = function (buffer, width, height, infos) {
              if (buffer) {
                buffer = new Uint8Array(buffer);
              };

              // buffer needs to be copied because we give up ownership
              var copyU8 = new Uint8Array(buffer.length);
              copyU8.set( buffer, 0, buffer.length );

              postMessage({
                buf: copyU8.buffer, 
                length: buffer.length,
                width: width, 
                height: height, 
                infos: infos
              }, [copyU8.buffer]); // 2nd parameter is used to indicate transfer of ownership

            };
          };
          postMessage({ consoleLog: "broadway worker initialized" });
        };
      };


    }, false);
  };
  
  Decoder.nowValue = nowValue;
  
  return Decoder;
  
  })();
  
  
}));


}).call(this)}).call(this,require('_process'),"/app/lib/broadway")
},{"_process":14}],10:[function(require,module,exports){
/*


usage:

p = new Player({
  useWorker: <bool>,
  workerFile: <defaults to "Decoder.js"> // give path to Decoder.js
  webgl: true | false | "auto" // defaults to "auto"
});

// canvas property represents the canvas node
// put it somewhere in the dom
p.canvas;

p.webgl; // contains the used rendering mode. if you pass auto to webgl you can see what auto detection resulted in

p.decode(<binary>);


*/



// universal module definition
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(["./Decoder", "./YUVCanvas"], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require("./Decoder"), require("./YUVCanvas"));
    } else {
        // Browser globals (root is window)
        window.Player = factory(window.Decoder, window.YUVCanvas);
    }
}(this, function (Decoder, WebGLCanvas) {
  "use strict";
  
  
  var nowValue = Decoder.nowValue;
  
  
  var Player = function(parOptions){
    var self = this;
    this._config = parOptions || {};
    
    this.render = true;
    if (this._config.render === false){
      this.render = false;
    };
    
    this.nowValue = nowValue;
    
    this._config.workerFile = this._config.workerFile || "Decoder.js";
    if (this._config.preserveDrawingBuffer){
      this._config.contextOptions = this._config.contextOptions || {};
      this._config.contextOptions.preserveDrawingBuffer = true;
    };
    
    var webgl = "auto";
    if (this._config.webgl === true){
      webgl = true;
    }else if (this._config.webgl === false){
      webgl = false;
    };
    
    if (webgl == "auto"){
      webgl = true;
      try{
        if (!window.WebGLRenderingContext) {
          // the browser doesn't even know what WebGL is
          webgl = false;
        } else {
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext("webgl");
          if (!ctx) {
            // browser supports WebGL but initialization failed.
            webgl = false;
          };
        };
      }catch(e){
        webgl = false;
      };
    };
    
    this.webgl = webgl;
    
    // choose functions
    if (this.webgl){
      this.createCanvasObj = this.createCanvasWebGL;
      this.renderFrame = this.renderFrameWebGL;
    }else{
      this.createCanvasObj = this.createCanvasRGB;
      this.renderFrame = this.renderFrameRGB;
    };
    
    
    var lastWidth;
    var lastHeight;
    var onPictureDecoded = function(buffer, width, height, infos) {
      self.onPictureDecoded(buffer, width, height, infos);
      
      var startTime = nowValue();
      
      if (!buffer || !self.render) {
        return;
      };
      
      self.renderFrame({
        canvasObj: self.canvasObj,
        data: buffer,
        width: width,
        height: height
      });
      
      if (self.onRenderFrameComplete){
        self.onRenderFrameComplete({
          data: buffer,
          width: width,
          height: height,
          infos: infos,
          canvasObj: self.canvasObj
        });
      };
      
    };
    
    // provide size
    
    if (!this._config.size){
      this._config.size = {};
    };
    this._config.size.width = this._config.size.width || 200;
    this._config.size.height = this._config.size.height || 200;
    
    if (this._config.useWorker){
      var worker = new Worker(this._config.workerFile);
      this.worker = worker;
      worker.addEventListener('message', function(e) {
        var data = e.data;
        if (data.consoleLog){
          console.log(data.consoleLog);
          return;
        };
        
        onPictureDecoded.call(self, new Uint8Array(data.buf, 0, data.length), data.width, data.height, data.infos);
        
      }, false);
      
      worker.postMessage({type: "Broadway.js - Worker init", options: {
        rgb: !webgl,
        memsize: this.memsize,
        reuseMemory: this._config.reuseMemory ? true : false
      }});
      
      if (this._config.transferMemory){
        this.decode = function(parData, parInfo){
          // no copy
          // instead we are transfering the ownership of the buffer
          // dangerous!!!
          
          worker.postMessage({buf: parData.buffer, offset: parData.byteOffset, length: parData.length, info: parInfo}, [parData.buffer]); // Send data to our worker.
        };
        
      }else{
        this.decode = function(parData, parInfo){
          // Copy the sample so that we only do a structured clone of the
          // region of interest
          var copyU8 = new Uint8Array(parData.length);
          copyU8.set( parData, 0, parData.length );
          worker.postMessage({buf: copyU8.buffer, offset: 0, length: parData.length, info: parInfo}, [copyU8.buffer]); // Send data to our worker.
        };
        
      };
      
      if (this._config.reuseMemory){
        this.recycleMemory = function(parArray){
          //this.beforeRecycle();
          worker.postMessage({reuse: parArray.buffer}, [parArray.buffer]); // Send data to our worker.
          //this.afterRecycle();
        };
      }
      
    }else{
      
      this.decoder = new Decoder({
        rgb: !webgl
      });
      this.decoder.onPictureDecoded = onPictureDecoded;

      this.decode = function(parData, parInfo){
        self.decoder.decode(parData, parInfo);
      };
      
    };
    
    
    
    if (this.render){
      this.canvasObj = this.createCanvasObj({
        contextOptions: this._config.contextOptions
      });
      this.canvas = this.canvasObj.canvas;
    };

    this.domNode = this.canvas;
    
    lastWidth = this._config.size.width;
    lastHeight = this._config.size.height;
    
  };
  
  Player.prototype = {
    
    onPictureDecoded: function(buffer, width, height, infos){},
    
    // call when memory of decoded frames is not used anymore
    recycleMemory: function(buf){
    },
    /*beforeRecycle: function(){},
    afterRecycle: function(){},*/
    
    // for both functions options is:
    //
    //  width
    //  height
    //  enableScreenshot
    //
    // returns a object that has a property canvas which is a html5 canvas
    createCanvasWebGL: function(options){
      var canvasObj = this._createBasicCanvasObj(options);
      canvasObj.contextOptions = options.contextOptions;
      return canvasObj;
    },
    
    createCanvasRGB: function(options){
      var canvasObj = this._createBasicCanvasObj(options);
      return canvasObj;
    },
    
    // part that is the same for webGL and RGB
    _createBasicCanvasObj: function(options){
      options = options || {};
      
      var obj = {};
      var width = options.width;
      if (!width){
        width = this._config.size.width;
      };
      var height = options.height;
      if (!height){
        height = this._config.size.height;
      };
      obj.canvas = document.createElement('canvas');
      obj.canvas.width = width;
      obj.canvas.height = height;
      obj.canvas.style.backgroundColor = "#0D0E1B";
      
      
      return obj;
    },
    
    // options:
    //
    // canvas
    // data
    renderFrameWebGL: function(options){
      
      var canvasObj = options.canvasObj;
      
      var width = options.width || canvasObj.canvas.width;
      var height = options.height || canvasObj.canvas.height;
      
      if (canvasObj.canvas.width !== width || canvasObj.canvas.height !== height || !canvasObj.webGLCanvas){
        canvasObj.canvas.width = width;
        canvasObj.canvas.height = height;
        canvasObj.webGLCanvas = new WebGLCanvas({
          canvas: canvasObj.canvas,
          contextOptions: canvasObj.contextOptions,
          width: width,
          height: height
        });
      };
      
      var ylen = width * height;
      var uvlen = (width / 2) * (height / 2);
      
      canvasObj.webGLCanvas.drawNextOutputPicture({
        yData: options.data.subarray(0, ylen),
        uData: options.data.subarray(ylen, ylen + uvlen),
        vData: options.data.subarray(ylen + uvlen, ylen + uvlen + uvlen)
      });
      
      var self = this;
      self.recycleMemory(options.data);
      
    },
    renderFrameRGB: function(options){
      var canvasObj = options.canvasObj;

      var width = options.width || canvasObj.canvas.width;
      var height = options.height || canvasObj.canvas.height;
      
      if (canvasObj.canvas.width !== width || canvasObj.canvas.height !== height){
        canvasObj.canvas.width = width;
        canvasObj.canvas.height = height;
      };
      
      var ctx = canvasObj.ctx;
      var imgData = canvasObj.imgData;

      if (!ctx){
        canvasObj.ctx = canvasObj.canvas.getContext('2d');
        ctx = canvasObj.ctx;

        canvasObj.imgData = ctx.createImageData(width, height);
        imgData = canvasObj.imgData;
      };

      imgData.data.set(options.data);
      ctx.putImageData(imgData, 0, 0);
      var self = this;
      self.recycleMemory(options.data);
      
    }
    
  };
  
  return Player;
  
}));


},{"./Decoder":9,"./YUVCanvas":11}],11:[function(require,module,exports){
//
//  Copyright (c) 2015 Paperspace Co. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to
//  deal in the Software without restriction, including without limitation the
//  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
//  sell copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
//  IN THE SOFTWARE.
//


// universal module definition
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        window.YUVCanvas = factory();
    }
}(this, function () {


/**
 * This class can be used to render output pictures from an H264bsdDecoder to a canvas element.
 * If available the content is rendered using WebGL.
 */
  function YUVCanvas(parOptions) {
    
    parOptions = parOptions || {};
    
    
    // Added to make screenshots available - TJWeb custom 
    parOptions.contextOptions = {preserveDrawingBuffer: true, antialias: false};
    
    this.canvasElement = parOptions.canvas || document.createElement("canvas");
    this.contextOptions = parOptions.contextOptions;
    
    this.type = parOptions.type || "yuv420";
    
    this.customYUV444 = parOptions.customYUV444;
    
    this.conversionType = parOptions.conversionType || "rec601";

    this.width = parOptions.width || 640;
    this.height = parOptions.height || 320;
    
    this.animationTime = parOptions.animationTime || 0;
    
    this.canvasElement.width = this.width;
    this.canvasElement.height = this.height;

    this.initContextGL();

    if(this.contextGL) {
      this.initProgram();
      this.initBuffers();
      this.initTextures();
    };
    

/**
 * Draw the next output picture using WebGL
 */
    if (this.type === "yuv420"){
      this.drawNextOuptutPictureGL = function(par) {
        var gl = this.contextGL;
        var texturePosBuffer = this.texturePosBuffer;
        var uTexturePosBuffer = this.uTexturePosBuffer;
        var vTexturePosBuffer = this.vTexturePosBuffer;
        
        var yTextureRef = this.yTextureRef;
        var uTextureRef = this.uTextureRef;
        var vTextureRef = this.vTextureRef;
        
        var yData = par.yData;
        var uData = par.uData;
        var vData = par.vData;
        var width = this.width;
        var height = this.height;
        
        var yDataPerRow = par.yDataPerRow || width;
        var yRowCnt     = par.yRowCnt || height;
        
        var uDataPerRow = par.uDataPerRow || (width / 2);
        var uRowCnt     = par.uRowCnt || (height / 2);
        
        var vDataPerRow = par.vDataPerRow || uDataPerRow;
        var vRowCnt     = par.vRowCnt || uRowCnt;
        
        gl.viewport(0, 0, width, height);

        var tTop = 0;
        var tLeft = 0;
        var tBottom = height / yRowCnt;
        var tRight = width / yDataPerRow;
        var texturePosValues = new Float32Array([tRight, tTop, tLeft, tTop, tRight, tBottom, tLeft, tBottom]);

        gl.bindBuffer(gl.ARRAY_BUFFER, texturePosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texturePosValues, gl.DYNAMIC_DRAW);
        
        if (this.customYUV444){
          tBottom = height / uRowCnt;
          tRight = width / uDataPerRow;
        }else{
          tBottom = (height / 2) / uRowCnt;
          tRight = (width / 2) / uDataPerRow;
        };
        var uTexturePosValues = new Float32Array([tRight, tTop, tLeft, tTop, tRight, tBottom, tLeft, tBottom]);

        gl.bindBuffer(gl.ARRAY_BUFFER, uTexturePosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, uTexturePosValues, gl.DYNAMIC_DRAW);
        
        
        if (this.customYUV444){
          tBottom = height / vRowCnt;
          tRight = width / vDataPerRow;
        }else{
          tBottom = (height / 2) / vRowCnt;
          tRight = (width / 2) / vDataPerRow;
        };
        var vTexturePosValues = new Float32Array([tRight, tTop, tLeft, tTop, tRight, tBottom, tLeft, tBottom]);

        gl.bindBuffer(gl.ARRAY_BUFFER, vTexturePosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vTexturePosValues, gl.DYNAMIC_DRAW);
        

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, yTextureRef);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, yDataPerRow, yRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, yData);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, uTextureRef);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, uDataPerRow, uRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uData);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, vTextureRef);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, vDataPerRow, vRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, vData);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); 
      };
      
    }else if (this.type === "yuv422"){
      this.drawNextOuptutPictureGL = function(par) {
        var gl = this.contextGL;
        var texturePosBuffer = this.texturePosBuffer;
        
        var textureRef = this.textureRef;
        
        var data = par.data;
        
        var width = this.width;
        var height = this.height;
        
        var dataPerRow = par.dataPerRow || (width * 2);
        var rowCnt     = par.rowCnt || height;

        gl.viewport(0, 0, width, height);

        var tTop = 0;
        var tLeft = 0;
        var tBottom = height / rowCnt;
        var tRight = width / (dataPerRow / 2);
        var texturePosValues = new Float32Array([tRight, tTop, tLeft, tTop, tRight, tBottom, tLeft, tBottom]);

        gl.bindBuffer(gl.ARRAY_BUFFER, texturePosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texturePosValues, gl.DYNAMIC_DRAW);
        
        gl.uniform2f(gl.getUniformLocation(this.shaderProgram, 'resolution'), dataPerRow, height);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureRef);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, dataPerRow, rowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); 
      };
    };
    
  };

  /**
 * Returns true if the canvas supports WebGL
 */
  YUVCanvas.prototype.isWebGL = function() {
    return this.contextGL;
  };

  /**
 * Create the GL context from the canvas element
 */
  YUVCanvas.prototype.initContextGL = function() {
    var canvas = this.canvasElement;
    var gl = null;

    var validContextNames = ["webgl", "experimental-webgl", "moz-webgl", "webkit-3d"];
    var nameIndex = 0;

    while(!gl && nameIndex < validContextNames.length) {
      var contextName = validContextNames[nameIndex];

      try {
        if (this.contextOptions){
          gl = canvas.getContext(contextName, this.contextOptions);
        }else{
          gl = canvas.getContext(contextName);
        };
      } catch (e) {
        gl = null;
      }

      if(!gl || typeof gl.getParameter !== "function") {
        gl = null;
      }    

      ++nameIndex;
    };

    this.contextGL = gl;
  };

/**
 * Initialize GL shader program
 */
YUVCanvas.prototype.initProgram = function() {
    var gl = this.contextGL;

  // vertex shader is the same for all types
  var vertexShaderScript;
  var fragmentShaderScript;
  
  if (this.type === "yuv420"){

    vertexShaderScript = [
      'attribute vec4 vertexPos;',
      'attribute vec4 texturePos;',
      'attribute vec4 uTexturePos;',
      'attribute vec4 vTexturePos;',
      'varying vec2 textureCoord;',
      'varying vec2 uTextureCoord;',
      'varying vec2 vTextureCoord;',

      'void main()',
      '{',
      '  gl_Position = vertexPos;',
      '  textureCoord = texturePos.xy;',
      '  uTextureCoord = uTexturePos.xy;',
      '  vTextureCoord = vTexturePos.xy;',
      '}'
    ].join('\n');
    
    fragmentShaderScript = [
      'precision highp float;',
      'varying highp vec2 textureCoord;',
      'varying highp vec2 uTextureCoord;',
      'varying highp vec2 vTextureCoord;',
      'uniform sampler2D ySampler;',
      'uniform sampler2D uSampler;',
      'uniform sampler2D vSampler;',
      'uniform mat4 YUV2RGB;',

      'void main(void) {',
      '  highp float y = texture2D(ySampler,  textureCoord).r;',
      '  highp float u = texture2D(uSampler,  uTextureCoord).r;',
      '  highp float v = texture2D(vSampler,  vTextureCoord).r;',
      '  gl_FragColor = vec4(y, u, v, 1) * YUV2RGB;',
      '}'
    ].join('\n');
    
  }else if (this.type === "yuv422"){
    vertexShaderScript = [
      'attribute vec4 vertexPos;',
      'attribute vec4 texturePos;',
      'varying vec2 textureCoord;',

      'void main()',
      '{',
      '  gl_Position = vertexPos;',
      '  textureCoord = texturePos.xy;',
      '}'
    ].join('\n');
    
    fragmentShaderScript = [
      'precision highp float;',
      'varying highp vec2 textureCoord;',
      'uniform sampler2D sampler;',
      'uniform highp vec2 resolution;',
      'uniform mat4 YUV2RGB;',

      'void main(void) {',
      
      '  highp float texPixX = 1.0 / resolution.x;',
      '  highp float logPixX = 2.0 / resolution.x;', // half the resolution of the texture
      '  highp float logHalfPixX = 4.0 / resolution.x;', // half of the logical resolution so every 4th pixel
      '  highp float steps = floor(textureCoord.x / logPixX);',
      '  highp float uvSteps = floor(textureCoord.x / logHalfPixX);',
      '  highp float y = texture2D(sampler, vec2((logPixX * steps) + texPixX, textureCoord.y)).r;',
      '  highp float u = texture2D(sampler, vec2((logHalfPixX * uvSteps), textureCoord.y)).r;',
      '  highp float v = texture2D(sampler, vec2((logHalfPixX * uvSteps) + texPixX + texPixX, textureCoord.y)).r;',
      
      //'  highp float y = texture2D(sampler,  textureCoord).r;',
      //'  gl_FragColor = vec4(y, u, v, 1) * YUV2RGB;',
      '  gl_FragColor = vec4(y, u, v, 1.0) * YUV2RGB;',
      '}'
    ].join('\n');
  };

  var YUV2RGB = [];

  if (this.conversionType == "rec709") {
      // ITU-T Rec. 709
      YUV2RGB = [
          1.16438,  0.00000,  1.79274, -0.97295,
          1.16438, -0.21325, -0.53291,  0.30148,
          1.16438,  2.11240,  0.00000, -1.13340,
          0, 0, 0, 1,
      ];
  } else {
      // assume ITU-T Rec. 601
      YUV2RGB = [
          1.16438,  0.00000,  1.59603, -0.87079,
          1.16438, -0.39176, -0.81297,  0.52959,
          1.16438,  2.01723,  0.00000, -1.08139,
          0, 0, 0, 1
      ];
  };

  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderScript);
  gl.compileShader(vertexShader);
  if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.log('Vertex shader failed to compile: ' + gl.getShaderInfoLog(vertexShader));
  }

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderScript);
  gl.compileShader(fragmentShader);
  if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.log('Fragment shader failed to compile: ' + gl.getShaderInfoLog(fragmentShader));
  }

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log('Program failed to compile: ' + gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  var YUV2RGBRef = gl.getUniformLocation(program, 'YUV2RGB');
  gl.uniformMatrix4fv(YUV2RGBRef, false, YUV2RGB);

  this.shaderProgram = program;
};

/**
 * Initialize vertex buffers and attach to shader program
 */
YUVCanvas.prototype.initBuffers = function() {
  var gl = this.contextGL;
  var program = this.shaderProgram;

  var vertexPosBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW);

  var vertexPosRef = gl.getAttribLocation(program, 'vertexPos');
  gl.enableVertexAttribArray(vertexPosRef);
  gl.vertexAttribPointer(vertexPosRef, 2, gl.FLOAT, false, 0, 0);
  
  if (this.animationTime){
    
    var animationTime = this.animationTime;
    var timePassed = 0;
    var stepTime = 15;
  
    var aniFun = function(){
      
      timePassed += stepTime;
      var mul = ( 1 * timePassed ) / animationTime;
      
      if (timePassed >= animationTime){
        mul = 1;
      }else{
        setTimeout(aniFun, stepTime);
      };
      
      var neg = -1 * mul;
      var pos = 1 * mul;

      var vertexPosBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([pos, pos, neg, pos, pos, neg, neg, neg]), gl.STATIC_DRAW);

      var vertexPosRef = gl.getAttribLocation(program, 'vertexPos');
      gl.enableVertexAttribArray(vertexPosRef);
      gl.vertexAttribPointer(vertexPosRef, 2, gl.FLOAT, false, 0, 0);
      
      try{
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }catch(e){};

    };
    aniFun();
    
  };

  

  var texturePosBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texturePosBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 0, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);

  var texturePosRef = gl.getAttribLocation(program, 'texturePos');
  gl.enableVertexAttribArray(texturePosRef);
  gl.vertexAttribPointer(texturePosRef, 2, gl.FLOAT, false, 0, 0);

  this.texturePosBuffer = texturePosBuffer;

  if (this.type === "yuv420"){
    var uTexturePosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uTexturePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 0, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);

    var uTexturePosRef = gl.getAttribLocation(program, 'uTexturePos');
    gl.enableVertexAttribArray(uTexturePosRef);
    gl.vertexAttribPointer(uTexturePosRef, 2, gl.FLOAT, false, 0, 0);

    this.uTexturePosBuffer = uTexturePosBuffer;
    
    
    var vTexturePosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vTexturePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 0, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);

    var vTexturePosRef = gl.getAttribLocation(program, 'vTexturePos');
    gl.enableVertexAttribArray(vTexturePosRef);
    gl.vertexAttribPointer(vTexturePosRef, 2, gl.FLOAT, false, 0, 0);

    this.vTexturePosBuffer = vTexturePosBuffer;
  };

};

/**
 * Initialize GL textures and attach to shader program
 */
YUVCanvas.prototype.initTextures = function() {
  var gl = this.contextGL;
  var program = this.shaderProgram;

  if (this.type === "yuv420"){

    var yTextureRef = this.initTexture();
    var ySamplerRef = gl.getUniformLocation(program, 'ySampler');
    gl.uniform1i(ySamplerRef, 0);
    this.yTextureRef = yTextureRef;

    var uTextureRef = this.initTexture();
    var uSamplerRef = gl.getUniformLocation(program, 'uSampler');
    gl.uniform1i(uSamplerRef, 1);
    this.uTextureRef = uTextureRef;

    var vTextureRef = this.initTexture();
    var vSamplerRef = gl.getUniformLocation(program, 'vSampler');
    gl.uniform1i(vSamplerRef, 2);
    this.vTextureRef = vTextureRef;
    
  }else if (this.type === "yuv422"){
    // only one texture for 422
    var textureRef = this.initTexture();
    var samplerRef = gl.getUniformLocation(program, 'sampler');
    gl.uniform1i(samplerRef, 0);
    this.textureRef = textureRef;

  };
};

/**
 * Create and configure a single texture
 */
YUVCanvas.prototype.initTexture = function() {
    var gl = this.contextGL;

    var textureRef = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureRef);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return textureRef;
};

/**
 * Draw picture data to the canvas.
 * If this object is using WebGL, the data must be an I420 formatted ArrayBuffer,
 * Otherwise, data must be an RGBA formatted ArrayBuffer.
 */
YUVCanvas.prototype.drawNextOutputPicture = function(width, height, croppingParams, data) {
    var gl = this.contextGL;

    if(gl) {
        this.drawNextOuptutPictureGL(width, height, croppingParams, data);
    } else {
        this.drawNextOuptutPictureRGBA(width, height, croppingParams, data);
    }
};



/**
 * Draw next output picture using ARGB data on a 2d canvas.
 */
YUVCanvas.prototype.drawNextOuptutPictureRGBA = function(width, height, croppingParams, data) {
    var canvas = this.canvasElement;

    var croppingParams = null;

    var argbData = data;

    var ctx = canvas.getContext('2d');
    var imageData = ctx.getImageData(0, 0, width, height);
    imageData.data.set(argbData);

    if(croppingParams === null) {
        ctx.putImageData(imageData, 0, 0);
    } else {
        ctx.putImageData(imageData, -croppingParams.left, -croppingParams.top, 0, 0, croppingParams.width, croppingParams.height);
    }
};
  
  return YUVCanvas;
  
}));

},{}],12:[function(require,module,exports){
const $ = require('jquery');
const Socket = require('./lib/Socket.js')
const Video = require('./lib/Video.js')
const Controls = require('./lib/Controls.js')
const GUI = require('./lib/GUI.js')
const HUDBlock = require('./lib/HUDBlock.js')
const Dashboard = require('./lib/Dashboard.js')
const LineChart = require('./lib/LineChart.js')

/* Initialize classes */
const socket = new Socket();
const videoSocket = new Socket();
const video = new Video($('#video')[0]);
const controls = new Controls();
const gui = new GUI();
const dashboard = new Dashboard(document.getElementById("dataGraphicsCanvas"))
const hudBlock = new HUDBlock(document.getElementById("HUD"))
const lineChart = new LineChart(document.getElementById("HUD"))

/************************
 * Scaling
 ************************/

const containerEl = document.getElementById('container');
const containerMaxWidth = containerEl.offsetWidth;
const containerMaxHeight = containerEl.offsetHeight;

function resize() {
    const sWidth = window.innerWidth;
    const sHeight = window.innerHeight;
    containerEl.style.zoom = Math.min(sWidth / containerMaxWidth, sHeight / containerMaxHeight);
};

resize();

window.addEventListener("resize", resize);


// Fix canvas width/height.
const allCanvas = document.getElementsByTagName("canvas");
for (let i = 0; i < allCanvas.length; i++) {
    allCanvas[i].height = allCanvas[i].offsetHeight;
    allCanvas[i].width = allCanvas[i].offsetWidth;
}

/************************
  * Controls on press e.t.c
 ************************/
controls.update(); /* Start update loop */
window.c = controls;
controls.onPress("adjustGain", (step) => { socket.send(`adjustGain ${step}`); });
controls.onPress("adjustCamera", (step) => { socket.send(`adjustCamera ${step}`); }, 250);
controls.onPress("centerCamera", () => { socket.send(`centerCamera`); }, 250);
controls.onPress("adjustLight", (step) => { socket.send(`adjustLight ${step}`); }, 250);
controls.onPress("fullscreen", () => { gui.pressButton("gui-controls-button-8"); }, 1000)
controls.onPress("arm", () => { socket.send("arm"); });
controls.onPress("disarm", () => { socket.send("disarm"); }, 1000);
controls.onPress("depthHold", () => { socket.send("depthHoldToggle"); });
controls.onPress("headingHold", () => { socket.send("headingHoldToggle"); });
controls.onPress("gripper", (value) => { console.log(value); socket.send("gripper " + value); });
controls.onPress("forward", (value) => { socket.send("forward " + value); });
controls.onPress("yaw", (value) => { socket.send("yaw " + value); });
controls.onPress("lateral", (value) => { socket.send("lateral " + value); });
controls.onPress("ascend", (value) => { socket.send("ascend " + value); });

/************************
 * Video Socket - Used for camera transmit
 ************************/
videoSocket.connect(`wss://${location.hostname}:8282`);
videoSocket.on("binary", (data) => { video.decodeFrame(data); });
videoSocket.on('open', () => {
    gui.log('Video socket connected');
    videoSocket.send("video");
});
videoSocket.on('log', (data) => { gui.log(data); });
videoSocket.on('error', (err) => { gui.log(err, undefined, undefined, "error"); });
videoSocket.on('close', () => { gui.log('Video socket closed'); });
videoSocket.on('data', (data) => {
    let type, value;
    try {
        data = JSON.parse(data);
        type = data.type;
        value = data.value;
    }
    catch (err) { gui.log(`Unable to parse ${data}`) }

    if (type == 'recordStateChange') {
        gui.buttonState("gui-controls-button-7", value == "recording" || value == "waitingidr");
    }
})

/************************
 * Socket - Used for everything else
 ************************/

socket.connect(`wss://${location.hostname}:8000`);
socket.on("hb", (data) => {
    const [sendtTime, latency] = data.split(" ");
    socket.send("hb " + sendtTime);
    gui.setInfo(12, latency + "ms");
});

/************************
 * GUI Preparations
 ************************/

gui.log("Initializing NodeROV GUI");
gui.overlayText("Connecting to NodeROV...", 2000);

gui.on("log", (data) => {
    //socket.send(`clog ${data}`);
})


gui.accelCanvas = document.getElementById("accelerometerCanvas");
gui.compassCanvas = document.getElementById("compassCanvas");
gui.dataGraphCanvas = document.getElementById("dataGraphicsCanvas");

gui.setButton("gui-controls-button-1", "LIGHT + 5", () => {
    socket.send(`adjustLight 5`);
});
gui.setButton("gui-controls-button-3", "LIGHT - 5", () => {
    socket.send(`adjustLight -5`);
});

gui.setButton("gui-controls-button-5", "Depthchart", () => {
    if (gui.buttonState("gui-controls-button-5")) {
        hudBlock.draw();
        gui.buttonState("gui-controls-button-5", false);
    } else {
        lineChart.draw();
        gui.buttonState("gui-controls-button-5", true);
    }
});

gui.setButton("gui-controls-button-2", "ARM", () => { socket.send("toggleArm"); });
gui.setButton("gui-controls-button-4", "HEADING HOLD", () => { socket.send("headingHoldToggle"); });
gui.setButton("gui-controls-button-6", "DEPTH HOLD", () => { socket.send("depthHoldToggle"); });
gui.setButton("gui-controls-button-7", "RECORD", () => { videoSocket.send("recordToggle"); });

gui.setButton("gui-controls-button-8", "FULLSCREEN", () => {
    const videoEl = document.getElementById("video");
    videoEl.classList.toggle("fullscreen");
    gui.buttonState("gui-controls-button-8", videoEl.classList.contains("fullscreen"));
    videoEl.onclick = () => { gui.pressButton("gui-controls-button-8"); };
});
gui.setButton("gui-controls-button-9", "RESET MAH", () => { socket.send("resetMahCounter"); });
gui.setButton("gui-controls-button-10", "CALIBRATE", () => { socket.send("calibrateAccelGyroBias"); });

gui.setButton("gui-controls-button-11", "PID Tuning", () => {
    $("#pidTuning").toggle();
});


gui.setButton("gui-log-button-1", "ADD EVENT", () => {
    var msg = "<p>Enter message: <input id='eventmsg' type='text' value='' /></p>";
    popup("Add event", msg, "Add", "Cancel", function () {
        gui.log("Custom event: " + $("#eventmsg").val());
        popup_hide();
    });
    $("#eventmsg").focus();
});

gui.setButton("gui-log-button-2", "SCREENSHOT", (e) => {
    var data = video.player.canvas.toDataURL("image/jpeg", 1);
    var filename = "noderov_" + (Date.now() / 1000) + ".jpg";
    gui.log("Screenshot saved (" + filename + ")");
    $("<a download='" + filename + "' href='" + data + "'></a>")[0].click();
});

gui.setInfo(1, 0, "Int. temp:");
gui.setInfo(2, 0, "Int. pressure:");
gui.setInfo(3, 0, "Int. humidity:");
gui.setInfo(4, 0, "Leak:");
gui.setInfo(5, 0, "CPU temp:");
gui.setInfo(6, 0, "CPU usage:");
gui.setInfo(7, 0, "Memory:");
gui.setInfo(8, 0, "Disk:");
gui.setInfo(9, 0, "Gain");
gui.setInfo(10, 0, "Camera");
gui.setInfo(11, 0, "Light");
gui.setInfo(12, 0, "Latency:");

$("#pidTuning .close").on('click', () => {
    gui.pressButton("gui-controls-button-11");
});
$("#pidTuning .save").on('click', () => {
    const newPid = {
        depthPid: {
            p: $("input[name=depthP").val(),
            i: $("input[name=depthI").val(),
            d: $("input[name=depthD").val()
        },
        headingPid: {
            p: $("input[name=headingP").val(),
            i: $("input[name=headingI").val(),
            d: $("input[name=headingD").val()
        }
    }
    socket.send(`newPid ${JSON.stringify(newPid)}`);
})

gui.canvas = $("#dataGraphicsCanvas")[0];

socket.on("data", (data) => {
    let type, value;
    try {
        data = JSON.parse(data);
        type = data.type;
        value = data.value;
    }
    catch (err) {
        console.log(`Unable to parse ${data}`)
    }
    switch (type) {

        case "iTemperature":
            gui.setInfo(1, value + "°C");
            break;

        case "iPressure":
            gui.setInfo(2, Math.round(value * 0.145038) / 10 + " PSI");

            break;

        case "iHumidity":
            gui.setInfo(3, value + "%");
            break;

        case "eTemperature":
            dashboard.setScale(2, "TEMPERATURE", value, 30, 0);
            dashboard.draw();
            break;

        case "ePressure":
            dashboard.setScale(0, "PRESSURE", value, 1300, 30);
            dashboard.draw();
            break;

        case "depth":
            dashboard.setScale(1, "DEPTH", value, 100, 30);
            dashboard.draw();
            lineChart.addDataPoint(value);
            if (gui.buttonState("gui-controls-button-5")) lineChart.draw();
            break;

        case "leak":
            gui.setInfo(4, value);
            break;

        case "voltage":
            dashboard.setScale(3, "VOLTAGE", value, 16.8, -6.8);
            dashboard.draw();
            break;

        case "current":
            dashboard.setScale(4, "CURRENT", value, 90, 10);
            dashboard.draw();
            break;

        case "accumulatedMah":
            dashboard.setScale(5, "MAH USED", value, 5500, 1000);
            dashboard.draw();
            break;

        case "roll":
            if (!gui.buttonState("gui-controls-button-5")) hudBlock.draw(undefined, value, undefined);
            break;

        case "pitch":
            if (!gui.buttonState("gui-controls-button-5")) hudBlock.draw(value, undefined, undefined)
            break;

        case "heading":
            if (!gui.buttonState("gui-controls-button-5")) hudBlock.draw(undefined, undefined, value)
            break;

        case 'cpuTemperature':
            gui.setInfo(5, Math.round(value * 10) / 10 + "°C");
            break;

        case 'cpuLoad':
            gui.setInfo(6, Math.round(value * 10) / 10 + "%");
            break;

        case 'memoryUsed':
            gui.setInfo(7, Math.round(value * 10) / 10 + "%");
            break;

        case 'diskUsed':
            gui.setInfo(8, Math.round(value * 10) / 10 + "%");
            break;

        case 'gain':
            gui.setInfo(9, value);
            break;

        case 'camera':
            gui.setInfo(10, value);
            break;

        case 'light':
            gui.setInfo(11, value);
            break;

        case 'headingHold':
            gui.buttonState("gui-controls-button-4", value.setPoint !== false);
            $("input[name=headingP").val(value.p);
            $("input[name=headingI").val(value.i);
            $("input[name=headingD").val(value.d);
            break;

        case 'depthHold':
            gui.buttonState("gui-controls-button-6", value.setPoint !== false);
            $("input[name=depthP").val(value.p);
            $("input[name=depthI").val(value.i);
            $("input[name=depthD").val(value.d);
            break;

        case 'armed':
            gui.buttonState("gui-controls-button-2", value);
            break;

        case 'turns':
            hudBlock.draw(undefined, undefined, undefined, value);
            break;

        default:
            gui.log(`Unknown enviroment type received: ${type} (${value})`, undefined, undefined, "warn");
            return;
    }
});

socket.on("log", function (data) {
    try {
        data = JSON.parse(data);
        gui.log(data.message, data.time, true, data.level);
    } catch (e) { }
})

socket.on("ts", (data) => {
    try {
        data = JSON.parse(data);
        console.log(data);
        data.forEach(thruster => {
            dashboard.setThruster(thruster.pin, thruster.percentage);
        });

    } catch (e) { }
});
},{"./lib/Controls.js":1,"./lib/Dashboard.js":2,"./lib/GUI.js":4,"./lib/HUDBlock.js":5,"./lib/LineChart.js":6,"./lib/Socket.js":7,"./lib/Video.js":8,"jquery":13}],13:[function(require,module,exports){
/*!
 * jQuery JavaScript Library v3.7.0
 * https://jquery.com/
 *
 * Copyright OpenJS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2023-05-11T18:29Z
 */
( function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket trac-14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
// throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
// arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
// enough that all such attempts are guarded in a try block.
"use strict";

var arr = [];

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var flat = arr.flat ? function( array ) {
	return arr.flat.call( array );
} : function( array ) {
	return arr.concat.apply( [], array );
};


var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};

var isFunction = function isFunction( obj ) {

		// Support: Chrome <=57, Firefox <=52
		// In some browsers, typeof returns "function" for HTML <object> elements
		// (i.e., `typeof document.createElement( "object" ) === "function"`).
		// We don't want to classify *any* DOM node as a function.
		// Support: QtWeb <=3.8.5, WebKit <=534.34, wkhtmltopdf tool <=0.12.5
		// Plus for old WebKit, typeof returns "function" for HTML collections
		// (e.g., `typeof document.getElementsByTagName("div") === "function"`). (gh-4756)
		return typeof obj === "function" && typeof obj.nodeType !== "number" &&
			typeof obj.item !== "function";
	};


var isWindow = function isWindow( obj ) {
		return obj != null && obj === obj.window;
	};


var document = window.document;



	var preservedScriptAttributes = {
		type: true,
		src: true,
		nonce: true,
		noModule: true
	};

	function DOMEval( code, node, doc ) {
		doc = doc || document;

		var i, val,
			script = doc.createElement( "script" );

		script.text = code;
		if ( node ) {
			for ( i in preservedScriptAttributes ) {

				// Support: Firefox 64+, Edge 18+
				// Some browsers don't support the "nonce" property on scripts.
				// On the other hand, just using `getAttribute` is not enough as
				// the `nonce` attribute is reset to an empty string whenever it
				// becomes browsing-context connected.
				// See https://github.com/whatwg/html/issues/2369
				// See https://html.spec.whatwg.org/#nonce-attributes
				// The `node.getAttribute` check was added for the sake of
				// `jQuery.globalEval` so that it can fake a nonce-containing node
				// via an object.
				val = node[ i ] || node.getAttribute && node.getAttribute( i );
				if ( val ) {
					script.setAttribute( i, val );
				}
			}
		}
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}


function toType( obj ) {
	if ( obj == null ) {
		return obj + "";
	}

	// Support: Android <=2.3 only (functionish RegExp)
	return typeof obj === "object" || typeof obj === "function" ?
		class2type[ toString.call( obj ) ] || "object" :
		typeof obj;
}
/* global Symbol */
// Defining this global in .eslintrc.json would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var version = "3.7.0",

	rhtmlSuffix = /HTML$/i,

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	};

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {

		// Return all the elements in a clean array
		if ( num == null ) {
			return slice.call( this );
		}

		// Return just the one element from the set
		return num < 0 ? this[ num + this.length ] : this[ num ];
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	even: function() {
		return this.pushStack( jQuery.grep( this, function( _elem, i ) {
			return ( i + 1 ) % 2;
		} ) );
	},

	odd: function() {
		return this.pushStack( jQuery.grep( this, function( _elem, i ) {
			return i % 2;
		} ) );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				copy = options[ name ];

				// Prevent Object.prototype pollution
				// Prevent never-ending loop
				if ( name === "__proto__" || target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = Array.isArray( copy ) ) ) ) {
					src = target[ name ];

					// Ensure proper type for the source value
					if ( copyIsArray && !Array.isArray( src ) ) {
						clone = [];
					} else if ( !copyIsArray && !jQuery.isPlainObject( src ) ) {
						clone = {};
					} else {
						clone = src;
					}
					copyIsArray = false;

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	// Evaluates a script in a provided context; falls back to the global one
	// if not specified.
	globalEval: function( code, options, doc ) {
		DOMEval( code, { nonce: options && options.nonce }, doc );
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},


	// Retrieve the text value of an array of DOM nodes
	text: function( elem ) {
		var node,
			ret = "",
			i = 0,
			nodeType = elem.nodeType;

		if ( !nodeType ) {

			// If no nodeType, this is expected to be an array
			while ( ( node = elem[ i++ ] ) ) {

				// Do not traverse comment nodes
				ret += jQuery.text( node );
			}
		} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
			return elem.textContent;
		} else if ( nodeType === 3 || nodeType === 4 ) {
			return elem.nodeValue;
		}

		// Do not include comment or processing instruction nodes

		return ret;
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
						[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	isXMLDoc: function( elem ) {
		var namespace = elem && elem.namespaceURI,
			docElem = elem && ( elem.ownerDocument || elem ).documentElement;

		// Assume HTML when documentElement doesn't yet exist, such as inside
		// document fragments.
		return !rhtmlSuffix.test( namespace || docElem && docElem.nodeName || "HTML" );
	},

	// Support: Android <=4.0 only, PhantomJS 1 only
	// push.apply(_, arraylike) throws on ancient WebKit
	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var length, value,
			i = 0,
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArrayLike( elems ) ) {
			length = elems.length;
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return flat( ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
} );

if ( typeof Symbol === "function" ) {
	jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
}

// Populate the class2type map
jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
	function( _i, name ) {
		class2type[ "[object " + name + "]" ] = name.toLowerCase();
	} );

function isArrayLike( obj ) {

	// Support: real iOS 8.2 only (not reproducible in simulator)
	// `in` check used to prevent JIT error (gh-2145)
	// hasOwn isn't used here due to false negatives
	// regarding Nodelist length in IE
	var length = !!obj && "length" in obj && obj.length,
		type = toType( obj );

	if ( isFunction( obj ) || isWindow( obj ) ) {
		return false;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}


function nodeName( elem, name ) {

	return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

}
var pop = arr.pop;


var sort = arr.sort;


var splice = arr.splice;


var whitespace = "[\\x20\\t\\r\\n\\f]";


var rtrimCSS = new RegExp(
	"^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$",
	"g"
);




// Note: an element does not contain itself
jQuery.contains = function( a, b ) {
	var bup = b && b.parentNode;

	return a === bup || !!( bup && bup.nodeType === 1 && (

		// Support: IE 9 - 11+
		// IE doesn't have `contains` on SVG.
		a.contains ?
			a.contains( bup ) :
			a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
	) );
};




// CSS string/identifier serialization
// https://drafts.csswg.org/cssom/#common-serializing-idioms
var rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g;

function fcssescape( ch, asCodePoint ) {
	if ( asCodePoint ) {

		// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
		if ( ch === "\0" ) {
			return "\uFFFD";
		}

		// Control characters and (dependent upon position) numbers get escaped as code points
		return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
	}

	// Other potentially-special ASCII characters get backslash-escaped
	return "\\" + ch;
}

jQuery.escapeSelector = function( sel ) {
	return ( sel + "" ).replace( rcssescape, fcssescape );
};




var preferredDoc = document,
	pushNative = push;

( function() {

var i,
	Expr,
	outermostContext,
	sortInput,
	hasDuplicate,
	push = pushNative,

	// Local document vars
	document,
	documentElement,
	documentIsHTML,
	rbuggyQSA,
	matches,

	// Instance-specific data
	expando = jQuery.expando,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	nonnativeSelectorCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|" +
		"loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// https://www.w3.org/TR/css-syntax-3/#ident-token-diagram
	identifier = "(?:\\\\[\\da-fA-F]{1,6}" + whitespace +
		"?|\\\\[^\\r\\n\\f]|[\\w-]|[^\0-\\x7f])+",

	// Attribute selectors: https://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +

		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +

		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" +
		whitespace + "*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +

		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +

		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +

		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rleadingCombinator = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" +
		whitespace + "*" ),
	rdescend = new RegExp( whitespace + "|>" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		ID: new RegExp( "^#(" + identifier + ")" ),
		CLASS: new RegExp( "^\\.(" + identifier + ")" ),
		TAG: new RegExp( "^(" + identifier + "|[*])" ),
		ATTR: new RegExp( "^" + attributes ),
		PSEUDO: new RegExp( "^" + pseudos ),
		CHILD: new RegExp(
			"^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" +
				whitespace + "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" +
				whitespace + "*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		bool: new RegExp( "^(?:" + booleans + ")$", "i" ),

		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		needsContext: new RegExp( "^" + whitespace +
			"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace +
			"*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,

	// CSS escapes
	// https://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\[\\da-fA-F]{1,6}" + whitespace +
		"?|\\\\([^\\r\\n\\f])", "g" ),
	funescape = function( escape, nonHex ) {
		var high = "0x" + escape.slice( 1 ) - 0x10000;

		if ( nonHex ) {

			// Strip the backslash prefix from a non-hex escape sequence
			return nonHex;
		}

		// Replace a hexadecimal escape sequence with the encoded Unicode code point
		// Support: IE <=11+
		// For values outside the Basic Multilingual Plane (BMP), manually construct a
		// surrogate pair
		return high < 0 ?
			String.fromCharCode( high + 0x10000 ) :
			String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// Used for iframes; see `setDocument`.
	// Support: IE 9 - 11+, Edge 12 - 18+
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE/Edge.
	unloadHandler = function() {
		setDocument();
	},

	inDisabledFieldset = addCombinator(
		function( elem ) {
			return elem.disabled === true && nodeName( elem, "fieldset" );
		},
		{ dir: "parentNode", next: "legend" }
	);

// Support: IE <=9 only
// Accessing document.activeElement can throw unexpectedly
// https://bugs.jquery.com/ticket/13393
function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		( arr = slice.call( preferredDoc.childNodes ) ),
		preferredDoc.childNodes
	);

	// Support: Android <=4.0
	// Detect silently failing push.apply
	// eslint-disable-next-line no-unused-expressions
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = {
		apply: function( target, els ) {
			pushNative.apply( target, slice.call( els ) );
		},
		call: function( target ) {
			pushNative.apply( target, slice.call( arguments, 1 ) );
		}
	};
}

function find( selector, context, results, seed ) {
	var m, i, elem, nid, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {
		setDocument( context );
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && ( match = rquickExpr.exec( selector ) ) ) {

				// ID selector
				if ( ( m = match[ 1 ] ) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( ( elem = context.getElementById( m ) ) ) {

							// Support: IE 9 only
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								push.call( results, elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE 9 only
						// getElementById can match elements by name instead of ID
						if ( newContext && ( elem = newContext.getElementById( m ) ) &&
							find.contains( context, elem ) &&
							elem.id === m ) {

							push.call( results, elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[ 2 ] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( ( m = match[ 3 ] ) && context.getElementsByClassName ) {
					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( !nonnativeSelectorCache[ selector + " " ] &&
				( !rbuggyQSA || !rbuggyQSA.test( selector ) ) ) {

				newSelector = selector;
				newContext = context;

				// qSA considers elements outside a scoping root when evaluating child or
				// descendant combinators, which is not what we want.
				// In such cases, we work around the behavior by prefixing every selector in the
				// list with an ID selector referencing the scope context.
				// The technique has to be used as well when a leading combinator is used
				// as such selectors are not recognized by querySelectorAll.
				// Thanks to Andrew Dupont for this technique.
				if ( nodeType === 1 &&
					( rdescend.test( selector ) || rleadingCombinator.test( selector ) ) ) {

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;

					// We can use :scope instead of the ID hack if the browser
					// supports it & if we're not changing the context.
					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when
					// strict-comparing two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					if ( newContext != context || !support.scope ) {

						// Capture the context ID, setting it first if necessary
						if ( ( nid = context.getAttribute( "id" ) ) ) {
							nid = jQuery.escapeSelector( nid );
						} else {
							context.setAttribute( "id", ( nid = expando ) );
						}
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					while ( i-- ) {
						groups[ i ] = ( nid ? "#" + nid : ":scope" ) + " " +
							toSelector( groups[ i ] );
					}
					newSelector = groups.join( "," );
				}

				try {
					push.apply( results,
						newContext.querySelectorAll( newSelector )
					);
					return results;
				} catch ( qsaError ) {
					nonnativeSelectorCache( selector, true );
				} finally {
					if ( nid === expando ) {
						context.removeAttribute( "id" );
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrimCSS, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {

		// Use (key + " ") to avoid collision with native prototype properties
		// (see https://github.com/jquery/sizzle/issues/157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {

			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return ( cache[ key + " " ] = value );
	}
	return cache;
}

/**
 * Mark a function for special use by jQuery selector module
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created element and returns a boolean result
 */
function assert( fn ) {
	var el = document.createElement( "fieldset" );

	try {
		return !!fn( el );
	} catch ( e ) {
		return false;
	} finally {

		// Remove from its parent by default
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}

		// release memory in IE
		el = null;
	}
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		return nodeName( elem, "input" ) && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		return ( nodeName( elem, "input" ) || nodeName( elem, "button" ) ) &&
			elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for :enabled/:disabled
 * @param {Boolean} disabled true for :disabled; false for :enabled
 */
function createDisabledPseudo( disabled ) {

	// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
	return function( elem ) {

		// Only certain elements can match :enabled or :disabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
		if ( "form" in elem ) {

			// Check for inherited disabledness on relevant non-disabled elements:
			// * listed form-associated elements in a disabled fieldset
			//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
			// * option elements in a disabled optgroup
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
			// All such elements have a "form" property.
			if ( elem.parentNode && elem.disabled === false ) {

				// Option elements defer to a parent optgroup if present
				if ( "label" in elem ) {
					if ( "label" in elem.parentNode ) {
						return elem.parentNode.disabled === disabled;
					} else {
						return elem.disabled === disabled;
					}
				}

				// Support: IE 6 - 11+
				// Use the isDisabled shortcut property to check for disabled fieldset ancestors
				return elem.isDisabled === disabled ||

					// Where there is no isDisabled, check manually
					elem.isDisabled !== !disabled &&
						inDisabledFieldset( elem ) === disabled;
			}

			return elem.disabled === disabled;

		// Try to winnow out elements that can't be disabled before trusting the disabled property.
		// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
		// even exist on them, let alone have a boolean value.
		} else if ( "label" in elem ) {
			return elem.disabled === disabled;
		}

		// Remaining elements are neither :enabled nor :disabled
		return false;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction( function( argument ) {
		argument = +argument;
		return markFunction( function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ ( j = matchIndexes[ i ] ) ] ) {
					seed[ j ] = !( matches[ j ] = seed[ j ] );
				}
			}
		} );
	} );
}

/**
 * Checks a node for validity as a jQuery selector context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [node] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
function setDocument( node ) {
	var subWindow,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	// Support: IE 11+, Edge 17 - 18+
	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
	// two documents; shallow comparisons work.
	// eslint-disable-next-line eqeqeq
	if ( doc == document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	documentElement = document.documentElement;
	documentIsHTML = !jQuery.isXMLDoc( document );

	// Support: iOS 7 only, IE 9 - 11+
	// Older browsers didn't support unprefixed `matches`.
	matches = documentElement.matches ||
		documentElement.webkitMatchesSelector ||
		documentElement.msMatchesSelector;

	// Support: IE 9 - 11+, Edge 12 - 18+
	// Accessing iframe documents after unload throws "permission denied" errors (see trac-13936)
	// Support: IE 11+, Edge 17 - 18+
	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
	// two documents; shallow comparisons work.
	// eslint-disable-next-line eqeqeq
	if ( preferredDoc != document &&
		( subWindow = document.defaultView ) && subWindow.top !== subWindow ) {

		// Support: IE 9 - 11+, Edge 12 - 18+
		subWindow.addEventListener( "unload", unloadHandler );
	}

	// Support: IE <10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programmatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert( function( el ) {
		documentElement.appendChild( el ).id = jQuery.expando;
		return !document.getElementsByName ||
			!document.getElementsByName( jQuery.expando ).length;
	} );

	// Support: IE 9 only
	// Check to see if it's possible to do matchesSelector
	// on a disconnected node.
	support.disconnectedMatch = assert( function( el ) {
		return matches.call( el, "*" );
	} );

	// Support: IE 9 - 11+, Edge 12 - 18+
	// IE/Edge don't support the :scope pseudo-class.
	support.scope = assert( function() {
		return document.querySelectorAll( ":scope" );
	} );

	// Support: Chrome 105 - 111 only, Safari 15.4 - 16.3 only
	// Make sure the `:has()` argument is parsed unforgivingly.
	// We include `*` in the test to detect buggy implementations that are
	// _selectively_ forgiving (specifically when the list includes at least
	// one valid selector).
	// Note that we treat complete lack of support for `:has()` as if it were
	// spec-compliant support, which is fine because use of `:has()` in such
	// environments will fail in the qSA path and fall back to jQuery traversal
	// anyway.
	support.cssHas = assert( function() {
		try {
			document.querySelector( ":has(*,:jqfake)" );
			return false;
		} catch ( e ) {
			return true;
		}
	} );

	// ID filter and find
	if ( support.getById ) {
		Expr.filter.ID = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute( "id" ) === attrId;
			};
		};
		Expr.find.ID = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var elem = context.getElementById( id );
				return elem ? [ elem ] : [];
			}
		};
	} else {
		Expr.filter.ID =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode( "id" );
				return node && node.value === attrId;
			};
		};

		// Support: IE 6 - 7 only
		// getElementById is not reliable as a find shortcut
		Expr.find.ID = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var node, i, elems,
					elem = context.getElementById( id );

				if ( elem ) {

					// Verify the id attribute
					node = elem.getAttributeNode( "id" );
					if ( node && node.value === id ) {
						return [ elem ];
					}

					// Fall back on getElementsByName
					elems = context.getElementsByName( id );
					i = 0;
					while ( ( elem = elems[ i++ ] ) ) {
						node = elem.getAttributeNode( "id" );
						if ( node && node.value === id ) {
							return [ elem ];
						}
					}
				}

				return [];
			}
		};
	}

	// Tag
	Expr.find.TAG = function( tag, context ) {
		if ( typeof context.getElementsByTagName !== "undefined" ) {
			return context.getElementsByTagName( tag );

		// DocumentFragment nodes don't have gEBTN
		} else {
			return context.querySelectorAll( tag );
		}
	};

	// Class
	Expr.find.CLASS = function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	rbuggyQSA = [];

	// Build QSA regex
	// Regex strategy adopted from Diego Perini
	assert( function( el ) {

		var input;

		documentElement.appendChild( el ).innerHTML =
			"<a id='" + expando + "' href='' disabled='disabled'></a>" +
			"<select id='" + expando + "-\r\\' disabled='disabled'>" +
			"<option selected=''></option></select>";

		// Support: iOS <=7 - 8 only
		// Boolean attributes and "value" are not treated correctly in some XML documents
		if ( !el.querySelectorAll( "[selected]" ).length ) {
			rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
		}

		// Support: iOS <=7 - 8 only
		if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
			rbuggyQSA.push( "~=" );
		}

		// Support: iOS 8 only
		// https://bugs.webkit.org/show_bug.cgi?id=136851
		// In-page `selector#id sibling-combinator selector` fails
		if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
			rbuggyQSA.push( ".#.+[+~]" );
		}

		// Support: Chrome <=105+, Firefox <=104+, Safari <=15.4+
		// In some of the document kinds, these selectors wouldn't work natively.
		// This is probably OK but for backwards compatibility we want to maintain
		// handling them through jQuery traversal in jQuery 3.x.
		if ( !el.querySelectorAll( ":checked" ).length ) {
			rbuggyQSA.push( ":checked" );
		}

		// Support: Windows 8 Native Apps
		// The type and name attributes are restricted during .innerHTML assignment
		input = document.createElement( "input" );
		input.setAttribute( "type", "hidden" );
		el.appendChild( input ).setAttribute( "name", "D" );

		// Support: IE 9 - 11+
		// IE's :disabled selector does not pick up the children of disabled fieldsets
		// Support: Chrome <=105+, Firefox <=104+, Safari <=15.4+
		// In some of the document kinds, these selectors wouldn't work natively.
		// This is probably OK but for backwards compatibility we want to maintain
		// handling them through jQuery traversal in jQuery 3.x.
		documentElement.appendChild( el ).disabled = true;
		if ( el.querySelectorAll( ":disabled" ).length !== 2 ) {
			rbuggyQSA.push( ":enabled", ":disabled" );
		}

		// Support: IE 11+, Edge 15 - 18+
		// IE 11/Edge don't find elements on a `[name='']` query in some cases.
		// Adding a temporary attribute to the document before the selection works
		// around the issue.
		// Interestingly, IE 10 & older don't seem to have the issue.
		input = document.createElement( "input" );
		input.setAttribute( "name", "" );
		el.appendChild( input );
		if ( !el.querySelectorAll( "[name='']" ).length ) {
			rbuggyQSA.push( "\\[" + whitespace + "*name" + whitespace + "*=" +
				whitespace + "*(?:''|\"\")" );
		}
	} );

	if ( !support.cssHas ) {

		// Support: Chrome 105 - 110+, Safari 15.4 - 16.3+
		// Our regular `try-catch` mechanism fails to detect natively-unsupported
		// pseudo-classes inside `:has()` (such as `:has(:contains("Foo"))`)
		// in browsers that parse the `:has()` argument as a forgiving selector list.
		// https://drafts.csswg.org/selectors/#relational now requires the argument
		// to be parsed unforgivingly, but browsers have not yet fully adjusted.
		rbuggyQSA.push( ":has" );
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join( "|" ) );

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		// Support: IE 11+, Edge 17 - 18+
		// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
		// two documents; shallow comparisons work.
		// eslint-disable-next-line eqeqeq
		compare = ( a.ownerDocument || a ) == ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			( !support.sortDetached && b.compareDocumentPosition( a ) === compare ) ) {

			// Choose the first element that is related to our preferred document
			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( a === document || a.ownerDocument == preferredDoc &&
				find.contains( preferredDoc, a ) ) {
				return -1;
			}

			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( b === document || b.ownerDocument == preferredDoc &&
				find.contains( preferredDoc, b ) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf.call( sortInput, a ) - indexOf.call( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	};

	return document;
}

find.matches = function( expr, elements ) {
	return find( expr, null, null, elements );
};

find.matchesSelector = function( elem, expr ) {
	setDocument( elem );

	if ( documentIsHTML &&
		!nonnativeSelectorCache[ expr + " " ] &&
		( !rbuggyQSA || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||

					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch ( e ) {
			nonnativeSelectorCache( expr, true );
		}
	}

	return find( expr, document, null, [ elem ] ).length > 0;
};

find.contains = function( context, elem ) {

	// Set document vars if needed
	// Support: IE 11+, Edge 17 - 18+
	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
	// two documents; shallow comparisons work.
	// eslint-disable-next-line eqeqeq
	if ( ( context.ownerDocument || context ) != document ) {
		setDocument( context );
	}
	return jQuery.contains( context, elem );
};


find.attr = function( elem, name ) {

	// Set document vars if needed
	// Support: IE 11+, Edge 17 - 18+
	// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
	// two documents; shallow comparisons work.
	// eslint-disable-next-line eqeqeq
	if ( ( elem.ownerDocument || elem ) != document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],

		// Don't get fooled by Object.prototype properties (see trac-13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	if ( val !== undefined ) {
		return val;
	}

	return elem.getAttribute( name );
};

find.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
jQuery.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	//
	// Support: Android <=4.0+
	// Testing for detecting duplicates is unpredictable so instead assume we can't
	// depend on duplicate detection in all browsers without a stable sort.
	hasDuplicate = !support.sortStable;
	sortInput = !support.sortStable && slice.call( results, 0 );
	sort.call( results, sortOrder );

	if ( hasDuplicate ) {
		while ( ( elem = results[ i++ ] ) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			splice.call( results, duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

jQuery.fn.uniqueSort = function() {
	return this.pushStack( jQuery.uniqueSort( slice.apply( this ) ) );
};

Expr = jQuery.expr = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		ATTR: function( match ) {
			match[ 1 ] = match[ 1 ].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[ 3 ] = ( match[ 3 ] || match[ 4 ] || match[ 5 ] || "" )
				.replace( runescape, funescape );

			if ( match[ 2 ] === "~=" ) {
				match[ 3 ] = " " + match[ 3 ] + " ";
			}

			return match.slice( 0, 4 );
		},

		CHILD: function( match ) {

			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[ 1 ] = match[ 1 ].toLowerCase();

			if ( match[ 1 ].slice( 0, 3 ) === "nth" ) {

				// nth-* requires argument
				if ( !match[ 3 ] ) {
					find.error( match[ 0 ] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[ 4 ] = +( match[ 4 ] ?
					match[ 5 ] + ( match[ 6 ] || 1 ) :
					2 * ( match[ 3 ] === "even" || match[ 3 ] === "odd" )
				);
				match[ 5 ] = +( ( match[ 7 ] + match[ 8 ] ) || match[ 3 ] === "odd" );

			// other types prohibit arguments
			} else if ( match[ 3 ] ) {
				find.error( match[ 0 ] );
			}

			return match;
		},

		PSEUDO: function( match ) {
			var excess,
				unquoted = !match[ 6 ] && match[ 2 ];

			if ( matchExpr.CHILD.test( match[ 0 ] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[ 3 ] ) {
				match[ 2 ] = match[ 4 ] || match[ 5 ] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&

				// Get excess from tokenize (recursively)
				( excess = tokenize( unquoted, true ) ) &&

				// advance to the next closing parenthesis
				( excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length ) ) {

				// excess is a negative index
				match[ 0 ] = match[ 0 ].slice( 0, excess );
				match[ 2 ] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		TAG: function( nodeNameSelector ) {
			var expectedNodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() {
					return true;
				} :
				function( elem ) {
					return nodeName( elem, expectedNodeName );
				};
		},

		CLASS: function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				( pattern = new RegExp( "(^|" + whitespace + ")" + className +
					"(" + whitespace + "|$)" ) ) &&
				classCache( className, function( elem ) {
					return pattern.test(
						typeof elem.className === "string" && elem.className ||
							typeof elem.getAttribute !== "undefined" &&
								elem.getAttribute( "class" ) ||
							""
					);
				} );
		},

		ATTR: function( name, operator, check ) {
			return function( elem ) {
				var result = find.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				if ( operator === "=" ) {
					return result === check;
				}
				if ( operator === "!=" ) {
					return result !== check;
				}
				if ( operator === "^=" ) {
					return check && result.indexOf( check ) === 0;
				}
				if ( operator === "*=" ) {
					return check && result.indexOf( check ) > -1;
				}
				if ( operator === "$=" ) {
					return check && result.slice( -check.length ) === check;
				}
				if ( operator === "~=" ) {
					return ( " " + result.replace( rwhitespace, " " ) + " " )
						.indexOf( check ) > -1;
				}
				if ( operator === "|=" ) {
					return result === check || result.slice( 0, check.length + 1 ) === check + "-";
				}

				return false;
			};
		},

		CHILD: function( type, what, _argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, _context, xml ) {
					var cache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( ( node = node[ dir ] ) ) {
									if ( ofType ?
										nodeName( node, name ) :
										node.nodeType === 1 ) {

										return false;
									}
								}

								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index
							outerCache = parent[ expando ] || ( parent[ expando ] = {} );
							cache = outerCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( ( node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								( diff = nodeIndex = 0 ) || start.pop() ) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									outerCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {

							// Use previously-cached element index if available
							if ( useCache ) {
								outerCache = elem[ expando ] || ( elem[ expando ] = {} );
								cache = outerCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {

								// Use the same loop as above to seek `elem` from the start
								while ( ( node = ++nodeIndex && node && node[ dir ] ||
									( diff = nodeIndex = 0 ) || start.pop() ) ) {

									if ( ( ofType ?
										nodeName( node, name ) :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] ||
												( node[ expando ] = {} );
											outerCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		PSEUDO: function( pseudo, argument ) {

			// pseudo-class names are case-insensitive
			// https://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					find.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as jQuery does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction( function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf.call( seed, matched[ i ] );
							seed[ idx ] = !( matches[ idx ] = matched[ i ] );
						}
					} ) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {

		// Potentially complex pseudos
		not: markFunction( function( selector ) {

			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrimCSS, "$1" ) );

			return matcher[ expando ] ?
				markFunction( function( seed, matches, _context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( ( elem = unmatched[ i ] ) ) {
							seed[ i ] = !( matches[ i ] = elem );
						}
					}
				} ) :
				function( elem, _context, xml ) {
					input[ 0 ] = elem;
					matcher( input, null, xml, results );

					// Don't keep the element
					// (see https://github.com/jquery/sizzle/issues/299)
					input[ 0 ] = null;
					return !results.pop();
				};
		} ),

		has: markFunction( function( selector ) {
			return function( elem ) {
				return find( selector, elem ).length > 0;
			};
		} ),

		contains: markFunction( function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || jQuery.text( elem ) ).indexOf( text ) > -1;
			};
		} ),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// https://www.w3.org/TR/selectors/#lang-pseudo
		lang: markFunction( function( lang ) {

			// lang value must be a valid identifier
			if ( !ridentifier.test( lang || "" ) ) {
				find.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( ( elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute( "xml:lang" ) || elem.getAttribute( "lang" ) ) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( ( elem = elem.parentNode ) && elem.nodeType === 1 );
				return false;
			};
		} ),

		// Miscellaneous
		target: function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		root: function( elem ) {
			return elem === documentElement;
		},

		focus: function( elem ) {
			return elem === safeActiveElement() &&
				document.hasFocus() &&
				!!( elem.type || elem.href || ~elem.tabIndex );
		},

		// Boolean properties
		enabled: createDisabledPseudo( false ),
		disabled: createDisabledPseudo( true ),

		checked: function( elem ) {

			// In CSS3, :checked should return both checked and selected elements
			// https://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			return ( nodeName( elem, "input" ) && !!elem.checked ) ||
				( nodeName( elem, "option" ) && !!elem.selected );
		},

		selected: function( elem ) {

			// Support: IE <=11+
			// Accessing the selectedIndex property
			// forces the browser to treat the default option as
			// selected when in an optgroup.
			if ( elem.parentNode ) {
				// eslint-disable-next-line no-unused-expressions
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		empty: function( elem ) {

			// https://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		parent: function( elem ) {
			return !Expr.pseudos.empty( elem );
		},

		// Element/input types
		header: function( elem ) {
			return rheader.test( elem.nodeName );
		},

		input: function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		button: function( elem ) {
			return nodeName( elem, "input" ) && elem.type === "button" ||
				nodeName( elem, "button" );
		},

		text: function( elem ) {
			var attr;
			return nodeName( elem, "input" ) && elem.type === "text" &&

				// Support: IE <10 only
				// New HTML5 attribute values (e.g., "search") appear
				// with elem.type === "text"
				( ( attr = elem.getAttribute( "type" ) ) == null ||
					attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		first: createPositionalPseudo( function() {
			return [ 0 ];
		} ),

		last: createPositionalPseudo( function( _matchIndexes, length ) {
			return [ length - 1 ];
		} ),

		eq: createPositionalPseudo( function( _matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		} ),

		even: createPositionalPseudo( function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		} ),

		odd: createPositionalPseudo( function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		} ),

		lt: createPositionalPseudo( function( matchIndexes, length, argument ) {
			var i;

			if ( argument < 0 ) {
				i = argument + length;
			} else if ( argument > length ) {
				i = length;
			} else {
				i = argument;
			}

			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		} ),

		gt: createPositionalPseudo( function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		} )
	}
};

Expr.pseudos.nth = Expr.pseudos.eq;

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

function tokenize( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || ( match = rcomma.exec( soFar ) ) ) {
			if ( match ) {

				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[ 0 ].length ) || soFar;
			}
			groups.push( ( tokens = [] ) );
		}

		matched = false;

		// Combinators
		if ( ( match = rleadingCombinator.exec( soFar ) ) ) {
			matched = match.shift();
			tokens.push( {
				value: matched,

				// Cast descendant combinators to space
				type: match[ 0 ].replace( rtrimCSS, " " )
			} );
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( ( match = matchExpr[ type ].exec( soFar ) ) && ( !preFilters[ type ] ||
				( match = preFilters[ type ]( match ) ) ) ) {
				matched = match.shift();
				tokens.push( {
					value: matched,
					type: type,
					matches: match
				} );
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	if ( parseOnly ) {
		return soFar.length;
	}

	return soFar ?
		find.error( selector ) :

		// Cache the tokens
		tokenCache( selector, groups ).slice( 0 );
}

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[ i ].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		skip = combinator.next,
		key = skip || dir,
		checkNonElements = base && key === "parentNode",
		doneName = done++;

	return combinator.first ?

		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( ( elem = elem[ dir ] ) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
			return false;
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( ( elem = elem[ dir ] ) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( ( elem = elem[ dir ] ) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || ( elem[ expando ] = {} );

						if ( skip && nodeName( elem, skip ) ) {
							elem = elem[ dir ] || elem;
						} else if ( ( oldCache = outerCache[ key ] ) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return ( newCache[ 2 ] = oldCache[ 2 ] );
						} else {

							// Reuse newcache so results back-propagate to previous elements
							outerCache[ key ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( ( newCache[ 2 ] = matcher( elem, context, xml ) ) ) {
								return true;
							}
						}
					}
				}
			}
			return false;
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[ i ]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[ 0 ];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		find( selector, contexts[ i ], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( ( elem = unmatched[ i ] ) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction( function( seed, results, context, xml ) {
		var temp, i, elem, matcherOut,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed ||
				multipleContexts( selector || "*",
					context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems;

		if ( matcher ) {

			// If we have a postFinder, or filtered seed, or non-seed postFilter
			// or preexisting results,
			matcherOut = postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

				// ...intermediate processing is necessary
				[] :

				// ...otherwise use results directly
				results;

			// Find primary matches
			matcher( matcherIn, matcherOut, context, xml );
		} else {
			matcherOut = matcherIn;
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( ( elem = temp[ i ] ) ) {
					matcherOut[ postMap[ i ] ] = !( matcherIn[ postMap[ i ] ] = elem );
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {

					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( ( elem = matcherOut[ i ] ) ) {

							// Restore matcherIn since elem is not yet a final match
							temp.push( ( matcherIn[ i ] = elem ) );
						}
					}
					postFinder( null, ( matcherOut = [] ), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( ( elem = matcherOut[ i ] ) &&
						( temp = postFinder ? indexOf.call( seed, elem ) : preMap[ i ] ) > -1 ) {

						seed[ temp ] = !( results[ temp ] = elem );
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	} );
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[ 0 ].type ],
		implicitRelative = leadingRelative || Expr.relative[ " " ],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf.call( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {

			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			var ret = ( !leadingRelative && ( xml || context != outermostContext ) ) || (
				( checkContext = context ).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );

			// Avoid hanging onto element
			// (see https://github.com/jquery/sizzle/issues/299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( ( matcher = Expr.relative[ tokens[ i ].type ] ) ) {
			matchers = [ addCombinator( elementMatcher( matchers ), matcher ) ];
		} else {
			matcher = Expr.filter[ tokens[ i ].type ].apply( null, tokens[ i ].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {

				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[ j ].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(

						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 )
							.concat( { value: tokens[ i - 2 ].type === " " ? "*" : "" } )
					).replace( rtrimCSS, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( ( tokens = tokens.slice( j ) ) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,

				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find.TAG( "*", outermost ),

				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = ( dirruns += contextBackup == null ? 1 : Math.random() || 0.1 ),
				len = elems.length;

			if ( outermost ) {

				// Support: IE 11+, Edge 17 - 18+
				// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
				// two documents; shallow comparisons work.
				// eslint-disable-next-line eqeqeq
				outermostContext = context == document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: iOS <=7 - 9 only
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching
			// elements by id. (see trac-14142)
			for ( ; i !== len && ( elem = elems[ i ] ) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;

					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
					// two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					if ( !context && elem.ownerDocument != document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( ( matcher = elementMatchers[ j++ ] ) ) {
						if ( matcher( elem, context || document, xml ) ) {
							push.call( results, elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {

					// They will have gone through all possible matchers
					if ( ( elem = !matcher && elem ) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( ( matcher = setMatchers[ j++ ] ) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {

					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !( unmatched[ i ] || setMatched[ i ] ) ) {
								setMatched[ i ] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					jQuery.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

function compile( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {

		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[ i ] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector,
			matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
}

/**
 * A low-level selection function that works with jQuery's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with jQuery selector compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
function select( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( ( selector = compiled.selector || selector ) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[ 0 ] = match[ 0 ].slice( 0 );
		if ( tokens.length > 2 && ( token = tokens[ 0 ] ).type === "ID" &&
				context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[ 1 ].type ] ) {

			context = ( Expr.find.ID(
				token.matches[ 0 ].replace( runescape, funescape ),
				context
			) || [] )[ 0 ];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr.needsContext.test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[ i ];

			// Abort if we hit a combinator
			if ( Expr.relative[ ( type = token.type ) ] ) {
				break;
			}
			if ( ( find = Expr.find[ type ] ) ) {

				// Search, expanding context for leading sibling combinators
				if ( ( seed = find(
					token.matches[ 0 ].replace( runescape, funescape ),
					rsibling.test( tokens[ 0 ].type ) &&
						testContext( context.parentNode ) || context
				) ) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
}

// One-time assignments

// Support: Android <=4.0 - 4.1+
// Sort stability
support.sortStable = expando.split( "" ).sort( sortOrder ).join( "" ) === expando;

// Initialize against the default document
setDocument();

// Support: Android <=4.0 - 4.1+
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert( function( el ) {

	// Should return 1, but returns 4 (following)
	return el.compareDocumentPosition( document.createElement( "fieldset" ) ) & 1;
} );

jQuery.find = find;

// Deprecated
jQuery.expr[ ":" ] = jQuery.expr.pseudos;
jQuery.unique = jQuery.uniqueSort;

// These have always been private, but they used to be documented
// as part of Sizzle so let's maintain them in the 3.x line
// for backwards compatibility purposes.
find.compile = compile;
find.select = select;
find.setDocument = setDocument;

find.escape = jQuery.escapeSelector;
find.getText = jQuery.text;
find.isXML = jQuery.isXMLDoc;
find.selectors = jQuery.expr;
find.support = jQuery.support;
find.uniqueSort = jQuery.uniqueSort;

	/* eslint-enable */

} )();


var dir = function( elem, dir, until ) {
	var matched = [],
		truncate = until !== undefined;

	while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
		if ( elem.nodeType === 1 ) {
			if ( truncate && jQuery( elem ).is( until ) ) {
				break;
			}
			matched.push( elem );
		}
	}
	return matched;
};


var siblings = function( n, elem ) {
	var matched = [];

	for ( ; n; n = n.nextSibling ) {
		if ( n.nodeType === 1 && n !== elem ) {
			matched.push( n );
		}
	}

	return matched;
};


var rneedsContext = jQuery.expr.match.needsContext;

var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			return !!qualifier.call( elem, i, elem ) !== not;
		} );
	}

	// Single element
	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		} );
	}

	// Arraylike of elements (jQuery, arguments, Array)
	if ( typeof qualifier !== "string" ) {
		return jQuery.grep( elements, function( elem ) {
			return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
		} );
	}

	// Filtered directly for both simple and complex selectors
	return jQuery.filter( qualifier, elements, not );
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	if ( elems.length === 1 && elem.nodeType === 1 ) {
		return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
	}

	return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
		return elem.nodeType === 1;
	} ) );
};

jQuery.fn.extend( {
	find: function( selector ) {
		var i, ret,
			len = this.length,
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter( function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			} ) );
		}

		ret = this.pushStack( [] );

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		return len > 1 ? jQuery.uniqueSort( ret ) : ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow( this, selector || [], false ) );
	},
	not: function( selector ) {
		return this.pushStack( winnow( this, selector || [], true ) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
} );


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (trac-9521)
	// Strict HTML recognition (trac-11290: must start with <)
	// Shortcut simple #id case for speed
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

	init = jQuery.fn.init = function( selector, context, root ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Method init() accepts an alternate rootjQuery
		// so migrate can support jQuery.sub (gh-2101)
		root = root || rootjQuery;

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[ 0 ] === "<" &&
				selector[ selector.length - 1 ] === ">" &&
				selector.length >= 3 ) {

				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && ( match[ 1 ] || !context ) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[ 1 ] ) {
					context = context instanceof jQuery ? context[ 0 ] : context;

					// Option to run scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[ 1 ],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {

							// Properties of context are called as methods if possible
							if ( isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[ 2 ] );

					if ( elem ) {

						// Inject the element directly into the jQuery object
						this[ 0 ] = elem;
						this.length = 1;
					}
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || root ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this[ 0 ] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( isFunction( selector ) ) {
			return root.ready !== undefined ?
				root.ready( selector ) :

				// Execute immediately if ready is not present
				selector( jQuery );
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,

	// Methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.fn.extend( {
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter( function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[ i ] ) ) {
					return true;
				}
			}
		} );
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			targets = typeof selectors !== "string" && jQuery( selectors );

		// Positional selectors never match, since there's no _selection_ context
		if ( !rneedsContext.test( selectors ) ) {
			for ( ; i < l; i++ ) {
				for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

					// Always skip document fragments
					if ( cur.nodeType < 11 && ( targets ?
						targets.index( cur ) > -1 :

						// Don't pass non-elements to jQuery#find
						cur.nodeType === 1 &&
							jQuery.find.matchesSelector( cur, selectors ) ) ) {

						matched.push( cur );
						break;
					}
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
	},

	// Determine the position of an element within the set
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// Index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.uniqueSort(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter( selector )
		);
	}
} );

function sibling( cur, dir ) {
	while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each( {
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, _i, until ) {
		return dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, _i, until ) {
		return dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, _i, until ) {
		return dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return siblings( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return siblings( elem.firstChild );
	},
	contents: function( elem ) {
		if ( elem.contentDocument != null &&

			// Support: IE 11+
			// <object> elements with no `data` attribute has an object
			// `contentDocument` with a `null` prototype.
			getProto( elem.contentDocument ) ) {

			return elem.contentDocument;
		}

		// Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
		// Treat the template element as a regular one in browsers that
		// don't support it.
		if ( nodeName( elem, "template" ) ) {
			elem = elem.content || elem;
		}

		return jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {

			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.uniqueSort( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
} );
var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



// Convert String-formatted options into Object-formatted ones
function createOptions( options ) {
	var object = {};
	jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	} );
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		createOptions( options ) :
		jQuery.extend( {}, options );

	var // Flag to know if list is currently firing
		firing,

		// Last fire value for non-forgettable lists
		memory,

		// Flag to know if list was already fired
		fired,

		// Flag to prevent firing
		locked,

		// Actual callback list
		list = [],

		// Queue of execution data for repeatable lists
		queue = [],

		// Index of currently firing callback (modified by add/remove as needed)
		firingIndex = -1,

		// Fire callbacks
		fire = function() {

			// Enforce single-firing
			locked = locked || options.once;

			// Execute callbacks for all pending executions,
			// respecting firingIndex overrides and runtime changes
			fired = firing = true;
			for ( ; queue.length; firingIndex = -1 ) {
				memory = queue.shift();
				while ( ++firingIndex < list.length ) {

					// Run callback and check for early termination
					if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
						options.stopOnFalse ) {

						// Jump to end and forget the data so .add doesn't re-fire
						firingIndex = list.length;
						memory = false;
					}
				}
			}

			// Forget the data if we're done with it
			if ( !options.memory ) {
				memory = false;
			}

			firing = false;

			// Clean up if we're done firing for good
			if ( locked ) {

				// Keep an empty list if we have data for future add calls
				if ( memory ) {
					list = [];

				// Otherwise, this object is spent
				} else {
					list = "";
				}
			}
		},

		// Actual Callbacks object
		self = {

			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {

					// If we have memory from a past run, we should fire after adding
					if ( memory && !firing ) {
						firingIndex = list.length - 1;
						queue.push( memory );
					}

					( function add( args ) {
						jQuery.each( args, function( _, arg ) {
							if ( isFunction( arg ) ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && toType( arg ) !== "string" ) {

								// Inspect recursively
								add( arg );
							}
						} );
					} )( arguments );

					if ( memory && !firing ) {
						fire();
					}
				}
				return this;
			},

			// Remove a callback from the list
			remove: function() {
				jQuery.each( arguments, function( _, arg ) {
					var index;
					while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
						list.splice( index, 1 );

						// Handle firing indexes
						if ( index <= firingIndex ) {
							firingIndex--;
						}
					}
				} );
				return this;
			},

			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ?
					jQuery.inArray( fn, list ) > -1 :
					list.length > 0;
			},

			// Remove all callbacks from the list
			empty: function() {
				if ( list ) {
					list = [];
				}
				return this;
			},

			// Disable .fire and .add
			// Abort any current/pending executions
			// Clear all callbacks and values
			disable: function() {
				locked = queue = [];
				list = memory = "";
				return this;
			},
			disabled: function() {
				return !list;
			},

			// Disable .fire
			// Also disable .add unless we have memory (since it would have no effect)
			// Abort any pending executions
			lock: function() {
				locked = queue = [];
				if ( !memory && !firing ) {
					list = memory = "";
				}
				return this;
			},
			locked: function() {
				return !!locked;
			},

			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( !locked ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					queue.push( args );
					if ( !firing ) {
						fire();
					}
				}
				return this;
			},

			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},

			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


function Identity( v ) {
	return v;
}
function Thrower( ex ) {
	throw ex;
}

function adoptValue( value, resolve, reject, noValue ) {
	var method;

	try {

		// Check for promise aspect first to privilege synchronous behavior
		if ( value && isFunction( ( method = value.promise ) ) ) {
			method.call( value ).done( resolve ).fail( reject );

		// Other thenables
		} else if ( value && isFunction( ( method = value.then ) ) ) {
			method.call( value, resolve, reject );

		// Other non-thenables
		} else {

			// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
			// * false: [ value ].slice( 0 ) => resolve( value )
			// * true: [ value ].slice( 1 ) => resolve()
			resolve.apply( undefined, [ value ].slice( noValue ) );
		}

	// For Promises/A+, convert exceptions into rejections
	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
	// Deferred#then to conditionally suppress rejection.
	} catch ( value ) {

		// Support: Android 4.0 only
		// Strict mode functions invoked without .call/.apply get global-object context
		reject.apply( undefined, [ value ] );
	}
}

jQuery.extend( {

	Deferred: function( func ) {
		var tuples = [

				// action, add listener, callbacks,
				// ... .then handlers, argument index, [final state]
				[ "notify", "progress", jQuery.Callbacks( "memory" ),
					jQuery.Callbacks( "memory" ), 2 ],
				[ "resolve", "done", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 0, "resolved" ],
				[ "reject", "fail", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 1, "rejected" ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				"catch": function( fn ) {
					return promise.then( null, fn );
				},

				// Keep pipe for back-compat
				pipe: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;

					return jQuery.Deferred( function( newDefer ) {
						jQuery.each( tuples, function( _i, tuple ) {

							// Map tuples (progress, done, fail) to arguments (done, fail, progress)
							var fn = isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

							// deferred.progress(function() { bind to newDefer or newDefer.notify })
							// deferred.done(function() { bind to newDefer or newDefer.resolve })
							// deferred.fail(function() { bind to newDefer or newDefer.reject })
							deferred[ tuple[ 1 ] ]( function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && isFunction( returned.promise ) ) {
									returned.promise()
										.progress( newDefer.notify )
										.done( newDefer.resolve )
										.fail( newDefer.reject );
								} else {
									newDefer[ tuple[ 0 ] + "With" ](
										this,
										fn ? [ returned ] : arguments
									);
								}
							} );
						} );
						fns = null;
					} ).promise();
				},
				then: function( onFulfilled, onRejected, onProgress ) {
					var maxDepth = 0;
					function resolve( depth, deferred, handler, special ) {
						return function() {
							var that = this,
								args = arguments,
								mightThrow = function() {
									var returned, then;

									// Support: Promises/A+ section 2.3.3.3.3
									// https://promisesaplus.com/#point-59
									// Ignore double-resolution attempts
									if ( depth < maxDepth ) {
										return;
									}

									returned = handler.apply( that, args );

									// Support: Promises/A+ section 2.3.1
									// https://promisesaplus.com/#point-48
									if ( returned === deferred.promise() ) {
										throw new TypeError( "Thenable self-resolution" );
									}

									// Support: Promises/A+ sections 2.3.3.1, 3.5
									// https://promisesaplus.com/#point-54
									// https://promisesaplus.com/#point-75
									// Retrieve `then` only once
									then = returned &&

										// Support: Promises/A+ section 2.3.4
										// https://promisesaplus.com/#point-64
										// Only check objects and functions for thenability
										( typeof returned === "object" ||
											typeof returned === "function" ) &&
										returned.then;

									// Handle a returned thenable
									if ( isFunction( then ) ) {

										// Special processors (notify) just wait for resolution
										if ( special ) {
											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special )
											);

										// Normal processors (resolve) also hook into progress
										} else {

											// ...and disregard older resolution values
											maxDepth++;

											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special ),
												resolve( maxDepth, deferred, Identity,
													deferred.notifyWith )
											);
										}

									// Handle all other returned values
									} else {

										// Only substitute handlers pass on context
										// and multiple values (non-spec behavior)
										if ( handler !== Identity ) {
											that = undefined;
											args = [ returned ];
										}

										// Process the value(s)
										// Default process is resolve
										( special || deferred.resolveWith )( that, args );
									}
								},

								// Only normal processors (resolve) catch and reject exceptions
								process = special ?
									mightThrow :
									function() {
										try {
											mightThrow();
										} catch ( e ) {

											if ( jQuery.Deferred.exceptionHook ) {
												jQuery.Deferred.exceptionHook( e,
													process.error );
											}

											// Support: Promises/A+ section 2.3.3.3.4.1
											// https://promisesaplus.com/#point-61
											// Ignore post-resolution exceptions
											if ( depth + 1 >= maxDepth ) {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Thrower ) {
													that = undefined;
													args = [ e ];
												}

												deferred.rejectWith( that, args );
											}
										}
									};

							// Support: Promises/A+ section 2.3.3.3.1
							// https://promisesaplus.com/#point-57
							// Re-resolve promises immediately to dodge false rejection from
							// subsequent errors
							if ( depth ) {
								process();
							} else {

								// Call an optional hook to record the error, in case of exception
								// since it's otherwise lost when execution goes async
								if ( jQuery.Deferred.getErrorHook ) {
									process.error = jQuery.Deferred.getErrorHook();

								// The deprecated alias of the above. While the name suggests
								// returning the stack, not an error instance, jQuery just passes
								// it directly to `console.warn` so both will work; an instance
								// just better cooperates with source maps.
								} else if ( jQuery.Deferred.getStackHook ) {
									process.error = jQuery.Deferred.getStackHook();
								}
								window.setTimeout( process );
							}
						};
					}

					return jQuery.Deferred( function( newDefer ) {

						// progress_handlers.add( ... )
						tuples[ 0 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onProgress ) ?
									onProgress :
									Identity,
								newDefer.notifyWith
							)
						);

						// fulfilled_handlers.add( ... )
						tuples[ 1 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onFulfilled ) ?
									onFulfilled :
									Identity
							)
						);

						// rejected_handlers.add( ... )
						tuples[ 2 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onRejected ) ?
									onRejected :
									Thrower
							)
						);
					} ).promise();
				},

				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 5 ];

			// promise.progress = list.add
			// promise.done = list.add
			// promise.fail = list.add
			promise[ tuple[ 1 ] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(
					function() {

						// state = "resolved" (i.e., fulfilled)
						// state = "rejected"
						state = stateString;
					},

					// rejected_callbacks.disable
					// fulfilled_callbacks.disable
					tuples[ 3 - i ][ 2 ].disable,

					// rejected_handlers.disable
					// fulfilled_handlers.disable
					tuples[ 3 - i ][ 3 ].disable,

					// progress_callbacks.lock
					tuples[ 0 ][ 2 ].lock,

					// progress_handlers.lock
					tuples[ 0 ][ 3 ].lock
				);
			}

			// progress_handlers.fire
			// fulfilled_handlers.fire
			// rejected_handlers.fire
			list.add( tuple[ 3 ].fire );

			// deferred.notify = function() { deferred.notifyWith(...) }
			// deferred.resolve = function() { deferred.resolveWith(...) }
			// deferred.reject = function() { deferred.rejectWith(...) }
			deferred[ tuple[ 0 ] ] = function() {
				deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
				return this;
			};

			// deferred.notifyWith = list.fireWith
			// deferred.resolveWith = list.fireWith
			// deferred.rejectWith = list.fireWith
			deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
		} );

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( singleValue ) {
		var

			// count of uncompleted subordinates
			remaining = arguments.length,

			// count of unprocessed arguments
			i = remaining,

			// subordinate fulfillment data
			resolveContexts = Array( i ),
			resolveValues = slice.call( arguments ),

			// the primary Deferred
			primary = jQuery.Deferred(),

			// subordinate callback factory
			updateFunc = function( i ) {
				return function( value ) {
					resolveContexts[ i ] = this;
					resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( !( --remaining ) ) {
						primary.resolveWith( resolveContexts, resolveValues );
					}
				};
			};

		// Single- and empty arguments are adopted like Promise.resolve
		if ( remaining <= 1 ) {
			adoptValue( singleValue, primary.done( updateFunc( i ) ).resolve, primary.reject,
				!remaining );

			// Use .then() to unwrap secondary thenables (cf. gh-3000)
			if ( primary.state() === "pending" ||
				isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

				return primary.then();
			}
		}

		// Multiple arguments are aggregated like Promise.all array elements
		while ( i-- ) {
			adoptValue( resolveValues[ i ], updateFunc( i ), primary.reject );
		}

		return primary.promise();
	}
} );


// These usually indicate a programmer mistake during development,
// warn about them ASAP rather than swallowing them by default.
var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

// If `jQuery.Deferred.getErrorHook` is defined, `asyncError` is an error
// captured before the async barrier to get the original error cause
// which may otherwise be hidden.
jQuery.Deferred.exceptionHook = function( error, asyncError ) {

	// Support: IE 8 - 9 only
	// Console exists when dev tools are open, which can happen at any time
	if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
		window.console.warn( "jQuery.Deferred exception: " + error.message,
			error.stack, asyncError );
	}
};




jQuery.readyException = function( error ) {
	window.setTimeout( function() {
		throw error;
	} );
};




// The deferred used on DOM ready
var readyList = jQuery.Deferred();

jQuery.fn.ready = function( fn ) {

	readyList
		.then( fn )

		// Wrap jQuery.readyException in a function so that the lookup
		// happens at the time of error handling instead of callback
		// registration.
		.catch( function( error ) {
			jQuery.readyException( error );
		} );

	return this;
};

jQuery.extend( {

	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See trac-6781
	readyWait: 1,

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );
	}
} );

jQuery.ready.then = readyList.then;

// The ready event handler and self cleanup method
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed );
	window.removeEventListener( "load", completed );
	jQuery.ready();
}

// Catch cases where $(document).ready() is called
// after the browser event has already occurred.
// Support: IE <=9 - 10 only
// Older IE sometimes signals "interactive" too soon
if ( document.readyState === "complete" ||
	( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

	// Handle it asynchronously to allow scripts the opportunity to delay ready
	window.setTimeout( jQuery.ready );

} else {

	// Use the handy event callback
	document.addEventListener( "DOMContentLoaded", completed );

	// A fallback to window.onload, that will always work
	window.addEventListener( "load", completed );
}




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( toType( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			access( elems, fn, i, key[ i ], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {

			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, _key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn(
					elems[ i ], key, raw ?
						value :
						value.call( elems[ i ], i, fn( elems[ i ], key ) )
				);
			}
		}
	}

	if ( chainable ) {
		return elems;
	}

	// Gets
	if ( bulk ) {
		return fn.call( elems );
	}

	return len ? fn( elems[ 0 ], key ) : emptyGet;
};


// Matches dashed string for camelizing
var rmsPrefix = /^-ms-/,
	rdashAlpha = /-([a-z])/g;

// Used by camelCase as callback to replace()
function fcamelCase( _all, letter ) {
	return letter.toUpperCase();
}

// Convert dashed to camelCase; used by the css and data modules
// Support: IE <=9 - 11, Edge 12 - 15
// Microsoft forgot to hump their vendor prefix (trac-9572)
function camelCase( string ) {
	return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
}
var acceptData = function( owner ) {

	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};




function Data() {
	this.expando = jQuery.expando + Data.uid++;
}

Data.uid = 1;

Data.prototype = {

	cache: function( owner ) {

		// Check if the owner object already has a cache
		var value = owner[ this.expando ];

		// If not, create one
		if ( !value ) {
			value = {};

			// We can accept data for non-element nodes in modern browsers,
			// but we should not, see trac-8335.
			// Always return an empty object.
			if ( acceptData( owner ) ) {

				// If it is a node unlikely to be stringify-ed or looped over
				// use plain assignment
				if ( owner.nodeType ) {
					owner[ this.expando ] = value;

				// Otherwise secure it in a non-enumerable property
				// configurable must be true to allow the property to be
				// deleted when data is removed
				} else {
					Object.defineProperty( owner, this.expando, {
						value: value,
						configurable: true
					} );
				}
			}
		}

		return value;
	},
	set: function( owner, data, value ) {
		var prop,
			cache = this.cache( owner );

		// Handle: [ owner, key, value ] args
		// Always use camelCase key (gh-2257)
		if ( typeof data === "string" ) {
			cache[ camelCase( data ) ] = value;

		// Handle: [ owner, { properties } ] args
		} else {

			// Copy the properties one-by-one to the cache object
			for ( prop in data ) {
				cache[ camelCase( prop ) ] = data[ prop ];
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		return key === undefined ?
			this.cache( owner ) :

			// Always use camelCase key (gh-2257)
			owner[ this.expando ] && owner[ this.expando ][ camelCase( key ) ];
	},
	access: function( owner, key, value ) {

		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				( ( key && typeof key === "string" ) && value === undefined ) ) {

			return this.get( owner, key );
		}

		// When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i,
			cache = owner[ this.expando ];

		if ( cache === undefined ) {
			return;
		}

		if ( key !== undefined ) {

			// Support array or space separated string of keys
			if ( Array.isArray( key ) ) {

				// If key is an array of keys...
				// We always set camelCase keys, so remove that.
				key = key.map( camelCase );
			} else {
				key = camelCase( key );

				// If a key with the spaces exists, use it.
				// Otherwise, create an array by matching non-whitespace
				key = key in cache ?
					[ key ] :
					( key.match( rnothtmlwhite ) || [] );
			}

			i = key.length;

			while ( i-- ) {
				delete cache[ key[ i ] ];
			}
		}

		// Remove the expando if there's no more data
		if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

			// Support: Chrome <=35 - 45
			// Webkit & Blink performance suffers when deleting properties
			// from DOM nodes, so set to undefined instead
			// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
			if ( owner.nodeType ) {
				owner[ this.expando ] = undefined;
			} else {
				delete owner[ this.expando ];
			}
		}
	},
	hasData: function( owner ) {
		var cache = owner[ this.expando ];
		return cache !== undefined && !jQuery.isEmptyObject( cache );
	}
};
var dataPriv = new Data();

var dataUser = new Data();



//	Implementation Summary
//
//	1. Enforce API surface and semantic compatibility with 1.9.x branch
//	2. Improve the module's maintainability by reducing the storage
//		paths to a single mechanism.
//	3. Use the same single mechanism to support "private" and "user" data.
//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
//	5. Avoid exposing implementation details on user objects (eg. expando properties)
//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /[A-Z]/g;

function getData( data ) {
	if ( data === "true" ) {
		return true;
	}

	if ( data === "false" ) {
		return false;
	}

	if ( data === "null" ) {
		return null;
	}

	// Only convert to a number if it doesn't change the string
	if ( data === +data + "" ) {
		return +data;
	}

	if ( rbrace.test( data ) ) {
		return JSON.parse( data );
	}

	return data;
}

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = getData( data );
			} catch ( e ) {}

			// Make sure we set the data so it isn't changed later
			dataUser.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend( {
	hasData: function( elem ) {
		return dataUser.hasData( elem ) || dataPriv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return dataUser.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		dataUser.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to dataPriv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return dataPriv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		dataPriv.remove( elem, name );
	}
} );

jQuery.fn.extend( {
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = dataUser.get( elem );

				if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE 11 only
						// The attrs elements can be null (trac-14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = camelCase( name.slice( 5 ) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					dataPriv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each( function() {
				dataUser.set( this, key );
			} );
		}

		return access( this, function( value ) {
			var data;

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {

				// Attempt to get data from the cache
				// The key will always be camelCased in Data
				data = dataUser.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each( function() {

				// We always store the camelCased key
				dataUser.set( this, key, value );
			} );
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each( function() {
			dataUser.remove( this, key );
		} );
	}
} );


jQuery.extend( {
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = dataPriv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || Array.isArray( data ) ) {
					queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// Clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// Not public - generate a queueHooks object, or return the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
			empty: jQuery.Callbacks( "once memory" ).add( function() {
				dataPriv.remove( elem, [ type + "queue", key ] );
			} )
		} );
	}
} );

jQuery.fn.extend( {
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[ 0 ], type );
		}

		return data === undefined ?
			this :
			this.each( function() {
				var queue = jQuery.queue( this, type, data );

				// Ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			} );
	},
	dequeue: function( type ) {
		return this.each( function() {
			jQuery.dequeue( this, type );
		} );
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},

	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
} );
var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var documentElement = document.documentElement;



	var isAttached = function( elem ) {
			return jQuery.contains( elem.ownerDocument, elem );
		},
		composed = { composed: true };

	// Support: IE 9 - 11+, Edge 12 - 18+, iOS 10.0 - 10.2 only
	// Check attachment across shadow DOM boundaries when possible (gh-3504)
	// Support: iOS 10.0-10.2 only
	// Early iOS 10 versions support `attachShadow` but not `getRootNode`,
	// leading to errors. We need to check for `getRootNode`.
	if ( documentElement.getRootNode ) {
		isAttached = function( elem ) {
			return jQuery.contains( elem.ownerDocument, elem ) ||
				elem.getRootNode( composed ) === elem.ownerDocument;
		};
	}
var isHiddenWithinTree = function( elem, el ) {

		// isHiddenWithinTree might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;

		// Inline style trumps all
		return elem.style.display === "none" ||
			elem.style.display === "" &&

			// Otherwise, check computed style
			// Support: Firefox <=43 - 45
			// Disconnected elements can have computed display: none, so first confirm that elem is
			// in the document.
			isAttached( elem ) &&

			jQuery.css( elem, "display" ) === "none";
	};



function adjustCSS( elem, prop, valueParts, tween ) {
	var adjusted, scale,
		maxIterations = 20,
		currentValue = tween ?
			function() {
				return tween.cur();
			} :
			function() {
				return jQuery.css( elem, prop, "" );
			},
		initial = currentValue(),
		unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

		// Starting value computation is required for potential unit mismatches
		initialInUnit = elem.nodeType &&
			( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
			rcssNum.exec( jQuery.css( elem, prop ) );

	if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

		// Support: Firefox <=54
		// Halve the iteration target value to prevent interference from CSS upper bounds (gh-2144)
		initial = initial / 2;

		// Trust units reported by jQuery.css
		unit = unit || initialInUnit[ 3 ];

		// Iteratively approximate from a nonzero starting point
		initialInUnit = +initial || 1;

		while ( maxIterations-- ) {

			// Evaluate and update our best guess (doubling guesses that zero out).
			// Finish if the scale equals or crosses 1 (making the old*new product non-positive).
			jQuery.style( elem, prop, initialInUnit + unit );
			if ( ( 1 - scale ) * ( 1 - ( scale = currentValue() / initial || 0.5 ) ) <= 0 ) {
				maxIterations = 0;
			}
			initialInUnit = initialInUnit / scale;

		}

		initialInUnit = initialInUnit * 2;
		jQuery.style( elem, prop, initialInUnit + unit );

		// Make sure we update the tween properties later on
		valueParts = valueParts || [];
	}

	if ( valueParts ) {
		initialInUnit = +initialInUnit || +initial || 0;

		// Apply relative offset (+=/-=) if specified
		adjusted = valueParts[ 1 ] ?
			initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
			+valueParts[ 2 ];
		if ( tween ) {
			tween.unit = unit;
			tween.start = initialInUnit;
			tween.end = adjusted;
		}
	}
	return adjusted;
}


var defaultDisplayMap = {};

function getDefaultDisplay( elem ) {
	var temp,
		doc = elem.ownerDocument,
		nodeName = elem.nodeName,
		display = defaultDisplayMap[ nodeName ];

	if ( display ) {
		return display;
	}

	temp = doc.body.appendChild( doc.createElement( nodeName ) );
	display = jQuery.css( temp, "display" );

	temp.parentNode.removeChild( temp );

	if ( display === "none" ) {
		display = "block";
	}
	defaultDisplayMap[ nodeName ] = display;

	return display;
}

function showHide( elements, show ) {
	var display, elem,
		values = [],
		index = 0,
		length = elements.length;

	// Determine new display value for elements that need to change
	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		display = elem.style.display;
		if ( show ) {

			// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
			// check is required in this first loop unless we have a nonempty display value (either
			// inline or about-to-be-restored)
			if ( display === "none" ) {
				values[ index ] = dataPriv.get( elem, "display" ) || null;
				if ( !values[ index ] ) {
					elem.style.display = "";
				}
			}
			if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
				values[ index ] = getDefaultDisplay( elem );
			}
		} else {
			if ( display !== "none" ) {
				values[ index ] = "none";

				// Remember what we're overwriting
				dataPriv.set( elem, "display", display );
			}
		}
	}

	// Set the display of the elements in a second loop to avoid constant reflow
	for ( index = 0; index < length; index++ ) {
		if ( values[ index ] != null ) {
			elements[ index ].style.display = values[ index ];
		}
	}

	return elements;
}

jQuery.fn.extend( {
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each( function() {
			if ( isHiddenWithinTree( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		} );
	}
} );
var rcheckableType = ( /^(?:checkbox|radio)$/i );

var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]*)/i );

var rscriptType = ( /^$|^module$|\/(?:java|ecma)script/i );



( function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// Support: Android 4.0 - 4.3 only
	// Check state lost if the name is set (trac-11217)
	// Support: Windows Web Apps (WWA)
	// `name` and `type` must use .setAttribute for WWA (trac-14901)
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Android <=4.1 only
	// Older WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE <=11 only
	// Make sure textarea (and checkbox) defaultValue is properly cloned
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;

	// Support: IE <=9 only
	// IE <=9 replaces <option> tags with their contents when inserted outside of
	// the select element.
	div.innerHTML = "<option></option>";
	support.option = !!div.lastChild;
} )();


// We have to close these tags to support XHTML (trac-13200)
var wrapMap = {

	// XHTML parsers do not magically insert elements in the
	// same way that tag soup parsers do. So we cannot shorten
	// this by omitting <tbody> or other required elements.
	thead: [ 1, "<table>", "</table>" ],
	col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
	tr: [ 2, "<table><tbody>", "</tbody></table>" ],
	td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

	_default: [ 0, "", "" ]
};

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;

// Support: IE <=9 only
if ( !support.option ) {
	wrapMap.optgroup = wrapMap.option = [ 1, "<select multiple='multiple'>", "</select>" ];
}


function getAll( context, tag ) {

	// Support: IE <=9 - 11 only
	// Use typeof to avoid zero-argument method invocation on host objects (trac-15151)
	var ret;

	if ( typeof context.getElementsByTagName !== "undefined" ) {
		ret = context.getElementsByTagName( tag || "*" );

	} else if ( typeof context.querySelectorAll !== "undefined" ) {
		ret = context.querySelectorAll( tag || "*" );

	} else {
		ret = [];
	}

	if ( tag === undefined || tag && nodeName( context, tag ) ) {
		return jQuery.merge( [ context ], ret );
	}

	return ret;
}


// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		dataPriv.set(
			elems[ i ],
			"globalEval",
			!refElements || dataPriv.get( refElements[ i ], "globalEval" )
		);
	}
}


var rhtml = /<|&#?\w+;/;

function buildFragment( elems, context, scripts, selection, ignored ) {
	var elem, tmp, tag, wrap, attached, j,
		fragment = context.createDocumentFragment(),
		nodes = [],
		i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		elem = elems[ i ];

		if ( elem || elem === 0 ) {

			// Add nodes directly
			if ( toType( elem ) === "object" ) {

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

			// Convert non-html into a text node
			} else if ( !rhtml.test( elem ) ) {
				nodes.push( context.createTextNode( elem ) );

			// Convert html into DOM nodes
			} else {
				tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

				// Deserialize a standard representation
				tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
				wrap = wrapMap[ tag ] || wrapMap._default;
				tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

				// Descend through wrappers to the right content
				j = wrap[ 0 ];
				while ( j-- ) {
					tmp = tmp.lastChild;
				}

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, tmp.childNodes );

				// Remember the top-level container
				tmp = fragment.firstChild;

				// Ensure the created nodes are orphaned (trac-12392)
				tmp.textContent = "";
			}
		}
	}

	// Remove wrapper from fragment
	fragment.textContent = "";

	i = 0;
	while ( ( elem = nodes[ i++ ] ) ) {

		// Skip elements already in the context collection (trac-4087)
		if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
			if ( ignored ) {
				ignored.push( elem );
			}
			continue;
		}

		attached = isAttached( elem );

		// Append to fragment
		tmp = getAll( fragment.appendChild( elem ), "script" );

		// Preserve script evaluation history
		if ( attached ) {
			setGlobalEval( tmp );
		}

		// Capture executables
		if ( scripts ) {
			j = 0;
			while ( ( elem = tmp[ j++ ] ) ) {
				if ( rscriptType.test( elem.type || "" ) ) {
					scripts.push( elem );
				}
			}
		}
	}

	return fragment;
}


var rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

function on( elem, types, selector, data, fn, one ) {
	var origFn, type;

	// Types can be a map of types/handlers
	if ( typeof types === "object" ) {

		// ( types-Object, selector, data )
		if ( typeof selector !== "string" ) {

			// ( types-Object, data )
			data = data || selector;
			selector = undefined;
		}
		for ( type in types ) {
			on( elem, type, selector, data, types[ type ], one );
		}
		return elem;
	}

	if ( data == null && fn == null ) {

		// ( types, fn )
		fn = selector;
		data = selector = undefined;
	} else if ( fn == null ) {
		if ( typeof selector === "string" ) {

			// ( types, selector, fn )
			fn = data;
			data = undefined;
		} else {

			// ( types, data, fn )
			fn = data;
			data = selector;
			selector = undefined;
		}
	}
	if ( fn === false ) {
		fn = returnFalse;
	} else if ( !fn ) {
		return elem;
	}

	if ( one === 1 ) {
		origFn = fn;
		fn = function( event ) {

			// Can use an empty set, since event contains the info
			jQuery().off( event );
			return origFn.apply( this, arguments );
		};

		// Use same guid so caller can remove using origFn
		fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
	}
	return elem.each( function() {
		jQuery.event.add( this, types, fn, data, selector );
	} );
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.get( elem );

		// Only attach events to objects that accept data
		if ( !acceptData( elem ) ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Ensure that invalid selectors throw exceptions at attach time
		// Evaluate against documentElement in case elem is a non-element node (e.g., document)
		if ( selector ) {
			jQuery.find.matchesSelector( documentElement, selector );
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !( events = elemData.events ) ) {
			events = elemData.events = Object.create( null );
		}
		if ( !( eventHandle = elemData.handle ) ) {
			eventHandle = elemData.handle = function( e ) {

				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend( {
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join( "." )
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !( handlers = events[ type ] ) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup ||
					special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

		if ( !elemData || !( events = elemData.events ) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[ 2 ] &&
				new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector ||
						selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown ||
					special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove data and the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			dataPriv.remove( elem, "handle events" );
		}
	},

	dispatch: function( nativeEvent ) {

		var i, j, ret, matched, handleObj, handlerQueue,
			args = new Array( arguments.length ),

			// Make a writable jQuery.Event from the native event object
			event = jQuery.event.fix( nativeEvent ),

			handlers = (
				dataPriv.get( this, "events" ) || Object.create( null )
			)[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[ 0 ] = event;

		for ( i = 1; i < arguments.length; i++ ) {
			args[ i ] = arguments[ i ];
		}

		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( ( handleObj = matched.handlers[ j++ ] ) &&
				!event.isImmediatePropagationStopped() ) {

				// If the event is namespaced, then each handler is only invoked if it is
				// specially universal or its namespaces are a superset of the event's.
				if ( !event.rnamespace || handleObj.namespace === false ||
					event.rnamespace.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
						handleObj.handler ).apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( ( event.result = ret ) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, handleObj, sel, matchedHandlers, matchedSelectors,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		if ( delegateCount &&

			// Support: IE <=9
			// Black-hole SVG <use> instance trees (trac-13180)
			cur.nodeType &&

			// Support: Firefox <=42
			// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
			// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
			// Support: IE 11 only
			// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
			!( event.type === "click" && event.button >= 1 ) ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't check non-elements (trac-13208)
				// Don't process clicks on disabled elements (trac-6911, trac-8165, trac-11382, trac-11764)
				if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
					matchedHandlers = [];
					matchedSelectors = {};
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (trac-13203)
						sel = handleObj.selector + " ";

						if ( matchedSelectors[ sel ] === undefined ) {
							matchedSelectors[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) > -1 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matchedSelectors[ sel ] ) {
							matchedHandlers.push( handleObj );
						}
					}
					if ( matchedHandlers.length ) {
						handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		cur = this;
		if ( delegateCount < handlers.length ) {
			handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
		}

		return handlerQueue;
	},

	addProp: function( name, hook ) {
		Object.defineProperty( jQuery.Event.prototype, name, {
			enumerable: true,
			configurable: true,

			get: isFunction( hook ) ?
				function() {
					if ( this.originalEvent ) {
						return hook( this.originalEvent );
					}
				} :
				function() {
					if ( this.originalEvent ) {
						return this.originalEvent[ name ];
					}
				},

			set: function( value ) {
				Object.defineProperty( this, name, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: value
				} );
			}
		} );
	},

	fix: function( originalEvent ) {
		return originalEvent[ jQuery.expando ] ?
			originalEvent :
			new jQuery.Event( originalEvent );
	},

	special: {
		load: {

			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		click: {

			// Utilize native event to ensure correct state for checkable inputs
			setup: function( data ) {

				// For mutual compressibility with _default, replace `this` access with a local var.
				// `|| data` is dead code meant only to preserve the variable through minification.
				var el = this || data;

				// Claim the first handler
				if ( rcheckableType.test( el.type ) &&
					el.click && nodeName( el, "input" ) ) {

					// dataPriv.set( el, "click", ... )
					leverageNative( el, "click", true );
				}

				// Return false to allow normal processing in the caller
				return false;
			},
			trigger: function( data ) {

				// For mutual compressibility with _default, replace `this` access with a local var.
				// `|| data` is dead code meant only to preserve the variable through minification.
				var el = this || data;

				// Force setup before triggering a click
				if ( rcheckableType.test( el.type ) &&
					el.click && nodeName( el, "input" ) ) {

					leverageNative( el, "click" );
				}

				// Return non-false to allow normal event-path propagation
				return true;
			},

			// For cross-browser consistency, suppress native .click() on links
			// Also prevent it if we're currently inside a leveraged native-event stack
			_default: function( event ) {
				var target = event.target;
				return rcheckableType.test( target.type ) &&
					target.click && nodeName( target, "input" ) &&
					dataPriv.get( target, "click" ) ||
					nodeName( target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	}
};

// Ensure the presence of an event listener that handles manually-triggered
// synthetic events by interrupting progress until reinvoked in response to
// *native* events that it fires directly, ensuring that state changes have
// already occurred before other listeners are invoked.
function leverageNative( el, type, isSetup ) {

	// Missing `isSetup` indicates a trigger call, which must force setup through jQuery.event.add
	if ( !isSetup ) {
		if ( dataPriv.get( el, type ) === undefined ) {
			jQuery.event.add( el, type, returnTrue );
		}
		return;
	}

	// Register the controller as a special universal handler for all event namespaces
	dataPriv.set( el, type, false );
	jQuery.event.add( el, type, {
		namespace: false,
		handler: function( event ) {
			var result,
				saved = dataPriv.get( this, type );

			if ( ( event.isTrigger & 1 ) && this[ type ] ) {

				// Interrupt processing of the outer synthetic .trigger()ed event
				if ( !saved ) {

					// Store arguments for use when handling the inner native event
					// There will always be at least one argument (an event object), so this array
					// will not be confused with a leftover capture object.
					saved = slice.call( arguments );
					dataPriv.set( this, type, saved );

					// Trigger the native event and capture its result
					this[ type ]();
					result = dataPriv.get( this, type );
					dataPriv.set( this, type, false );

					if ( saved !== result ) {

						// Cancel the outer synthetic event
						event.stopImmediatePropagation();
						event.preventDefault();

						return result;
					}

				// If this is an inner synthetic event for an event with a bubbling surrogate
				// (focus or blur), assume that the surrogate already propagated from triggering
				// the native event and prevent that from happening again here.
				// This technically gets the ordering wrong w.r.t. to `.trigger()` (in which the
				// bubbling surrogate propagates *after* the non-bubbling base), but that seems
				// less bad than duplication.
				} else if ( ( jQuery.event.special[ type ] || {} ).delegateType ) {
					event.stopPropagation();
				}

			// If this is a native event triggered above, everything is now in order
			// Fire an inner synthetic event with the original arguments
			} else if ( saved ) {

				// ...and capture the result
				dataPriv.set( this, type, jQuery.event.trigger(
					saved[ 0 ],
					saved.slice( 1 ),
					this
				) );

				// Abort handling of the native event by all jQuery handlers while allowing
				// native handlers on the same element to run. On target, this is achieved
				// by stopping immediate propagation just on the jQuery event. However,
				// the native event is re-wrapped by a jQuery one on each level of the
				// propagation so the only way to stop it for jQuery is to stop it for
				// everyone via native `stopPropagation()`. This is not a problem for
				// focus/blur which don't bubble, but it does also stop click on checkboxes
				// and radios. We accept this limitation.
				event.stopPropagation();
				event.isImmediatePropagationStopped = returnTrue;
			}
		}
	} );
}

jQuery.removeEvent = function( elem, type, handle ) {

	// This "if" is needed for plain objects
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle );
	}
};

jQuery.Event = function( src, props ) {

	// Allow instantiation without the 'new' keyword
	if ( !( this instanceof jQuery.Event ) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&

				// Support: Android <=2.3 only
				src.returnValue === false ?
			returnTrue :
			returnFalse;

		// Create target properties
		// Support: Safari <=6 - 7 only
		// Target should not be a text node (trac-504, trac-13143)
		this.target = ( src.target && src.target.nodeType === 3 ) ?
			src.target.parentNode :
			src.target;

		this.currentTarget = src.currentTarget;
		this.relatedTarget = src.relatedTarget;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || Date.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	constructor: jQuery.Event,
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,
	isSimulated: false,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && !this.isSimulated ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Includes all common event props including KeyEvent and MouseEvent specific props
jQuery.each( {
	altKey: true,
	bubbles: true,
	cancelable: true,
	changedTouches: true,
	ctrlKey: true,
	detail: true,
	eventPhase: true,
	metaKey: true,
	pageX: true,
	pageY: true,
	shiftKey: true,
	view: true,
	"char": true,
	code: true,
	charCode: true,
	key: true,
	keyCode: true,
	button: true,
	buttons: true,
	clientX: true,
	clientY: true,
	offsetX: true,
	offsetY: true,
	pointerId: true,
	pointerType: true,
	screenX: true,
	screenY: true,
	targetTouches: true,
	toElement: true,
	touches: true,
	which: true
}, jQuery.event.addProp );

jQuery.each( { focus: "focusin", blur: "focusout" }, function( type, delegateType ) {

	function focusMappedHandler( nativeEvent ) {
		if ( document.documentMode ) {

			// Support: IE 11+
			// Attach a single focusin/focusout handler on the document while someone wants
			// focus/blur. This is because the former are synchronous in IE while the latter
			// are async. In other browsers, all those handlers are invoked synchronously.

			// `handle` from private data would already wrap the event, but we need
			// to change the `type` here.
			var handle = dataPriv.get( this, "handle" ),
				event = jQuery.event.fix( nativeEvent );
			event.type = nativeEvent.type === "focusin" ? "focus" : "blur";
			event.isSimulated = true;

			// First, handle focusin/focusout
			handle( nativeEvent );

			// ...then, handle focus/blur
			//
			// focus/blur don't bubble while focusin/focusout do; simulate the former by only
			// invoking the handler at the lower level.
			if ( event.target === event.currentTarget ) {

				// The setup part calls `leverageNative`, which, in turn, calls
				// `jQuery.event.add`, so event handle will already have been set
				// by this point.
				handle( event );
			}
		} else {

			// For non-IE browsers, attach a single capturing handler on the document
			// while someone wants focusin/focusout.
			jQuery.event.simulate( delegateType, nativeEvent.target,
				jQuery.event.fix( nativeEvent ) );
		}
	}

	jQuery.event.special[ type ] = {

		// Utilize native event if possible so blur/focus sequence is correct
		setup: function() {

			var attaches;

			// Claim the first handler
			// dataPriv.set( this, "focus", ... )
			// dataPriv.set( this, "blur", ... )
			leverageNative( this, type, true );

			if ( document.documentMode ) {

				// Support: IE 9 - 11+
				// We use the same native handler for focusin & focus (and focusout & blur)
				// so we need to coordinate setup & teardown parts between those events.
				// Use `delegateType` as the key as `type` is already used by `leverageNative`.
				attaches = dataPriv.get( this, delegateType );
				if ( !attaches ) {
					this.addEventListener( delegateType, focusMappedHandler );
				}
				dataPriv.set( this, delegateType, ( attaches || 0 ) + 1 );
			} else {

				// Return false to allow normal processing in the caller
				return false;
			}
		},
		trigger: function() {

			// Force setup before trigger
			leverageNative( this, type );

			// Return non-false to allow normal event-path propagation
			return true;
		},

		teardown: function() {
			var attaches;

			if ( document.documentMode ) {
				attaches = dataPriv.get( this, delegateType ) - 1;
				if ( !attaches ) {
					this.removeEventListener( delegateType, focusMappedHandler );
					dataPriv.remove( this, delegateType );
				} else {
					dataPriv.set( this, delegateType, attaches );
				}
			} else {

				// Return false to indicate standard teardown should be applied
				return false;
			}
		},

		// Suppress native focus or blur if we're currently inside
		// a leveraged native-event stack
		_default: function( event ) {
			return dataPriv.get( event.target, type );
		},

		delegateType: delegateType
	};

	// Support: Firefox <=44
	// Firefox doesn't have focus(in | out) events
	// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
	//
	// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
	// focus(in | out) events fire after focus & blur events,
	// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
	// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
	//
	// Support: IE 9 - 11+
	// To preserve relative focusin/focus & focusout/blur event order guaranteed on the 3.x branch,
	// attach a single handler for both events in IE.
	jQuery.event.special[ delegateType ] = {
		setup: function() {

			// Handle: regular nodes (via `this.ownerDocument`), window
			// (via `this.document`) & document (via `this`).
			var doc = this.ownerDocument || this.document || this,
				dataHolder = document.documentMode ? this : doc,
				attaches = dataPriv.get( dataHolder, delegateType );

			// Support: IE 9 - 11+
			// We use the same native handler for focusin & focus (and focusout & blur)
			// so we need to coordinate setup & teardown parts between those events.
			// Use `delegateType` as the key as `type` is already used by `leverageNative`.
			if ( !attaches ) {
				if ( document.documentMode ) {
					this.addEventListener( delegateType, focusMappedHandler );
				} else {
					doc.addEventListener( type, focusMappedHandler, true );
				}
			}
			dataPriv.set( dataHolder, delegateType, ( attaches || 0 ) + 1 );
		},
		teardown: function() {
			var doc = this.ownerDocument || this.document || this,
				dataHolder = document.documentMode ? this : doc,
				attaches = dataPriv.get( dataHolder, delegateType ) - 1;

			if ( !attaches ) {
				if ( document.documentMode ) {
					this.removeEventListener( delegateType, focusMappedHandler );
				} else {
					doc.removeEventListener( type, focusMappedHandler, true );
				}
				dataPriv.remove( dataHolder, delegateType );
			} else {
				dataPriv.set( dataHolder, delegateType, attaches );
			}
		}
	};
} );

// Create mouseenter/leave events using mouseover/out and event-time checks
// so that event delegation works in jQuery.
// Do the same for pointerenter/pointerleave and pointerover/pointerout
//
// Support: Safari 7 only
// Safari sends mouseenter too often; see:
// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
// for the description of the bug (it existed in older Chrome versions as well).
jQuery.each( {
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mouseenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
} );

jQuery.fn.extend( {

	on: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn );
	},
	one: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {

			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ?
					handleObj.origType + "." + handleObj.namespace :
					handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {

			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {

			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each( function() {
			jQuery.event.remove( this, types, fn, selector );
		} );
	}
} );


var

	// Support: IE <=10 - 11, Edge 12 - 13 only
	// In IE/Edge using regex groups here causes severe slowdowns.
	// See https://connect.microsoft.com/IE/feedback/details/1736512/
	rnoInnerhtml = /<script|<style|<link/i,

	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,

	rcleanScript = /^\s*<!\[CDATA\[|\]\]>\s*$/g;

// Prefer a tbody over its parent table for containing new rows
function manipulationTarget( elem, content ) {
	if ( nodeName( elem, "table" ) &&
		nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

		return jQuery( elem ).children( "tbody" )[ 0 ] || elem;
	}

	return elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	if ( ( elem.type || "" ).slice( 0, 5 ) === "true/" ) {
		elem.type = elem.type.slice( 5 );
	} else {
		elem.removeAttribute( "type" );
	}

	return elem;
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( dataPriv.hasData( src ) ) {
		pdataOld = dataPriv.get( src );
		events = pdataOld.events;

		if ( events ) {
			dataPriv.remove( dest, "handle events" );

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( dataUser.hasData( src ) ) {
		udataOld = dataUser.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		dataUser.set( dest, udataCur );
	}
}

// Fix IE bugs, see support tests
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

function domManip( collection, args, callback, ignored ) {

	// Flatten any nested arrays
	args = flat( args );

	var fragment, first, scripts, hasScripts, node, doc,
		i = 0,
		l = collection.length,
		iNoClone = l - 1,
		value = args[ 0 ],
		valueIsFunction = isFunction( value );

	// We can't cloneNode fragments that contain checked, in WebKit
	if ( valueIsFunction ||
			( l > 1 && typeof value === "string" &&
				!support.checkClone && rchecked.test( value ) ) ) {
		return collection.each( function( index ) {
			var self = collection.eq( index );
			if ( valueIsFunction ) {
				args[ 0 ] = value.call( this, index, self.html() );
			}
			domManip( self, args, callback, ignored );
		} );
	}

	if ( l ) {
		fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
		first = fragment.firstChild;

		if ( fragment.childNodes.length === 1 ) {
			fragment = first;
		}

		// Require either new content or an interest in ignored elements to invoke the callback
		if ( first || ignored ) {
			scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
			hasScripts = scripts.length;

			// Use the original fragment for the last item
			// instead of the first because it can end up
			// being emptied incorrectly in certain situations (trac-8070).
			for ( ; i < l; i++ ) {
				node = fragment;

				if ( i !== iNoClone ) {
					node = jQuery.clone( node, true, true );

					// Keep references to cloned scripts for later restoration
					if ( hasScripts ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( scripts, getAll( node, "script" ) );
					}
				}

				callback.call( collection[ i ], node, i );
			}

			if ( hasScripts ) {
				doc = scripts[ scripts.length - 1 ].ownerDocument;

				// Reenable scripts
				jQuery.map( scripts, restoreScript );

				// Evaluate executable scripts on first document insertion
				for ( i = 0; i < hasScripts; i++ ) {
					node = scripts[ i ];
					if ( rscriptType.test( node.type || "" ) &&
						!dataPriv.access( node, "globalEval" ) &&
						jQuery.contains( doc, node ) ) {

						if ( node.src && ( node.type || "" ).toLowerCase()  !== "module" ) {

							// Optional AJAX dependency, but won't run scripts if not present
							if ( jQuery._evalUrl && !node.noModule ) {
								jQuery._evalUrl( node.src, {
									nonce: node.nonce || node.getAttribute( "nonce" )
								}, doc );
							}
						} else {

							// Unwrap a CDATA section containing script contents. This shouldn't be
							// needed as in XML documents they're already not visible when
							// inspecting element contents and in HTML documents they have no
							// meaning but we're preserving that logic for backwards compatibility.
							// This will be removed completely in 4.0. See gh-4904.
							DOMEval( node.textContent.replace( rcleanScript, "" ), node, doc );
						}
					}
				}
			}
		}
	}

	return collection;
}

function remove( elem, selector, keepData ) {
	var node,
		nodes = selector ? jQuery.filter( selector, elem ) : elem,
		i = 0;

	for ( ; ( node = nodes[ i ] ) != null; i++ ) {
		if ( !keepData && node.nodeType === 1 ) {
			jQuery.cleanData( getAll( node ) );
		}

		if ( node.parentNode ) {
			if ( keepData && isAttached( node ) ) {
				setGlobalEval( getAll( node, "script" ) );
			}
			node.parentNode.removeChild( node );
		}
	}

	return elem;
}

jQuery.extend( {
	htmlPrefilter: function( html ) {
		return html;
	},

	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = isAttached( elem );

		// Fix IE cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew jQuery#find here for performance reasons:
			// https://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	cleanData: function( elems ) {
		var data, elem, type,
			special = jQuery.event.special,
			i = 0;

		for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
			if ( acceptData( elem ) ) {
				if ( ( data = elem[ dataPriv.expando ] ) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataPriv.expando ] = undefined;
				}
				if ( elem[ dataUser.expando ] ) {

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataUser.expando ] = undefined;
				}
			}
		}
	}
} );

jQuery.fn.extend( {
	detach: function( selector ) {
		return remove( this, selector, true );
	},

	remove: function( selector ) {
		return remove( this, selector );
	},

	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each( function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				} );
		}, null, value, arguments.length );
	},

	append: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		} );
	},

	prepend: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		} );
	},

	before: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		} );
	},

	after: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		} );
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; ( elem = this[ i ] ) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map( function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		} );
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = jQuery.htmlPrefilter( value );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch ( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var ignored = [];

		// Make the changes, replacing each non-ignored context element with the new content
		return domManip( this, arguments, function( elem ) {
			var parent = this.parentNode;

			if ( jQuery.inArray( this, ignored ) < 0 ) {
				jQuery.cleanData( getAll( this ) );
				if ( parent ) {
					parent.replaceChild( elem, this );
				}
			}

		// Force callback invocation
		}, ignored );
	}
} );

jQuery.each( {
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: Android <=4.0 only, PhantomJS 1 only
			// .get() because push.apply(_, arraylike) throws on ancient WebKit
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
} );
var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var rcustomProp = /^--/;


var getStyles = function( elem ) {

		// Support: IE <=11 only, Firefox <=30 (trac-15098, trac-14150)
		// IE throws on elements created in popups
		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
		var view = elem.ownerDocument.defaultView;

		if ( !view || !view.opener ) {
			view = window;
		}

		return view.getComputedStyle( elem );
	};

var swap = function( elem, options, callback ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.call( elem );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};


var rboxStyle = new RegExp( cssExpand.join( "|" ), "i" );



( function() {

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computeStyleTests() {

		// This is a singleton, we need to execute it only once
		if ( !div ) {
			return;
		}

		container.style.cssText = "position:absolute;left:-11111px;width:60px;" +
			"margin-top:1px;padding:0;border:0";
		div.style.cssText =
			"position:relative;display:block;box-sizing:border-box;overflow:scroll;" +
			"margin:auto;border:1px;padding:1px;" +
			"width:60%;top:1%";
		documentElement.appendChild( container ).appendChild( div );

		var divStyle = window.getComputedStyle( div );
		pixelPositionVal = divStyle.top !== "1%";

		// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
		reliableMarginLeftVal = roundPixelMeasures( divStyle.marginLeft ) === 12;

		// Support: Android 4.0 - 4.3 only, Safari <=9.1 - 10.1, iOS <=7.0 - 9.3
		// Some styles come back with percentage values, even though they shouldn't
		div.style.right = "60%";
		pixelBoxStylesVal = roundPixelMeasures( divStyle.right ) === 36;

		// Support: IE 9 - 11 only
		// Detect misreporting of content dimensions for box-sizing:border-box elements
		boxSizingReliableVal = roundPixelMeasures( divStyle.width ) === 36;

		// Support: IE 9 only
		// Detect overflow:scroll screwiness (gh-3699)
		// Support: Chrome <=64
		// Don't get tricked when zoom affects offsetWidth (gh-4029)
		div.style.position = "absolute";
		scrollboxSizeVal = roundPixelMeasures( div.offsetWidth / 3 ) === 12;

		documentElement.removeChild( container );

		// Nullify the div so it wouldn't be stored in the memory and
		// it will also be a sign that checks already performed
		div = null;
	}

	function roundPixelMeasures( measure ) {
		return Math.round( parseFloat( measure ) );
	}

	var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal,
		reliableTrDimensionsVal, reliableMarginLeftVal,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	// Finish early in limited (non-browser) environments
	if ( !div.style ) {
		return;
	}

	// Support: IE <=9 - 11 only
	// Style of cloned element affects source element cloned (trac-8908)
	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	jQuery.extend( support, {
		boxSizingReliable: function() {
			computeStyleTests();
			return boxSizingReliableVal;
		},
		pixelBoxStyles: function() {
			computeStyleTests();
			return pixelBoxStylesVal;
		},
		pixelPosition: function() {
			computeStyleTests();
			return pixelPositionVal;
		},
		reliableMarginLeft: function() {
			computeStyleTests();
			return reliableMarginLeftVal;
		},
		scrollboxSize: function() {
			computeStyleTests();
			return scrollboxSizeVal;
		},

		// Support: IE 9 - 11+, Edge 15 - 18+
		// IE/Edge misreport `getComputedStyle` of table rows with width/height
		// set in CSS while `offset*` properties report correct values.
		// Behavior in IE 9 is more subtle than in newer versions & it passes
		// some versions of this test; make sure not to make it pass there!
		//
		// Support: Firefox 70+
		// Only Firefox includes border widths
		// in computed dimensions. (gh-4529)
		reliableTrDimensions: function() {
			var table, tr, trChild, trStyle;
			if ( reliableTrDimensionsVal == null ) {
				table = document.createElement( "table" );
				tr = document.createElement( "tr" );
				trChild = document.createElement( "div" );

				table.style.cssText = "position:absolute;left:-11111px;border-collapse:separate";
				tr.style.cssText = "border:1px solid";

				// Support: Chrome 86+
				// Height set through cssText does not get applied.
				// Computed height then comes back as 0.
				tr.style.height = "1px";
				trChild.style.height = "9px";

				// Support: Android 8 Chrome 86+
				// In our bodyBackground.html iframe,
				// display for all div elements is set to "inline",
				// which causes a problem only in Android 8 Chrome 86.
				// Ensuring the div is display: block
				// gets around this issue.
				trChild.style.display = "block";

				documentElement
					.appendChild( table )
					.appendChild( tr )
					.appendChild( trChild );

				trStyle = window.getComputedStyle( tr );
				reliableTrDimensionsVal = ( parseInt( trStyle.height, 10 ) +
					parseInt( trStyle.borderTopWidth, 10 ) +
					parseInt( trStyle.borderBottomWidth, 10 ) ) === tr.offsetHeight;

				documentElement.removeChild( table );
			}
			return reliableTrDimensionsVal;
		}
	} );
} )();


function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,
		isCustomProp = rcustomProp.test( name ),

		// Support: Firefox 51+
		// Retrieving style before computed somehow
		// fixes an issue with getting wrong values
		// on detached elements
		style = elem.style;

	computed = computed || getStyles( elem );

	// getPropertyValue is needed for:
	//   .css('filter') (IE 9 only, trac-12537)
	//   .css('--customProperty) (gh-3144)
	if ( computed ) {

		// Support: IE <=9 - 11+
		// IE only supports `"float"` in `getPropertyValue`; in computed styles
		// it's only available as `"cssFloat"`. We no longer modify properties
		// sent to `.css()` apart from camelCasing, so we need to check both.
		// Normally, this would create difference in behavior: if
		// `getPropertyValue` returns an empty string, the value returned
		// by `.css()` would be `undefined`. This is usually the case for
		// disconnected elements. However, in IE even disconnected elements
		// with no styles return `"none"` for `getPropertyValue( "float" )`
		ret = computed.getPropertyValue( name ) || computed[ name ];

		if ( isCustomProp && ret ) {

			// Support: Firefox 105+, Chrome <=105+
			// Spec requires trimming whitespace for custom properties (gh-4926).
			// Firefox only trims leading whitespace. Chrome just collapses
			// both leading & trailing whitespace to a single space.
			//
			// Fall back to `undefined` if empty string returned.
			// This collapses a missing definition with property defined
			// and set to an empty string but there's no standard API
			// allowing us to differentiate them without a performance penalty
			// and returning `undefined` aligns with older jQuery.
			//
			// rtrimCSS treats U+000D CARRIAGE RETURN and U+000C FORM FEED
			// as whitespace while CSS does not, but this is not a problem
			// because CSS preprocessing replaces them with U+000A LINE FEED
			// (which *is* CSS whitespace)
			// https://www.w3.org/TR/css-syntax-3/#input-preprocessing
			ret = ret.replace( rtrimCSS, "$1" ) || undefined;
		}

		if ( ret === "" && !isAttached( elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// A tribute to the "awesome hack by Dean Edwards"
		// Android Browser returns percentage for some values,
		// but width seems to be reliably pixels.
		// This is against the CSSOM draft spec:
		// https://drafts.csswg.org/cssom/#resolved-values
		if ( !support.pixelBoxStyles() && rnumnonpx.test( ret ) && rboxStyle.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?

		// Support: IE <=9 - 11 only
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {

	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {

				// Hook not needed (or it's not possible to use it due
				// to missing dependency), remove it.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.
			return ( this.get = hookFn ).apply( this, arguments );
		}
	};
}


var cssPrefixes = [ "Webkit", "Moz", "ms" ],
	emptyStyle = document.createElement( "div" ).style,
	vendorProps = {};

// Return a vendor-prefixed property or undefined
function vendorPropName( name ) {

	// Check for vendor prefixed names
	var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in emptyStyle ) {
			return name;
		}
	}
}

// Return a potentially-mapped jQuery.cssProps or vendor prefixed property
function finalPropName( name ) {
	var final = jQuery.cssProps[ name ] || vendorProps[ name ];

	if ( final ) {
		return final;
	}
	if ( name in emptyStyle ) {
		return name;
	}
	return vendorProps[ name ] = vendorPropName( name ) || name;
}


var

	// Swappable if display is none or starts with table
	// except "table", "table-cell", or "table-caption"
	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	};

function setPositiveNumber( _elem, value, subtract ) {

	// Any relative (+/-) values have already been
	// normalized at this point
	var matches = rcssNum.exec( value );
	return matches ?

		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
		value;
}

function boxModelAdjustment( elem, dimension, box, isBorderBox, styles, computedVal ) {
	var i = dimension === "width" ? 1 : 0,
		extra = 0,
		delta = 0,
		marginDelta = 0;

	// Adjustment may not be necessary
	if ( box === ( isBorderBox ? "border" : "content" ) ) {
		return 0;
	}

	for ( ; i < 4; i += 2 ) {

		// Both box models exclude margin
		// Count margin delta separately to only add it after scroll gutter adjustment.
		// This is needed to make negative margins work with `outerHeight( true )` (gh-3982).
		if ( box === "margin" ) {
			marginDelta += jQuery.css( elem, box + cssExpand[ i ], true, styles );
		}

		// If we get here with a content-box, we're seeking "padding" or "border" or "margin"
		if ( !isBorderBox ) {

			// Add padding
			delta += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// For "border" or "margin", add border
			if ( box !== "padding" ) {
				delta += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );

			// But still keep track of it otherwise
			} else {
				extra += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}

		// If we get here with a border-box (content + padding + border), we're seeking "content" or
		// "padding" or "margin"
		} else {

			// For "content", subtract padding
			if ( box === "content" ) {
				delta -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// For "content" or "padding", subtract border
			if ( box !== "margin" ) {
				delta -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	// Account for positive content-box scroll gutter when requested by providing computedVal
	if ( !isBorderBox && computedVal >= 0 ) {

		// offsetWidth/offsetHeight is a rounded sum of content, padding, scroll gutter, and border
		// Assuming integer scroll gutter, subtract the rest and round down
		delta += Math.max( 0, Math.ceil(
			elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
			computedVal -
			delta -
			extra -
			0.5

		// If offsetWidth/offsetHeight is unknown, then we can't determine content-box scroll gutter
		// Use an explicit zero to avoid NaN (gh-3964)
		) ) || 0;
	}

	return delta + marginDelta;
}

function getWidthOrHeight( elem, dimension, extra ) {

	// Start with computed style
	var styles = getStyles( elem ),

		// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-4322).
		// Fake content-box until we know it's needed to know the true value.
		boxSizingNeeded = !support.boxSizingReliable() || extra,
		isBorderBox = boxSizingNeeded &&
			jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
		valueIsBorderBox = isBorderBox,

		val = curCSS( elem, dimension, styles ),
		offsetProp = "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 );

	// Support: Firefox <=54
	// Return a confounding non-pixel value or feign ignorance, as appropriate.
	if ( rnumnonpx.test( val ) ) {
		if ( !extra ) {
			return val;
		}
		val = "auto";
	}


	// Support: IE 9 - 11 only
	// Use offsetWidth/offsetHeight for when box sizing is unreliable.
	// In those cases, the computed value can be trusted to be border-box.
	if ( ( !support.boxSizingReliable() && isBorderBox ||

		// Support: IE 10 - 11+, Edge 15 - 18+
		// IE/Edge misreport `getComputedStyle` of table rows with width/height
		// set in CSS while `offset*` properties report correct values.
		// Interestingly, in some cases IE 9 doesn't suffer from this issue.
		!support.reliableTrDimensions() && nodeName( elem, "tr" ) ||

		// Fall back to offsetWidth/offsetHeight when value is "auto"
		// This happens for inline elements with no explicit setting (gh-3571)
		val === "auto" ||

		// Support: Android <=4.1 - 4.3 only
		// Also use offsetWidth/offsetHeight for misreported inline dimensions (gh-3602)
		!parseFloat( val ) && jQuery.css( elem, "display", false, styles ) === "inline" ) &&

		// Make sure the element is visible & connected
		elem.getClientRects().length ) {

		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

		// Where available, offsetWidth/offsetHeight approximate border box dimensions.
		// Where not available (e.g., SVG), assume unreliable box-sizing and interpret the
		// retrieved value as a content box dimension.
		valueIsBorderBox = offsetProp in elem;
		if ( valueIsBorderBox ) {
			val = elem[ offsetProp ];
		}
	}

	// Normalize "" and auto
	val = parseFloat( val ) || 0;

	// Adjust for the element's box model
	return ( val +
		boxModelAdjustment(
			elem,
			dimension,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles,

			// Provide the current computed size to request scroll gutter calculation (gh-3589)
			val
		)
	) + "px";
}

jQuery.extend( {

	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {

					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		animationIterationCount: true,
		aspectRatio: true,
		borderImageSlice: true,
		columnCount: true,
		flexGrow: true,
		flexShrink: true,
		fontWeight: true,
		gridArea: true,
		gridColumn: true,
		gridColumnEnd: true,
		gridColumnStart: true,
		gridRow: true,
		gridRowEnd: true,
		gridRowStart: true,
		lineHeight: true,
		opacity: true,
		order: true,
		orphans: true,
		scale: true,
		widows: true,
		zIndex: true,
		zoom: true,

		// SVG-related
		fillOpacity: true,
		floodOpacity: true,
		stopOpacity: true,
		strokeMiterlimit: true,
		strokeOpacity: true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {

		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name ),
			style = elem.style;

		// Make sure that we're working with the right name. We don't
		// want to query the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Gets hook for the prefixed version, then unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Convert "+=" or "-=" to relative numbers (trac-7345)
			if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
				value = adjustCSS( elem, name, ret );

				// Fixes bug trac-9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set (trac-7116)
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add the unit (except for certain CSS properties)
			// The isCustomProp check can be removed in jQuery 4.0 when we only auto-append
			// "px" to a few hardcoded values.
			if ( type === "number" && !isCustomProp ) {
				value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
			}

			// background-* props affect original clone's values
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !( "set" in hooks ) ||
				( value = hooks.set( elem, value, extra ) ) !== undefined ) {

				if ( isCustomProp ) {
					style.setProperty( name, value );
				} else {
					style[ name ] = value;
				}
			}

		} else {

			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks &&
				( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name );

		// Make sure that we're working with the right name. We don't
		// want to modify the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Try prefixed name followed by the unprefixed name
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		// Convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Make numeric if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || isFinite( num ) ? num || 0 : val;
		}

		return val;
	}
} );

jQuery.each( [ "height", "width" ], function( _i, dimension ) {
	jQuery.cssHooks[ dimension ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {

				// Certain elements can have dimension info if we invisibly show them
				// but it must have a current display style that would benefit
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

					// Support: Safari 8+
					// Table columns in Safari have non-zero offsetWidth & zero
					// getBoundingClientRect().width unless display is changed.
					// Support: IE <=11 only
					// Running getBoundingClientRect on a disconnected node
					// in IE throws an error.
					( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
					swap( elem, cssShow, function() {
						return getWidthOrHeight( elem, dimension, extra );
					} ) :
					getWidthOrHeight( elem, dimension, extra );
			}
		},

		set: function( elem, value, extra ) {
			var matches,
				styles = getStyles( elem ),

				// Only read styles.position if the test has a chance to fail
				// to avoid forcing a reflow.
				scrollboxSizeBuggy = !support.scrollboxSize() &&
					styles.position === "absolute",

				// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-3991)
				boxSizingNeeded = scrollboxSizeBuggy || extra,
				isBorderBox = boxSizingNeeded &&
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
				subtract = extra ?
					boxModelAdjustment(
						elem,
						dimension,
						extra,
						isBorderBox,
						styles
					) :
					0;

			// Account for unreliable border-box dimensions by comparing offset* to computed and
			// faking a content-box to get border and padding (gh-3699)
			if ( isBorderBox && scrollboxSizeBuggy ) {
				subtract -= Math.ceil(
					elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
					parseFloat( styles[ dimension ] ) -
					boxModelAdjustment( elem, dimension, "border", false, styles ) -
					0.5
				);
			}

			// Convert to pixels if value adjustment is needed
			if ( subtract && ( matches = rcssNum.exec( value ) ) &&
				( matches[ 3 ] || "px" ) !== "px" ) {

				elem.style[ dimension ] = value;
				value = jQuery.css( elem, dimension );
			}

			return setPositiveNumber( elem, value, subtract );
		}
	};
} );

jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
	function( elem, computed ) {
		if ( computed ) {
			return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
				elem.getBoundingClientRect().left -
					swap( elem, { marginLeft: 0 }, function() {
						return elem.getBoundingClientRect().left;
					} )
			) + "px";
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each( {
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// Assumes a single number if not a string
				parts = typeof value === "string" ? value.split( " " ) : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( prefix !== "margin" ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
} );

jQuery.fn.extend( {
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( Array.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	}
} );


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || jQuery.easing._default;
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			// Use a property on the element directly when it is not a DOM element,
			// or when there is no matching style property that exists.
			if ( tween.elem.nodeType !== 1 ||
				tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
				return tween.elem[ tween.prop ];
			}

			// Passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails.
			// Simple values such as "10px" are parsed to Float;
			// complex values such as "rotate(1rad)" are returned as-is.
			result = jQuery.css( tween.elem, tween.prop, "" );

			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {

			// Use step hook for back compat.
			// Use cssHook if its there.
			// Use .style if available and use plain properties where available.
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.nodeType === 1 && (
				jQuery.cssHooks[ tween.prop ] ||
					tween.elem.style[ finalPropName( tween.prop ) ] != null ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE <=9 only
// Panic based approach to setting things on disconnected nodes
Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	},
	_default: "swing"
};

jQuery.fx = Tween.prototype.init;

// Back compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, inProgress,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rrun = /queueHooks$/;

function schedule() {
	if ( inProgress ) {
		if ( document.hidden === false && window.requestAnimationFrame ) {
			window.requestAnimationFrame( schedule );
		} else {
			window.setTimeout( schedule, jQuery.fx.interval );
		}

		jQuery.fx.tick();
	}
}

// Animations created synchronously will run synchronously
function createFxNow() {
	window.setTimeout( function() {
		fxNow = undefined;
	} );
	return ( fxNow = Date.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// If we include width, step value is 1 to do all cssExpand values,
	// otherwise step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

			// We're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
		isBox = "width" in props || "height" in props,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHiddenWithinTree( elem ),
		dataShow = dataPriv.get( elem, "fxshow" );

	// Queue-skipping animations hijack the fx hooks
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always( function() {

			// Ensure the complete handler is called before this completes
			anim.always( function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			} );
		} );
	}

	// Detect show/hide animations
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.test( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// Pretend to be hidden if this is a "show" and
				// there is still data from a stopped show/hide
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;

				// Ignore all other no-op show/hide data
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
		}
	}

	// Bail out if this is a no-op like .hide().hide()
	propTween = !jQuery.isEmptyObject( props );
	if ( !propTween && jQuery.isEmptyObject( orig ) ) {
		return;
	}

	// Restrict "overflow" and "display" styles during box animations
	if ( isBox && elem.nodeType === 1 ) {

		// Support: IE <=9 - 11, Edge 12 - 15
		// Record all 3 overflow attributes because IE does not infer the shorthand
		// from identically-valued overflowX and overflowY and Edge just mirrors
		// the overflowX value there.
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Identify a display type, preferring old show/hide data over the CSS cascade
		restoreDisplay = dataShow && dataShow.display;
		if ( restoreDisplay == null ) {
			restoreDisplay = dataPriv.get( elem, "display" );
		}
		display = jQuery.css( elem, "display" );
		if ( display === "none" ) {
			if ( restoreDisplay ) {
				display = restoreDisplay;
			} else {

				// Get nonempty value(s) by temporarily forcing visibility
				showHide( [ elem ], true );
				restoreDisplay = elem.style.display || restoreDisplay;
				display = jQuery.css( elem, "display" );
				showHide( [ elem ] );
			}
		}

		// Animate inline elements as inline-block
		if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
			if ( jQuery.css( elem, "float" ) === "none" ) {

				// Restore the original display value at the end of pure show/hide animations
				if ( !propTween ) {
					anim.done( function() {
						style.display = restoreDisplay;
					} );
					if ( restoreDisplay == null ) {
						display = style.display;
						restoreDisplay = display === "none" ? "" : display;
					}
				}
				style.display = "inline-block";
			}
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always( function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		} );
	}

	// Implement show/hide animations
	propTween = false;
	for ( prop in orig ) {

		// General show/hide setup for this element animation
		if ( !propTween ) {
			if ( dataShow ) {
				if ( "hidden" in dataShow ) {
					hidden = dataShow.hidden;
				}
			} else {
				dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
			}

			// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
			if ( toggle ) {
				dataShow.hidden = !hidden;
			}

			// Show elements before animating them
			if ( hidden ) {
				showHide( [ elem ], true );
			}

			/* eslint-disable no-loop-func */

			anim.done( function() {

				/* eslint-enable no-loop-func */

				// The final step of a "hide" animation is actually hiding the element
				if ( !hidden ) {
					showHide( [ elem ] );
				}
				dataPriv.remove( elem, "fxshow" );
				for ( prop in orig ) {
					jQuery.style( elem, prop, orig[ prop ] );
				}
			} );
		}

		// Per-property setup
		propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
		if ( !( prop in dataShow ) ) {
			dataShow[ prop ] = propTween.start;
			if ( hidden ) {
				propTween.end = propTween.start;
				propTween.start = 0;
			}
		}
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( Array.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// Not quite $.extend, this won't overwrite existing keys.
			// Reusing 'index' because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = Animation.prefilters.length,
		deferred = jQuery.Deferred().always( function() {

			// Don't match elem in the :animated selector
			delete tick.elem;
		} ),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

				// Support: Android 2.3 only
				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (trac-12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ] );

			// If there's more to do, yield
			if ( percent < 1 && length ) {
				return remaining;
			}

			// If this was an empty animation, synthesize a final progress notification
			if ( !length ) {
				deferred.notifyWith( elem, [ animation, 1, 0 ] );
			}

			// Resolve the animation and report its conclusion
			deferred.resolveWith( elem, [ animation ] );
			return false;
		},
		animation = deferred.promise( {
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, {
				specialEasing: {},
				easing: jQuery.easing._default
			}, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
					animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,

					// If we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// Resolve when we played the last frame; otherwise, reject
				if ( gotoEnd ) {
					deferred.notifyWith( elem, [ animation, 1, 0 ] );
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		} ),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length; index++ ) {
		result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			if ( isFunction( result.stop ) ) {
				jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
					result.stop.bind( result );
			}
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	// Attach callbacks from options
	animation
		.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		} )
	);

	return animation;
}

jQuery.Animation = jQuery.extend( Animation, {

	tweeners: {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value );
			adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
			return tween;
		} ]
	},

	tweener: function( props, callback ) {
		if ( isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.match( rnothtmlwhite );
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length; index++ ) {
			prop = props[ index ];
			Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
			Animation.tweeners[ prop ].unshift( callback );
		}
	},

	prefilters: [ defaultPrefilter ],

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			Animation.prefilters.unshift( callback );
		} else {
			Animation.prefilters.push( callback );
		}
	}
} );

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !isFunction( easing ) && easing
	};

	// Go to the end state if fx are off
	if ( jQuery.fx.off ) {
		opt.duration = 0;

	} else {
		if ( typeof opt.duration !== "number" ) {
			if ( opt.duration in jQuery.fx.speeds ) {
				opt.duration = jQuery.fx.speeds[ opt.duration ];

			} else {
				opt.duration = jQuery.fx.speeds._default;
			}
		}
	}

	// Normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend( {
	fadeTo: function( speed, to, easing, callback ) {

		// Show any hidden elements after setting opacity to 0
		return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

			// Animate to the value specified
			.end().animate( { opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {

				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || dataPriv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};

		doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue ) {
			this.queue( type || "fx", [] );
		}

		return this.each( function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = dataPriv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this &&
					( type == null || timers[ index ].queue === type ) ) {

					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// Start the next in the queue if the last step wasn't forced.
			// Timers currently will call their complete callbacks, which
			// will dequeue but only if they were gotoEnd.
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		} );
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each( function() {
			var index,
				data = dataPriv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// Enable finishing flag on private data
			data.finish = true;

			// Empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// Look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// Look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// Turn off finishing flag
			delete data.finish;
		} );
	}
} );

jQuery.each( [ "toggle", "show", "hide" ], function( _i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
} );

// Generate shortcuts for custom animations
jQuery.each( {
	slideDown: genFx( "show" ),
	slideUp: genFx( "hide" ),
	slideToggle: genFx( "toggle" ),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
} );

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = Date.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];

		// Run the timer and safely remove it when done (allowing for external removal)
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	jQuery.fx.start();
};

jQuery.fx.interval = 13;
jQuery.fx.start = function() {
	if ( inProgress ) {
		return;
	}

	inProgress = true;
	schedule();
};

jQuery.fx.stop = function() {
	inProgress = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,

	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = window.setTimeout( next, time );
		hooks.stop = function() {
			window.clearTimeout( timeout );
		};
	} );
};


( function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: Android <=4.3 only
	// Default value for a checkbox should be "on"
	support.checkOn = input.value !== "";

	// Support: IE <=11 only
	// Must access selectedIndex to make default options select
	support.optSelected = opt.selected;

	// Support: IE <=11 only
	// An input loses its value after becoming a radio
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
} )();


var boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend( {
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each( function() {
			jQuery.removeAttr( this, name );
		} );
	}
} );

jQuery.extend( {
	attr: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set attributes on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === "undefined" ) {
			return jQuery.prop( elem, name, value );
		}

		// Attribute hooks are determined by the lowercase version
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
		}

		if ( value !== undefined ) {
			if ( value === null ) {
				jQuery.removeAttr( elem, name );
				return;
			}

			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			elem.setAttribute( name, value + "" );
			return value;
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		ret = jQuery.find.attr( elem, name );

		// Non-existent attributes return null, we normalize to undefined
		return ret == null ? undefined : ret;
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					nodeName( elem, "input" ) ) {
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	},

	removeAttr: function( elem, value ) {
		var name,
			i = 0,

			// Attribute names can contain non-HTML whitespace characters
			// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
			attrNames = value && value.match( rnothtmlwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( ( name = attrNames[ i++ ] ) ) {
				elem.removeAttribute( name );
			}
		}
	}
} );

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {

			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};

jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( _i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle,
			lowercaseName = name.toLowerCase();

		if ( !isXML ) {

			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ lowercaseName ];
			attrHandle[ lowercaseName ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				lowercaseName :
				null;
			attrHandle[ lowercaseName ] = handle;
		}
		return ret;
	};
} );




var rfocusable = /^(?:input|select|textarea|button)$/i,
	rclickable = /^(?:a|area)$/i;

jQuery.fn.extend( {
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each( function() {
			delete this[ jQuery.propFix[ name ] || name ];
		} );
	}
} );

jQuery.extend( {
	prop: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set properties on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			return ( elem[ name ] = value );
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		return elem[ name ];
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {

				// Support: IE <=9 - 11 only
				// elem.tabIndex doesn't always return the
				// correct value when it hasn't been explicitly set
				// Use proper attribute retrieval (trac-12072)
				var tabindex = jQuery.find.attr( elem, "tabindex" );

				if ( tabindex ) {
					return parseInt( tabindex, 10 );
				}

				if (
					rfocusable.test( elem.nodeName ) ||
					rclickable.test( elem.nodeName ) &&
					elem.href
				) {
					return 0;
				}

				return -1;
			}
		}
	},

	propFix: {
		"for": "htmlFor",
		"class": "className"
	}
} );

// Support: IE <=11 only
// Accessing the selectedIndex property
// forces the browser to respect setting selected
// on the option
// The getter ensures a default option is selected
// when in an optgroup
// eslint rule "no-unused-expressions" is disabled for this code
// since it considers such accessions noop
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		},
		set: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent ) {
				parent.selectedIndex;

				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
		}
	};
}

jQuery.each( [
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
} );




	// Strip and collapse whitespace according to HTML spec
	// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
	function stripAndCollapse( value ) {
		var tokens = value.match( rnothtmlwhite ) || [];
		return tokens.join( " " );
	}


function getClass( elem ) {
	return elem.getAttribute && elem.getAttribute( "class" ) || "";
}

function classesToArray( value ) {
	if ( Array.isArray( value ) ) {
		return value;
	}
	if ( typeof value === "string" ) {
		return value.match( rnothtmlwhite ) || [];
	}
	return [];
}

jQuery.fn.extend( {
	addClass: function( value ) {
		var classNames, cur, curValue, className, i, finalValue;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		classNames = classesToArray( value );

		if ( classNames.length ) {
			return this.each( function() {
				curValue = getClass( this );
				cur = this.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					for ( i = 0; i < classNames.length; i++ ) {
						className = classNames[ i ];
						if ( cur.indexOf( " " + className + " " ) < 0 ) {
							cur += className + " ";
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						this.setAttribute( "class", finalValue );
					}
				}
			} );
		}

		return this;
	},

	removeClass: function( value ) {
		var classNames, cur, curValue, className, i, finalValue;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( !arguments.length ) {
			return this.attr( "class", "" );
		}

		classNames = classesToArray( value );

		if ( classNames.length ) {
			return this.each( function() {
				curValue = getClass( this );

				// This expression is here for better compressibility (see addClass)
				cur = this.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					for ( i = 0; i < classNames.length; i++ ) {
						className = classNames[ i ];

						// Remove *all* instances
						while ( cur.indexOf( " " + className + " " ) > -1 ) {
							cur = cur.replace( " " + className + " ", " " );
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						this.setAttribute( "class", finalValue );
					}
				}
			} );
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var classNames, className, i, self,
			type = typeof value,
			isValidValue = type === "string" || Array.isArray( value );

		if ( isFunction( value ) ) {
			return this.each( function( i ) {
				jQuery( this ).toggleClass(
					value.call( this, i, getClass( this ), stateVal ),
					stateVal
				);
			} );
		}

		if ( typeof stateVal === "boolean" && isValidValue ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		classNames = classesToArray( value );

		return this.each( function() {
			if ( isValidValue ) {

				// Toggle individual class names
				self = jQuery( this );

				for ( i = 0; i < classNames.length; i++ ) {
					className = classNames[ i ];

					// Check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( value === undefined || type === "boolean" ) {
				className = getClass( this );
				if ( className ) {

					// Store className if set
					dataPriv.set( this, "__className__", className );
				}

				// If the element has a class name or if we're passed `false`,
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				if ( this.setAttribute ) {
					this.setAttribute( "class",
						className || value === false ?
							"" :
							dataPriv.get( this, "__className__" ) || ""
					);
				}
			}
		} );
	},

	hasClass: function( selector ) {
		var className, elem,
			i = 0;

		className = " " + selector + " ";
		while ( ( elem = this[ i++ ] ) ) {
			if ( elem.nodeType === 1 &&
				( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
				return true;
			}
		}

		return false;
	}
} );




var rreturn = /\r/g;

jQuery.fn.extend( {
	val: function( value ) {
		var hooks, ret, valueIsFunction,
			elem = this[ 0 ];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] ||
					jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks &&
					"get" in hooks &&
					( ret = hooks.get( elem, "value" ) ) !== undefined
				) {
					return ret;
				}

				ret = elem.value;

				// Handle most common string cases
				if ( typeof ret === "string" ) {
					return ret.replace( rreturn, "" );
				}

				// Handle cases where value is null/undef or number
				return ret == null ? "" : ret;
			}

			return;
		}

		valueIsFunction = isFunction( value );

		return this.each( function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( valueIsFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( Array.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				} );
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		} );
	}
} );

jQuery.extend( {
	valHooks: {
		option: {
			get: function( elem ) {

				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :

					// Support: IE <=10 - 11 only
					// option.text throws exceptions (trac-14686, trac-14858)
					// Strip and collapse whitespace
					// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
					stripAndCollapse( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option, i,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one",
					values = one ? null : [],
					max = one ? index + 1 : options.length;

				if ( index < 0 ) {
					i = max;

				} else {
					i = one ? index : 0;
				}

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// Support: IE <=9 only
					// IE8-9 doesn't update selected after form reset (trac-2551)
					if ( ( option.selected || i === index ) &&

							// Don't return options that are disabled or in a disabled optgroup
							!option.disabled &&
							( !option.parentNode.disabled ||
								!nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];

					/* eslint-disable no-cond-assign */

					if ( option.selected =
						jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
					) {
						optionSet = true;
					}

					/* eslint-enable no-cond-assign */
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
} );

// Radios and checkboxes getter/setter
jQuery.each( [ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( Array.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			return elem.getAttribute( "value" ) === null ? "on" : elem.value;
		};
	}
} );




// Return jQuery for attributes-only inclusion
var location = window.location;

var nonce = { guid: Date.now() };

var rquery = ( /\?/ );



// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml, parserErrorElem;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE 9 - 11 only
	// IE throws on parseFromString with invalid input.
	try {
		xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
	} catch ( e ) {}

	parserErrorElem = xml && xml.getElementsByTagName( "parsererror" )[ 0 ];
	if ( !xml || parserErrorElem ) {
		jQuery.error( "Invalid XML: " + (
			parserErrorElem ?
				jQuery.map( parserErrorElem.childNodes, function( el ) {
					return el.textContent;
				} ).join( "\n" ) :
				data
		) );
	}
	return xml;
};


var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
	stopPropagationCallback = function( e ) {
		e.stopPropagation();
	};

jQuery.extend( jQuery.event, {

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special, lastElement,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

		cur = lastElement = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf( "." ) > -1 ) {

			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split( "." );
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf( ":" ) < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join( "." );
		event.rnamespace = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (trac-9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (trac-9724)
		if ( !onlyHandlers && !special.noBubble && !isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === ( elem.ownerDocument || document ) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
			lastElement = cur;
			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( dataPriv.get( cur, "events" ) || Object.create( null ) )[ event.type ] &&
				dataPriv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( ( !special._default ||
				special._default.apply( eventPath.pop(), data ) === false ) &&
				acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name as the event.
				// Don't do default actions on window, that's where global variables be (trac-6170)
				if ( ontype && isFunction( elem[ type ] ) && !isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;

					if ( event.isPropagationStopped() ) {
						lastElement.addEventListener( type, stopPropagationCallback );
					}

					elem[ type ]();

					if ( event.isPropagationStopped() ) {
						lastElement.removeEventListener( type, stopPropagationCallback );
					}

					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	// Piggyback on a donor event to simulate a different one
	// Used only for `focus(in | out)` events
	simulate: function( type, elem, event ) {
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true
			}
		);

		jQuery.event.trigger( e, null, elem );
	}

} );

jQuery.fn.extend( {

	trigger: function( type, data ) {
		return this.each( function() {
			jQuery.event.trigger( type, data, this );
		} );
	},
	triggerHandler: function( type, data ) {
		var elem = this[ 0 ];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
} );


var
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( Array.isArray( obj ) ) {

		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {

				// Treat each array item as a scalar.
				add( prefix, v );

			} else {

				// Item is non-scalar (array or object), encode its numeric index.
				buildParams(
					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
					v,
					traditional,
					add
				);
			}
		} );

	} else if ( !traditional && toType( obj ) === "object" ) {

		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {

		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, valueOrFunction ) {

			// If value is a function, invoke it and use its return value
			var value = isFunction( valueOrFunction ) ?
				valueOrFunction() :
				valueOrFunction;

			s[ s.length ] = encodeURIComponent( key ) + "=" +
				encodeURIComponent( value == null ? "" : value );
		};

	if ( a == null ) {
		return "";
	}

	// If an array was passed in, assume that it is an array of form elements.
	if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		} );

	} else {

		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" );
};

jQuery.fn.extend( {
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map( function() {

			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		} ).filter( function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		} ).map( function( _i, elem ) {
			var val = jQuery( this ).val();

			if ( val == null ) {
				return null;
			}

			if ( Array.isArray( val ) ) {
				return jQuery.map( val, function( val ) {
					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} );
			}

			return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		} ).get();
	}
} );


var
	r20 = /%20/g,
	rhash = /#.*$/,
	rantiCache = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

	// trac-7653, trac-8125, trac-8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (trac-10098); must appease lint and evade compression
	allTypes = "*/".concat( "*" ),

	// Anchor tag for parsing the document origin
	originAnchor = document.createElement( "a" );

originAnchor.href = location.href;

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

		if ( isFunction( func ) ) {

			// For each dataType in the dataTypeExpression
			while ( ( dataType = dataTypes[ i++ ] ) ) {

				// Prepend if requested
				if ( dataType[ 0 ] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

				// Otherwise append
				} else {
					( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" &&
				!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		} );
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes trac-9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {

		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}

		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},

		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

			// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {

								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s.throws ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return {
								state: "parsererror",
								error: conv ? e : "No conversion from " + prev + " to " + current
							};
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend( {

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: location.href,
		type: "GET",
		isLocal: rlocalProtocol.test( location.protocol ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",

		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /\bxml\b/,
			html: /\bhtml/,
			json: /\bjson\b/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": JSON.parse,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,

			// URL without anti-cache param
			cacheURL,

			// Response headers
			responseHeadersString,
			responseHeaders,

			// timeout handle
			timeoutTimer,

			// Url cleanup var
			urlAnchor,

			// Request state (becomes false upon send and true upon completion)
			completed,

			// To know if global events are to be dispatched
			fireGlobals,

			// Loop variable
			i,

			// uncached part of the url
			uncached,

			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),

			// Callbacks context
			callbackContext = s.context || s,

			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context &&
				( callbackContext.nodeType || callbackContext.jquery ) ?
				jQuery( callbackContext ) :
				jQuery.event,

			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks( "once memory" ),

			// Status-dependent callbacks
			statusCode = s.statusCode || {},

			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},

			// Default abort message
			strAbort = "canceled",

			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( completed ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
								responseHeaders[ match[ 1 ].toLowerCase() + " " ] =
									( responseHeaders[ match[ 1 ].toLowerCase() + " " ] || [] )
										.concat( match[ 2 ] );
							}
						}
						match = responseHeaders[ key.toLowerCase() + " " ];
					}
					return match == null ? null : match.join( ", " );
				},

				// Raw string
				getAllResponseHeaders: function() {
					return completed ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					if ( completed == null ) {
						name = requestHeadersNames[ name.toLowerCase() ] =
							requestHeadersNames[ name.toLowerCase() ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( completed == null ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( completed ) {

							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						} else {

							// Lazy-add the new callbacks in a way that preserves old ones
							for ( code in map ) {
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR );

		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (trac-10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || location.href ) + "" )
			.replace( rprotocol, location.protocol + "//" );

		// Alias method option to type as per ticket trac-12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

		// A cross-domain request is in order when the origin doesn't match the current origin.
		if ( s.crossDomain == null ) {
			urlAnchor = document.createElement( "a" );

			// Support: IE <=8 - 11, Edge 12 - 15
			// IE throws exception on accessing the href property if url is malformed,
			// e.g. http://example.com:80x/
			try {
				urlAnchor.href = s.url;

				// Support: IE <=8 - 11 only
				// Anchor's host property isn't correctly set when s.url is relative
				urlAnchor.href = urlAnchor.href;
				s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
					urlAnchor.protocol + "//" + urlAnchor.host;
			} catch ( e ) {

				// If there is an error parsing the URL, assume it is crossDomain,
				// it can be rejected by the transport if it is invalid
				s.crossDomain = true;
			}
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( completed ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (trac-15118)
		fireGlobals = jQuery.event && s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		// Remove hash to simplify url manipulation
		cacheURL = s.url.replace( rhash, "" );

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// Remember the hash so we can put it back
			uncached = s.url.slice( cacheURL.length );

			// If data is available and should be processed, append data to url
			if ( s.data && ( s.processData || typeof s.data === "string" ) ) {
				cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

				// trac-9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add or update anti-cache param if needed
			if ( s.cache === false ) {
				cacheURL = cacheURL.replace( rantiCache, "$1" );
				uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce.guid++ ) +
					uncached;
			}

			// Put hash and anti-cache on the URL that will be requested (gh-1732)
			s.url = cacheURL + uncached;

		// Change '%20' to '+' if this is encoded form body content (gh-2658)
		} else if ( s.data && s.processData &&
			( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
			s.data = s.data.replace( r20, "+" );
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
				s.accepts[ s.dataTypes[ 0 ] ] +
					( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend &&
			( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

			// Abort if not done already and return
			return jqXHR.abort();
		}

		// Aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		completeDeferred.add( s.complete );
		jqXHR.done( s.success );
		jqXHR.fail( s.error );

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}

			// If request was aborted inside ajaxSend, stop there
			if ( completed ) {
				return jqXHR;
			}

			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = window.setTimeout( function() {
					jqXHR.abort( "timeout" );
				}, s.timeout );
			}

			try {
				completed = false;
				transport.send( requestHeaders, done );
			} catch ( e ) {

				// Rethrow post-completion exceptions
				if ( completed ) {
					throw e;
				}

				// Propagate others as results
				done( -1, e );
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Ignore repeat invocations
			if ( completed ) {
				return;
			}

			completed = true;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				window.clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Use a noop converter for missing script but not if jsonp
			if ( !isSuccess &&
				jQuery.inArray( "script", s.dataTypes ) > -1 &&
				jQuery.inArray( "json", s.dataTypes ) < 0 ) {
				s.converters[ "text script" ] = function() {};
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader( "Last-Modified" );
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader( "etag" );
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {

				// Extract error from statusText and normalize for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger( "ajaxStop" );
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
} );

jQuery.each( [ "get", "post" ], function( _i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {

		// Shift arguments if data argument was omitted
		if ( isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		// The url can be an options object (which then must have .url)
		return jQuery.ajax( jQuery.extend( {
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		}, jQuery.isPlainObject( url ) && url ) );
	};
} );

jQuery.ajaxPrefilter( function( s ) {
	var i;
	for ( i in s.headers ) {
		if ( i.toLowerCase() === "content-type" ) {
			s.contentType = s.headers[ i ] || "";
		}
	}
} );


jQuery._evalUrl = function( url, options, doc ) {
	return jQuery.ajax( {
		url: url,

		// Make this explicit, since user can override this through ajaxSetup (trac-11264)
		type: "GET",
		dataType: "script",
		cache: true,
		async: false,
		global: false,

		// Only evaluate the response if it is successful (gh-4126)
		// dataFilter is not invoked for failure responses, so using it instead
		// of the default converter is kludgy but it works.
		converters: {
			"text script": function() {}
		},
		dataFilter: function( response ) {
			jQuery.globalEval( response, options, doc );
		}
	} );
};


jQuery.fn.extend( {
	wrapAll: function( html ) {
		var wrap;

		if ( this[ 0 ] ) {
			if ( isFunction( html ) ) {
				html = html.call( this[ 0 ] );
			}

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map( function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			} ).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( isFunction( html ) ) {
			return this.each( function( i ) {
				jQuery( this ).wrapInner( html.call( this, i ) );
			} );
		}

		return this.each( function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		} );
	},

	wrap: function( html ) {
		var htmlIsFunction = isFunction( html );

		return this.each( function( i ) {
			jQuery( this ).wrapAll( htmlIsFunction ? html.call( this, i ) : html );
		} );
	},

	unwrap: function( selector ) {
		this.parent( selector ).not( "body" ).each( function() {
			jQuery( this ).replaceWith( this.childNodes );
		} );
		return this;
	}
} );


jQuery.expr.pseudos.hidden = function( elem ) {
	return !jQuery.expr.pseudos.visible( elem );
};
jQuery.expr.pseudos.visible = function( elem ) {
	return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
};




jQuery.ajaxSettings.xhr = function() {
	try {
		return new window.XMLHttpRequest();
	} catch ( e ) {}
};

var xhrSuccessStatus = {

		// File protocol always yields status code 0, assume 200
		0: 200,

		// Support: IE <=9 only
		// trac-1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport( function( options ) {
	var callback, errorCallback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr();

				xhr.open(
					options.type,
					options.url,
					options.async,
					options.username,
					options.password
				);

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
					headers[ "X-Requested-With" ] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							callback = errorCallback = xhr.onload =
								xhr.onerror = xhr.onabort = xhr.ontimeout =
									xhr.onreadystatechange = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {

								// Support: IE <=9 only
								// On a manual native abort, IE9 throws
								// errors on any property access that is not readyState
								if ( typeof xhr.status !== "number" ) {
									complete( 0, "error" );
								} else {
									complete(

										// File: protocol always yields status 0; see trac-8605, trac-14207
										xhr.status,
										xhr.statusText
									);
								}
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,

									// Support: IE <=9 only
									// IE9 has no XHR2 but throws on binary (trac-11426)
									// For XHR2 non-text, let the caller handle it (gh-2498)
									( xhr.responseType || "text" ) !== "text"  ||
									typeof xhr.responseText !== "string" ?
										{ binary: xhr.response } :
										{ text: xhr.responseText },
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				errorCallback = xhr.onerror = xhr.ontimeout = callback( "error" );

				// Support: IE 9 only
				// Use onreadystatechange to replace onabort
				// to handle uncaught aborts
				if ( xhr.onabort !== undefined ) {
					xhr.onabort = errorCallback;
				} else {
					xhr.onreadystatechange = function() {

						// Check readyState before timeout as it changes
						if ( xhr.readyState === 4 ) {

							// Allow onerror to be called first,
							// but that will not handle a native abort
							// Also, save errorCallback to a variable
							// as xhr.onerror cannot be accessed
							window.setTimeout( function() {
								if ( callback ) {
									errorCallback();
								}
							} );
						}
					};
				}

				// Create the abort callback
				callback = callback( "abort" );

				try {

					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {

					// trac-14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
jQuery.ajaxPrefilter( function( s ) {
	if ( s.crossDomain ) {
		s.contents.script = false;
	}
} );

// Install script dataType
jQuery.ajaxSetup( {
	accepts: {
		script: "text/javascript, application/javascript, " +
			"application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /\b(?:java|ecma)script\b/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
} );

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
} );

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {

	// This transport only deals with cross domain or forced-by-attrs requests
	if ( s.crossDomain || s.scriptAttrs ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery( "<script>" )
					.attr( s.scriptAttrs || {} )
					.prop( { charset: s.scriptCharset, src: s.url } )
					.on( "load error", callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					} );

				// Use native DOM manipulation to avoid our domManip AJAX trickery
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup( {
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce.guid++ ) );
		this[ callback ] = true;
		return callback;
	}
} );

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" &&
				( s.contentType || "" )
					.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
				rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters[ "script json" ] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// Force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always( function() {

			// If previous value didn't exist - remove it
			if ( overwritten === undefined ) {
				jQuery( window ).removeProp( callbackName );

			// Otherwise restore preexisting value
			} else {
				window[ callbackName ] = overwritten;
			}

			// Save back as free
			if ( s[ callbackName ] ) {

				// Make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// Save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		} );

		// Delegate to script
		return "script";
	}
} );




// Support: Safari 8 only
// In Safari 8 documents created via document.implementation.createHTMLDocument
// collapse sibling forms: the second one becomes a child of the first one.
// Because of that, this security measure has to be disabled in Safari 8.
// https://bugs.webkit.org/show_bug.cgi?id=137337
support.createHTMLDocument = ( function() {
	var body = document.implementation.createHTMLDocument( "" ).body;
	body.innerHTML = "<form></form><form></form>";
	return body.childNodes.length === 2;
} )();


// Argument "data" should be string of html
// context (optional): If specified, the fragment will be created in this context,
// defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( typeof data !== "string" ) {
		return [];
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}

	var base, parsed, scripts;

	if ( !context ) {

		// Stop scripts or inline event handlers from being executed immediately
		// by using document.implementation
		if ( support.createHTMLDocument ) {
			context = document.implementation.createHTMLDocument( "" );

			// Set the base href for the created document
			// so any parsed elements with URLs
			// are based on the document's URL (gh-2965)
			base = context.createElement( "base" );
			base.href = document.location.href;
			context.head.appendChild( base );
		} else {
			context = document;
		}
	}

	parsed = rsingleTag.exec( data );
	scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[ 1 ] ) ];
	}

	parsed = buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	var selector, type, response,
		self = this,
		off = url.indexOf( " " );

	if ( off > -1 ) {
		selector = stripAndCollapse( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax( {
			url: url,

			// If "type" variable is undefined, then "GET" method will be used.
			// Make value of this field explicit since
			// user can override it through ajaxSetup method
			type: type || "GET",
			dataType: "html",
			data: params
		} ).done( function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		// If the request succeeds, this function gets "data", "status", "jqXHR"
		// but they are ignored because response was set above.
		// If it fails, this function gets "jqXHR", "status", "error"
		} ).always( callback && function( jqXHR, status ) {
			self.each( function() {
				callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
			} );
		} );
	}

	return this;
};




jQuery.expr.pseudos.animated = function( elem ) {
	return jQuery.grep( jQuery.timers, function( fn ) {
		return elem === fn.elem;
	} ).length;
};




jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

		// Need to be able to calculate position if either
		// top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( isFunction( options ) ) {

			// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
			options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend( {

	// offset() relates an element's border box to the document origin
	offset: function( options ) {

		// Preserve chaining for setter
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each( function( i ) {
					jQuery.offset.setOffset( this, options, i );
				} );
		}

		var rect, win,
			elem = this[ 0 ];

		if ( !elem ) {
			return;
		}

		// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
		// Support: IE <=11 only
		// Running getBoundingClientRect on a
		// disconnected node in IE throws an error
		if ( !elem.getClientRects().length ) {
			return { top: 0, left: 0 };
		}

		// Get document-relative position by adding viewport scroll to viewport-relative gBCR
		rect = elem.getBoundingClientRect();
		win = elem.ownerDocument.defaultView;
		return {
			top: rect.top + win.pageYOffset,
			left: rect.left + win.pageXOffset
		};
	},

	// position() relates an element's margin box to its offset parent's padding box
	// This corresponds to the behavior of CSS absolute positioning
	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset, doc,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// position:fixed elements are offset from the viewport, which itself always has zero offset
		if ( jQuery.css( elem, "position" ) === "fixed" ) {

			// Assume position:fixed implies availability of getBoundingClientRect
			offset = elem.getBoundingClientRect();

		} else {
			offset = this.offset();

			// Account for the *real* offset parent, which can be the document or its root element
			// when a statically positioned element is identified
			doc = elem.ownerDocument;
			offsetParent = elem.offsetParent || doc.documentElement;
			while ( offsetParent &&
				( offsetParent === doc.body || offsetParent === doc.documentElement ) &&
				jQuery.css( offsetParent, "position" ) === "static" ) {

				offsetParent = offsetParent.parentNode;
			}
			if ( offsetParent && offsetParent !== elem && offsetParent.nodeType === 1 ) {

				// Incorporate borders into its offset, since they are outside its content origin
				parentOffset = jQuery( offsetParent ).offset();
				parentOffset.top += jQuery.css( offsetParent, "borderTopWidth", true );
				parentOffset.left += jQuery.css( offsetParent, "borderLeftWidth", true );
			}
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	// This method will return documentElement in the following cases:
	// 1) For the element inside the iframe without offsetParent, this method will return
	//    documentElement of the parent window
	// 2) For the hidden or detached element
	// 3) For body or html element, i.e. in case of the html node - it will return itself
	//
	// but those exceptions were never presented as a real life use-cases
	// and might be considered as more preferable results.
	//
	// This logic, however, is not guaranteed and can change at any point in the future
	offsetParent: function() {
		return this.map( function() {
			var offsetParent = this.offsetParent;

			while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || documentElement;
		} );
	}
} );

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {

			// Coalesce documents and windows
			var win;
			if ( isWindow( elem ) ) {
				win = elem;
			} else if ( elem.nodeType === 9 ) {
				win = elem.defaultView;
			}

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : win.pageXOffset,
					top ? val : win.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length );
	};
} );

// Support: Safari <=7 - 9.1, Chrome <=37 - 49
// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
// getComputedStyle returns percent when specified for top/left/bottom/right;
// rather than make the css module depend on the offset module, just check for it here
jQuery.each( [ "top", "left" ], function( _i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );

				// If curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
} );


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( {
		padding: "inner" + name,
		content: type,
		"": "outer" + name
	}, function( defaultExtra, funcName ) {

		// Margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( isWindow( elem ) ) {

					// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
					return funcName.indexOf( "outer" ) === 0 ?
						elem[ "inner" + name ] :
						elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?

					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable );
		};
	} );
} );


jQuery.each( [
	"ajaxStart",
	"ajaxStop",
	"ajaxComplete",
	"ajaxError",
	"ajaxSuccess",
	"ajaxSend"
], function( _i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
} );




jQuery.fn.extend( {

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {

		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ?
			this.off( selector, "**" ) :
			this.off( types, selector || "**", fn );
	},

	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
} );

jQuery.each(
	( "blur focus focusin focusout resize scroll click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup contextmenu" ).split( " " ),
	function( _i, name ) {

		// Handle event binding
		jQuery.fn[ name ] = function( data, fn ) {
			return arguments.length > 0 ?
				this.on( name, null, data, fn ) :
				this.trigger( name );
		};
	}
);




// Support: Android <=4.0 only
// Make sure we trim BOM and NBSP
// Require that the "whitespace run" starts from a non-whitespace
// to avoid O(N^2) behavior when the engine would try matching "\s+$" at each space position.
var rtrim = /^[\s\uFEFF\xA0]+|([^\s\uFEFF\xA0])[\s\uFEFF\xA0]+$/g;

// Bind a function to a context, optionally partially applying any
// arguments.
// jQuery.proxy is deprecated to promote standards (specifically Function#bind)
// However, it is not slated for removal any time soon
jQuery.proxy = function( fn, context ) {
	var tmp, args, proxy;

	if ( typeof context === "string" ) {
		tmp = fn[ context ];
		context = fn;
		fn = tmp;
	}

	// Quick check to determine if target is callable, in the spec
	// this throws a TypeError, but we will just return undefined.
	if ( !isFunction( fn ) ) {
		return undefined;
	}

	// Simulated bind
	args = slice.call( arguments, 2 );
	proxy = function() {
		return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
	};

	// Set the guid of unique handler to the same of original handler, so it can be removed
	proxy.guid = fn.guid = fn.guid || jQuery.guid++;

	return proxy;
};

jQuery.holdReady = function( hold ) {
	if ( hold ) {
		jQuery.readyWait++;
	} else {
		jQuery.ready( true );
	}
};
jQuery.isArray = Array.isArray;
jQuery.parseJSON = JSON.parse;
jQuery.nodeName = nodeName;
jQuery.isFunction = isFunction;
jQuery.isWindow = isWindow;
jQuery.camelCase = camelCase;
jQuery.type = toType;

jQuery.now = Date.now;

jQuery.isNumeric = function( obj ) {

	// As of jQuery 3.0, isNumeric is limited to
	// strings and numbers (primitives or objects)
	// that can be coerced to finite numbers (gh-2662)
	var type = jQuery.type( obj );
	return ( type === "number" || type === "string" ) &&

		// parseFloat NaNs numeric-cast false positives ("")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		!isNaN( obj - parseFloat( obj ) );
};

jQuery.trim = function( text ) {
	return text == null ?
		"" :
		( text + "" ).replace( rtrim, "$1" );
};



// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	} );
}




var

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in AMD
// (trac-7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (trac-13566)
if ( typeof noGlobal === "undefined" ) {
	window.jQuery = window.$ = jQuery;
}




return jQuery;
} );

},{}],14:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[12]);
