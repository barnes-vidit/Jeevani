
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { clerkMiddleware, requireAuth } = require('@clerk/express');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust first proxy (Render, Heroku, etc.) — required for express-rate-limit
app.set('trust proxy', 1);

// -- CORS (item 23): restrict in production, allow all in dev --
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

app.use(cors({
  origin: ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

// -- Rate Limiting (item 24) --
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});
app.use('/api', apiLimiter);

// Stricter limit on chat to protect Groq API quota
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Chat rate limit reached. Please wait a moment.' }
});
app.use('/api/biographer/chat', chatLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(clerkMiddleware());

// Request logger (concise)
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
const vaultRoutes = require('./routes/vault');
const biographerRoutes = require('./routes/biographer');
const memoirRoutes = require('./routes/memoir');

// Protected Routes
// Manual auth check inside routes to prevent redirect loops
app.use('/api/vault', vaultRoutes);
app.use('/api/biographer', biographerRoutes);
app.use('/api/memoir', memoirRoutes);

app.get('/', (req, res) => {
  res.send('Jeevani API is running');
});

// Diagnostic endpoint to check service health
app.get('/health', async (req, res) => {
  const axios = require('axios');
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const checks = {
    server: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ai_service_url: AI_SERVICE_URL,
    ai_service: 'unknown'
  };
  try {
    const aiRes = await axios.get(`${AI_SERVICE_URL}/`, { timeout: 5000 });
    checks.ai_service = aiRes.data?.status || 'reachable';
  } catch (err) {
    checks.ai_service = `error: ${err.code || err.message}`;
  }
  res.json(checks);
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
