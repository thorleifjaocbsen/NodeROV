import GUI from './classes/GUI.js';
import Socket from './classes/Socket.js';
import Controls from './classes/Controls.js';
import Video from './classes/Video.js';
import HUDBlock from './classes/HUDBlock.js';
import LineChart from './classes/LineChart.js';
import Dashboard from './classes/Dashboard.js';

const gui = new GUI();
const controls = new Controls();
const socket = new Socket();
const video = new Video(document.getElementById("video"));

const dashboard = new Dashboard(document.getElementById("dataGraphicsCanvas"))
const hudBlock = new HUDBlock(document.getElementById("HUD"))
const lineChart = new LineChart(document.getElementById("HUD"))

/************************
 * Video Socket - Used for camera transmit
 ************************/
video.connect(location.hostname, 8282);


/************************
 * GUI Class - Initializing GUI functionality
 ************************/

gui.log("Initializing NodeROV GUI");

gui.on("log", (data) => {
    socket.send(`clog ${data}`);
})


gui.accelCanvas = document.getElementById("accelerometerCanvas");
gui.compassCanvas = document.getElementById("compassCanvas");
gui.dataGraphCanvas = document.getElementById("dataGraphicsCanvas");

gui.setButton("gui-controls-button-1", "LEFT LIGHT", function (e) {
    if (gui.getButtonState(0)) {
        socket.send("setlight 0 0");
    } else {
        e.target.className = "selected";
        socket.send("setlight 0 100");
    }
});
gui.setButton("gui-controls-button-3", "RIGHT LIGHT", function (e) {
    if (gui.getButtonState(2)) {
        socket.send("setlight 1 0");
    } else {
        e.target.className = "selected";
        socket.send("setlight 1 100");
    }
});

gui.overlayText("Connecting to NodeROV...", 2000);

gui.setButton("gui-controls-button-5", "Depthchart", () => {
    if (gui.buttonState("gui-controls-button-5")) {
        hudBlock.draw();
        gui.buttonState("gui-controls-button-5", false);
    } else {
        lineChart.draw();
        gui.buttonState("gui-controls-button-5", true);
    }
});

gui.setButton("gui-controls-button-2", "ARM", () => { socket.send("togglearm"); });
gui.setButton("gui-controls-button-4", "HEADING HOLD", () => { socket.send("headinghold"); });
gui.setButton("gui-controls-button-6", "DEPTH HOLD", () => { socket.send("depthhold"); });
gui.setButton("gui-controls-button-7", "RECORD", () => {
    if (gui.buttonState("gui-controls-button-7")) {
        video.stopRecord();
        gui.buttonState("gui-controls-button-7", false);
    } else {
        video.startRecord();
        gui.buttonState("gui-controls-button-7", true);
    }

});
video.on("recordStateChange", (state) => {
    gui.buttonState("gui-controls-button-7", state == "recording");
    gui.log(`Recording state changed to ${state}`);
})

