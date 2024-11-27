import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosInstance';
import { FaCar, FaChartLine, FaExclamationTriangle, FaMoneyBillWave } from 'react-icons/fa';
import './StatisticsWidgets.css';

const StatisticsWidgets = () => {
  const [stats, setStats] = useState({
    currentOccupancy: {
      total: 0,
      occupied: 0,
      available: 0,
      occupancyRate: 0
    },
    today: {
      totalParking: 0,
      averageDuration: 0,
      revenue: 0,
      violationRate: 0
    },
    weekly: {
      totalParking: 0,
      averageDuration: 0,
      revenue: 0,
      violationRate: 0
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/analytics/overview');
        setStats(res.data || stats);
        setError(null);
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (minutes) => {
    if (minutes == null) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount) => {
    if (amount == null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatRate = (rate) => {
    if (rate == null) return '0.0';
    return Number(rate).toFixed(1);
  };

  if (loading) {
    return (
      <div className="statistics-widgets loading">
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-widgets error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="statistics-widgets">
      {/* Current Occupancy */}
      <div className="widget occupancy">
        <div className="widget-icon">
          <FaCar />
        </div>
        <div className="widget-content">
          <h3>Current Occupancy</h3>
          <div className="widget-stats">
            <p className="main-stat">{formatRate(stats.currentOccupancy?.occupancyRate)}%</p>
            <p className="sub-stat">
              {stats.currentOccupancy?.occupied || 0} / {stats.currentOccupancy?.total || 0} spots
            </p>
          </div>
        </div>
      </div>

      {/* Today's Revenue */}
      <div className="widget revenue">
        <div className="widget-icon">
          <FaMoneyBillWave />
        </div>
        <div className="widget-content">
          <h3>Today's Revenue</h3>
          <div className="widget-stats">
            <p className="main-stat">{formatCurrency(stats.today?.revenue)}</p>
            <p className="sub-stat">
              {stats.today?.totalParking || 0} vehicles
            </p>
          </div>
        </div>
      </div>

      {/* Average Duration */}
      <div className="widget duration">
        <div className="widget-icon">
          <FaChartLine />
        </div>
        <div className="widget-content">
          <h3>Average Duration</h3>
          <div className="widget-stats">
            <p className="main-stat">{formatDuration(stats.today?.averageDuration)}</p>
            <p className="sub-stat">
              Today's average
            </p>
          </div>
        </div>
      </div>

      {/* Violation Rate */}
      <div className="widget violations">
        <div className="widget-icon">
          <FaExclamationTriangle />
        </div>
        <div className="widget-content">
          <h3>Violation Rate</h3>
          <div className="widget-stats">
            <p className="main-stat">{formatRate(stats.today?.violationRate)}%</p>
            <p className="sub-stat">
              {stats.today?.totalParking || 0} total checks
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsWidgets;
