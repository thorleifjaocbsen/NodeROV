#!/bin/bash 
 
SSID=$(/sbin/iwgetid --raw) 

if [ -z "$SSID" ] 
then 
    echo "`date -Is` WiFi interface is down, trying to reconnect" >> /home/toffe/wifi-log.txt
    sudo ifconfig wlan0 down
    sleep 30
    sudo ifconfig wlan0 up 
fi 

# echo "`date -Is` WiFi check finished ${SSID}" >> /home/toffe/wifi-log.txt
