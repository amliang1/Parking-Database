const mongoose = require('mongoose');

const ViolationSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  type: {
    type: String,
    enum: ['overtime', 'no_permit', 'wrong_spot', 'unauthorized', 'other'],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'cancelled', 'appealed'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  },
  evidence: [{
    type: String, // URL to image/video
    required: true
  }],
  fine: {
    amount: {
      type: Number,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'waived'],
      default: 'pending'
    },
    paidAt: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Add indexes for common queries
ViolationSchema.index({ timestamp: -1 });
ViolationSchema.index({ status: 1 });
ViolationSchema.index({ vehicle: 1 });
ViolationSchema.index({ 'fine.status': 1 });

module.exports = mongoose.models.Violation || mongoose.model('Violation', ViolationSchema);
