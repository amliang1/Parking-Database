const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Vehicle = require('../models/Vehicle');
const ParkingSpot = require('../models/ParkingSpot');
const ParkingRecord = require('../models/ParkingRecord');

// @route   GET /api/vehicles/active
// @desc    Get all active vehicles
// @access  Private
router.get('/active', auth, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isParked: true })
      .populate('parkingSpot')
      .sort('-entryTime');
    res.json(vehicles);
  } catch (err) {
    console.error('Error fetching active vehicles:', err);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/vehicles/enter
// @desc    Register a vehicle entering the parking lot
// @access  Private
router.post('/enter', auth, async (req, res) => {
  try {
    const { licensePlate, spotId, make, model, color } = req.body;

    console.log('Vehicle entry request:', {
      licensePlate,
      spotId,
      make,
      model,
      color
    });

    if (!licensePlate || !spotId || !make || !model || !color) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: ['licensePlate', 'spotId', 'make', 'model', 'color'],
        received: { licensePlate, spotId, make, model, color }
      });
    }

    // Find parking spot
    const parkingSpot = await ParkingSpot.findOne({ spotId });
    console.log('Found parking spot:', parkingSpot);

    if (!parkingSpot) {
      return res.status(404).json({ message: 'Parking spot not found' });
    }

    // Check spot status
    if (parkingSpot.status === 'maintenance') {
      return res.status(400).json({ message: 'Parking spot is under maintenance' });
    }
    if (parkingSpot.status === 'blocked') {
      return res.status(400).json({ message: 'Parking spot is blocked' });
    }
    if (parkingSpot.occupied || parkingSpot.status === 'occupied') {
      return res.status(400).json({ message: 'Parking spot is already occupied' });
    }

    // Check if vehicle already exists and is parked
    const existingVehicle = await Vehicle.findOne({ 
      licensePlate: licensePlate.toUpperCase(),
      isParked: true
    });

    if (existingVehicle) {
      return res.status(400).json({ 
        message: 'This vehicle is already registered as parked in another spot' 
      });
    }

    // Initialize occupancyHistory array if it doesn't exist
    if (!parkingSpot.occupancyHistory) {
      parkingSpot.occupancyHistory = [];
    }

    // Create new vehicle record
    const vehicle = new Vehicle({
      licensePlate: licensePlate.toUpperCase(),
      make,
      model,
      color,
      parkingSpot: parkingSpot._id,
      entryTime: new Date(),
      isParked: true
    });

    console.log('Created vehicle record:', vehicle);

    // Update parking spot status
    parkingSpot.occupied = true;
    parkingSpot.status = 'occupied';
    parkingSpot.currentVehicle = vehicle._id;
    parkingSpot.lastOccupied = new Date();
    parkingSpot.occupancyHistory.push({
      vehicle: vehicle._id,
      startTime: new Date()
    });

    console.log('Updating parking spot:', {
      id: parkingSpot._id,
      spotId: parkingSpot.spotId,
      status: parkingSpot.status,
      occupied: parkingSpot.occupied,
      currentVehicle: parkingSpot.currentVehicle
    });

    try {
      // Save both records
      await Promise.all([
        vehicle.save(),
        parkingSpot.save()
      ]);
    } catch (saveError) {
      console.error('Error saving records:', saveError);
      return res.status(500).json({
        message: 'Error saving vehicle or parking spot',
        error: saveError.message
      });
    }

    try {
      // Create parking record
      const parkingRecord = new ParkingRecord({
        vehicle: vehicle._id,
        parkingSpot: parkingSpot._id,
        entryTime: new Date()
      });
      await parkingRecord.save();
      console.log('Created parking record:', parkingRecord);
    } catch (recordError) {
      console.error('Error creating parking record:', recordError);
      // Don't fail the request if parking record fails
    }

    // Return vehicle data with populated parking spot
    const populatedVehicle = await Vehicle.findById(vehicle._id).populate('parkingSpot');
    res.json(populatedVehicle);
  } catch (err) {
    console.error('Error registering vehicle entry:', err);
    res.status(500).json({ 
      message: 'Error registering vehicle entry',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// @route   POST /api/vehicles/exit
// @desc    Register a vehicle exiting the parking lot
// @access  Private
router.post('/exit', auth, async (req, res) => {
  try {
    const { licensePlate } = req.body;

    // Find vehicle
    const vehicle = await Vehicle.findOne({ licensePlate, isParked: true });
    if (!vehicle) {
      return res.status(404).json({ message: 'No active vehicle found with this license plate' });
    }

    // Update parking spot
    const parkingSpot = await ParkingSpot.findById(vehicle.parkingSpot);
    if (parkingSpot) {
      parkingSpot.occupied = false;
      parkingSpot.currentVehicle = null;
      await parkingSpot.save();
    }

    // Update parking record
    const parkingRecord = await ParkingRecord.findOne({
      vehicle: vehicle._id,
      exitTime: null
    });
    if (parkingRecord) {
      parkingRecord.exitTime = new Date();
      await parkingRecord.save();
    }

    // Update vehicle record
    vehicle.isParked = false;
    vehicle.exitTime = new Date();
    vehicle.parkingSpot = null;
    await vehicle.save();

    res.json(vehicle);
  } catch (err) {
    console.error('Error registering vehicle exit:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/vehicles/history
// @desc    Get parking history for a vehicle
// @access  Private
router.get('/history/:licensePlate', auth, async (req, res) => {
  try {
    const { licensePlate } = req.params;
    const records = await ParkingRecord.find()
      .populate({
        path: 'vehicle',
        match: { licensePlate: new RegExp(licensePlate, 'i') }
      })
      .populate('parkingSpot')
      .sort('-entryTime');

    // Filter out records where vehicle didn't match
    const validRecords = records.filter(record => record.vehicle);
    res.json(validRecords);
  } catch (err) {
    console.error('Error fetching vehicle history:', err);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/vehicles/:id/violation
// @desc    Update vehicle violation status
// @access  Private
router.put('/:id/violation', auth, async (req, res) => {
  try {
    const { violationStatus } = req.body;
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    vehicle.violationStatus = violationStatus;
    await vehicle.save();

    // Emit real-time update
    const io = req.app.get('io');
    const updatedVehicle = await vehicle.populate('parkingSpot');
    io.emit('vehicle:update', updatedVehicle);

    res.json(vehicle);
  } catch (err) {
    console.error('Error updating vehicle violation status:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
