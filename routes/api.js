const express = require('express');
const router = express.Router();

// Health check endpoint for Vercel
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Discord verification bot is running' });
});

// You can add more API endpoints here if needed

module.exports = router;