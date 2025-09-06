const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Guild = require("./models/Guild");
const {
  handleVerifyCommand,
  handleOTPResponse,
} = require("./controllers/verificationController");
const { isAdmin, getGuildInfo } = require("./utils/helpers");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle DMs (OTP responses)
  if (!message.guild) {
    await handleOTPResponse(message);
    return;
  }

  // Handle server commands
  const [command, ...args] = message.content.split(" ");

  switch (command) {
    case ".verify":
      await handleVerifyCommand(message);
      break;

    case ".enableonjoin":
      if (!isAdmin(message.member)) {
        return message.reply(
          "You need administrator permissions to use this command."
        );
      }
      await Guild.updateOne(
        { guildid: message.guild.id },
        { onjoin: true },
        { upsert: true }
      );
      message.reply("✅ Verification on join has been enabled.");
      break;

    case ".disableonjoin":
      if (!isAdmin(message.member)) {
        return message.reply(
          "You need administrator permissions to use this command."
        );
      }
      await Guild.updateOne(
        { guildid: message.guild.id },
        { onjoin: false },
        { upsert: true }
      );
      message.reply("✅ Verification on join has been disabled.");
      break;

    case ".domainadd":
      if (!isAdmin(message.member)) {
        return message.reply(
          "You need administrator permissions to use this command."
        );
      }
      if (!args[0]) return message.reply("Please provide a domain to add.");
      await Guild.updateOne(
        { guildid: message.guild.id },
        { $addToSet: { domains: args[0] } },
        { upsert: true }
      );
      message.reply(`✅ Domain ${args[0]} has been added.`);
      break;

    case ".domainremove":
      if (!isAdmin(message.member)) {
        return message.reply(
          "You need administrator permissions to use this command."
        );
      }
      if (!args[0]) return message.reply("Please provide a domain to remove.");
      await Guild.updateOne(
        { guildid: message.guild.id },
        { $pull: { domains: args[0] } }
      );
      message.reply(`✅ Domain ${args[0]} has been removed.`);
      break;

    case ".rolechange":
      if (!isAdmin(message.member)) {
        return message.reply(
          "You need administrator permissions to use this command."
        );
      }
      if (!args[0]) {
        return message.reply(
          "Please provide the name of the new verified role."
        );
      }
      await Guild.updateOne(
        { guildid: message.guild.id },
        { role: args[0] },
        { upsert: true }
      );
      message.reply(`✅ Verified role has been changed to ${args[0]}.`);
      break;

    case ".vstatus":
      try {
        const { domains, onjoin, role } = await getGuildInfo(message.guild.id);
        await message.channel.send(
          `\`\`\`Ping: ${Math.round(client.ws.ping)}ms\n` +
            "User commands:\n" +
            "   .verify -> Sends a DM to verify your email with OTP\n" +
            "   .vstatus -> This help message\n\n" +
            "Admin commands:\n" +
            " - A domain must be added before users can be verified.\n" +
            " - Use .rolechange instead of server settings to change the name of the verified role.\n" +
            "   .enableonjoin -> Enables verifying users on join\n" +
            "   .disableonjoin -> Disables verifying users on join\n" +
            "   .domainadd domain -> Adds an email domain\n" +
            "   .domainremove domain -> Removes an email domain\n" +
            "   .rolechange role -> Changes the name of the verified role\n\n" +
            `Domains: ${domains}\n` +
            `Verify when a user joins? (default=False): ${onjoin}\n` +
            `Verified role (default=Verified): ${role}\`\`\``
        );
      } catch (error) {
        console.error("vstatus error:", error);
        message.reply("An error occurred while fetching server status.");
      }
      break;

    case ".vping":
      await message.channel.send(`🏓 Pong! ${Math.round(client.ws.ping)}ms`);
      break;
  }
});

client.on("guildMemberAdd", async (member) => {
  const guildData = await Guild.findOne({ guildid: member.guild.id });
  if (guildData?.onjoin) {
    try {
      await member.send(
        "👋 Welcome! Please verify your email address by using the `.verify` command in the server."
      );
    } catch (err) {
      console.error(`Could not send DM to ${member.user.tag}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
