const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const ParkingSpot = require('../../models/ParkingSpot');
const { generateToken } = require('../../utils/auth');

let mongoServer;
let authToken;
let testSpot;
let testReservation;

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
  
  // Create a test parking spot
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

  // Create a test reservation for current time
  const now = new Date();
  const startTime = new Date(now);
  startTime.setMinutes(now.getMinutes() - 30); // Start 30 minutes ago
  const endTime = new Date(startTime);
  endTime.setHours(startTime.getHours() + 2); // End in 1.5 hours

  const createRes = await request(app)
    .post(`/api/parkingspots/${testSpot._id}/reservations`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      userId: 'testuser'
    });

  const spot = await ParkingSpot.findById(testSpot._id);
  testReservation = spot.reservations[0];
});

describe('Quick Actions Tests', () => {
  describe('PUT /api/parkingspots/:id/reservations/:reservationId/extend', () => {
    test('should extend a reservation successfully', async () => {
      // Get current reservation
      const spot = await ParkingSpot.findById(testSpot._id);
      const reservation = spot.reservations[0];
      
      // Set new end time within operating hours
      const currentEndTime = new Date(reservation.endTime);
      const newEndTime = new Date(currentEndTime);
      newEndTime.setHours(19, 0); // Set to 7 PM, within operating hours

      const res = await request(app)
        .put(`/api/parkingspots/${testSpot._id}/reservations/${reservation._id}/extend`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newEndTime: newEndTime.toISOString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('extended successfully');

      // Verify extension
      const updatedSpot = await ParkingSpot.findById(testSpot._id);
      const updatedReservation = updatedSpot.reservations.id(reservation._id);
      expect(new Date(updatedReservation.endTime).getTime()).toBe(newEndTime.getTime());
    });

    test('should reject extension beyond operating hours', async () => {
      // Get current reservation
      const spot = await ParkingSpot.findById(testSpot._id);
      const reservation = spot.reservations[0];
      
      // Set new end time beyond operating hours
      const currentEndTime = new Date(reservation.endTime);
      const newEndTime = new Date(currentEndTime);
      newEndTime.setHours(22, 0); // Set to 10 PM, beyond operating hours

      const res = await request(app)
        .put(`/api/parkingspots/${testSpot._id}/reservations/${reservation._id}/extend`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newEndTime: newEndTime.toISOString() });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('operating hours');
    });
  });

  describe('POST /api/parkingspots/:id/reservations/:reservationId/check-in', () => {
    test('should check in successfully', async () => {
      // First get the current reservation
      const spot = await ParkingSpot.findById(testSpot._id);
      const reservation = spot.reservations[0];

      const res = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations/${reservation._id}/check-in`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Checked in successfully');

      // Verify check-in
      const updatedSpot = await ParkingSpot.findById(testSpot._id);
      const updatedReservation = updatedSpot.reservations.id(reservation._id);
      expect(updatedReservation.status).toBe('checked-in');
      expect(updatedReservation.checkInTime).toBeDefined();
      expect(updatedSpot.status).toBe('occupied');
    });

    test('should reject early check-in', async () => {
      // Create a future reservation
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 3); // 3 hours from now
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 2);

      const createRes = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser'
        });

      const spot = await ParkingSpot.findById(testSpot._id);
      const futureReservation = spot.reservations[spot.reservations.length - 1];

      const res = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations/${futureReservation._id}/check-in`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Too early to check in');
    });
  });

  describe('POST /api/parkingspots/:id/reservations/:reservationId/check-out', () => {
    test('should check out successfully with no overstay', async () => {
      // First check in the reservation
      const spot = await ParkingSpot.findById(testSpot._id);
      const reservation = spot.reservations[0];

      await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations/${reservation._id}/check-in`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then attempt check out
      const res = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations/${reservation._id}/check-out`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Checked out successfully');
      expect(res.body.checkOutTime).toBeDefined();

      // Verify check-out
      const updatedSpot = await ParkingSpot.findById(testSpot._id);
      const updatedReservation = updatedSpot.reservations.id(reservation._id);
      expect(updatedReservation.status).toBe('completed');
      expect(updatedReservation.checkOutTime).toBeDefined();
      expect(updatedSpot.status).toBe('available');
    });

    test('should reject check-out without check-in', async () => {
      // Get current reservation
      const spot = await ParkingSpot.findById(testSpot._id);
      const reservation = spot.reservations[0];

      const res = await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations/${reservation._id}/check-out`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Must check in before checking out');
    });
  });

  describe('GET /api/parkingspots/:id/reservations/upcoming', () => {
    test('should get upcoming reservations', async () => {
      // Create a future reservation
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 3); // 3 hours from now
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 2);

      await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'testuser'
        });

      const res = await request(app)
        .get(`/api/parkingspots/${testSpot._id}/reservations/upcoming`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      
      const firstReservationStart = new Date(res.body[0].startTime).getTime();
      const now = new Date().getTime();
      expect(firstReservationStart).toBeGreaterThan(now);
    });

    test('should filter upcoming reservations by userId', async () => {
      // Create reservations for different users
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 2);

      await request(app)
        .post(`/api/parkingspots/${testSpot._id}/reservations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          userId: 'otheruser'
        });

      const res = await request(app)
        .get(`/api/parkingspots/${testSpot._id}/reservations/upcoming?userId=testuser`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach(reservation => {
        expect(reservation.userId).toBe('testuser');
      });
    });
  });

  describe('GET /api/parkingspots/:id/reservations/current', () => {
    test('should get current active reservation', async () => {
      const res = await request(app)
        .get(`/api/parkingspots/${testSpot._id}/reservations/current`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body.userId).toBe('testuser');
      expect(res.body.status).toBe('confirmed');
      
      const startTime = new Date(res.body.startTime).getTime();
      const endTime = new Date(res.body.endTime).getTime();
      const now = new Date().getTime();
      expect(startTime).toBeLessThanOrEqual(now);
      expect(endTime).toBeGreaterThan(now);
    });

    test('should return null when no current reservation exists', async () => {
      // Cancel the test reservation
      await request(app)
        .delete(`/api/parkingspots/${testSpot._id}/reservations/${testReservation._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .get(`/api/parkingspots/${testSpot._id}/reservations/current`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });
  });
});
