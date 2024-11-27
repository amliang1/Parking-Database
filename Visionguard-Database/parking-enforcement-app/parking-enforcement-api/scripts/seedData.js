require('dotenv').config();
const mongoose = require('mongoose');
const ParkingSpot = require('../models/ParkingSpot');
const Vehicle = require('../models/Vehicle');
const User = require('../models/Users');

if (!process.env.MONGO_URI) {
  console.error('Please set the MONGO_URI environment variable');
  process.exit(1);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Generate random date within a range
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate random coordinates within San Francisco area
const generateSFCoordinates = () => {
  const sfBounds = {
    lat: { min: 37.708, max: 37.818 },
    lng: { min: -122.513, max: -122.355 }
  };
  return [
    sfBounds.lng.min + Math.random() * (sfBounds.lng.max - sfBounds.lng.min),
    sfBounds.lat.min + Math.random() * (sfBounds.lat.max - sfBounds.lat.min)
  ];
};

const generateReservations = (spotId) => {
  const now = new Date();
  const reservations = [];
  const statuses = ['confirmed', 'checked-in', 'completed', 'cancelled'];
  const users = ['user1', 'user2', 'user3', 'user4', 'user5'];

  // Past reservations
  for (let i = 0; i < 3; i++) {
    const startTime = randomDate(new Date(now - 7 * 24 * 60 * 60 * 1000), now);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    reservations.push({
      startTime,
      endTime,
      userId: users[Math.floor(Math.random() * users.length)],
      status: 'completed',
      checkInTime: startTime,
      checkOutTime: endTime
    });
  }

  // Current/upcoming reservations
  for (let i = 0; i < 2; i++) {
    const startTime = randomDate(now, new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    const status = statuses[Math.floor(Math.random() * 2)]; // Only confirmed or checked-in
    reservations.push({
      startTime,
      endTime,
      userId: users[Math.floor(Math.random() * users.length)],
      status,
      checkInTime: status === 'checked-in' ? now : null,
      checkOutTime: null
    });
  }

  return reservations;
};

const generateParkingSpots = (count) => {
  const spots = [];
  const sections = ['A', 'B', 'C', 'D'];
  const types = ['standard', 'handicap', 'electric', 'compact'];
  const statuses = ['available', 'occupied', 'reserved', 'maintenance'];

  for (let i = 1; i <= count; i++) {
    const section = sections[Math.floor(Math.random() * sections.length)];
    const spotId = `${section}-${String(i).padStart(3, '0')}`;
    const coordinates = generateSFCoordinates();

    spots.push({
      spotId,
      section,
      type: types[Math.floor(Math.random() * types.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      location: {
        coordinates,
        level: Math.floor(Math.random() * 3) + 1,
        building: 'Main'
      },
      operatingHours: {
        start: '08:00',
        end: '20:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      },
      hourlyRate: Math.floor(Math.random() * 15) + 5,
      reservations: generateReservations(spotId),
      sensors: {
        occupancySensor: true,
        lastReading: new Date(),
        status: 'active',
        batteryLevel: Math.floor(Math.random() * 100)
      },
      statistics: {
        totalOccupancyTime: Math.floor(Math.random() * 100000),
        occupancyCount: Math.floor(Math.random() * 1000),
        violationCount: Math.floor(Math.random() * 50),
        revenue: Math.floor(Math.random() * 10000),
        turnoverRate: Math.random() * 5
      }
    });
  }

  return spots;
};

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Clear existing data
    await ParkingSpot.deleteMany({});
    console.log('Cleared existing parking spots');

    // Generate and insert new parking spots
    const parkingSpots = generateParkingSpots(20);
    await ParkingSpot.insertMany(parkingSpots);
    console.log('Inserted sample parking spots');

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
