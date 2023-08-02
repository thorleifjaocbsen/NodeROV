
$("chip").each((id, chip) => {
    makeDraggable(chip);
});

function makeDraggable(el) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    console.log(el);
    document.ontouchstart  = (e) => { e.preventDefault();console.log("touchstart"); };
    document.ontouchmove  = (e) => { e.preventDefault();console.log("ontouchmove"); };
    document.ontouchend  = (e) => { e.preventDefault();console.log("ontouchend"); };
    document.onmousedown  = (e) => { e.preventDefault();console.log("onmousedown"); };
    document.onmousemove  = (e) => { e.preventDefault();console.log("onmousemove"); };
    document.onmouseup  = (e) => { e.preventDefault(); console.log("onmouseup"); };
    // el.onmousedown = mouseDown;
    function mouseDown(e) {
        console.log("Ye");
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = (e.clientX || e.targetTouches[0].pageX);
        pos4 = (e.clientY || e.targetTouches[0].pageY);
        document.onmouseup = closeDragElement;
        document.ontouchend = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;    
        document.ontouchmove = elementDrag;    
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - (e.clientX || e.targetTouches[0].pageX);
        pos2 = pos4 - (e.clientY || e.targetTouches[0].pageY);
        pos3 = e.clientX || e.targetTouches[0].pageX;
        pos4 = e.clientY || e.targetTouches[0].pageY;
        // set the element's new position:
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
      }

      function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
      }
}

// function dragElement(elmnt) {
//     var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
//     if (document.getElementById(elmnt.id + "header")) {
//       // if present, the header is where you move the DIV from:
//       document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
//     } else {
//       // otherwise, move the DIV from anywhere inside the DIV:
//       elmnt.onmousedown = dragMouseDown;
//     }
  
//     function dragMouseDown(e) {
//       e = e || window.event;
//       e.preventDefault();
//       // get the mouse cursor position at startup:
//       pos3 = e.clientX;
//       pos4 = e.clientY;
//       document.onmouseup = closeDragElement;
//       // call a function whenever the cursor moves:
//       document.onmousemove = elementDrag;
//     }
  
//     function elementDrag(e) {
//       e = e || window.event;
//       e.preventDefault();
//       // calculate the new cursor position:
//       pos1 = pos3 - e.clientX;
//       pos2 = pos4 - e.clientY;
//       pos3 = e.clientX;
//       pos4 = e.clientY;
//       // set the element's new position:
//       elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
//       elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
//     }
  
//     function closeDragElement() {
//       // stop moving when mouse button is released:
//       document.onmouseup = null;
//       document.onmousemove = null;
//     }
//   }
// dragElement($("chip")[0]);
