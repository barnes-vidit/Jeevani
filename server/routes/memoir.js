const express = require('express');
const router = express.Router();
const { requireAuth } = require('@clerk/express');
const axios = require('axios');
const BiographyJob = require('../models/BiographyJob');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/memoir/generate
// Starts a biography generation job. Returns jobId immediately.
router.post('/generate', requireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  try {
    // Rate limit: 1 generation per user per hour (non-failed jobs)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentJob = await BiographyJob.findOne({
      userId,
      createdAt: { $gt: oneHourAgo },
      status: { $ne: 'failed' }
    });
    if (recentJob && recentJob.status !== 'complete') {
      return res.status(429).json({
        error: 'A generation is already in progress or was started recently. Please wait before generating again.',
        jobId: recentJob._id
      });
    }

    const job = await BiographyJob.create({ userId });

    // Fire and forget — generation runs in background in AI service
    axios.post(`${AI_SERVICE_URL}/memoir/generate`, {
      userId,
      jobId: job._id.toString()
    }).catch(err => console.error('[memoir] AI service fire-and-forget error:', err.message));

    res.json({ jobId: job._id });
  } catch (err) {
    console.error('[memoir] generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memoir/status/:jobId
// Poll for generation progress
router.get('/status/:jobId', requireAuth(), async (req, res) => {
  try {
    const job = await BiographyJob.findById(req.params.jobId);
    if (!job || job.userId !== req.auth.userId) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({
      status: job.status,
      progress: job.progress,
      currentPhase: job.currentPhase,
      title: job.title,
      wordCount: job.wordCount,
      errorMessage: job.errorMessage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memoir/result/:jobId
// Fetch the completed manuscript
router.get('/result/:jobId', requireAuth(), async (req, res) => {
  try {
    const job = await BiographyJob.findById(req.params.jobId);
    if (!job || job.userId !== req.auth.userId) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'complete') {
      return res.status(202).json({ status: job.status, message: 'Not ready yet' });
    }
    res.json({
      manuscript: job.manuscript,
      title: job.title,
      wordCount: job.wordCount,
      chapterCount: job.chapterCount,
      completedAt: job.completedAt,
      plan: job.plan || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memoir/list
// List past biographies for this user
router.get('/list', requireAuth(), async (req, res) => {
  try {
    const jobs = await BiographyJob.find(
      { userId: req.auth.userId, status: 'complete' },
      { manuscript: 0 }  // Exclude large manuscript field from list
    ).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memoir/export/docx/:jobId
// Generate and download a DOCX file of the biography
router.get('/export/docx/:jobId', requireAuth(), async (req, res) => {
  try {
    const job = await BiographyJob.findById(req.params.jobId);
    if (!job || job.userId !== req.auth.userId) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'complete') {
      return res.status(202).json({ message: 'Biography not ready yet' });
    }

    const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } = require('docx');

    const cleanText = (t) => t
      .replace(/\s*\[UNVERIFIED:[^\]]*\]/g, '')
      .replace(/\s*\[COHERENCE_ISSUE:[^\]]*\]/g, '')
      .replace(/\[GAP:[^\]]*\]/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // strip inline images
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1');

    const lines = job.manuscript.split('\n');
    const docChildren = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        docChildren.push(new Paragraph({
          text: cleanText(line.replace(/^# /, '')),
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }));
      } else if (line.startsWith('## ')) {
        docChildren.push(new Paragraph({
          text: cleanText(line.replace(/^## /, '')),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }));
      } else if (line.startsWith('### ')) {
        docChildren.push(new Paragraph({
          text: cleanText(line.replace(/^### /, '')),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        }));
      } else if (line.trim() === '') {
        docChildren.push(new Paragraph({ text: '' }));
      } else {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: cleanText(line), size: 24 })],
          spacing: { after: 120 }
        }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children: docChildren
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const safeTitle = (job.title || 'life-sketch').replace(/[^a-z0-9]/gi, '-').toLowerCase();

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    console.error('[memoir] DOCX export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/memoir/export/pdf/:jobId
// Generate and download a PDF file of the biography
router.get('/export/pdf/:jobId', requireAuth(), async (req, res) => {
  try {
    const job = await BiographyJob.findById(req.params.jobId);
    if (!job || job.userId !== req.auth.userId) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'complete') {
      return res.status(202).json({ message: 'Biography not ready yet' });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 80, size: 'A4' });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const safeTitle = (job.title || 'life-sketch').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
        'Content-Length': buffer.length
      });
      res.send(buffer);
    });

    const pdfClean = (t) => t
      .replace(/\s*\[UNVERIFIED:[^\]]*\]/g, '')
      .replace(/\s*\[COHERENCE_ISSUE:[^\]]*\]/g, '')
      .replace(/\[GAP:[^\]]*\]/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // strip inline images
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1');

    const lines = job.manuscript.split('\n');
    for (const line of lines) {
      if (line.startsWith('# ')) {
        doc.moveDown(0.5)
           .fontSize(26).font('Times-Bold')
           .text(pdfClean(line.replace(/^# /, '')), { align: 'center' })
           .moveDown(1.2);
      } else if (line.startsWith('## ')) {
        doc.moveDown(1.2)
           .fontSize(16).font('Times-Bold')
           .text(pdfClean(line.replace(/^## /, '')))
           .moveDown(0.6);
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.6)
           .fontSize(13).font('Times-BoldItalic')
           .text(pdfClean(line.replace(/^### /, '')))
           .moveDown(0.3);
      } else if (line.trim() === '') {
        doc.moveDown(0.6);
      } else {
        doc.fontSize(11).font('Times-Roman')
           .text(pdfClean(line), { lineGap: 5, indent: 20 })
           .moveDown(0.2);
      }
    }

    doc.end();
  } catch (err) {
    console.error('[memoir] PDF export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
