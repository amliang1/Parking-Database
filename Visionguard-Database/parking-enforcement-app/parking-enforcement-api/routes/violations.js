const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Violation = require('../models/Violation');
const Vehicle = require('../models/Vehicle');
const ParkingSpot = require('../models/ParkingSpot');
const { check, validationResult } = require('express-validator');

// @route   GET api/violations
// @desc    Get all violations with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      status,
      type,
      startDate,
      endDate,
      vehiclePlate,
      page = 1,
      limit = 10,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Apply filters
    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Handle vehicle plate filter
    if (vehiclePlate) {
      const vehicles = await Vehicle.find({ 
        licensePlate: new RegExp(vehiclePlate, 'i') 
      }).select('_id');
      query.vehicle = { $in: vehicles.map(v => v._id) };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build sort object
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query with pagination
    const [violations, total] = await Promise.all([
      Violation.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('vehicle', 'licensePlate make model color')
        .populate('processedBy', 'email')
        .lean(),
      Violation.countDocuments(query)
    ]);

    res.json({
      violations,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching violations:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET api/violations/recent
// @desc    Get recent violations
// @access  Private
router.get('/recent', auth, async (req, res) => {
  try {
    const violations = await Violation.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('vehicle', 'licensePlate make model color')
      .populate('processedBy', 'email')
      .lean();

    res.json(violations);
  } catch (err) {
    console.error('Error fetching recent violations:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET api/violations/stats
// @desc    Get violation statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const [
      total,
      byStatus,
      byType,
      recentTrend
    ] = await Promise.all([
      Violation.countDocuments(),
      Violation.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Violation.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      Violation.aggregate([
        {
          $match: {
            timestamp: { 
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);

    res.json({
      total,
      byStatus: byStatus.reduce((acc, curr) => ({
        ...acc,
        [curr._id]: curr.count
      }), {}),
      byType: byType.reduce((acc, curr) => ({
        ...acc,
        [curr._id]: curr.count
      }), {}),
      recentTrend
    });
  } catch (err) {
    console.error('Error fetching violation stats:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET api/violations/:id
// @desc    Get violation by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id)
      .populate('vehicle', 'licensePlate make model color')
      .populate('processedBy', 'email')
      .lean();

    if (!violation) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    res.json(violation);
  } catch (err) {
    console.error('Error fetching violation:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST api/violations
// @desc    Create a new violation
// @access  Private
router.post('/', [
  auth,
  [
    check('vehicle', 'Vehicle ID is required').not().isEmpty(),
    check('type', 'Violation type is required').isIn([
      'overtime', 'no_permit', 'wrong_spot', 'unauthorized', 'other'
    ]),
    check('location', 'Location is required').not().isEmpty(),
    check('evidence', 'At least one evidence item is required').isArray({ min: 1 })
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { vehicle, type, location, notes, evidence, fine } = req.body;

    // Verify vehicle exists
    const vehicleExists = await Vehicle.findById(vehicle);
    if (!vehicleExists) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const violation = new Violation({
      vehicle,
      type,
      location,
      notes,
      evidence,
      fine: fine ? {
        amount: fine.amount,
        status: 'pending'
      } : undefined,
      timestamp: new Date()
    });

    await violation.save();

    const populatedViolation = await Violation.findById(violation._id)
      .populate('vehicle', 'licensePlate make model color')
      .lean();

    res.json(populatedViolation);
  } catch (err) {
    console.error('Error creating violation:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST api/violations/manual
// @desc    Create a manual violation entry
// @access  Private
router.post('/manual', [
  auth,
  [
    check('licensePlate', 'License plate is required').not().isEmpty(),
    check('type', 'Violation type is required').isIn([
      'overtime', 'no_permit', 'wrong_spot', 'unauthorized', 'other'
    ]),
    check('location', 'Location is required').not().isEmpty(),
    check('evidence', 'At least one evidence item is required').isArray({ min: 1 }),
    check('timestamp', 'Timestamp is required').optional().isISO8601(),
    check('fine.amount', 'Fine amount must be a positive number').optional().isFloat({ min: 0 })
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      licensePlate,
      type,
      location,
      notes,
      evidence,
      timestamp,
      fine,
      parkingSpotId
    } = req.body;

    // Find or create vehicle
    let vehicle = await Vehicle.findOne({ licensePlate: licensePlate.toUpperCase() });
    
    if (!vehicle) {
      vehicle = new Vehicle({
        licensePlate: licensePlate.toUpperCase(),
        violationCount: 0
      });
      await vehicle.save();
    }

    // Create violation object
    const violationData = {
      vehicle: vehicle._id,
      type,
      location,
      notes,
      evidence,
      timestamp: timestamp || new Date(),
      fine: fine ? {
        amount: fine.amount,
        status: 'pending'
      } : undefined
    };

    // If parkingSpotId is provided, validate and include it
    if (parkingSpotId) {
      const parkingSpot = await ParkingSpot.findById(parkingSpotId);
      if (!parkingSpot) {
        return res.status(404).json({ message: 'Parking spot not found' });
      }
      violationData.parkingSpot = parkingSpotId;
    }

    const violation = new Violation(violationData);
    await violation.save();

    // Update vehicle violation status
    vehicle.violationCount += 1;
    vehicle.lastViolation = violation.timestamp;
    await vehicle.updateViolationStatus();

    // If parking spot exists, update its statistics
    if (parkingSpotId) {
      const parkingSpot = await ParkingSpot.findById(parkingSpotId);
      if (parkingSpot) {
        parkingSpot.statistics.violations += 1;
        parkingSpot.lastViolation = violation.timestamp;
        await parkingSpot.save();
      }
    }

    // Return populated violation
    const populatedViolation = await Violation.findById(violation._id)
      .populate('vehicle', 'licensePlate make model color')
      .populate('parkingSpot', 'spotId section')
      .lean();

    res.json(populatedViolation);
  } catch (err) {
    console.error('Error creating manual violation:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT api/violations/:id
// @desc    Update violation
// @access  Private
router.put('/:id', [
  auth,
  [
    check('status').optional().isIn(['pending', 'processed', 'cancelled', 'appealed']),
    check('fine.status').optional().isIn(['pending', 'paid', 'waived'])
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { status, notes, fine } = req.body;

    const violation = await Violation.findById(req.params.id);
    if (!violation) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    // Update fields if provided
    if (status) {
      violation.status = status;
      violation.processedBy = req.user.id;
      violation.processedAt = new Date();
    }
    
    if (notes) violation.notes = notes;
    
    if (fine) {
      violation.fine = {
        ...violation.fine,
        ...fine,
        paidAt: fine.status === 'paid' ? new Date() : violation.fine?.paidAt
      };
    }

    await violation.save();

    const updatedViolation = await Violation.findById(violation._id)
      .populate('vehicle', 'licensePlate make model color')
      .populate('processedBy', 'email')
      .lean();

    res.json(updatedViolation);
  } catch (err) {
    console.error('Error updating violation:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE api/violations/:id
// @desc    Delete violation
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const violation = await Violation.findById(req.params.id);
    if (!violation) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    await violation.remove();
    res.json({ message: 'Violation removed' });
  } catch (err) {
    console.error('Error deleting violation:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
