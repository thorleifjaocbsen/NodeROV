/*
 * LineChart Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

export default class LineChart {

  #canvas;
  #ctx;
  #points;
  #seaLevelOffset;

  constructor(canvas) {

    this.#canvas = canvas;
    this.#ctx = this.#canvas.getContext("2d");

    this.setDepthScale(10);
    this.setTimeScale(60 * 1);

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
    this.draw();
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
  }

  draw() {
    this.drawPoints();
    this.drawDepthScale();
  }


  drawPoints() {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#ctx.save();

    let lastPointsTime = this.#points[0].time;
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
    console.log("DRAW");
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
    
    //this.#ctx.fillStyle = "rgb(231,96,98)";
    //this.#ctx.fillText(roll + "°", width - 20, centerY)

  }



  writeText(text, y, baseline = "middle") {
    this.#ctx.font = "bold 15px Open Sans";
    this.#ctx.textBaseline = baseline;

    this.#ctx.textAlign = "left";

    this.#ctx.fillStyle = "rgb(255,255,255)";
    this.#ctx.fillText(text, 10, y);
  }


  // drawOLD(pitch = 0, roll = 0, heading = 0) {

  //   const width = this.canvas.width
  //   const height = this.canvas.height
  //   const ctx = this.canvas.getContext('2d')

  //   ctx.clearRect(0, 0, width, height);
  //   ctx.save()
  //   this.drawArtificialHorizon(pitch, roll)
  //   this.drawCompass(heading)
  //   ctx.restore()
  // }


  // drawArtificialHorizon(pitch, roll) {

  //   const width         = this.canvas.width
  //   const height        = this.canvas.height
  //   const ctx           = this.canvas.getContext('2d')
  //   const centerY       = height / 2
  //   const centerX       = width / 2
  //   const pixelPrDegree = (height / 2) / 30 // (Top = 30 deg bottom = -30 deg)



  //   // Draw background lines each 5deg
  //   ctx.fillStyle = "rgba(145,152,169,0.2)";
  //   ctx.fillRect(0, centerY - (pixelPrDegree * 20), width, 2) // +20 degrees
  //   ctx.fillRect(0, centerY - (pixelPrDegree * 10), width, 2) // +10 degrees
  //   ctx.fillRect(0, centerY, width, 2)                        // 0 degrees
  //   ctx.fillRect(0, centerY + (pixelPrDegree * 10), width, 2) // -10 degrees
  //   ctx.fillRect(0, centerY + (pixelPrDegree * 20), width, 2) // -20 degrees

  //   // Draw square showing roll and pitch
  //   ctx.beginPath()
  //   ctx.strokeStyle = "rgba(255,255,255,0.9)";
  //   if (Math.abs(roll) > 5 || Math.abs(pitch) > 5) { ctx.fillStyle = "rgba(231,96,98,.2)"; }
  //   else { ctx.fillStyle = "rgba(255,255,255,.2)"; }
  //   ctx.lineWidth = 2;
  //   ctx.save()
  //   ctx.translate(centerX, centerY + pitch * pixelPrDegree);
  //   ctx.rotate(roll * Math.PI / 180);
  //   ctx.translate(-centerX, 0);
  //   ctx.rect(-centerX, 0, width * 2, height * 4);
  //   ctx.restore()
  //   ctx.stroke();
  //   ctx.fill();
  //   ctx.closePath()    



  //   roll = Math.round(roll);
  //   pitch = Math.round(pitch);

  //   // Common text formats
  //   ctx.font = "bold 15px Open Sans";
  //   ctx.textBaseline = "middle";

  //   // Draw PITCH text    
  //   ctx.fillStyle = "rgb(255,255,255)";
  //   ctx.fillText("PITCH", 20, centerY);
  //   ctx.fillStyle = "rgb(231,96,98)";
  //   ctx.fillText(pitch + "°", 20 + ctx.measureText("PITCH ").width, centerY)

  //   // Draw ROLL text
  //   ctx.textAlign = "right";
  //   ctx.fillStyle = "rgb(255,255,255)";
  //   ctx.fillText("ROLL", width - 20 - ctx.measureText(roll + "° ").width, centerY);
  //   ctx.fillStyle = "rgb(231,96,98)";
  //   ctx.fillText(roll + "°", width - 20, centerY)
  // }


  // drawCompass(heading) {
  //   const width = this.canvas.width;
  //   const height = this.canvas.height;
  //   const ctx = this.canvas.getContext("2d");

  //   heading = Math.round(heading)

  //   // Rose
  //   const left = (width / 2 - 74) - ((1200 / 360) * heading);
  //   ctx.drawImage(this.compassRose, left, 0);
  //   ctx.drawImage(this.compassRose, -1200 + left, 0);
  //   ctx.drawImage(this.compassRose, 1200 + left, 0);

  //   // Heading background
  //   ctx.save()
  //   ctx.beginPath()
  //   ctx.fillStyle = "#fb6362";
  //   ctx.strokeStyle = "rgba(145,152,169,1)";
  //   ctx.lineWidth = 2;
  //   ctx.rect(width/2-35,-2,70,30)
  //   ctx.stroke()
  //   ctx.fill()
  //   ctx.closePath()
  //   ctx.restore()

  //   // Heading
  //   ctx.font = "bold 25px Open Sans";
  //   ctx.textBaseline = "middle";
  //   ctx.textAlign = "center";
  //   ctx.fillStyle = "rgb(255,255,255)";
  //   ctx.fillText(heading.toString().padStart(3,'0'), width/2, 15);
  // }
}
