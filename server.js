// server.js

// BASE SETUP
// =============================================================================

// require('sticky-cluster')(
//   (callback) => {
//     Promise.all([
//       require("./src/broker_connect").connect(),
//       require('./src/models/index').sequelize.sync()
//     ]).then(
//       res => {
//         let channel = res[0];
//         console.log('\x1b[32m%s\x1b[0m.', '(PLAIN) Connection established with MongoDB, MySQL and RabbitMQ');

//         // This code will be executed only in slave workers
//         let express = require('express');
//         var server = require('http').createServer(express());

//         //Handle messaging
//         require('./src/message_handler').listen(require('socket.io')(server), channel);

//         callback(server);

//       }, error => console.log(error));
//   },
//   {
//     port: process.env.PORT || 8000
//   }
// );


// Get the env variables from .env
if (process.env.NODE_ENV !== "docker") {
  require('dotenv').config();
}

Promise.all([
  require("./src/broker_connect").connect(),
  require('./src/models/index').sequelize.sync()
]).then(
  res => {
    console.log('\x1b[32m(PLAIN) Connection established with External Services\x1b[0m.');

    // This code will be executed only in slave workers
    let app = require('express')();
    var server = require('http').createServer(app);
  
    // Handle messaging
    require('./src/broker_websocket').listen(require('socket.io')(server), res[0]);

    // Start ws server
    let port = process.env.PORT || 9020;
    server.listen(port, () => {
      console.log('\x1b[32m%s %d\x1b[0m.', '(PLAIN) Server listening on port', port);
    });

  }, error => { console.log('Unable to connect to External Services.', error); process.exit(1); });
