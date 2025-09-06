const express = require("express");
const mongoose = require("mongoose");

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Discord verification API is running",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint for verification (optional)
app.get("/api/test", async (req, res) => {
  try {
    // Test MongoDB connection
    await mongoose.connect(process.env.MONGO_URI);
    res.json({
      success: true,
      message: "MongoDB connected successfully",
      mongodb: "Connected",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      mongodb: "Disconnected",
    });
  }
});

// Export for Vercel
module.exports = app;
