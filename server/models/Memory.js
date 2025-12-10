
const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
    clerkUserId: {
        type: String,
        required: true,
        index: true
    },
    originalName: {
        type: String,
        required: true
    },
    fileType: {
        type: String, // 'application/pdf', 'audio/mpeg', etc.
        required: true
    },
    cloudUrl: {
        type: String,
        required: true
    },
    publicId: { // Cloudinary Public ID
        type: String,
        required: true
    },
    processingStatus: {
        type: String,
        enum: ['uploaded', 'processing', 'completed', 'failed'],
        default: 'uploaded'
    },
    summary: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Memory', MemorySchema);
