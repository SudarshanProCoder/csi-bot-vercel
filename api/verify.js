const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const { Client, GatewayIntentBits } = require("discord.js");

let isConnected = false;

// Connect to MongoDB
const connectDB = async () => {
  if (isConnected) return;
  
  try {
    await mongoose.connect(process.env.MONGO_URI, {});
    isConnected = true;
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

// Schemas
const UserSchema = new mongoose.Schema({
  userid: String,
  guildid: String,
  email: String,
  token: String,
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, default: Date.now, expires: 600 }
});

const GuildSchema = new mongoose.Schema({
  guildid: String,
  domains: [String],
  onjoin: { type: Boolean, default: false },
  role: { type: String, default: "Verified" },
});

const User = mongoose.model("User", UserSchema);
const Guild = mongoose.model("Guild", GuildSchema);

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  await connectDB();
  
  const { token, user, guild } = req.query;
  
  if (!token || !user || !guild) {
    return res.status(400).send('Invalid verification link');
  }
  
  try {
    // Find the verification record
    const verificationRecord = await User.findOne({
      userid: user,
      guildid: guild,
      token: token
    });
    
    if (!verificationRecord) {
      return res.status(400).send('Invalid or expired verification link');
    }
    
    if (verificationRecord.verified) {
      return res.status(400).send('Email already verified');
    }
    
    // Mark as verified
    verificationRecord.verified = true;
    await verificationRecord.save();
    
    // Get the guild configuration
    const guildData = await Guild.findOne({ guildid: guild });
    const roleName = guildData ? guildData.role : "Verified";
    
    // Initialize Discord client and add role
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
    });
    
    try {
      await client.login(process.env.DISCORD_TOKEN);
      
      const discordGuild = await client.guilds.fetch(guild);
      if (discordGuild) {
        const member = await discordGuild.members.fetch(user);
        if (member) {
          const verifiedRole = discordGuild.roles.cache.find(
            (role) => role.name === roleName
          );
          
          if (verifiedRole) {
            await member.roles.add(verifiedRole);
            
            // Send confirmation DM to user
            try {
              await member.send("Your email has been successfully verified!");
            } catch (err) {
              console.error(`Could not send DM to ${member.user.tag}`);
            }
          }
        }
      }
      
      await client.destroy();
    } catch (discordError) {
      console.error('Discord error:', discordError);
      // Continue even if Discord operation fails
    }
    
    // Redirect to success page
    return res.redirect(302, '/success.html');
    
  } catch (err) {
    console.error('Verification error:', err);
    return res.status(500).send('An error occurred during verification');
  }
};