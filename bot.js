const { Client, GatewayIntentBits } = require("discord.js");
const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error(err));

// Schemas
const UserSchema = new mongoose.Schema({
  userid: String,
  guildid: String,
  email: String,
  token: String,
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, default: Date.now, expires: 600 } // 10 minutes
});

const GuildSchema = new mongoose.Schema({
  guildid: String,
  domains: [String],
  onjoin: { type: Boolean, default: false },
  role: { type: String, default: "Verified" },
});

const User = mongoose.model("User", UserSchema);
const Guild = mongoose.model("Guild", GuildSchema);

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
  if (message.author.bot || !message.guild) return;
  const [command, ...args] = message.content.split(" ");

  switch (command) {
    case ".verify":
      try {
        // Check if user is already verified
        const existingUser = await User.findOne({ 
          userid: message.author.id, 
          guildid: message.guild.id,
          verified: true 
        });
        
        if (existingUser) {
          return message.reply("You are already verified in this server.");
        }

        const emailPrompt = await message.author.send(
          "Please provide your email address for verification."
        );
        
        const filter = (response) => response.author.id === message.author.id;
        const collected = await emailPrompt.channel.awaitMessages({
          filter,
          max: 1,
          time: 60000,
        });
        
        const email = collected.first().content;

        const guildData = await Guild.findOne({ guildid: message.guild.id });
        if (!guildData || !guildData.domains.includes(email.split("@")[1])) {
          return message.author.send(
            "The provided email domain is not allowed."
          );
        }

        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        // Remove any existing verification records for this user
        await User.deleteMany({ 
          userid: message.author.id, 
          guildid: message.guild.id 
        });
        
        await User.create({
          userid: message.author.id,
          guildid: message.guild.id,
          email,
          token: verificationToken,
        });

        // Send the verification URL to the user
        const verificationUrl = `${process.env.VERCEL_URL}/api/verify?token=${verificationToken}&user=${message.author.id}&guild=${message.guild.id}`;
        
        message.author.send(
          `Please verify your email by visiting this link: ${verificationUrl}\n\nThis link will expire in 10 minutes.`
        );
        
      } catch (err) {
        console.error(err);
        message.reply(
          "I could not send you a DM. Please check your privacy settings."
        );
      }
      break;

    case ".enableonjoin":
      await Guild.updateOne(
        { guildid: message.guild.id },
        { onjoin: true },
        { upsert: true }
      );
      message.reply("Verification on join has been enabled.");
      break;

    case ".disableonjoin":
      await Guild.updateOne(
        { guildid: message.guild.id },
        { onjoin: false },
        { upsert: true }
      );
      message.reply("Verification on join has been disabled.");
      break;

    case ".domainadd":
      if (!args[0]) return message.reply("Please provide a domain to add.");
      await Guild.updateOne(
        { guildid: message.guild.id },
        { $addToSet: { domains: args[0] } },
        { upsert: true }
      );
      message.reply(`Domain ${args[0]} has been added.`);
      break;

    case ".domainremove":
      if (!args[0]) return message.reply("Please provide a domain to remove.");
      await Guild.updateOne(
        { guildid: message.guild.id },
        { $pull: { domains: args[0] } }
      );
      message.reply(`Domain ${args[0]} has been removed.`);
      break;

    case ".rolechange":
      if (!args[0])
        return message.reply(
          "Please provide the name of the new verified role."
        );
      await Guild.updateOne(
        { guildid: message.guild.id },
        { role: args[0] },
        { upsert: true }
      );
      message.reply(`Verified role has been changed to ${args[0]}.`);
      break;
      
    case ".vstatus":
      const guildData = await Guild.findOne({ guildid: message.guild.id });
      const domains = guildData ? guildData.domains.join(", ") : "None";
      const onJoin = guildData ? guildData.onjoin : false;
      const role = guildData ? guildData.role : "Verified";
      
      await message.channel.send(
        "```" +
          `Ping: ${Math.round(client.ws.ping)}ms\n` +
          "User commands:\n" +
          "   .verify -> Sends a DM to the user to verify their email\n" +
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
          `Verify when a user joins? (default=False): ${onJoin}\n` +
          `Verified role (default=Verified): ${role}\`\`\``
      );
      break;
  }
});

client.on("guildMemberAdd", async (member) => {
  const guildData = await Guild.findOne({ guildid: member.guild.id });
  if (guildData?.onjoin) {
    try {
      await member.send(
        "Welcome! Please verify your email address by using the `.verify` command in the server."
      );
    } catch (err) {
      console.error(`Could not send DM to ${member.user.tag}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);