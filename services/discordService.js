const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let isReady = false;

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  isReady = true;
});

client.login(process.env.DISCORD_TOKEN);

const getClient = () => {
  if (!isReady) {
    throw new Error("Discord client is not ready yet");
  }
  return client;
};

const assignRole = async (userId, guildId, roleName) => {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.error(`❌ Guild ${guildId} not found`);
      return false;
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      console.error(`❌ Member ${userId} not found in guild ${guildId}`);
      return false;
    }

    // Try to find role by name (case insensitive)
    let role = guild.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );

    // If role doesn't exist, try to create it
    if (!role) {
      try {
        console.log(`🔄 Creating missing role: ${roleName}`);
        role = await guild.roles.create({
          name: roleName,
          color: "#00FF00",
          reason: "Auto-created verified role",
          permissions: [], // No special permissions
        });
        console.log(`✅ Created new role: ${roleName}`);
      } catch (createError) {
        console.error(
          `❌ Failed to create role ${roleName}:`,
          createError.message
        );
        return false;
      }
    }

    // Check if user already has the role
    if (member.roles.cache.has(role.id)) {
      console.log(`ℹ️ User ${userId} already has role ${roleName}`);
      return true;
    }

    // Check if bot can manage this role
    const botMember = await guild.members.fetch(client.user.id);
    const botHighestRole = botMember.roles.highest;

    if (role.position >= botHighestRole.position) {
      console.error(
        `❌ Bot cannot assign role ${roleName} - role position too high`
      );
      console.error(
        `Bot's highest role: ${botHighestRole.name} (position: ${botHighestRole.position})`
      );
      console.error(`Target role: ${role.name} (position: ${role.position})`);
      return false;
    }

    // Check if bot has Manage Roles permission
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      console.error("❌ Bot missing Manage Roles permission");
      return false;
    }

    // Assign the role
    await member.roles.add(role);
    console.log(`✅ Assigned role ${roleName} to user ${userId}`);
    return true;
  } catch (error) {
    console.error("❌ Error assigning role:", error.message);

    if (error.code === 50013) {
      console.error("🔧 Missing permissions. Please ensure:");
      console.error(
        "1. Bot role is ABOVE the target role in server settings → Roles"
      );
      console.error('2. Bot has "Manage Roles" permission enabled');
      console.error("3. Bot has been reinvited with proper permissions");
    }

    return false;
  }
};

const sendDM = async (userId, message) => {
  try {
    const client = getClient();
    const user = await client.users.fetch(userId);

    try {
      await user.send(message);
      return true;
    } catch (dmError) {
      console.error(`❌ Cannot send DM to user ${userId}:`, dmError.message);
      return false;
    }
  } catch (error) {
    console.error("❌ Error fetching user for DM:", error.message);
    return false;
  }
};

const checkBotPermissions = async (guildId) => {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.error(`❌ Guild ${guildId} not found for permission check`);
      return false;
    }

    const botMember = await guild.members.fetch(client.user.id);
    const permissions = botMember.permissions;

    const hasManageRoles = permissions.has(
      PermissionsBitField.Flags.ManageRoles
    );
    const hasViewChannel = permissions.has(
      PermissionsBitField.Flags.ViewChannel
    );

    console.log(`🔍 Bot permissions in guild ${guildId}:`);
    console.log(`- Manage Roles: ${hasManageRoles}`);
    console.log(`- View Channel: ${hasViewChannel}`);

    return hasManageRoles && hasViewChannel;
  } catch (error) {
    console.error("❌ Error checking bot permissions:", error.message);
    return false;
  }
};

// Function to debug role hierarchy
const debugRoleHierarchy = async (guildId) => {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;

    const botMember = await guild.members.fetch(client.user.id);
    const botRole = botMember.roles.highest;

    const roles = guild.roles.cache
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        name: role.name,
        position: role.position,
        isBotRole: role.id === botRole.id,
        manageable: role.position < botRole.position,
      }));

    return {
      botRole: botRole.name,
      botRolePosition: botRole.position,
      roles: roles,
    };
  } catch (error) {
    console.error("Error debugging role hierarchy:", error);
    return null;
  }
};

module.exports = {
  assignRole,
  sendDM,
  getClient,
  checkBotPermissions,
  debugRoleHierarchy,
};
