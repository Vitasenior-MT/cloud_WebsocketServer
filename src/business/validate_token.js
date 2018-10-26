var db = require('../models/index'),
  fs = require("fs"),
  jwt = require('jsonwebtoken'),
  vitabox_list = require('./get_vitaboxes');

exports.validateToken = (token) => {
  return new Promise((resolve, reject) => {
    let public_key = fs.readFileSync(__dirname + '/../keys/cert.pem').toString();
    if (public_key === undefined) reject("error on load public key");

    let options = {
      algorithms: ["RS256"]
    };

    jwt.verify(token, public_key, options, (error, payload) => {
      if (error) reject({ code: 500, msg: error.message });
      // verify if user
      if (payload.role === "User") db.User.findById(payload.id).then(
        user => {
          // if is a user, set its own exchange
          if (user) user.getVitaboxes({ where: { active: true } }).then(
            vitaboxes => {
              // push exchanges to vitaboxes
              let rooms = vitaboxes.map(x => x.id);
              // if admin push exchange to admin
              if (user.admin) rooms.push("admin");
              // if doctor push exchanges to patients
              if (user.doctor) user.getPatients().then(
                patients => {
                  patients.forEach(x => rooms.push(x.id));
                  resolve({ rooms: rooms, entity: user.id });
                }, error => reject(error));
              else resolve({ rooms: rooms, entity: user.id });
            }, error => reject(error));
          else reject(new Error("user not found"));
        }, error => reject(error));
      // if is a vitabox, just return their own exchange
      else resolve({ rooms: [payload.id], entity: payload.id });
    });
  });
}