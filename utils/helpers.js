const Guild = require('../models/Guild');

const isAdmin = (member) => {
  return member.permissions.has('ADMINISTRATOR');
};

const getGuildInfo = async (guildId) => {
  const guildData = await Guild.findOne({ guildid: guildId });
  return {
    domains: guildData ? guildData.domains.join(', ') : 'None',
    onjoin: guildData ? guildData.onjoin : false,
    role: guildData ? guildData.role : 'Verified'
  };
};

module.exports = { isAdmin, getGuildInfo };