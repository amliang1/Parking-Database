import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosInstance';
import { useWebSocket } from '../context/WebSocketContext';
import { FaParking, FaCar, FaExclamationTriangle } from 'react-icons/fa';
import './OccupancyIndicator.css';

const OccupancyIndicator = () => {
  const [occupancy, setOccupancy] = useState({
    totalSpots: 0,
    occupiedSpots: 0,
    sections: []
  });
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const fetchOccupancy = async () => {
      try {
        const [occupancyRes, sectionsRes] = await Promise.all([
          axios.get('/api/parkingspots/occupancy'),
          axios.get('/api/analytics/section-analysis')
        ]);

        setOccupancy({
          ...occupancyRes.data,
          sections: sectionsRes.data
        });
      } catch (err) {
        console.error('Error fetching occupancy data:', err);
      }
    };

    fetchOccupancy();

    // Subscribe to real-time updates
    const unsubscribeVehicleEnter = subscribe('vehicle:enter', () => {
      fetchOccupancy();
    });

    const unsubscribeVehicleExit = subscribe('vehicle:exit', () => {
      fetchOccupancy();
    });

    return () => {
      unsubscribeVehicleEnter();
      unsubscribeVehicleExit();
    };
  }, [subscribe]);

  const occupancyRate = (
    (occupancy.occupiedSpots / occupancy.totalSpots) *
    100
  ).toFixed(1);

  const getOccupancyColor = (rate) => {
    if (rate >= 90) return '#ef5350';
    if (rate >= 70) return '#ffa726';
    return '#66bb6a';
  };

  return (
    <div className="occupancy-indicator">
      <div className="occupancy-header">
        <h2>Parking Occupancy</h2>
        <div className="occupancy-summary">
          <div className="total-spots">
            <FaParking className="icon" />
            <span>{occupancy.totalSpots} Total Spots</span>
          </div>
          <div className="occupied-spots">
            <FaCar className="icon" />
            <span>{occupancy.occupiedSpots} Occupied</span>
          </div>
          {occupancyRate >= 90 && (
            <div className="warning">
              <FaExclamationTriangle className="icon" />
              <span>Near Capacity</span>
            </div>
          )}
        </div>
      </div>

      <div className="occupancy-meter">
        <div 
          className="occupancy-fill"
          style={{ 
            width: `${occupancyRate}%`,
            backgroundColor: getOccupancyColor(occupancyRate)
          }}
        />
        <span className="occupancy-rate">{occupancyRate}%</span>
      </div>

      <div className="section-grid">
        {occupancy.sections.map((section) => (
          <div key={section.section} className="section-card">
            <h3>{section.section}</h3>
            <div className="section-stats">
              <div className="stat">
                <span className="label">Occupied</span>
                <span className="value">{section.currentOccupancy}</span>
              </div>
              <div className="stat">
                <span className="label">Total</span>
                <span className="value">{section.totalSpots}</span>
              </div>
              <div className="stat">
                <span className="label">Rate</span>
                <span 
                  className="value"
                  style={{ color: getOccupancyColor(section.occupancyRate) }}
                >
                  {section.occupancyRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OccupancyIndicator;