gui.setButton("gui-controls-button-8", "FULLSCREEN", () => {
    const videoEl = document.getElementById("video");
    videoEl.classList.toggle("fullscreen");
    gui.buttonState("gui-controls-button-8", videoEl.classList.contains("fullscreen"));
    videoEl.onclick = () => { gui.pressButton("gui-controls-button-8"); };
});
gui.setButton("gui-controls-button-9", "SET FLAT", () => { socket.send("setflat"); });
gui.setButton("gui-controls-button-10", "CALIBRATE GYRO", () => { socket.send("calibrategyro"); });
gui.setButton("gui-log-button-1", "ADD EVENT", () => {
    var msg = "<p>Enter message: <input id='eventmsg' type='text' value='' /></p>";
    popup("Add event", msg, "Add", "Cancel", function () {
        gui.log("Custom event: " + $("#eventmsg").val());
        popup_hide();
    });
    $("#eventmsg").focus();
});
gui.setButton("gui-controls-button-11", "CPU FAN", () => {
    const newState = !gui.buttonState("gui-controls-button-11");
    gui.buttonState("gui-controls-button-11", newState);
    socket.send("fanState " + newState);
});
gui.setButton("gui-log-button-2", "SCREENSHOT", (e) => {
    var data = player.canvas.toDataURL("image/jpeg", 1);
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
gui.setInfo(9, "", "");
gui.setInfo(10, "", "");
gui.setInfo(11, "", "");
gui.setInfo(12, 0, "Latency:");

/************************
  * Controls on press e.t.c
 ************************/
controls.onPress(controls.map.gainIncrease, () => { socket.send("gainIncrease"); });
controls.onPress(controls.map.gainDecrease, () => { socket.send("gainDecrease"); });
controls.onPress(controls.map.lightsDimBrighter, () => { socket.send("lightsDimBrighter"); }, 250);
controls.onPress(controls.map.lightsDimDarker, () => { socket.send("lightsDimDarker"); }, 250);
controls.onPress(controls.map.cameraTiltUp, () => { socket.send("cameraTiltUp"); }, 250);
controls.onPress(controls.map.cameraTiltDown, () => { socket.send("cameraTiltDown"); }, 250);
controls.onPress(controls.map.fullscreen, () => { gui.pressButton("gui-controls-button-8"); }, 1000)
controls.onPress(controls.map.arm, () => { socket.send("arm"); });
controls.onPress(controls.map.disarm, () => { socket.send("disarm"); });
controls.onPress(controls.map.depthHoldToggle, () => { socket.send("depthHoldToggle"); });
controls.onPress(controls.map.headingHoldToggle, () => { socket.send("headingHoldToggle"); });
controls.onPress(controls.map.gripperOpen, (value) => {  console.log(value);socket.send("gripperOpen " + value); }, 50);
controls.onPress(controls.map.gripperClose, (value) => { socket.send("gripperClose " + value); }, 50);

controls.onPress(controls.map.headingHoldDisable, () => { socket.send("headingHoldDisable"); });
controls.onPress(controls.map.headingHoldEnable, () => { socket.send("headingHoldEnable"); }, 250);

/************************
 *
 *
 * Data Socket - Used for telemetry
 *
 *
 ************************/

socket.connect(location.hostname, location.port);
socket.on("hb", (data) => {
    const [sendtTime, latency] = data.split(" ");
    socket.send("hb " + sendtTime);
    gui.setInfo(12, latency)
});

socket.on("env", (data) => {

    data = data.split(" ");
    const type = data[0];
    const value = data[1];

    switch (type) {

        case "iTemperature":
            gui.setInfo(1, value);
            break;

        case "iPressure":
            gui.setInfo(2, value);
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
            dashboard.setScale(5, "MAH USED", parseInt(value), 5500, 1000);
            dashboard.draw();
            break;

        case "roll":
            if (!gui.buttonState("gui-controls-button-5")) hudBlock.draw(value, undefined, undefined);
            break;

        case "pitch":
            if (!gui.buttonState("gui-controls-button-5")) hudBlock.draw(undefined, value, undefined)
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

        default:
            gui.log(`Unknown enviroment type received: ${type} (${value})`);
            return;
    }
});

socket.on("log", function (data) {
    try {
        data = JSON.parse(data);
        gui.log(data.message, data.time, true);
    } catch (e) { }
})


/************************
 *
 *
 * Start system loop
 *
 *
 ************************/
function systemLoop() {

    controls.update();
    // // ! < add it below to enable gp warning again (before controls.warned)
    // if (!controls.checkGamepad() && controls.warned) {
    //     popup("Connect Gamepad", "Please connect the gamepad to continue.");
    //     controls.warned = true;
    // } else if (controls.checkGamepad() && controls.warned) {
    //     popup_hide();
    //     controls.warned = false;
    // } else if (confirmWaterTight == false && controls.warned == false) {
    //     //popup("Confirm water tightness of chambers", "Check for loose connectors and that vacuum plugs are connected before pressing confirm!", "Confirm");
    //     confirmWaterTight = true;
    // }

    requestAnimationFrame(systemLoop);
}
systemLoop();

/************************
 *
 *
 * Clock
 *
 *
 ************************/
setInterval(() => {
    let d = new Date().toISOString();
    document.getElementsByTagName("time")[0].innerHTML = d.split('T')[1].split('.')[0] + " UTC";
    document.getElementsByTagName("time")[1].innerHTML = d.split('T')[0];
}, 1000);

/*

function popup(title, message, button1, button2, button1_callback, button2_callback) {
    if (!button1_callback && button1) {
        button1_callback = popup_hide;
    }
    if (!button2_callback && button2) {
        button2_callback = popup_hide;
    }

    $(".msgbox button").css("display", "none");
    $(".msgbox button").off();

    if (button1) {
        $(".msgbox button:first").html(button1);
        $(".msgbox button:first").on('click', button1_callback);
        $(".msgbox button:first").css("display", "");
    }
    if (button2) {
        $(".msgbox button:last").html(button2);
        $(".msgbox button:last").on('click', button2_callback);
        $(".msgbox button:last").css("display", "");
    }

    $(".msgbox h1").html(title);
    $(".msgbox div:first").html(message);
    $(".msgbox").fadeIn();
    $(".msgbox-bg").fadeIn();

    $(".msgbox").css("margin-top", $(".msgbox").height() * -1);
}

function popup_hide() {
    $(".msgbox").fadeOut();
    $(".msgbox-bg").fadeOut();
}

$(".msgbox").keyup(function (e) {
    e.preventDefault();
    if (e.keyCode == 13) $(".msgbox button:first").click();
    if (e.keyCode == 27) $(".msgbox button:last").click();
});*/