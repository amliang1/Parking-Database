const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  licensePlate: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
    unique: true
  },
  make: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  isParked: {
    type: Boolean,
    default: false
  },
  violationStatus: {
    type: String,
    enum: ['none', 'warning', 'violation'],
    default: 'none'
  },
  parkingSpot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingSpot'
  },
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  violationCount: {
    type: Number,
    default: 0
  },
  lastViolation: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Update lastUpdated timestamp before saving
VehicleSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Virtual for getting active violations
VehicleSchema.virtual('activeViolations', {
  ref: 'Violation',
  localField: '_id',
  foreignField: 'vehicle',
  match: { status: { $in: ['pending', 'processed'] } }
});

// Method to check if vehicle has active violations
VehicleSchema.methods.hasActiveViolations = async function() {
  const violations = await mongoose.model('Violation').countDocuments({
    vehicle: this._id,
    status: { $in: ['pending', 'processed'] }
  });
  return violations > 0;
};

// Update violation status based on violations
VehicleSchema.methods.updateViolationStatus = async function() {
  const activeViolations = await this.hasActiveViolations();
  this.violationStatus = activeViolations ? 'violation' : 'none';
  await this.save();
};

module.exports = mongoose.model('Vehicle', VehicleSchema);
