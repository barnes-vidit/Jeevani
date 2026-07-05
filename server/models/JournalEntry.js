const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const JournalEntrySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD to easily bucket by day
    messages: [MessageSchema],
    // Decision 4: AI-generated life-profile summary (~200 words).
    // Written by the session summariser after each chat and loaded into every greeting.
    summary: { type: String, default: '' },
    created_at: { type: Date, default: Date.now }
});

// Compound index to ensure one entry per user per day is unique (if we want strict enforcement)
// JournalEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);
