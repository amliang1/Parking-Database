const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ParkingSpot = require('../models/ParkingSpot');
const Vehicle = require('../models/Vehicle');

// @route   GET api/parkingspots
// @desc    Get all parking spots with optional filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching parking spots with query:', req.query);
    
    const {
      section,
      type,
      status,
      occupied,
      permitRequired,
      permitType,
      level,
      building
    } = req.query;

    const query = {};

    if (section) query.section = section;
    if (type) query.type = type;
    if (status) query.status = status;
    if (occupied !== undefined) query.occupied = occupied === 'true';
    if (permitRequired !== undefined) query['restrictions.permitRequired'] = permitRequired === 'true';
    if (permitType) query['restrictions.permitTypes'] = permitType;
    if (level) query['location.level'] = parseInt(level);
    if (building) query['location.building'] = building;

    console.log('Final query:', query);

    const spots = await ParkingSpot.find(query)
      .populate('currentVehicle', 'licensePlate make model color')
      .sort('spotId');

    console.log(`Found ${spots.length} parking spots`);

    if (!spots) {
      return res.status(404).json({ 
        message: 'No parking spots found',
        query: query 
      });
    }

    res.json(spots);
  } catch (err) {
    console.error('Error fetching parking spots:', err);
    res.status(500).json({ 
      message: 'Error fetching parking spots',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// @route   GET api/parkingspots/occupancy
// @desc    Get parking spot occupancy statistics
// @access  Private
router.get('/occupancy', auth, async (req, res) => {
  try {
    const { section, level, building } = req.query;
    const query = {};

    if (section) query.section = section;
    if (level) query['location.level'] = parseInt(level);
    if (building) query['location.building'] = building;

    const [totalSpots, occupiedSpots] = await Promise.all([
      ParkingSpot.countDocuments(query),
      ParkingSpot.countDocuments({ ...query, occupied: true })
    ]);

    const occupancyRate = totalSpots > 0 ? (occupiedSpots / totalSpots) * 100 : 0;

    res.json({
      total: totalSpots,
      occupied: occupiedSpots,
      available: totalSpots - occupiedSpots,
      occupancyRate
    });
  } catch (err) {
    console.error('Error fetching occupancy:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/parkingspots/nearby
// @desc    Find nearby available parking spots
// @access  Private
router.get('/nearby', auth, async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 1000, type } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Location coordinates are required' });
    }

    const query = {
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      status: 'available',
      occupied: false
    };

    if (type) query.type = type;

    const spots = await ParkingSpot.find(query)
      .limit(10)
      .select('spotId type location restrictions');

    res.json(spots);
  } catch (err) {
    console.error('Error finding nearby spots:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/parkingspots/:id
// @desc    Get parking spot by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const spot = await ParkingSpot.findById(req.params.id)
      .populate('currentVehicle', 'licensePlate make model color permits');

    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }

    res.json(spot);
  } catch (err) {
    console.error('Error fetching parking spot:', err);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/parkingspots/:id/maintenance
// @desc    Update parking spot maintenance status
// @access  Private
router.put('/:id/maintenance', auth, async (req, res) => {
  try {
    const { status, notes, nextScheduled } = req.body;
    const spot = await ParkingSpot.findById(req.params.id);

    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }

    spot.maintenance.status = status;
    if (notes) spot.maintenance.notes = notes;
    if (nextScheduled) spot.maintenance.nextScheduled = nextScheduled;
    
    if (status === 'completed') {
      spot.maintenance.lastMaintenance = new Date();
    }

    await spot.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('spot:maintenance', { spotId: spot._id, status });

    res.json(spot);
  } catch (err) {
    console.error('Error updating maintenance status:', err);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/parkingspots/:id/sensor
// @desc    Update parking spot sensor status
// @access  Private
router.put('/:id/sensor', auth, async (req, res) => {
  try {
    const { status, reading } = req.body;
    const spot = await ParkingSpot.findById(req.params.id);

    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }

    spot.sensors.status = status;
    spot.sensors.lastReading = new Date();

    // Update occupancy based on sensor reading if provided
    if (reading !== undefined) {
      const previousOccupied = spot.occupied;
      spot.occupied = reading;

      if (!previousOccupied && reading) {
        spot.lastOccupied = new Date();
      } else if (previousOccupied && !reading) {
        spot.updateStatistics(new Date());
      }
    }

    await spot.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('spot:sensor', { 
      spotId: spot._id, 
      status,
      occupied: spot.occupied
    });

    res.json(spot);
  } catch (err) {
    console.error('Error updating sensor status:', err);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/parkingspots/:id/restrictions
// @desc    Update parking spot restrictions
// @access  Private
router.put('/:id/restrictions', auth, async (req, res) => {
  try {
    const { timeLimit, permitRequired, permitTypes } = req.body;
    const spot = await ParkingSpot.findById(req.params.id);

    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }

    if (timeLimit !== undefined) spot.restrictions.timeLimit = timeLimit;
    if (permitRequired !== undefined) spot.restrictions.permitRequired = permitRequired;
    if (permitTypes) spot.restrictions.permitTypes = permitTypes;

    await spot.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('spot:restrictions', { 
      spotId: spot._id, 
      restrictions: spot.restrictions 
    });

    res.json(spot);
  } catch (err) {
    console.error('Error updating restrictions:', err);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/parkingspots/:id/reservations
// @desc    Create a new reservation for a parking spot
// @access  Private
router.post('/:id/reservations', auth, async (req, res) => {
  try {
    const { startTime, endTime, userId } = req.body;

    if (!startTime || !endTime || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: startTime, endTime, and userId are required' 
      });
    }

    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    try {
      // Check if spot is available for the requested time
      await spot.isAvailableForTimeSlot(new Date(startTime), new Date(endTime));
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const reservation = {
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      userId,
      status: 'confirmed'
    };

    spot.reservations.push(reservation);
    await spot.save();

    const newReservation = spot.reservations[spot.reservations.length - 1];
    res.status(201).json({ 
      success: true, 
      reservation: {
        _id: newReservation._id,
        startTime: newReservation.startTime,
        endTime: newReservation.endTime,
        userId: newReservation.userId,
        status: newReservation.status
      }
    });
  } catch (err) {
    console.error('Error creating reservation:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET api/parkingspots/:id/reservations
// @desc    Get all reservations for a parking spot
// @access  Private
router.get('/:id/reservations', auth, async (req, res) => {
  try {
    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    const reservations = spot.reservations.map(r => ({
      _id: r._id,
      startTime: r.startTime,
      endTime: r.endTime,
      userId: r.userId,
      status: r.status
    }));

    res.json(reservations);
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   DELETE api/parkingspots/:id/reservations/:reservationId
// @desc    Cancel a reservation
// @access  Private
router.delete('/:id/reservations/:reservationId', auth, async (req, res) => {
  try {
    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    try {
      await spot.cancelReservation(req.params.reservationId);
      res.json({ success: true, message: 'Reservation cancelled successfully' });
    } catch (error) {
      if (error.message === 'Reservation not found') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message === 'Cannot cancel a completed reservation') {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }
  } catch (err) {
    console.error('Error cancelling reservation:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST api/parkingspots/:id/violations
// @desc    Record a parking violation
// @access  Private
router.post('/:id/violations', auth, async (req, res) => {
  try {
    const { type, vehicleId, description, evidence } = req.body;

    if (!type) {
      return res.status(400).json({ message: 'Violation type is required' });
    }

    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }

    await spot.recordViolation(type, vehicleId, description, evidence);

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('spot:violation', { 
      spotId: spot._id,
      violation: spot.violations[spot.violations.length - 1]
    });

    res.json(spot);
  } catch (err) {
    console.error('Error recording violation:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/parkingspots/:id/violations
// @desc    Get spot violations
// @access  Private
router.get('/:id/violations', auth, async (req, res) => {
  try {
    const { status, startDate, endDate, type } = req.query;
    const spot = await ParkingSpot.findById(req.params.id)
      .populate('violations.vehicleId', 'licensePlate make model');

    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }

    let violations = spot.violations;

    if (status) {
      violations = violations.filter(v => v.status === status);
    }

    if (type) {
      violations = violations.filter(v => v.type === type);
    }

    if (startDate && endDate) {
      violations = violations.filter(v => 
        v.timestamp >= new Date(startDate) && v.timestamp <= new Date(endDate)
      );
    }

    res.json(violations);
  } catch (err) {
    console.error('Error fetching violations:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/parkingspots/analytics
// @desc    Get parking analytics
// @access  Private
router.get('/analytics', auth, async (req, res) => {
  try {
    const { startDate, endDate, section, type } = req.query;
    const query = {};

    if (section) query.section = section;
    if (type) query.type = type;

    const spots = await ParkingSpot.find(query);

    const analytics = {
      totalRevenue: 0,
      averageTurnoverRate: 0,
      totalViolations: 0,
      occupancyByType: {},
      violationsByType: {},
      revenueBySection: {},
      peakHours: Array(24).fill(0)
    };

    spots.forEach(spot => {
      // Revenue
      analytics.totalRevenue += spot.statistics.revenue;
      analytics.revenueBySection[spot.section] = (analytics.revenueBySection[spot.section] || 0) + spot.statistics.revenue;

      // Turnover
      analytics.averageTurnoverRate += spot.statistics.turnoverRate;

      // Violations
      analytics.totalViolations += spot.statistics.violationCount;
      spot.violations.forEach(v => {
        analytics.violationsByType[v.type] = (analytics.violationsByType[v.type] || 0) + 1;
      });

      // Occupancy by type
      if (!analytics.occupancyByType[spot.type]) {
        analytics.occupancyByType[spot.type] = {
          total: 0,
          occupied: 0
        };
      }
      analytics.occupancyByType[spot.type].total++;
      if (spot.occupied) {
        analytics.occupancyByType[spot.type].occupied++;
      }

      // Peak hours analysis
      spot.reservations.forEach(r => {
        if ((!startDate || r.startTime >= new Date(startDate)) && 
            (!endDate || r.endTime <= new Date(endDate))) {
          const hour = new Date(r.startTime).getHours();
          analytics.peakHours[hour]++;
        }
      });
    });

    // Calculate averages
    analytics.averageTurnoverRate /= spots.length;
    Object.keys(analytics.occupancyByType).forEach(type => {
      const typeStats = analytics.occupancyByType[type];
      typeStats.occupancyRate = (typeStats.occupied / typeStats.total) * 100;
    });

    res.json(analytics);
  } catch (err) {
    console.error('Error generating analytics:', err);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/parkingspots/:id/reservations/:reservationId/extend
// @desc    Extend a reservation
// @access  Private
router.put('/:id/reservations/:reservationId/extend', auth, async (req, res) => {
  try {
    const { newEndTime } = req.body;
    if (!newEndTime) {
      return res.status(400).json({ success: false, message: 'New end time is required' });
    }

    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    try {
      await spot.extendReservation(req.params.reservationId, newEndTime);
      res.json({ success: true, message: 'Reservation extended successfully' });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  } catch (err) {
    console.error('Error extending reservation:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST api/parkingspots/:id/reservations/:reservationId/check-in
// @desc    Check in for a reservation
// @access  Private
router.post('/:id/reservations/:reservationId/check-in', auth, async (req, res) => {
  try {
    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    try {
      await spot.checkInReservation(req.params.reservationId);
      res.json({ success: true, message: 'Checked in successfully' });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  } catch (err) {
    console.error('Error checking in:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST api/parkingspots/:id/reservations/:reservationId/check-out
// @desc    Check out from a reservation
// @access  Private
router.post('/:id/reservations/:reservationId/check-out', auth, async (req, res) => {
  try {
    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    try {
      const result = await spot.checkOutReservation(req.params.reservationId);
      const reservation = result.reservations.id(req.params.reservationId);
      
      const response = {
        success: true,
        message: 'Checked out successfully',
        checkOutTime: reservation.checkOutTime
      };

      if (reservation.overstayFee) {
        response.overstayFee = reservation.overstayFee;
        response.message += `. Overstay fee: $${reservation.overstayFee}`;
      }

      res.json(response);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  } catch (err) {
    console.error('Error checking out:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET api/parkingspots/:id/reservations/upcoming
// @desc    Get upcoming reservations for a spot
// @access  Private
router.get('/:id/reservations/upcoming', auth, async (req, res) => {
  try {
    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    const userId = req.query.userId; // Optional filter by user
    const upcomingReservations = spot.getUpcomingReservations(userId);

    res.json(upcomingReservations.map(r => ({
      _id: r._id,
      startTime: r.startTime,
      endTime: r.endTime,
      userId: r.userId,
      status: r.status
    })));
  } catch (err) {
    console.error('Error fetching upcoming reservations:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET api/parkingspots/:id/reservations/current
// @desc    Get current active reservation for a spot
// @access  Private
router.get('/:id/reservations/current', auth, async (req, res) => {
  try {
    const spot = await ParkingSpot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Parking spot not found' });
    }

    const currentReservation = spot.getCurrentReservation();
    if (!currentReservation) {
      return res.json(null);
    }

    res.json({
      _id: currentReservation._id,
      startTime: currentReservation.startTime,
      endTime: currentReservation.endTime,
      userId: currentReservation.userId,
      status: currentReservation.status,
      checkedIn: currentReservation.checkedIn,
      checkInTime: currentReservation.checkInTime
    });
  } catch (err) {
    console.error('Error fetching current reservation:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
