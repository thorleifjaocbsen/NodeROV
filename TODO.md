# Todo

- Add gyro calibration of some kind
- Implement HOLD feature for Auxiliary Controller
- Implement PWM Controller
- Add documentation on how to get to the current multiplication number. 
  1000 / (Rshunt * Rother) = 1000 / (0.0005*56000) = 35.714285714285715

  Controller system, how?

PWM usually has a 0 - 1 or maybe 1000-2000


Future: Client - https://github.com/NewChromantics/PopH264


# Static IP on eth0
/etc/dhcpcd.conf
```
# Example static IP configuration:
interface eth0
static ip_address=10.10.10.10/24
#static ip6_address=fd51:42f8:caae:d92e::ff/64
#static routers=10.10.10.10
#static domain_name_servers=192.168.0.1 8.8.8.8 fd51:42f8:caae:d92e::1`
```

in /etc/init.d/udhcpd add a line

Required-Start: $network (with the commetns)

/etc/udhcpd.conf:
```
start           10.10.10.20     #default: 192.168.0.20
end             10.10.10.254    #default: 192.168.0.254
interface       eth0            #default: eth0
opt     dns     1.1.1.1
option  subnet  255.255.255.0
opt     router  10.10.10.10
option  lease   864000          # 10 days of seconds
```