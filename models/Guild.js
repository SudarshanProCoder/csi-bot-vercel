const mongoose = require('mongoose');

const GuildSchema = new mongoose.Schema({
  guildid: String,
  domains: [String],
  onjoin: { type: Boolean, default: false },
  role: { type: String, default: "Verified" },
});

module.exports = mongoose.model('Guild', GuildSchema);