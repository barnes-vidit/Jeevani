const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const ChatHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    messages: [MessageSchema]
});

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);
