var gui = GUI();
var player = new Player({});
var rovData = {};
var vacuumTest = false;
var confirmWaterTight = false;



/************************
 *
 *
 * Video Socket - Used for camera transmit
 *
 *
 ************************/
player.ws = new Socket(location.hostname, 8282);
player.ws.on('open', () => { player.ws.send("REQUESTSTREAM") })
player.ws.on('message', (e) => {
  if (typeof e.data == "string") console.log(e.data, Date.now())
  if (player.skipMessages) return
  var frame = new Uint8Array(e.data)
  player.decode(frame)
})
$(".fvideo").html(player.canvas)

/************************
 *
 *
 * GUI Class - Initializing GUI functionality
 *
 *
 ************************/

// gui.init();
// gui.log("Initializing NodeROV GUI");

const ws = new Socket(location.hostname, 8080)
ws.on('message', (e) => {

  if (typeof e.data != 'string') {
    console.log("Unknown data")
    return false
  }

  const data = e.data.split(' ')
  const cmd = data.shift()

  if (cmd == "hb") {

    console.log(`latency: ${data[1]}`)
    ws.send(`hb ${data[0]}`)
  }
  else if (cmd == "log") {

    console.log(data.join(" "))
  }
  else {

    console.log(`Unhandeled command: ${cmd} (${JSON.stringify(data)})`)
    console.log(data)
  }
})
ws.on('close', (error) => {
  console.log(error)
})


$("canvas").each(function () { $(this).get(0).height = $(this).height(); $(this).get(0).width = $(this).width(); });

// Darhboard Drawer
const dashboard = new Dashboard($(".fdatagraphics canvas").get(0))
setTimeout(() => { dashboard.draw() }, 100)


// HUDBlock
const hudBlock = new HUDBlock($(".fvitals canvas").get(0))
setTimeout(() => { hudBlock.draw() }, 100)

// Controls
const controls = new Controls()
setInterval(() => { console.log(controls.getControls()) }, 100)



// let d = new Date().toISOString();
// $("time:first").html(d.split('T')[1].split('.')[0] + " UTC");
// $("time:last").html(d.split('T')[0]);

// // gui.drawAccelerometer(rovData.pitch, rovData.roll);

// requestAnimationFrame(systemLoop);
// gui.setInfo(1, 0, "Int. temp:");
// gui.setInfo(2, 0, "Int. pressure:");
// gui.setInfo(3, 0, "Ext. temp:");
// gui.setInfo(4, 0, "Ext. pressure:");
// gui.setInfo(5, 0, "Core temp:");
// gui.setInfo(6, 0, "mAh:");
// gui.setInfo(7, 0, "Gain:");
// gui.setInfo(8, 0, "Turns:");
// gui.setInfo(9, 0, "Heading Hold:");
// gui.setInfo(10, 0, "Depth Hold:");
// gui.setInfo(11, "", "-");
// gui.setInfo(12, 0, "Ping:");

// /************************
//  *
//  *
//  * Controls on press e.t.c
//  *
//  *
//  ************************/
// controls.onPress(controls.map.gainUp, function () { socket.send("setgain " + (rovData.gain + 50)); });
// controls.onPress(controls.map.gainDown, function () { socket.send("setgain " + (rovData.gain - 50)); });
// controls.onPress(controls.map.lightsUp, function () { socket.send("setlight 0 " + (rovData.lights[0] + 10)); socket.send("setlight 1 " + (rovData.lights[1] + 10)); }, 100);
// controls.onPress(controls.map.lightsDown, function () { socket.send("setlight 0 " + (rovData.lights[0] - 10)); socket.send("setlight 1 " + (rovData.lights[1] - 10)); }, 100);
// controls.onPress(controls.map.cameraUp, function () { socket.send("setcamera " + (rovData.cameraPosition - 1)); }, 10);
// controls.onPress(controls.map.cameraDown, function () { socket.send("setcamera " + (rovData.cameraPosition + 1)); }, 10);
// controls.onPress(controls.map.fullscreen, function () { gui.pressButton(7); })
// controls.onPress(controls.map.arm, function () { socket.send("arm"); });
// controls.onPress(controls.map.disarm, function () { socket.send("disarm"); });
// controls.onPress(controls.map.depthhold, function () { socket.send("depthhold"); });
// controls.onPress(controls.map.gripOpen, function () { socket.send("gripopen"); }, 50);
// controls.onPress(controls.map.gripClose, function () { socket.send("gripclose"); }, 50);

// /************************
//  *
//  *
//  * Data Socket - Used for telemetry
//  *
//  *
//  ************************/

// var voltWarnLevel = 0;

// socket.connect(location.hostname, 8080);
// socket.log = function (text) { gui.log("WebSocket: " + text); }
// socket.on("hb", function (time) {
//   time = time.split(" ");
//   socket.send("hb " + time[0]);
//   gui.setInfo(12, time[1])
// })
// socket.on("telemetryData", function (data) {
//   rovData = JSON.parse(data);

//   gui.setInfo(1, parseFloat(rovData.inside.temp).toFixed(2))
//   gui.setInfo(2, parseFloat(rovData.inside.pressure / 1000 * 14.5037738).toFixed(2))
//   gui.setInfo(3, parseFloat(rovData.outside.temp).toFixed(2))
//   gui.setInfo(4, parseFloat(rovData.outside.pressure / 1000 * 14.5037738).toFixed(2))

//   gui.setInfo(5, parseFloat(rovData.inside.coreTemp).toFixed(2))
//   gui.setInfo(6, parseInt(rovData.mAmpUsed))
//   gui.setInfo(7, parseInt(rovData.gain))
//   gui.setInfo(8, parseInt(rovData.heading.turns))

