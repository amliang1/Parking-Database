const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ParkingSpot = require('../../models/ParkingSpot');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ParkingSpot.deleteMany({});
});

describe('ParkingSpot Model Tests', () => {
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

  test('should create a parking spot successfully', async () => {
    const validSpot = new ParkingSpot(sampleSpot);
    const savedSpot = await validSpot.save();
    expect(savedSpot.spotId).toBe(sampleSpot.spotId);
    expect(savedSpot.occupied).toBe(false);
    expect(savedSpot.status).toBe('available');
  });

  test('should fail to create spot without required fields', async () => {
    const invalidSpot = new ParkingSpot({ section: 'A' });
    await expect(invalidSpot.save()).rejects.toThrow();
  });

  test('should update statistics correctly', async () => {
    const spot = new ParkingSpot(sampleSpot);
    await spot.save();

    // Simulate parking for 60 minutes
    spot.lastOccupied = new Date(Date.now() - 60 * 60 * 1000);
    spot.updateStatistics(new Date());

    expect(spot.statistics.totalOccupancyTime).toBe(60);
    expect(spot.statistics.occupancyCount).toBe(1);
  });

  test('should check availability correctly', async () => {
    const spot = new ParkingSpot({
      ...sampleSpot,
      restrictions: {
        permitRequired: true,
        permitTypes: ['resident']
      }
    });
    await spot.save();

    const validVehicle = {
      permits: [{ type: 'resident', expiryDate: new Date(Date.now() + 86400000) }]
    };

    const invalidVehicle = {
      permits: [{ type: 'visitor', expiryDate: new Date(Date.now() + 86400000) }]
    };

    expect(spot.isAvailableFor(validVehicle)).toBe(true);
    expect(spot.isAvailableFor(invalidVehicle)).toBe(false);
  });

  test('should handle maintenance status correctly', async () => {
    const spot = new ParkingSpot(sampleSpot);
    await spot.save();

    spot.maintenance.status = 'in-progress';
    await spot.save();

    expect(spot.status).toBe('maintenance');
  });

  test('should calculate current occupancy duration', async () => {
    const spot = new ParkingSpot(sampleSpot);
    await spot.save();

    const occupiedTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    spot.lastOccupied = occupiedTime;
    await spot.save();

    const duration = spot.currentOccupancyDuration;
    expect(duration).toBeGreaterThanOrEqual(29);
    expect(duration).toBeLessThanOrEqual(31);
  });
});
