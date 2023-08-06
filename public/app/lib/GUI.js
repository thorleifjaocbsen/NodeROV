const EventEmitter = require('./EventEmitter.js');

module.exports = class GUI extends EventEmitter {

    constructor() {
        super();

        this.canvas = null;
        this.compassRose = new Image();
        this.compassRose.src = 'gfx/compass_rose.png';
    };

    map(x, in_min, in_max, out_min, out_max) {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    };

    showChip(id, value, options = {}) {

        // if chip does not exist, create it
        let chip = document.getElementById(`chip_${id}`);
        if (!chip) {
            chip = document.createElement("chip");
            chip.id = `chip_${id}`;
            chip.innerHTML = `<title></title><value>${value}</value>`;
            document.body.appendChild(chip);
        }

        // Merge existing options if exists
        if (chip.options) options = { ...chip.options, ...options };

        // Add unit to value if exists
        if (options.unit) {
            if (options.sup) value += `<sup>${options.unit}</sup>`;
            else if (options.sub) value += `<sub>${options.unit}</sub>`;
            else value += options.unit;
        }

        // Set value
        chip.getElementsByTagName("value")[0].innerHTML = value;

        // set options
        if (options.color) chip.style.backgroundColor = options.color;
        if (options.x) chip.style.left = `${options.x}px`;
        if (options.y) chip.style.top = `${options.y}px`;
        if (options.title) chip.getElementsByTagName("title")[0].innerHTML = options.title;
        if (options.rightAlign) chip.classList.add("right");
        else chip.classList.remove("right");

        // Save options
        chip.options = options;
    }

    showButtons() {
        // Show all buttons:
        const buttons = document.getElementsByTagName("button");
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].style.display = "block";
        }
    }

    ifButtonVisible() {
        // Show all buttons:
        const buttons = document.getElementsByTagName("button");
        for (let i = 0; i < buttons.length; i++) {
            if(buttons[i].style.display == "block") return true;
        }
        return false;
    }

    hideAllButtons() {
        // Hide all buttons:
        const buttons = document.getElementsByTagName("button");
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].style.display = "none";
        }
    }

    button(id, options = {}) {

        // if chip does not exist, create it
        let button = document.getElementById(`button_${id}`);
        if (!button) {
            button = document.createElement("button");
            button.id = `button_${id}`;
            button.name = id;
            document.body.appendChild(button);
            button.onclick = () => this.emit("click", button);
        }

        // Merge existing options if exists
        if (button.options) options = { ...button.options, ...options };

        // set options
        if (options.color) button.style.backgroundColor = options.color;
        if (options.x) button.style.left = `${options.x}px`;
        if (options.y) button.style.top = `${options.y}px`;
        if (options.title) button.innerHTML = options.title;
        


 
        // Save options
        button.options = options;
    }


    drawCompass(heading) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.canvas.getContext("2d");

        ctx.clearRect(0, 0, width, height);
    
        heading = Math.round(heading)
    
        // Rose
        const left = (width / 2 - 74) - ((1200 / 360) * heading);
        ctx.drawImage(this.compassRose, left, 0);
        ctx.drawImage(this.compassRose, -1200 + left, 0);
        ctx.drawImage(this.compassRose, 1200 + left, 0);
    
        // // Heading background
        // ctx.save()
        // ctx.beginPath()
        // ctx.fillStyle = "rgba(0,0,255,0.2)";
        // ctx.strokeStyle = "rgba(255,255,255,1)";
        // ctx.lineWidth = 2;
        // ctx.rect(width/2-35,-2,70,30)
        // ctx.stroke()
        // ctx.fill()
        // ctx.closePath()
        // ctx.restore()
    
        // // Heading
        // ctx.font = "bold 25px Open Sans";
        // ctx.textBaseline = "middle";
        // ctx.textAlign = "center";
        // ctx.fillStyle = "rgb(255,255,255)";
        // ctx.fillText(heading.toString().padStart(3,'0'), width/2, 15);
      }

}