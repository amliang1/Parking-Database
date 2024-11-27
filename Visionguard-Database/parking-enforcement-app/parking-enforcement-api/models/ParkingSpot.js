const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'checked-in', 'cancelled', 'completed'],
    default: 'confirmed'
  },
  checkInTime: {
    type: Date
  },
  checkOutTime: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ParkingSpotSchema = new mongoose.Schema({
  spotId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  type: {
    type: String,
    enum: ['standard', 'handicap', 'electric', 'reserved', 'compact', 'motorcycle'],
    default: 'standard',
    index: true
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'maintenance', 'blocked'],
    default: 'available',
    index: true
  },
  occupied: {
    type: Boolean,
    default: false
  },
  currentVehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  lastOccupied: {
    type: Date
  },
  restrictions: {
    timeLimit: {
      type: Number,  // Time limit in minutes
      default: null
    },
    permitRequired: {
      type: Boolean,
      default: false
    },
    permitTypes: [{
      type: String,
      enum: ['resident', 'employee', 'visitor', 'handicap', 'electric']
    }],
    hourlyRate: {
      type: Number,
      default: 0
    },
    operatingHours: {
      start: {
        type: String,
        default: '08:00'
      },
      end: {
        type: String,
        default: '20:00'
      },
      days: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      }]
    }
  },
  location: {
    coordinates: {
      type: [Number],  // [longitude, latitude]
      required: true
    },
    level: {
      type: Number,
      default: 1
    },
    building: {
      type: String,
      trim: true
    }
  },
  sensors: {
    occupancySensor: {
      type: Boolean,
      default: false
    },
    lastReading: {
      type: Date
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active'
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  maintenance: {
    lastMaintenance: Date,
    nextScheduled: Date,
    notes: String,
    status: {
      type: String,
      enum: ['none', 'scheduled', 'in-progress', 'completed'],
      default: 'none'
    },
    history: [{
      date: Date,
      type: {
        type: String,
        enum: ['routine', 'repair', 'cleaning', 'inspection']
      },
      description: String,
      performedBy: String,
      cost: Number
    }]
  },
  statistics: {
    totalOccupancyTime: {
      type: Number,  // Total minutes occupied
      default: 0
    },
    occupancyCount: {
      type: Number,  // Number of times occupied
      default: 0
    },
    violationCount: {
      type: Number,
      default: 0
    },
    lastViolation: Date,
    revenue: {
      type: Number,
      default: 0
    },
    turnoverRate: {
      type: Number,
      default: 0
    }
  },
  reservations: [ReservationSchema],
  violations: [{
    type: {
      type: String,
      enum: ['overtime', 'no_permit', 'invalid_permit', 'unauthorized_vehicle', 'payment_required'],
      required: true
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    description: String,
    evidence: [{
      type: String,  // URL to image/video
      timestamp: Date
    }],
    status: {
      type: String,
      enum: ['pending', 'issued', 'appealed', 'resolved'],
      default: 'pending'
    },
    fine: {
      amount: Number,
      status: {
        type: String,
        enum: ['pending', 'paid', 'waived'],
        default: 'pending'
      },
      paidDate: Date
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
ParkingSpotSchema.index({ 'location.coordinates': '2dsphere' });
ParkingSpotSchema.index({ section: 1, type: 1, status: 1 });
ParkingSpotSchema.index({ 'restrictions.permitRequired': 1, 'restrictions.permitTypes': 1 });
ParkingSpotSchema.index({ 'reservations.startTime': 1, 'reservations.status': 1 });
ParkingSpotSchema.index({ 'violations.timestamp': 1, 'violations.status': 1 });

// Virtual for current occupancy duration
ParkingSpotSchema.virtual('currentOccupancyDuration').get(function() {
  if (!this.lastOccupied) return 0;
  return Math.floor((Date.now() - this.lastOccupied) / (1000 * 60)); // Duration in minutes
});

// Method to check if spot is available for a specific vehicle
ParkingSpotSchema.methods.isAvailableFor = function(vehicle, requestedTime = new Date()) {
  // Check basic availability
  if (this.status !== 'available' || this.occupied) return false;
  
  // Check operating hours
  const requestedHour = requestedTime.getHours();
  const requestedMinute = requestedTime.getMinutes();
  const requestedTimeStr = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
  const day = requestedTime.toLocaleLowerCase();
  
  if (this.restrictions.operatingHours.days.length > 0) {
    if (!this.restrictions.operatingHours.days.includes(day)) return false;
    if (requestedTimeStr < this.restrictions.operatingHours.start || 
        requestedTimeStr > this.restrictions.operatingHours.end) return false;
  }

  // Check permit requirements
  if (this.restrictions.permitRequired && vehicle.permits) {
    const hasValidPermit = vehicle.permits.some(permit => 
      this.restrictions.permitTypes.includes(permit.type) && 
      new Date() < permit.expiryDate
    );
    if (!hasValidPermit) return false;
  }

  // Check vehicle type compatibility
  if (this.type === 'compact' && vehicle.size === 'large') return false;
  if (this.type === 'motorcycle' && vehicle.type !== 'motorcycle') return false;
  if (this.type === 'electric' && !vehicle.isElectric) return false;
  
  // Check for conflicting reservations
  const hasConflictingReservation = this.reservations.some(reservation => {
    return reservation.status === 'confirmed' &&
           requestedTime >= reservation.startTime &&
           requestedTime <= reservation.endTime;
  });
  
  return !hasConflictingReservation;
};

// Method to check if spot is available for a specific time slot
ParkingSpotSchema.methods.isAvailableForTimeSlot = async function(startTime, endTime) {
  startTime = new Date(startTime);
  endTime = new Date(endTime);

  // Check operating hours
  const [operatingStartHour] = this.restrictions.operatingHours.start.split(':').map(Number);
  const [operatingEndHour] = this.restrictions.operatingHours.end.split(':').map(Number);
  
  const startHour = startTime.getHours();
  const endHour = endTime.getHours();

  if (startHour < operatingStartHour || endHour > operatingEndHour) {
    throw new Error('Reservation is outside operating hours');
  }

  // Check if there are any overlapping reservations
  const overlappingReservations = this.reservations.filter(reservation => {
    if (reservation.status === 'cancelled') return false;
    
    const reservationStart = new Date(reservation.startTime);
    const reservationEnd = new Date(reservation.endTime);
    
    return (
      (startTime >= reservationStart && startTime < reservationEnd) ||
      (endTime > reservationStart && endTime <= reservationEnd) ||
      (startTime <= reservationStart && endTime >= reservationEnd)
    );
  });

  if (overlappingReservations.length > 0) {
    throw new Error('Spot is already reserved for this time slot');
  }

  return true;
};

// Method to get all active reservations
ParkingSpotSchema.methods.getActiveReservations = function() {
  return this.reservations.filter(reservation => 
    reservation.status === 'confirmed' && 
    new Date(reservation.endTime) > new Date()
  );
};

// Method to cancel a reservation
ParkingSpotSchema.methods.cancelReservation = function(reservationId) {
  const reservation = this.reservations.id(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }
  
  if (reservation.status === 'completed') {
    throw new Error('Cannot cancel a completed reservation');
  }
  
  reservation.status = 'cancelled';
  return this.save();
};

// Method to complete a reservation
ParkingSpotSchema.methods.completeReservation = async function(reservationId) {
  const reservation = this.reservations.id(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }
  
  if (reservation.status !== 'checked-in') {
    throw new Error('Only checked-in reservations can be completed');
  }
  
  reservation.status = 'completed';
  await this.save();
  return reservation;
};

// Method to update spot statistics
ParkingSpotSchema.methods.updateStatistics = function(exitTime) {
  if (this.lastOccupied && exitTime) {
    const duration = Math.floor((exitTime - this.lastOccupied) / (1000 * 60));
    this.statistics.totalOccupancyTime += duration;
    this.statistics.occupancyCount += 1;
    
    // Update turnover rate (vehicles per day)
    const totalDays = Math.ceil((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
    this.statistics.turnoverRate = this.statistics.occupancyCount / totalDays;
    
    // Update revenue if hourly rate is set
    if (this.restrictions.hourlyRate > 0) {
      const hours = duration / 60;
      this.statistics.revenue += hours * this.restrictions.hourlyRate;
    }
  }
};

// Method to create a reservation
ParkingSpotSchema.methods.createReservation = async function(vehicleId, startTime, endTime) {
  // Check if spot is available for the requested time period
  const isAvailable = await this.isAvailableForTimeSlot(startTime, endTime);
  if (!isAvailable) {
    throw new Error('Spot not available for requested time period');
  }

  // Calculate reservation cost
  const hours = (endTime - startTime) / (1000 * 60 * 60);
  const amount = hours * this.restrictions.hourlyRate;

  // Generate unique confirmation code
  const confirmationCode = Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);

  this.reservations.push({
    vehicleId,
    startTime,
    endTime,
    amount,
    confirmationCode
  });

  return this.save();
};

// Method to check spot availability for a time period
ParkingSpotSchema.methods.checkAvailability = function(startTime, endTime) {
  return !this.reservations.some(reservation => {
    return reservation.status === 'confirmed' &&
           ((startTime >= reservation.startTime && startTime <= reservation.endTime) ||
            (endTime >= reservation.startTime && endTime <= reservation.endTime) ||
            (startTime <= reservation.startTime && endTime >= reservation.endTime));
  });
};

// Method to record a violation
ParkingSpotSchema.methods.recordViolation = async function(type, vehicleId, description, evidence) {
  try {
    const violation = new mongoose.model('Violation')({
      vehicle: vehicleId,
      type,
      location: `${this.section}-${this.spotId}`,
      notes: description,
      evidence,
      parkingSpot: this._id
    });

    await violation.save();

    // Update vehicle violation status
    const vehicle = await mongoose.model('Vehicle').findById(vehicleId);
    if (vehicle) {
      vehicle.violationCount += 1;
      vehicle.lastViolation = new Date();
      await vehicle.updateViolationStatus();
    }

    // Update spot statistics
    this.statistics.violations += 1;
    this.lastViolation = new Date();
    await this.save();

    return violation;
  } catch (error) {
    console.error('Error recording violation:', error);
    throw error;
  }
};

// Method to extend a reservation
ParkingSpotSchema.methods.extendReservation = async function(reservationId, newEndTime) {
  const reservation = this.reservations.id(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.status !== 'confirmed') {
    throw new Error('Can only extend active reservations');
  }

  const originalEndTime = new Date(reservation.endTime);
  newEndTime = new Date(newEndTime);

  if (newEndTime <= originalEndTime) {
    throw new Error('New end time must be after current end time');
  }

  // Check if the extension period is available
  const overlappingReservations = this.reservations.filter(r => {
    if (r._id.equals(reservationId) || r.status === 'cancelled') return false;
    
    const rStart = new Date(r.startTime);
    const rEnd = new Date(r.endTime);
    
    return (originalEndTime < rEnd && newEndTime > rStart);
  });

  if (overlappingReservations.length > 0) {
    throw new Error('Cannot extend reservation due to conflict with another reservation');
  }

  // Check operating hours
  const [operatingEndHour] = this.restrictions.operatingHours.end.split(':').map(Number);
  if (newEndTime.getHours() > operatingEndHour) {
    throw new Error('Cannot extend reservation beyond operating hours');
  }

  reservation.endTime = newEndTime;
  return this.save();
};

// Method to check in for a reservation
ParkingSpotSchema.methods.checkInReservation = async function(reservationId) {
  const reservation = this.reservations.id(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.status !== 'confirmed') {
    throw new Error('Can only check in confirmed reservations');
  }

  const now = new Date();
  const startTime = new Date(reservation.startTime);
  const endTime = new Date(reservation.endTime);

  // Allow check-in up to 15 minutes early
  const earliestCheckIn = new Date(startTime.getTime() - 15 * 60000);
  
  if (now < earliestCheckIn) {
    throw new Error('Too early to check in. You can check in 15 minutes before your reservation');
  }

  if (now > endTime) {
    throw new Error('Reservation has expired');
  }

  reservation.status = 'checked-in';
  reservation.checkInTime = now;
  this.status = 'occupied';
  
  return this.save();
};

// Method to check out from a reservation
ParkingSpotSchema.methods.checkOutReservation = async function(reservationId) {
  const reservation = this.reservations.id(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.status !== 'checked-in') {
    throw new Error('Must check in before checking out');
  }

  const now = new Date();
  reservation.checkOutTime = now;
  reservation.status = 'completed';
  this.status = 'available';

  // Calculate any overstay fees
  const endTime = new Date(reservation.endTime);
  if (now > endTime) {
    const overstayMinutes = Math.ceil((now - endTime) / (1000 * 60));
    const overstayFee = Math.ceil(overstayMinutes / 60) * this.restrictions.hourlyRate;
    reservation.overstayFee = overstayFee;
  }

  return this.save();
};

// Method to get upcoming reservations
ParkingSpotSchema.methods.getUpcomingReservations = function(userId = null) {
  const now = new Date();
  return this.reservations.filter(r => {
    if (r.status !== 'confirmed') return false;
    if (userId && r.userId !== userId) return false;
    return new Date(r.startTime) > now;
  }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
};

// Method to get current active reservation
ParkingSpotSchema.methods.getCurrentReservation = function() {
  const now = new Date();
  return this.reservations.find(r => {
    if (r.status !== 'confirmed' && r.status !== 'checked-in') return false;
    const startTime = new Date(r.startTime);
    const endTime = new Date(r.endTime);
    return now >= startTime && now <= endTime;
  });
};

// Pre-save middleware
ParkingSpotSchema.pre('save', function(next) {
  // Update status based on occupancy and maintenance
  if (this.maintenance.status === 'in-progress') {
    this.status = 'maintenance';
  } else if (this.occupied) {
    this.status = 'occupied';
  } else if (this.isModified('occupied') && !this.occupied) {
    this.status = 'available';
  }
  
  next();
});

module.exports = mongoose.model('ParkingSpot', ParkingSpotSchema);
