const mongoose = require('mongoose');

const ViolationSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true,
  },
  officer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  violationType: {
    type: String,
    enum: ['unauthorized', 'overstay', 'other'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  notes: String,
});

module.exports = mongoose.model('Violation', ViolationSchema);
