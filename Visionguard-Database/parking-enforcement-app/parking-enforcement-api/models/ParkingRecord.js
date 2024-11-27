const mongoose = require('mongoose');

const ParkingRecordSchema = new mongoose.Schema({
  parkingSpot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingSpot',
    required: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  entryTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  exitTime: {
    type: Date
  },
  duration: {
    type: Number, // Duration in minutes
    default: 0
  },
  fee: {
    type: Number,
    default: 0
  },
  violationIssued: {
    type: Boolean,
    default: false
  },
  section: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate duration when exitTime is set
ParkingRecordSchema.pre('save', function(next) {
  if (this.exitTime && this.entryTime) {
    this.duration = Math.round((this.exitTime - this.entryTime) / (1000 * 60)); // Duration in minutes
  }
  next();
});

module.exports = mongoose.model('ParkingRecord', ParkingRecordSchema);
