const mongoose = require('mongoose');
require('dotenv').config();

const ParkingRecord = require('../models/ParkingRecord');
const ParkingSpot = require('../models/ParkingSpot');
const Vehicle = require('../models/Vehicle');

const generateParkingRecords = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Get all parking spots
    const parkingSpots = await ParkingSpot.find();
    console.log(`Found ${parkingSpots.length} parking spots`);

    // Create some sample vehicles
    await Vehicle.deleteMany({});
    const vehicles = await Vehicle.insertMany([
      { licensePlate: 'ABC123', make: 'Toyota', model: 'Camry', color: 'Silver' },
      { licensePlate: 'XYZ789', make: 'Honda', model: 'Civic', color: 'Blue' },
      { licensePlate: 'DEF456', make: 'Ford', model: 'F-150', color: 'Red' },
      { licensePlate: 'GHI789', make: 'Tesla', model: 'Model 3', color: 'White' },
      { licensePlate: 'JKL012', make: 'BMW', model: 'X5', color: 'Black' }
    ]);
    console.log(`Created ${vehicles.length} sample vehicles`);
    
    // Clear existing records
    await ParkingRecord.deleteMany({});
    console.log('Cleared existing parking records');

    const records = [];
    const now = new Date();
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Generate records for the past 7 days
    for (const spot of parkingSpots) {
      // Generate 3-5 records per day for each spot
      for (let day = 0; day < 7; day++) {
        const recordsPerDay = Math.floor(Math.random() * 3) + 3;
        
        for (let i = 0; i < recordsPerDay; i++) {
          const startDay = new Date(past7Days.getTime() + day * 24 * 60 * 60 * 1000);
          const startHour = 8 + Math.floor(Math.random() * 10); // Between 8 AM and 6 PM
          startDay.setHours(startHour, Math.floor(Math.random() * 60));

          const duration = Math.floor(Math.random() * 4) + 1; // 1-4 hours
          const endDay = new Date(startDay.getTime() + duration * 60 * 60 * 1000);
          const randomVehicle = vehicles[Math.floor(Math.random() * vehicles.length)];

          const record = new ParkingRecord({
            parkingSpot: spot._id,
            section: spot.section,
            vehicle: randomVehicle._id,
            entryTime: startDay,
            exitTime: endDay,
            duration: duration * 60, // in minutes
            fee: duration * (spot.hourlyRate || 10), // default hourly rate of 10 if not set
            violationIssued: Math.random() < 0.1 // 10% chance of violation
          });

          records.push(record);
        }
      }
    }

    // Insert all records
    await ParkingRecord.insertMany(records);
    console.log(`Created ${records.length} parking records`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

generateParkingRecords();
