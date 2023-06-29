; (async () => {
  const fs = require("fs");
  const net = require("net");
  const axios = require('axios');
  const { ProtocolParser, parseIMEI, Data, GPRS, BufferReader } = require('complete-teltonika-parser')
  const https = require("https");
  //mongoose
  const ConnectDatabase = require('./config/database');
  const config = require('./config');
  const teltonikaSchema = require('./model/teltonika');  
  ConnectDatabase(config.mongoURI);
  
  // Create a Teltonika TCP server that listens on port 5500
  const server = net.createServer((socket) => {
    console.log("New Teltonika device connected");

    // When a new connection is established, listen for data events
    var imei
    socket.on("data", (response) => {
      const buf = Buffer.from(response);
      // Extract the source and destination IP addresses from the buffer
      const srcIp = `${buf[12]}.${buf[13]}.${buf[14]}.${buf[15]}`;
      console.log("device ip:", srcIp);

      const packet = response.toString("hex");

      if (packet.length === 34) {
        imei = parseIMEI(packet)
        const acceptData = true; // Set to true or false based on whether the server should accept data from this module
        const confirmationPacket = Buffer.alloc(1);
        confirmationPacket.writeUInt8(acceptData ? 0x01 : 0x00);
        socket.write(confirmationPacket);

        console.log("imei------", imei);
        console.log(`Sent confirmation packet ${acceptData ? "01" : "00"}`);
      }
      else {
        let parsed = new ProtocolParser(packet);
        const dataLength = parsed.Data_Length;
        console.log("CodecType:", parsed.CodecType);

        if (parsed.CodecType == "data sending") {
          let avlDatas = parsed.Content
          const avlData = avlDatas.AVL_Datas[1];
          const gpsElement = avlData.GPSelement;
          var date_ob = new Date(avlData.Timestamp);
          const timestamp = avlData.Timestamp;//new Date(avlData.Timestamp * 1000).toISOString();;

          const longitude = gpsElement.Longitude;
          const latitude = gpsElement.Latitude;
          const speed = gpsElement.Speed;


          const ioElement = avlData.IOelement;

          //movement detection
          let movement = 0;
          if (ioElement.Elements && ioElement.Elements['240']) {
            movement = ioElement.Elements['240'];
          }

          let signalStatus = 0;
          if (ioElement.Elements && ioElement.Elements['21']) {
            signalStatus = ioElement.Elements['21'];
          }

          let battery = 0;
          if (ioElement.Elements && ioElement.Elements['66']) {
            battery = ioElement.Elements['66'] * 100 / 13090;
          }

          let fuel = 0;
          if (ioElement.Elements && ioElement.Elements['9']) {
            fuel = ioElement.Elements['9'] * 0.001;
          }

          let iccid = '';
          if (ioElement.Elements && ioElement.Elements['11'] && ioElement.Elements['14']) {
            let iccid1 = ioElement.Elements['11'];
            let iccid2 = ioElement.Elements['14'];
            iccid = iccid1.toString() + iccid2.toString();
          }

          let ignition = 0;
          if (ioElement.Elements && ioElement.Elements['239']) {
            ignition = ioElement.Elements['239'];
          }

          const deviceInfo = { longitude, latitude, speed, 
          timestamp, movement, battery, fuel, signalStatus, iccid, ignition };


          let address = '';
          https.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyD9vdLrtEtIZ-U2i8tRqMVyrI0J_KbfeDk`, (response) => {
            let data = '';

            response.on('data', (chunk) => {
              data += chunk;
            });

            response.on('end', () => {
              let res = JSON.parse(data);
              address = res.results[0]? res.results[0].formatted_address : '';

              console.log('device info --------', deviceInfo);
              let record = new teltonikaSchema({
                  deviceImei: imei,
                  lat: latitude,
                  lng: longitude,
                  transferDate: timestamp,
                  movement: movement,
                  speed: speed,
                  fuel: fuel,
                  battery: battery,
                  signal: signalStatus,
                  address: address,
                  iccid: iccid,
                  ignition : ignition,
                  ip: srcIp
              });
              record.save();
            });
          }).on('error', (error) => {
            console.error(error);
          });

          const dataReceivedPacket = Buffer.alloc(4);
          dataReceivedPacket.writeUInt32BE(dataLength);
          socket.write(dataReceivedPacket);
          console.log("dataLength --------", dataLength);

          //} else {
          //let gprs = parsed.Content
          //console.log("gprs-----");
        }
      }
    });
  });
  server.listen(5500, () => {
    console.log("Teltonika server listening on port 5500");
  });
})()
