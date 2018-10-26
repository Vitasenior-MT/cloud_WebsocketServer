// // https://github.com/john-pettigrew/scaling-socket-io-talk/blob/master/code/app.js
// exports.listen = (socketIO, channel) => {

//   socketIO.on('connection', (socket) => {
//     if (socket.handshake.query && socket.handshake.query.token) {
//       require("./business/validate_token").validateToken(socket.handshake.query.token).then(
//         result => {
//           Promise.all(result.rooms.map(room => _subscribeToEntity(channel, room))).then(
//             exchanges => {
//               exchanges.forEach(exchange => exchange.onMessageReceived = onMessageReceived);

//               socket.join(result.rooms, (err) => {
//                 if (err) socket.emit("message", { content: "error", msg: "error on join rooms: " + err.message });
//                 else socket.emit('message', { content: "Hello", msg: "Hello from server" });

//                 console.log("new connection");

//                 socket.on('disconnect', () => {
//                   exchanges.forEach(exchange => exchange.closeConnection());
//                 });
//               });
//             }, error => console.log(error))
//         }, error => { socket.emit("message", { content: "Unauthorized", msg: error.message }); socket.disconnect(true) });
//     } else { socket.emit("message", { content: "Unauthorized", msg: "token undefined" }); socket.disconnect(true); }
//   });

//   function onMessageReceived(room, message) {
//     socketIO.to(room).emit('message', message);
//   }
// }

// // PRIVATE
// //_________________________
// _subscribeToEntity = (channel, entity_id) => {
//   return new Promise((resolve, reject) => {

//     channel.assertExchange(entity_id, 'fanout', { autoDelete: true });

//     //setup a queue for receiving messages
//     channel.assertQueue('', { exclusive: true }, function (err, q) {
//       if (err) reject(err);

//       channel.bindQueue(q.queue, entity_id, '');

//       let exchange = {
//         emitMessage: emitMessage,
//         onMessageReceived: onMessageReceived,
//         closeConnection: closeConnection
//       };

//       //listen for messages
//       channel.consume(q.queue, function (msg) {
//         exchange.onMessageReceived(entity_id, JSON.parse(msg.content.toString()));
//       }, { noAck: true });

//       function emitMessage(message) {
//         channel.publish(entity_id, '', new Buffer(JSON.stringify(message)));
//       }
//       function closeConnection() {
//         channel.unbindQueue(q.queue, entity_id, '');
//       }
//       function onMessageReceived() { }

//       resolve(exchange);

//     });
//   });
// }


// https://github.com/john-pettigrew/scaling-socket-io-talk/blob/master/code/app.js
exports.listen = (socketIO, channel) => {
  socketIO.on('connection', (socket) => {

    function forwardBroadcast(room, message) { socketIO.to(room).emit('message', message); }
    function forwardUnicast(message) { socket.emit('message', message); }

    if (socket.handshake.query && socket.handshake.query.token) {
      require("./business/validate_token").validateToken(socket.handshake.query.token).then(
        result => {
          Promise.all(result.rooms.map(room => _subscribeToEntity(channel, room))).then(
            exchanges => _subscribeToUnicast(channel, result.entity).then(
              exchange => {

                exchanges.forEach(exchange => { exchange.forwardBroadcast = forwardBroadcast });
                exchange.forwardUnicast = forwardUnicast;

                socket.join(result.rooms, (err) => {
                  if (err) socket.emit("message", { content: "error", msg: "error on join rooms: " + err.message });
                  else socket.emit('message', { content: "Hello", msg: "Hello from server" });

                  console.log("new connection");

                  socket.on('disconnect', () => {
                    exchanges.forEach(exchange => exchange.closeConnection());
                    exchange.closeConnection();
                  });
                });
              }, error => console.log(error)),
            error => console.log(error));
        }, error => { socket.emit("message", { content: "Unauthorized", msg: error.message }); socket.disconnect(true) });
    } else { socket.emit("message", { content: "Unauthorized", msg: "token undefined" }); socket.disconnect(true); }
  });
}


// PRIVATE
//_________________________
_subscribeToEntity = (channel, entity_id) => {
  return new Promise((resolve, reject) => {

    channel.assertExchange(entity_id, 'direct', { autoDelete: true, durable: false });

    //setup a queue for receiving messages
    channel.assertQueue('', { exclusive: true }, function (err, q) {
      if (err) reject(err);

      channel.bindQueue(q.queue, entity_id, 'broadcast');

      let exchange = {
        forwardBroadcast: forwardBroadcast,
        closeConnection: closeConnection
      };

      // listen for messages
      channel.consume(q.queue, function (msg) {
        exchange.forwardBroadcast(entity_id, JSON.parse(msg.content.toString()));
      }, { noAck: true });

      function closeConnection() { channel.unbindQueue(q.queue, entity_id, 'broadcast'); }
      function forwardBroadcast() { }

      resolve(exchange);

    });
  });
}

_subscribeToUnicast = (channel, client_id) => {
  return new Promise((resolve, reject) => {
    channel.assertExchange(client_id, 'direct', { autoDelete: true, durable: false });

    //setup a queue for receiving messages
    channel.assertQueue('', { exclusive: true }, function (err, q) {
      if (err) reject(err);

      channel.bindQueue(q.queue, client_id, 'unicast');

      let exchange = {
        forwardUnicast: forwardUnicast,
        closeConnection: closeConnection
      };

      // listen for messages
      channel.consume(q.queue, function (msg) {
        exchange.forwardUnicast(JSON.parse(msg.content.toString()));
      }, { noAck: true });

      function closeConnection() { channel.unbindQueue(q.queue, client_id, 'unicast'); }
      function forwardUnicast() { }

      resolve(exchange);
    });
  });
}