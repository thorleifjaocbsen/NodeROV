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

gui.setButton("gui-controls-button-12", "Magnometer Calibration", () => {
    
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
            if (value == true) {
                gui.overlayText("LEAK DETECTED", 2000);
            }
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
            gui.log(`Heading hold set to: ${value.setPoint}`)
            hudBlock.headingHoldPosition = value.setPoint;
            $("input[name=headingP").val(value.p);
            $("input[name=headingI").val(value.i);
            $("input[name=headingD").val(value.d);
            break;

        case 'depthHold':
            gui.buttonState("gui-controls-button-6", value.setPoint !== false);
            gui.log(`Depth hold set to: ${value.setPoint}`)
            lineChart.setDepthHoldLine(value.setPoint);
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