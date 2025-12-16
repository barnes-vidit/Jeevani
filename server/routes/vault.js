
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const axios = require('axios');
const Memory = require('../models/Memory');

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Storage Config
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        console.log(`[Multer Debug] Processing file: ${file.originalname} (${file.mimetype})`);

        // Determine resource type
        let resourceType = 'auto';
        if (file.mimetype === 'application/pdf' ||
            file.mimetype.includes('msword') ||
            file.mimetype.includes('document')) {
            resourceType = 'raw';
        } else if (file.mimetype.startsWith('image/')) {
            resourceType = 'image';
        }

        const params = {
            folder: 'jeevani_vault',
            resource_type: resourceType,
            public_id: file.originalname.split('.')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase() + "_" + Date.now(),
        };

        // Only enforce format if we are NOT using 'auto' for images, 
        // because correct images usually are auto-detected. 
        // If raw, we don't set format. 
        // If auto (image), let Cloudinary decide or keep original.

        console.log(`[Multer Debug] Upload params:`, JSON.stringify(params));
        return params;
    },
});

const upload = multer({ storage: storage });

const uploadMiddleware = upload.single('file');

// @route   POST /api/vault/upload
// @desc    Upload a file to the vault
// @access  Private
router.post('/upload', (req, res, next) => {
    console.log("[Vault] Starting Upload Middleware");
    uploadMiddleware(req, res, (err) => {
        if (err) {
            console.error("[Vault] Multer Upload Error:", err);
            return res.status(500).json({ msg: 'File upload failed', error: err.message });
        }
        console.log("[Vault] Upload Middleware Completed");
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        const { auth } = req;
        const authData = auth();
        console.log("[Vault Upload] Auth:", authData);
        const { userId } = authData;

        if (!userId) {
            console.log("Unauthorized Upload Attempt");
            return res.status(401).json({ msg: 'Unauthorized: No User ID found' });
        }

        const newMemory = new Memory({
            clerkUserId: userId,
            originalName: req.file.originalname,
            fileType: req.file.mimetype,
            cloudUrl: req.file.path,
            publicId: req.file.filename,
            processingStatus: 'processing'
        });

        const memory = await newMemory.save();
        console.log(`[Vault] Memory saved successfully: ${memory._id}`);

        // Trigger AI Service processing
        let AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        if (AI_SERVICE_URL.endsWith('/')) {
            AI_SERVICE_URL = AI_SERVICE_URL.slice(0, -1);
        }

        console.log(`[Vault] Triggering AI Service at: ${AI_SERVICE_URL}/ingest/file-process`);

        // Fire and forget (async)
        const params = new URLSearchParams();
        params.append('userId', userId);
        params.append('docId', memory._id.toString());
        params.append('fileUrl', memory.cloudUrl);
        params.append('originalName', memory.originalName);

        axios.post(`${AI_SERVICE_URL}/ingest/file-process`, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).then(async () => {
            console.log(`Ingestion started for ${memory._id}`);
            await Memory.findByIdAndUpdate(memory._id, { processingStatus: 'completed' });
        }).catch(err => {
            console.error("AI Ingestion Failed:", err.message);
            if (err.response) {
                console.error("AI Service Error Data:", err.response.data);
                console.error("AI Service Status:", err.response.status);
            }
            Memory.findByIdAndUpdate(memory._id, { processingStatus: 'failed' }).exec();
        });

        res.json(memory);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/vault/list
// @desc    Get all files for the user
// @access  Private
router.get('/list', async (req, res) => {
    try {
        const { userId } = req.auth();
        if (!userId) return res.status(401).json({ msg: 'Unauthorized' });

        console.log(`[Vault] Listing memories for user: ${userId}`);

        const memories = await Memory.find({ clerkUserId: userId }).sort({ createdAt: -1 });
        console.log(`[Vault] Found ${memories.length} memories`);
        res.json(memories);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/vault/:id
// @desc    Delete a file
// @access  Private
router.delete('/:id', async (req, res) => {
    try {
        const { userId } = req.auth();
        if (!userId) return res.status(401).json({ msg: 'Unauthorized' });

        const memory = await Memory.findById(req.params.id);

        if (!memory) {
            return res.status(404).json({ msg: 'Memory not found' });
        }

        // Check user
        if (memory.clerkUserId !== userId) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // Delete from Cloudinary
        await cloudinary.uploader.destroy(memory.publicId, { resource_type: 'raw' }); // 'raw' might need adjustment based on type
        // Note: Cloudinary resource_type needs to match what was uploaded. 
        // For simplicity in MVP, we might try-catch delete or store resource_type in DB.

        // Delete from AI Service (Pinecone)
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        try {
            const params = new URLSearchParams();
            params.append('userId', userId);
            params.append('docId', memory._id.toString());
            await axios.post(`${AI_SERVICE_URL}/ingest/delete`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            console.log(`[Vault] Deleted vectors for ${memory._id}`);
        } catch (aiErr) {
            console.error(`[Vault] Failed to delete vectors (non-fatal): ${aiErr.message}`);
        }

        await memory.deleteOne();

        res.json({ msg: 'Memory removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