//   gui.setInfo(9, rovData.heading.hold ? parseInt(rovData.heading.totalHeading) + "/" + parseInt(rovData.heading.wanted) : "OFF")
//   //gui.setInfo(11, "Unused")
//   //gui.setInfo(12, "Unused")


//   // Update lights gui
//   for (i in rovData.lights) { gui.setButtonState(2 * i, rovData.lights[i] > 0); }

//   // Update armed gui
//   gui.setButtonState(1, rovData.armed);
//   gui.setButtonState(5, rovData.depth.hold);
//   gui.setButtonState(4, rovData.heading.hold);

//   var insidePressure = parseFloat(rovData.inside.pressure / 1000 * 14.5037738).toFixed(2);
//   if (insidePressure < 14 && !vacuumTest) {
//     popup("Vacuum test - Stage 1", "<p>Starting automatic vacuum test due to lower internal pressure.<br />Be sure the LiPo battery is not inside and you use a vacuum safe battery.<br /><br />Current pressure is: <span class='currpress'>" + insidePressure + "</span></p>");
//     gui.log("Vacuum Test: Stage 1 starting")
//     vacuumTest = 1;
//   }
//   else if (insidePressure < 12 && insidePressure > 4.5 && vacuumTest == 1) {
//     $(".currpress").html(insidePressure);
//   }
//   else if (insidePressure <= 5 && vacuumTest == 1) {
//     popup("Vacuum test - Stage 2", "<p>Vacuum test at wanted pressure. Stop pumping now:<br /><br />Time passed: <span class='timepassed'>0</span> sec of 900<br />Current pressure is: <span class='currpress'>" + insidePressure + "</span></p>");
//     gui.log("Vacuum Test: Stage 2 starting")
//     vacuumTest = Date.now();
//   }
//   else if (vacuumTest && insidePressure > 14) {
//     popup_hide();
//     vacuumTest = false;
//     gui.log("Vacuum Test: Cancelled")
//   }
//   if (vacuumTest >= 4) {
//     var passed = (Date.now() - vacuumTest) / 1000;
//     $(".timepassed").html(Math.round(passed));
//     $(".currpress").html(insidePressure);

//     if (passed > 900 && insidePressure <= 5) {
//       vacuumTest = 3;
//       gui.log("Vacuum Test: Passed, pressure after 15 minutes are " + insidePressure + " PSI");

//       popup("Vacuum test - Passed", "<p>ROV seems tight, internal pressure did not go above 5PSI in the period of 60 seconds.<br /><br />Release pressure before you continue then press 'Confirm'</p>", "Confirm", false, function () {
//         vacuumTest = false;
//         popup_hide();
//       });
//     }
//     else if (insidePressure > 5) {
//       vacuumTest = 3;
//       gui.log("Vacuum Test: FAILED, pressure after " + (passed / 60) + " minutes are " + insidePressure + " PSI");
//       popup("Vacuum test - Fail", "<p>ROV seems leaky, internal pressure did pass 4.5PSI during the test period.<br />It hit " + insidePressure + " in only " + passed + " seconds..<br /><br />Release pressure before you continue then press 'Confirm' then check for leaks</p>", "Confirm", false, function () {
//         popup_hide();
//         vacuumTest = false;
//       });
//     }
//   }

//   // On Screen Warnings:
//   if (rovData.volt < 10.5 && voltWarnLevel == 0) {
//     gui.overlayText("Voltage warning", 3);
//     voltWarnLevel = 1;
//   }
//   else if (rovData.volt < 9.8 && voltWarnLevel == 1) {
//     gui.overlayText("Voltage warning", 3);
//     voltWarnLevel = 2;
//   }
//   else if (rovData.volt < 9 && voltWarnLevel == 2) {
//     gui.overlayText("Battery dying", 100);
//     voltWarnLevel = 3;
//   }


// });
// socket.on("log", function (data) { data = JSON.parse(data); gui.log(data.message, data.time, true); })


// /************************
//  *
//  *
//  * Start system loop
//  *
//  *
//  ************************/

// function systemLoop() {
//   let d = new Date().toISOString();
//   $("time:first").html(d.split('T')[1].split('.')[0] + " UTC");
//   $("time:last").html(d.split('T')[0]);

//   requestAnimationFrame(systemLoop);
// }

// systemLoop();




// function popup(title, message, button1, button2, button1_callback, button2_callback) {
//   if (!button1_callback && button1) {
//     button1_callback = popup_hide;
//   }
//   if (!button2_callback && button2) {
//     button2_callback = popup_hide;
//   }

//   $(".msgbox button").css("display", "none");
//   $(".msgbox button").off();

//   if (button1) {
//     $(".msgbox button:first").html(button1);
//     $(".msgbox button:first").on('click', button1_callback);
//     $(".msgbox button:first").css("display", "");
//   }
//   if (button2) {
//     $(".msgbox button:last").html(button2);
//     $(".msgbox button:last").on('click', button2_callback);
//     $(".msgbox button:last").css("display", "");
//   }

//   $(".msgbox h1").html(title);
//   $(".msgbox div:first").html(message);
//   $(".msgbox").fadeIn();
//   $(".msgbox-bg").fadeIn();

//   $(".msgbox").css("margin-top", $(".msgbox").height() * -1);
// }

// function popup_hide() {
//   $(".msgbox").fadeOut();
//   $(".msgbox-bg").fadeOut();
// }

// $(".msgbox").keyup(function (e) {
//   e.preventDefault();
//   if (e.keyCode == 13) $(".msgbox button:first").click();
//   if (e.keyCode == 27) $(".msgbox button:last").click();
// });
