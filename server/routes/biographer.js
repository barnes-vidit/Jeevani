
const express = require('express');
const router = express.Router();
const axios = require('axios'); // We need axios in server too
const Memory = require('../models/Memory');

// AI Service URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// @route   POST /api/biographer/chat
// @desc    Chat with the biographer
// @access  Private
router.post('/chat', async (req, res) => {
    console.log("[Biographer] Route Handler Entered");
    try {
        const { message } = req.body;
        const { auth } = req;
        const userId = auth?.userId || "debug_test_user"; // Fallback for debugging if auth fails

        if (!message) {
            return res.status(400).json({ msg: 'Message is required' });
        }

        // Call AI Service
        console.log(`[Biographer] Sending message to AI: ${message}`);
        // We pass userId to let AI service filter Pinecone vectors
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/chat`, {
            userId: userId,
            message: message
        });

        console.log(`[Biographer] AI Response status: ${aiResponse.status}`);
        console.log(`[Biographer] AI Response data:`, aiResponse.data);

        res.json({
            answer: aiResponse.data.answer,
            sender: 'biographer'
        });

    } catch (err) {
        console.error("AI Chat Error:", err.response?.data || err.message);
        res.status(500).send('Error communicating with Biographer');
    }
});

module.exports = router;
