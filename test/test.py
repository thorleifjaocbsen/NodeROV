# SPDX-FileCopyrightText: 2021 ladyada for Adafruit Industries
# SPDX-License-Identifier: MIT

# Simple demo of the LSM9DS1 accelerometer, magnetometer, gyroscope.
# Will print the acceleration, magnetometer, and gyroscope values every second.
import time
import math
import board
import adafruit_lsm9ds1
import os

# Create sensor object, communicating over the board's default I2C bus
i2c = board.I2C()  # uses board.SCL and board.SDA
# i2c = board.STEMMA_I2C()  # For using the built-in STEMMA QT connector on a microcontroller
sensor = adafruit_lsm9ds1.LSM9DS1_I2C(i2c)

# SPI connection:
# from digitalio import DigitalInOut, Direction
# spi = board.SPI()
# csag = DigitalInOut(board.D5)
# csag.direction = Direction.OUTPUT
# csag.value = True
# csm = DigitalInOut(board.D6)
# csm.direction = Direction.OUTPUT
# csm.value = True
# sensor = adafruit_lsm9ds1.LSM9DS1_SPI(spi, csag, csm)

# Main loop will read the acceleration, magnetometer, gyroscope, Temperature
# values every second and print them out.
while True:

    # Clear terminal
    os.system("clear")

    # Read acceleration, magnetometer, gyroscope, temperature.
    
    accel_x, accel_z, accel_y = sensor.acceleration # Retruns xyz, but sensor is mounted sideways, so y and z are swapped
    accel_z = accel_z * -1 # Invert z axis
    accel_y = accel_y * -1 # Invert y axis
    # accel_x = accel_x * -1 # Invert x axis

    mag_x, mag_y, mag_z = sensor.magnetic
    gyro_x, gyro_z, gyro_y = sensor.gyro
    gyro_y = gyro_y * -1 # Invert z axis
    
    temp = sensor.temperature
    # Print values.
    print("Acceleration (m/s^2): ({0:0.3f},{1:0.3f},{2:0.3f})".format(accel_x, accel_y, accel_z))

    # Calculate Theta (Pitch) using arcsin(ax/g) make it in degrees
#    Theta = math.asin(accel_x/9.81) * 180 / math.pi
#    print("Theta (pitch): {0:0.3f}".format(Theta))
    #Improved Theta calculation
    Theta = math.atan2(accel_x, math.sqrt(accel_y*accel_y + accel_z*accel_z)) * 180 / math.pi
    print("Theta (pitch): {0:0.3f}".format(Theta))


    # Calculate Phi (roll) atan2(ay,az) make it in degrees
#    phi = math.atan2(accel_y, accel_z) * 180 / math.pi
#    print("Phi (roll): {0:0.3f}".format(phi))
    # Improved phi calculation
    Phi = math.atan2(accel_y, math.sqrt(accel_x*accel_x + accel_z*accel_z)) * 180 / math.pi
    print("Phi (roll): {0:0.3f}".format(Phi))

    # Calculate Psi (yaw) 
    # Tilt compensation
    mag_x_comp = mag_x * math.cos(Theta) + mag_z * math.sin(Theta)
    mag_y_comp = mag_x * math.sin(Phi) * math.sin(Theta) + mag_y * math.cos(Phi) - mag_z * math.sin(Phi) * math.cos(Theta)

    Psi = math.atan2(mag_y_comp, mag_x_comp) * 180 / math.pi
    if Psi < 0:
        Psi = Psi + 360

    print("Psi (yaw): {0:0.3f}".format(Psi))

    print("Magnetometer (gauss): ({0:0.3f},{1:0.3f},{2:0.3f})".format(mag_x, mag_y, mag_z))
    print("Gyroscope (rad/sec): ({0:0.3f},{1:0.3f},{2:0.3f})".format(gyro_x, gyro_y, gyro_z))
    print("Temperature: {0:0.3f}C".format(temp))

   # Write magnet calibrations to a FileCopyrightText

    # Delay for a second.
    time.sleep(.1)