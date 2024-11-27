const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  licensePlate: {
    type: String,
    required: true,
    unique: true,
  },
  ownerName: String,
  authorized: {
    type: Boolean,
    default: false,
  },
  parkingPassId: String,
  entryTime: Date,
  exitTime: Date,
  status: {
    type: String,
    enum: ['in', 'out'],
    default: 'in',
  },
});

module.exports = mongoose.model('Vehicle', VehicleSchema);
