
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
    resourceType: { // Cloudinary resource_type ('raw', 'image', 'video', 'auto')
        type: String,
        default: 'raw'
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
    // Full processed text stored as ordered chunks.
    // Pinecone holds embeddings + pointer IDs only; this is the source of truth.
    chunks: {
        type: [
            {
                index: { type: Number, required: true },
                text:  { type: String, required: true }
            }
        ],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Memory', MemorySchema);
