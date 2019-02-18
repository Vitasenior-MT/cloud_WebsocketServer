// thanks to https://github.com/john-pettigrew/scaling-socket-io-talk/blob/master/code/app.js

exports.listen = (socketIO, channel) => {
  socketIO.of("/socketio").on('connection', (socket) => {

    if (socket.handshake.query && socket.handshake.query.token) {
      require("./business/validate_token").validateToken(socket.handshake.query.token).then(
        result => {
          Promise.all(result.rooms.map(room => _subscribeToEntity(channel, room))).then(
            exchanges => _subscribeToUnicast(channel, result.entity).then(
              exchange => {

                exchanges.forEach(exchange => {
                  exchange.forwardMessage = (message) => socket.emit('message', message);
                });
                exchange.forwardMessage = (message) => socket.emit('message', message);

                socket.join(result.rooms, (err) => {
                  if (err) socket.emit("message", { content: "error", msg: "error on join rooms: " + err.message });
                  else socket.emit('message', { content: "hello" });

                  console.log("\x1b[36mnew connection: %s\x1b[0m", result.entity);

                  socket.on('disconnect', () => {
                    exchanges.forEach(exchange => exchange.closeConnection());
                    exchange.closeConnection();
                  });
                });
              }, error => console.log(error)),
            error => console.log(error));
        }, error => { socket.emit("message", { content: "unauthorized", msg: error.message }); socket.disconnect(true) });
    } else { socket.emit("message", { content: "unauthorized", msg: "token undefined" }); socket.disconnect(true); }
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
        forwardMessage: forwardMessage,
        closeConnection: closeConnection
      };

      channel.consume(q.queue, function (msg) {
        exchange.forwardMessage(JSON.parse(msg.content.toString()));
      }, { noAck: true });

      function closeConnection() { channel.unbindQueue(q.queue, entity_id, 'broadcast'); }
      function forwardMessage() { }

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
        forwardMessage: forwardMessage,
        closeConnection: closeConnection
      };

      // listen for messages
      channel.consume(q.queue, function (msg) {
        exchange.forwardMessage(JSON.parse(msg.content.toString()));
      }, { noAck: true });

      function closeConnection() { channel.unbindQueue(q.queue, client_id, 'unicast'); }
      function forwardMessage() { }

      resolve(exchange);
    });
  });
}