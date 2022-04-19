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
