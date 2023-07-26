/*
 * Dashboard Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

export default class Dashboard {

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

    this.setThruster(0, 0, 0, 0, 45)
    this.setThruster(1, 0, 100, 0, 315)
    this.setThruster(4, 0, 20, 100, 180)
    this.setThruster(5, 0, 80, 100, 0)
    this.setThruster(2, 0, 0, 200, 135+180)
    this.setThruster(3, 0, 100, 200, 225+180)
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

    const fl = 30
    const fr = 50
    const ul = 80
    const ur = 90
    const bl = -50
    const br = -30

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
