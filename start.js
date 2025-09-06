require("dotenv").config();

// Check if all required environment variables are set
const requiredEnvVars = [
  "DISCORD_TOKEN",
  "MONGO_URI",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Missing environment variables:");
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.log("\n💡 Please create a .env file with these variables");
  process.exit(1);
}

// Start the bot
console.log("✅ Starting Discord bot...");
require("./bot.js");

// Start the API server (optional)
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.json({ status: "OK", bot: "Running" });
});

app.listen(PORT, () => {
  console.log(`🌐 API server running on port ${PORT}`);
});
