const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ParkingRecord = require('../models/ParkingRecord');
const ParkingSpot = require('../models/ParkingSpot');

// @route   GET /api/analytics/overview
// @desc    Get parking overview statistics
// @access  Private
router.get('/overview', auth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Current occupancy
    const totalSpots = await ParkingSpot.countDocuments();
    const occupiedSpots = await ParkingSpot.countDocuments({ occupied: true });
    
    // Today's statistics
    const todayRecords = await ParkingRecord.find({
      entryTime: { $gte: today }
    });

    // Weekly statistics
    const weeklyRecords = await ParkingRecord.find({
      entryTime: { $gte: lastWeek }
    });

    // Monthly statistics
    const monthlyRecords = await ParkingRecord.find({
      entryTime: { $gte: lastMonth }
    });

    // Calculate average durations
    const calcAverageDuration = (records) => {
      const completedRecords = records.filter(r => r.exitTime);
      if (completedRecords.length === 0) return 0;
      return completedRecords.reduce((acc, curr) => acc + curr.duration, 0) / completedRecords.length;
    };

    // Calculate total revenue
    const calcTotalRevenue = (records) => {
      return records.reduce((acc, curr) => acc + curr.fee, 0);
    };

    // Calculate violation rate
    const calcViolationRate = (records) => {
      if (records.length === 0) return 0;
      const violations = records.filter(r => r.violationIssued).length;
      return (violations / records.length) * 100;
    };

    res.json({
      currentOccupancy: {
        total: totalSpots,
        occupied: occupiedSpots,
        available: totalSpots - occupiedSpots,
        occupancyRate: (occupiedSpots / totalSpots) * 100
      },
      today: {
        totalParking: todayRecords.length,
        averageDuration: calcAverageDuration(todayRecords),
        revenue: calcTotalRevenue(todayRecords),
        violationRate: calcViolationRate(todayRecords)
      },
      weekly: {
        totalParking: weeklyRecords.length,
        averageDuration: calcAverageDuration(weeklyRecords),
        revenue: calcTotalRevenue(weeklyRecords),
        violationRate: calcViolationRate(weeklyRecords)
      },
      monthly: {
        totalParking: monthlyRecords.length,
        averageDuration: calcAverageDuration(monthlyRecords),
        revenue: calcTotalRevenue(monthlyRecords),
        violationRate: calcViolationRate(monthlyRecords)
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/analytics/occupancy-trends
// @desc    Get hourly occupancy trends
// @access  Private
router.get('/occupancy-trends', auth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const records = await ParkingRecord.find({
      entryTime: { $gte: today, $lt: tomorrow }
    });

    // Initialize hourly buckets
    const hourlyOccupancy = Array(24).fill(0);

    // Count vehicles present in each hour
    records.forEach(record => {
      const entryHour = record.entryTime.getHours();
      const exitHour = record.exitTime ? record.exitTime.getHours() : now.getHours();
      
      for (let hour = entryHour; hour <= exitHour; hour++) {
        hourlyOccupancy[hour]++;
      }
    });

    res.json({
      date: today,
      hourlyOccupancy
    });
  } catch (err) {
    console.error('Occupancy trends error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/analytics/section-analysis
// @desc    Get parking analysis by section
// @access  Private
router.get('/section-analysis', auth, async (req, res) => {
  try {
    const sections = await ParkingSpot.distinct('section');
    const sectionStats = await Promise.all(sections.map(async (section) => {
      const totalSpots = await ParkingSpot.countDocuments({ section });
      const occupiedSpots = await ParkingSpot.countDocuments({ section, occupied: true });
      
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const records = await ParkingRecord.find({
        section,
        entryTime: { $gte: lastWeek }
      });

      return {
        section,
        totalSpots,
        currentOccupancy: occupiedSpots,
        occupancyRate: (occupiedSpots / totalSpots) * 100,
        weeklyUtilization: records.length,
        averageDuration: records.length > 0 
          ? records.reduce((acc, curr) => acc + (curr.duration || 0), 0) / records.length 
          : 0
      };
    }));

    res.json(sectionStats);
  } catch (err) {
    console.error('Section analysis error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/analytics/occupancy
// @desc    Get real-time occupancy trend data
// @access  Private
router.get('/occupancy', auth, async (req, res) => {
  try {
    const now = new Date();
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get hourly snapshots for the past 24 hours
    const records = await ParkingRecord.aggregate([
      {
        $match: {
          entryTime: { $gte: past24Hours }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$entryTime" },
            month: { $month: "$entryTime" },
            day: { $dayOfMonth: "$entryTime" },
            hour: { $hour: "$entryTime" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 }
      }
    ]);

    const totalSpots = await ParkingSpot.countDocuments();
    
    // Format data for the chart
    const occupancyTrend = records.map(record => ({
      time: `${record._id.hour}:00`,
      rate: (record.count / totalSpots) * 100
    }));

    res.json(occupancyTrend);
  } catch (err) {
    console.error('Occupancy trend error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/analytics/revenue
// @desc    Get daily revenue data
// @access  Private
router.get('/revenue', auth, async (req, res) => {
  try {
    const now = new Date();
    const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const records = await ParkingRecord.aggregate([
      {
        $match: {
          entryTime: { $gte: past7Days }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$entryTime" },
            month: { $month: "$entryTime" },
            day: { $dayOfMonth: "$entryTime" }
          },
          revenue: { $sum: "$fee" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);

    // Format data for the chart
    const revenueData = records.map(record => ({
      date: `${record._id.month}/${record._id.day}`,
      revenue: record.revenue
    }));

    res.json(revenueData);
  } catch (err) {
    console.error('Revenue analytics error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/analytics/utilization
// @desc    Get spot utilization by type
// @access  Private
router.get('/utilization', auth, async (req, res) => {
  try {
    const spotTypes = await ParkingSpot.aggregate([
      {
        $group: {
          _id: "$type",
          value: { $sum: 1 }
        }
      }
    ]);

    const utilization = spotTypes.map(type => ({
      type: type._id,
      value: type.value
    }));

    res.json(utilization);
  } catch (err) {
    console.error('Utilization analytics error:', err);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/analytics/sensors
// @desc    Get sensor health status
// @access  Private
router.get('/sensors', auth, async (req, res) => {
  try {
    const sensorStatus = await ParkingSpot.aggregate([
      {
        $group: {
          _id: "$sensors.status",
          count: { $sum: 1 }
        }
      }
    ]);

    const sensorHealth = sensorStatus.map(status => ({
      status: status._id || 'unknown',
      count: status.count
    }));

    res.json(sensorHealth);
  } catch (err) {
    console.error('Sensor health analytics error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
