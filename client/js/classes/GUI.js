import EventEmitter from './EventEmitter.js';

export default class GUI extends EventEmitter {

    constructor() {
        super();
       
        this.accelCanvas = null;
        this.compassCanvas = null;
        this.compassRose = new Image();
        this.dataGraphCanvasContext = null;
        this.compassRose.src = 'gfx/compass_rose.png';
    };

    map(x, in_min, in_max, out_min, out_max) {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    };

    log(text, time, doNotEmit) {
        if (time == undefined) time = Date.now();

        if(!doNotEmit) super.emit("log", text, time);

        let d = new Date(time).toISOString();
        let timestamp = d.split('T')[1].split('.')[0] + " | " + d.split('T')[0];

        const table = document.getElementById("logTable")
        const tr = document.createElement("tr")
        tr.innerHTML = "<th>" + timestamp + "</th><td>" + text + "</td>";
        table.prepend(tr);
    };

    setButton(name, text, callback) {
        const btn = document.getElementsByName(name)[0];
        if (!btn) return false;
        btn.innerHTML = text;
        btn.onclick = (e) => callback(e);
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
        const overlay = document.getElementById("overlay");

        overlay.innerHTML = message;
        overlay.style.display = "block";
        overlay.style.opacity = 1;
        setTimeout(() => {
            overlay.style.opacity = 0;
        }, time);
    };

    setInfo(no, value, titleText = false) {
        no--;
        let parent = document.getElementsByClassName("field data")[0];
        let child = parent.getElementsByTagName("li")[no];
        let title = child.getElementsByTagName("b")[0];
        let text = child.getElementsByTagName("span")[0];

        if(titleText) title.innerHTML = titleText;
        text.innerHTML = value;
    };

}