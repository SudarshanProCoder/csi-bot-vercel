const User = require("../models/User");
const Guild = require("../models/Guild");
const { sendVerificationEmail } = require("../services/emailService");
const {
  assignRole,
  sendDM,
  checkBotPermissions,
  debugRoleHierarchy,
} = require("../services/discordService");

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
const activeVerifications = new Map();

const handleVerifyCommand = async (message) => {
  const userId = message.author.id;
  const guildId = message.guild.id;

  try {
    if (activeVerifications.has(userId)) {
      await sendDM(
        userId,
        "⏳ You already have an active verification process. Please complete it first."
      );
      return;
    }

    activeVerifications.set(userId, { guildId, startedAt: Date.now() });

    // Check bot permissions with detailed logging
    const hasPermissions = await checkBotPermissions(guildId);
    if (!hasPermissions) {
      const debugInfo = await debugRoleHierarchy(guildId);
      console.log("Role hierarchy debug:", debugInfo);

      await sendDM(
        userId,
        "❌ Bot is missing required permissions. Please contact an administrator to:\n1. Ensure bot role is ABOVE the verified role\n2. Enable 'Manage Roles' permission for the bot"
      );
      activeVerifications.delete(userId);
      return;
    }

    const existingUser = await User.findOne({
      userid: userId,
      guildid: guildId,
      verified: true,
    });

    if (existingUser) {
      await sendDM(userId, "✅ You are already verified in this server.");
      activeVerifications.delete(userId);
      return;
    }

    await sendDM(
      userId,
      "📧 Please provide your email address for verification."
    );

    let dmChannel = message.author.dmChannel;
    if (!dmChannel) {
      dmChannel = await message.author.createDM();
    }

    const emailFilter = (response) => response.author.id === userId;
    const emailCollected = await dmChannel.awaitMessages({
      filter: emailFilter,
      max: 1,
      time: 60000,
      errors: ["time"],
    });

    const email = emailCollected.first().content.trim();
    const guildData = await Guild.findOne({ guildid: guildId });
    const allowedDomains = guildData?.domains || [];

    if (!guildData || !allowedDomains.includes(email.split("@")[1])) {
      await sendDM(
        userId,
        `❌ The email domain is not allowed. Allowed domains: ${
          allowedDomains.join(", ") || "None configured"
        }`
      );
      activeVerifications.delete(userId);
      return;
    }

    const otp = generateOTP();
    await User.deleteMany({
      userid: userId,
      guildid: guildId,
      verified: false,
    });

    await User.create({
      userid: userId,
      guildid: guildId,
      email,
      code: otp,
    });

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      await sendDM(
        userId,
        "✅ Verification code sent! Please check your email and reply with the 6-digit code."
      );

      const otpTimeout = setTimeout(async () => {
        if (activeVerifications.has(userId)) {
          await sendDM(
            userId,
            "⏰ Verification timed out. Please use `.verify` again."
          );
          activeVerifications.delete(userId);
        }
      }, 600000);

      activeVerifications.set(userId, {
        ...activeVerifications.get(userId),
        timeout: otpTimeout,
        expiresAt: Date.now() + 600000,
      });
    } else {
      await sendDM(
        userId,
        "❌ Failed to send verification email. Please try again later."
      );
      activeVerifications.delete(userId);
    }
  } catch (error) {
    console.error("Verify command error:", error);

    if (error.message.includes("time")) {
      await sendDM(
        userId,
        "⏰ You took too long to respond. Please use `.verify` again."
      );
    } else {
      await sendDM(userId, "❌ An error occurred. Please try again.");
    }

    activeVerifications.delete(userId);
  }
};

const handleOTPResponse = async (message) => {
  const userId = message.author.id;

  try {
    if (!activeVerifications.has(userId)) {
      await sendDM(
        userId,
        "❌ No active verification found. Please start with `.verify` command."
      );
      return;
    }

    const verificationData = activeVerifications.get(userId);
    if (verificationData.timeout) {
      clearTimeout(verificationData.timeout);
    }

    const userCode = message.content.trim();
    const userRecord = await User.findOne({
      userid: userId,
      code: userCode,
      verified: false,
    });

    if (!userRecord) {
      await sendDM(userId);
      activeVerifications.delete(userId);
      return;
    }

    userRecord.verified = true;
    await userRecord.save();

    const guildData = await Guild.findOne({ guildid: userRecord.guildid });
    const roleName = guildData?.role || "Verified";

    console.log(`🔄 Attempting to assign role: ${roleName} to user: ${userId}`);
    const roleAssigned = await assignRole(userId, userRecord.guildid, roleName);

    if (roleAssigned) {
      await sendDM(
        userId,
        "🎉 Your email has been successfully verified! You now have access to all channels."
      );
    } else {
      // Try to provide more specific error information
      const debugInfo = await debugRoleHierarchy(userRecord.guildid);
      console.error("Role assignment failed. Debug info:", debugInfo);

      await sendDM(userId);
    }

    activeVerifications.delete(userId);
  } catch (error) {
    console.error("OTP response error:", error);
    await sendDM(
      userId,
      "❌ An error occurred during verification. Please contact an administrator."
    );
    activeVerifications.delete(userId);
  }
};

setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of activeVerifications.entries()) {
    if (data.expiresAt && data.expiresAt < now) {
      activeVerifications.delete(userId);
    }
  }
}, 60000);

module.exports = { handleVerifyCommand, handleOTPResponse };
