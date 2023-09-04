import time
import board
import busio
import adafruit_lsm9ds1

# Initialize I2C bus and LSM9DS1 sensor
i2c = busio.I2C(board.SCL, board.SDA)
sensor = adafruit_lsm9ds1.LSM9DS1_I2C(i2c)

# Open a file for writing calibration data
calibration_file = open("magnetometer_calibration_data.txt", "w")

try:
    print("Move the sensor slowly and steadily in all directions to gather calibration data.")
    print("Press Ctrl+C when done.")

    while True:
        mag_x, mag_y, mag_z = sensor.magnetic

        # Write raw magnetometer data to the file
        calibration_file.write(f"{mag_x}\t{mag_z}\t{mag_y}\n")
        calibration_file.flush()

        time.sleep(0.1)  # Adjust the sleep interval as needed

except KeyboardInterrupt:
    print("Data collection stopped. Calibration data saved to 'magnetometer_calibration_data.txt'.")

finally:
    calibration_file.close()