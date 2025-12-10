
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { clerkMiddleware, requireAuth } = require('@clerk/express');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});
app.use(clerkMiddleware());

app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  console.log(`[Server] Req Auth state:`, req.auth);
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
// TEMPORARY DEBUG: Removed requireAuth() from ALL routes to unify debugging
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
