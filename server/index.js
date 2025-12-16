
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { clerkMiddleware, requireAuth } = require('@clerk/express');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (or you can specify your vercel app)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors()); // Enable pre-flight for all routes

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(clerkMiddleware());

app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  console.log(`[Server] Auth Header:`, req.headers.authorization ? "Present" : "Missing");
  console.log(`[Server] Req Auth state:`, req.auth);
  next();
});

app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  try {
    const authData = req.auth();
    console.log(`[Server] Auth Data:`, JSON.stringify(authData, null, 2));
  } catch (e) {
    console.log(`[Server] Auth Data Error:`, e.message);
  }
  next();
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
const vaultRoutes = require('./routes/vault');
const biographerRoutes = require('./routes/biographer');

// Protected Routes
// Manual auth check inside routes to prevent redirect loops
app.use('/api/vault', vaultRoutes);
app.use('/api/biographer', biographerRoutes);

app.get('/', (req, res) => {
  res.send('Jeevani API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
