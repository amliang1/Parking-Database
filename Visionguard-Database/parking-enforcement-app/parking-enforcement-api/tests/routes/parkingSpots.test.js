const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const ParkingSpot = require('../../models/ParkingSpot');
const { generateToken } = require('../../utils/auth');

let mongoServer;
let authToken;

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
});

describe('Parking Spots Routes Tests', () => {
  const sampleSpot = {
    spotId: 'A-123',
    section: 'A',
    type: 'standard',
    location: {
      coordinates: [-122.419416, 37.774929],
      level: 1,
      building: 'Main'
    }
  };

  describe('GET /api/parkingspots', () => {
    test('should get all parking spots', async () => {
      await ParkingSpot.create(sampleSpot);
      
      const res = await request(app)
        .get('/api/parkingspots')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].spotId).toBe(sampleSpot.spotId);
    });

    test('should filter spots correctly', async () => {
      await ParkingSpot.create([
        sampleSpot,
        { ...sampleSpot, spotId: 'B-123', section: 'B' }
      ]);

      const res = await request(app)
        .get('/api/parkingspots?section=A')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].section).toBe('A');
    });
  });

  describe('GET /api/parkingspots/occupancy', () => {
    test('should get correct occupancy statistics', async () => {
      await ParkingSpot.create([
        sampleSpot,
        { ...sampleSpot, spotId: 'B-123', occupied: true }
      ]);

      const res = await request(app)
        .get('/api/parkingspots/occupancy')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.occupied).toBe(1);
      expect(res.body.available).toBe(1);
      expect(res.body.occupancyRate).toBe(50);
    });
  });

  describe('GET /api/parkingspots/nearby', () => {
    test('should find nearby spots', async () => {
      await ParkingSpot.create(sampleSpot);

      const res = await request(app)
        .get('/api/parkingspots/nearby')
        .query({
          longitude: -122.419416,
          latitude: 37.774929
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    test('should require coordinates', async () => {
      const res = await request(app)
        .get('/api/parkingspots/nearby')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/parkingspots/:id/maintenance', () => {
    test('should update maintenance status', async () => {
      const spot = await ParkingSpot.create(sampleSpot);

      const res = await request(app)
        .put(`/api/parkingspots/${spot._id}/maintenance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'in-progress',
          notes: 'Testing maintenance'
        });

      expect(res.status).toBe(200);
      expect(res.body.maintenance.status).toBe('in-progress');
      expect(res.body.maintenance.notes).toBe('Testing maintenance');
    });
  });

  describe('PUT /api/parkingspots/:id/sensor', () => {
    test('should update sensor status and occupancy', async () => {
      const spot = await ParkingSpot.create(sampleSpot);

      const res = await request(app)
        .put(`/api/parkingspots/${spot._id}/sensor`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'active',
          reading: true
        });

      expect(res.status).toBe(200);
      expect(res.body.sensors.status).toBe('active');
      expect(res.body.occupied).toBe(true);
    });
  });

  describe('PUT /api/parkingspots/:id/restrictions', () => {
    test('should update spot restrictions', async () => {
      const spot = await ParkingSpot.create(sampleSpot);

      const res = await request(app)
        .put(`/api/parkingspots/${spot._id}/restrictions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timeLimit: 120,
          permitRequired: true,
          permitTypes: ['resident']
        });

      expect(res.status).toBe(200);
      expect(res.body.restrictions.timeLimit).toBe(120);
      expect(res.body.restrictions.permitRequired).toBe(true);
      expect(res.body.restrictions.permitTypes).toContain('resident');
    });
  });
});
