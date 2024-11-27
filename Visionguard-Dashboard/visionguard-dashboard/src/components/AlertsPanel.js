import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AlertsPanel = () => {
  const [violations, setViolations] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchViolations = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/violations/recent`);
        setViolations(res.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching violations:', err);
        setError('Unable to load recent violations');
        setViolations([]);
      }
    };

    fetchViolations();
    const interval = setInterval(fetchViolations, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="alerts-panel">
        <h2>Recent Violations</h2>
        <p style={{ color: '#666', textAlign: 'center' }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="alerts-panel">
      <h2>Recent Violations</h2>
      {violations.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center' }}>
          No recent violations
        </p>
      ) : (
        <ul>
          {violations.map((violation) => (
            <li key={violation._id}>
              {violation.violationType} by {violation.vehicle?.licensePlate || 'Unknown'} at{' '}
              {new Date(violation.timestamp).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AlertsPanel;
