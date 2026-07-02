const mongoose = require('mongoose');

const BiographyJobSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['queued', 'harvesting', 'planning', 'writing', 'assembling', 'editing', 'verifying', 'complete', 'failed'],
    default: 'queued'
  },
  progress: { type: Number, default: 0 },
  currentPhase: { type: String, default: '' },
  manuscript: { type: String, default: '' },
  title: { type: String, default: '' },
  chapterCount: { type: Number, default: 0 },
  wordCount: { type: Number, default: 0 },
  plan: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('BiographyJob', BiographyJobSchema);
