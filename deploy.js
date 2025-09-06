const { execSync } = require("child_process");
const fs = require("fs");
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
  console.error("❌ Missing required environment variables:");
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.log("\n💡 Please add them to your .env file");
  process.exit(1);
}

console.log("✅ All environment variables are set");

// Deploy to Vercel
try {
  console.log("🚀 Deploying to Vercel...");

  // Set environment variables for Vercel
  requiredEnvVars.forEach((varName) => {
    execSync(
      `vercel env add ${varName} ${
        process.env.NODE_ENV === "production" ? "production" : "development"
      }`,
      {
        stdio: "inherit",
        input: process.env[varName],
      }
    );
  });

  console.log("✅ Environment variables set in Vercel");
  console.log("🌐 Deploying application...");

  execSync("vercel --prod", { stdio: "inherit" });

  console.log("🎉 Deployment successful!");
} catch (error) {
  console.error("❌ Deployment failed:", error.message);
}
