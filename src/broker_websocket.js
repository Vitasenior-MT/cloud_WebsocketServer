// https://github.com/john-pettigrew/scaling-socket-io-talk/blob/master/code/app.js
exports.listen = (socketIO, channel) => {
  require("./business/get_vitaboxes").list().then(
    vitaboxes => {
      vitaboxes.push("admin");
      Promise.all(vitaboxes.map(vitabox => _subscribe(channel, vitabox))).then(
        exchanges => {
          exchanges.forEach(exchange => exchange.onMessageReceived = onMessageReceived);

          socketIO.on('connection', (socket) => {
            if (socket.handshake.query && socket.handshake.query.token) {
              require("./business/validate_token").validateToken(socket.handshake.query.token).then(
                boxes => {
                  socket.join(boxes, (err) => {
                    if (err) socket.emit("message", "error on join rooms: " + err.message);
                    else socketIO.to(boxes[0]).emit('message', { content: "Hello", msg: "Hello from server" });

                    // console.log("\x1b[32mnew connection\x1b[0m assigned to rooms: ", Object.keys(socket.rooms));
                    console.log("new connection");

                    socket.on('disconnect', () => { 
                      // console.log("\x1b[35muser disconect\x1b[0m: ", socket.conn.id); 
                    });
                  })
                },
                error => { socket.emit("message", { content: "Unauthorized", msg: error.message }); socket.disconnect(true) });
            } else { socket.emit("message", { content: "Unauthorized", msg: "token undefined" }); socket.disconnect(true); }
          });

          function onMessageReceived(room, message) {
            socketIO.to(room).emit('message', message);
          }

          // console.log('\x1b[32m%s %s\x1b[0m', '(PLAIN) Worker ', process.pid, 'listening rooms');
        }, error => console.log(error))
    }, error => console.log(error));
}

// PRIVATE
//_________________________
_subscribe = (channel, vitabox_id) => {
  return new Promise((resolve, reject) => {

    channel.assertExchange(vitabox_id, 'fanout', { durable: true });

    //setup a queue for receiving messages
    channel.assertQueue('', { exclusive: true }, function (err, q) {
      if (err) reject(err);

      channel.bindQueue(q.queue, vitabox_id, '');

      let exchanges = {
        emitMessage: emitMessage,
        onMessageReceived: onMessageReceived
      };

      //listen for messages
      channel.consume(q.queue, function (msg) {
        exchanges.onMessageReceived(vitabox_id, JSON.parse(msg.content.toString()));
      }, { noAck: true });

      function emitMessage(message) {
        channel.publish(vitabox_id, '', new Buffer(JSON.stringify(message)));
      }
      function onMessageReceived() { }

      resolve(exchanges);

    });
  });
}