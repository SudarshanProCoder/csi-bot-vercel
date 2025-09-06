const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  userid: String,
  guildid: String,
  email: String,
  code: String,
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 600 } // 10 minutes
});

module.exports = mongoose.model('User', UserSchema);