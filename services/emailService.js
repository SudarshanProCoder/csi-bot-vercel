const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, 
  port: process.env.SMTP_PORT, 
  secure: process.env.SMTP_SECURE === "true", 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    await transporter.sendMail({
      from: `"CSI Verification" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Email Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;"> 
          <img src="https://res.cloudinary.com/dcigoid9w/image/upload/v1757153781/CSI-logo_wbp83w.png" alt="CSI Logo" width="150">
          <h2>CSI-SAKEC Account Verification</h2>
          <p>Hello, <b>${email}</b></p>
          <p>To continue setting up your CSI Discord account, please verify your account with the code below:</p>
          <p class="code" style="font-size:24px; font-weight:bold; letter-spacing:3px; background:#f5f5f5; padding:10px; border-radius:5px; display:inline-block;">${verificationCode}</p>
          <p>This code will expire in 10 minutes. Please do not share it with anyone.</p>
          <p>If you did not make this request, please ignore this email.</p>
          <hr>
          <p>© 2025 CSI-SAKEC. All Rights Reserved.</p>
        </div>`,
    });
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (err) {
    console.error("Error sending verification email:", err);
    return false;
  }
};

module.exports = { sendVerificationEmail };