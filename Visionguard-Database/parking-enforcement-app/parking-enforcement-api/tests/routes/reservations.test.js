const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const ParkingSpot = require('../../models/ParkingSpot');
const { generateToken } = require('../../utils/auth');

let mongoServer;
let authToken;
let testSpot;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  authToken = generateToken({ id: 'testuser' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ParkingSpot.deleteMany({});
  testSpot = await ParkingSpot.create({
    spotId: 'A-123',
    section: 'A',
    type: 'standard',
    location: {
      coordinates: [-122.419416, 37.774929],
      level: 1,
      building: 'Main'
    },
    operatingHours: {
      start: '08:00',
      end: '20:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    hourlyRate: 10
  });
});

describe('Reservation System Tests', () => {
  describe('POST /api/parkingspots/:id/reservations', () => {
    test('should create a valid reservation', async () => {
      const startTime = new Date();
      startTime.setHours(10, 0); // Set to 10 AM
      const endTime = new Date(startTime);
      endTime.setHours(12, 0); // Set to 12 PM

      const res = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.reservation).toHaveProperty('startTime');
      expect(res.body.reservation).toHaveProperty('endTime');
      expect(res.body.reservation.status).toBe('confirmed');
    });

    test('should reject reservation for occupied time slot', async () => {
      // Create initial reservation
      const startTime = new Date();
      startTime.setHours(10, 0); // Set to 10 AM
      const endTime = new Date(startTime);
      endTime.setHours(12, 0); // Set to 12 PM

      await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser'
        });

      // Try to create overlapping reservation
      const res = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser2'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already reserved');
    });

    test('should reject reservation outside operating hours', async () => {
      const startTime = new Date();
      startTime.setHours(22, 0); // After operating hours (10 PM)
      const endTime = new Date(startTime);
      endTime.setHours(23, 0); // 11 PM

      const res = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('operating hours');
    });
  });

  describe('GET /api/parkingspots/:id/reservations', () => {
    test('should get all reservations for a spot', async () => {
      // Create a reservation
      const startTime = new Date();
      startTime.setHours(10, 0); // Set to 10 AM
      const endTime = new Date(startTime);
      endTime.setHours(12, 0); // Set to 12 PM

      const createRes = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser'
        });

      const res = await request(app)
        .get(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('userId', 'testuser');
    });
  });

  describe('DELETE /api/parkingspots/:id/reservations/:reservationId', () => {
    test('should cancel a reservation', async () => {
      // Create a reservation
      const startTime = new Date();
      startTime.setHours(10, 0); // Set to 10 AM
      const endTime = new Date(startTime);
      endTime.setHours(12, 0); // Set to 12 PM

      const createRes = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser'
        });

      // Get the spot to find the reservation ID
      const spot = await ParkingSpot.findById(testSpot._id);
      const reservationId = spot.reservations[0]._id;

      const res = await request(app)
        .delete(`/api/parkingspots/${testSpot._id}/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('cancelled');
    });
  });
});
