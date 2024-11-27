import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosInstance';
import { useWebSocket } from '../context/WebSocketContext';
import { FaCar, FaClock, FaMapMarkerAlt, FaInfoCircle } from 'react-icons/fa';
import './LiveVehicleFeed.css';

const LiveVehicleFeed = () => {
  const [vehicles, setVehicles] = useState([]);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await axios.get('/api/vehicles/active');
        if (Array.isArray(res.data)) {
          setVehicles(res.data);
        } else {
          console.error('Expected an array but received:', res.data);
          setVehicles([]);
        }
      } catch (err) {
        console.error('Error fetching vehicles:', err);
        setVehicles([]);
      }
    };

    fetchVehicles();

    // Subscribe to real-time updates
    const unsubscribeVehicleEnter = subscribe('vehicle:enter', (vehicle) => {
      setVehicles(prev => [vehicle, ...prev]);
    });

    const unsubscribeVehicleExit = subscribe('vehicle:exit', (vehicleId) => {
      setVehicles(prev => prev.filter(v => v._id !== vehicleId));
    });

    const unsubscribeVehicleUpdate = subscribe('vehicle:update', (updatedVehicle) => {
      setVehicles(prev => 
        prev.map(v => v._id === updatedVehicle._id ? updatedVehicle : v)
      );
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeVehicleEnter();
      unsubscribeVehicleExit();
      unsubscribeVehicleUpdate();
    };
  }, [subscribe]);

  const calculateDuration = (entryTime) => {
    const now = new Date();
    const entry = new Date(entryTime);
    const diffInMinutes = Math.floor((now - entry) / 1000 / 60);
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    }
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="live-vehicle-feed">
      <div className="feed-header">
        <h2>Live Vehicle Feed</h2>
        <span className="vehicle-count">
          {vehicles.length} active {vehicles.length === 1 ? 'vehicle' : 'vehicles'}
        </span>
      </div>
      
      <div className="vehicle-list">
        {vehicles && vehicles.length > 0 ? (
          vehicles.map((vehicle) => (
            <div key={vehicle._id} className="vehicle-card">
              <div className="vehicle-info">
                <div className="license-plate">
                  <FaCar className="icon" />
                  <span>{vehicle.licensePlate}</span>
                </div>
                {(vehicle.make || vehicle.model) && (
                  <div className="vehicle-model">
                    <FaInfoCircle className="icon" />
                    <span>
                      {vehicle.make} {vehicle.model}
                    </span>
                  </div>
                )}
                <div className="vehicle-details">
                  <div className="detail">
                    <FaClock className="icon" />
                    <span>{calculateDuration(vehicle.entryTime)} ago</span>
                  </div>
                  <div className="detail">
                    <FaMapMarkerAlt className="icon" />
                    <span>Spot {vehicle.parkingSpot?.spotId || 'Unknown'}</span>
                  </div>
                </div>
              </div>
              {vehicle.violationStatus && (
                <div className={`violation-status ${vehicle.violationStatus.toLowerCase()}`}>
                  {vehicle.violationStatus}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="no-vehicles">
            <p>No vehicles currently parked</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveVehicleFeed;
