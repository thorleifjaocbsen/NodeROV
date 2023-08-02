const $ = require('jquery');
const Socket = require('./lib/Socket.js')
const Video = require('./lib/Video.js')
const Controls = require('./lib/Controls.js')
const GUI = require('./lib/GUI.js')

/* Initialize classes */
const socket = new Socket();
const video = new Video($('#video')[0]);
const controls = new Controls();
const gui = new GUI();

/************************
  * Controls on press e.t.c
 ************************/
controls.update(); /* Start update loop */
window.c = controls;
controls.onPress("adjustGain", (step) => { socket.send(`adjustGain ${step}`); });
controls.onPress("adjustCamera", (step) => { socket.send(`adjustCamera ${step}`); }, 250);
controls.onPress("centerCamera", () => { socket.send(`centerCamera`); }, 250);

controls.onPress("adjustLight", (step) => { socket.send(`adjustLight ${step}`); }, 250);
controls.onPress("fullScreen", () => { gui.pressButton("gui-controls-button-8"); }, 1000)
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

/* Configure socket */
socket.connect(`wss://${location.hostname}:8000`);
socket.on("hb", (data) => {
    const [sendtTime, latency] = data.split(" ");
    socket.send("hb " + sendtTime);
    gui.showChip("latency", latency);
});

gui.showChip("cpuTemperature", "0", { title: "Temp", unit: "°", sup: true, x: 730, y: 330, rightAlign: true });
gui.showChip("cpuLoad", "0", { title: "Load", unit: "%", sub: true, x: 730, y: 380, rightAlign: true });
gui.showChip("latency", "0", { title: "Latency", unit: "ms", sub: true, x: 730, y: 430, rightAlign: true });

gui.showChip("depth", "0", { title: "Depth", unit: "m", sub: true, x: 730, y: 10, rightAlign: true });
gui.showChip("eTemperature", "0", { title: "Water", unit: "°", sup: true, x: 730, y: 60, rightAlign: true });

gui.showChip("turns", "3.2", { title: "Turns", x: 10, y: 10 });
gui.showChip("heading", "360", { title: "Heading", x: 10, y: 60 });


gui.showChip("voltage", "12.3", { title: "Voltage", unit: "V", sub: true, x: 10, y: 330 });
gui.showChip("current", "13.2", { title: "Current", unit: "A", sub: true, x: 10, y: 380 });
gui.showChip("accumulatedMah", "3212", { title: "MAH", unit: "mA", sub: true, x: 10, y: 430 });

gui.canvas = $("#dataGraphicsCanvas")[0];

socket.on("binary", (data) => {
    video.decodeFrame(data);
});

socket.on("data", (data) => {
    let type, value; 
    try {
        data = JSON.parse(data);
        type = data.type;
        value = data.value;
    }
    catch(err) {
        console.log(`Unable to parse ${data}`)
    }
    switch (type) {

        case "iTemperature": // gui.showChip("temperature", "Temperature", `${value}<sup>°</sup>`, 730, 380);
        case "iPressure": // gui.setInfo(2, Math.round(value * 0.145038) / 10 + " PSI");
        case "iHumidity": // gui.setInfo(3, value + "%");
        case "ePressure": // dashboard.setScale(0, "PRESSURE", value, 1300, 30);
        case "leak": // gui.setInfo(4, value);
            break;

        case "eTemperature":
        case "depth":
        case "voltage":
        case "current":
        case "accumulatedMah":
        case 'cpuLoad':
        case 'cpuTemperature':
            gui.showChip(type, value);
            break;

        case "roll":
            // if (!gui.buttonState("gui-controls-button-5")) hudBlock.draw(undefined, value, undefined);
            break;

        case "pitch":
            // if (!gui.buttonState("gui-controls-button-5")) hudBlock.draw(value, undefined, undefined)
            break;

        case "heading":
            gui.drawCompass(value);
            gui.showChip("heading", value);        
            break;

        case 'memoryUsed':
            // gui.setInfo(7, Math.round(value * 10) / 10 + "%");
            break;

        case 'diskUsed':
            // gui.setInfo(8, Math.round(value * 10) / 10 + "%");
            break;

        case 'gain':
            // gui.setInfo(9, value);
            break;
        
        case 'camera':
            // gui.setInfo(10, value);
            break;
        
        case 'light':
            // gui.setInfo(11, value);
            break;

        case 'headingHold':
            console.log(value, typeof value);
            // gui.buttonState("gui-controls-button-4", !isNaN(value));
            break;

        case 'depthHold':
            // gui.buttonState("gui-controls-button-6", !isNaN(value));
            break;

        case 'armed':
            // gui.buttonState("gui-controls-button-2", value);
            break;

        default:
            // gui.log(`Unknown enviroment type received: ${type} (${value})`, undefined, undefined, "warn");
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
    return;
    try {
        data = JSON.parse(data);
        console.log(data);
        data.forEach(thruster => {
            dashboard.setThruster(thruster.pin, thruster.percentage);
        });

    } catch (e) { } 
});