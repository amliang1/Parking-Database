const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io setup for tests
const io = {
  emit: jest.fn()
};
app.set('io', io);

// Routes
app.use('/api/parkingspots', require('./routes/parkingSpots'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;
