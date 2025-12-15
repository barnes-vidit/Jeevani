const express = require('express');
const router = express.Router();
const axios = require('axios');
const JournalEntry = require('../models/JournalEntry');
const { requireAuth } = require('@clerk/express'); // Keep for now in case needed elsewhere, but unused here

// Manual Auth Middleware (fixes hanging requireAuth)
const ensureAuthenticated = (req, res, next) => {
    console.log(`[Auth] Checking auth for ${req.method} ${req.url}`);
    try {
        const { userId } = req.auth();
        if (!userId) {
            console.log("[Auth] No userId found -> 401");
            return res.status(401).json({ error: "Unauthorized" });
        }
        console.log(`[Auth] Verified User: ${userId}`);
        next();
    } catch (err) {
        console.error("[Auth] Error checking auth status:", err);
        res.status(500).json({ error: "Auth verification failed" });
    }
};

// AI Service URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// DEBUG ROUTE
router.get('/version', (req, res) => {
    res.json({ version: "1.2.0 - DEBUG MODE", message: "If you see this, the new code is loaded!" });
});

// @route   GET /api/biographer/history
// @desc    Get list of journal entries (previews only), optionally filtered by search query
// @access  Private
router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const { q } = req.query;
        const { userId } = req.auth();
        let query = { userId };

        if (q) {
            // Search inside messages content
            query['messages.content'] = { $regex: q, $options: 'i' };
        }

        const entries = await JournalEntry.find(query).sort({ date: -1 });

        const list = entries.map(entry => ({
            id: entry._id,
            date: entry.date,
            // Find the matching snippet if searching, otherwise use the last message
            preview: q
                ? (entry.messages.find(m => m.content.match(new RegExp(q, 'i')))?.content.substring(0, 60) + "..." || "Match found")
                : (entry.messages.length > 0 ? entry.messages[entry.messages.length - 1].content.substring(0, 50) + "..." : "Empty entry")
        }));
        res.json(list);
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// @route   DELETE /api/biographer/history/:id
// @desc    Delete a specific journal entry
// @access  Private
router.delete('/history/:id', ensureAuthenticated, async (req, res) => {
    console.log(`[$$$ DEBUG $$$] DELETE Request for ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        const { userId } = req.auth();
        console.log(`[$$$ DEBUG $$$] Auth User: ${userId}`);

        // 1. Check if Entry Exists
        const entry = await JournalEntry.findById(id);
        if (!entry) {
            console.log(`[$$$ DEBUG $$$] Entry NOT FOUND in DB`);
            return res.status(404).json({ error: "Entry not found in database" });
        }

        // 2. Check Ownership
        console.log(`[$$$ DEBUG $$$] Entry Owner: ${entry.userId}`);
        if (entry.userId !== userId) {
            console.log(`[$$$ DEBUG $$$] OWNERSHIP MISMATCH!`);
            return res.status(403).json({ error: "Unauthorized: You do not own this entry" });
        }

        // 3. Delete
        await JournalEntry.findByIdAndDelete(id);
        console.log(`[$$$ DEBUG $$$] DELETED Successfully`);
        res.json({ message: "Journal entry deleted successfully" });
    } catch (error) {
        console.error("[$$$ DEBUG $$$] Error deleting entry:", error);
        res.status(500).json({ error: "Failed to delete entry" });
    }
});

// @route   GET /api/biographer/history/:id
// @desc    Get specific journal entry
// @access  Private
router.get('/history/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { userId } = req.auth();
        const entry = await JournalEntry.findById(req.params.id);

        if (!entry) return res.status(404).json({ msg: 'Entry not found' });
        if (entry.userId !== userId) return res.status(401).json({ msg: 'Unauthorized' });

        res.json(entry.messages);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/biographer/chat
// @desc    Chat with the biographer
// @access  Private
router.post('/chat', ensureAuthenticated, async (req, res) => {
    console.log("[Biographer] Route Handler Entered");
    try {
        const { message } = req.body;
        const { userId } = req.auth();

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

        console.log(`[Biographer] AI Response in Chat Route - Status: ${aiResponse.status}`);

        const answer = aiResponse.data.answer;

        // Save to Journal Entry (Daily Bucket)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        await JournalEntry.findOneAndUpdate(
            { userId, date: today },
            {
                $push: {
                    messages: [
                        { role: 'user', content: message },
                        { role: 'assistant', content: answer }
                    ]
                }
            },
            { upsert: true, new: true }
        );

        res.json({
            answer: answer,
            sender: 'biographer'
        });

    } catch (err) {
        console.error("AI Chat Error:", err.response?.data || err.message);
        res.status(500).send('Error communicating with Biographer');
    }
});

module.exports = router;
