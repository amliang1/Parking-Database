import React, { useState, useEffect } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import axios from 'axios';
import { loadCarData } from '../utils/carData';

const QuickActions = () => {
  const [open, setOpen] = useState(false);
  const [vehicleData, setVehicleData] = useState({
    licensePlate: '',
    make: '',
    model: '',
    color: ''
  });
  const [selectedSpot, setSelectedSpot] = useState('');
  const [availableSpots, setAvailableSpots] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [carMakes, setCarMakes] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (open) {
        try {
          fetchAvailableSpots();
          const data = await loadCarData();
          console.log('Loaded car makes:', {
            numberOfMakes: Object.keys(data).length,
            makes: Object.keys(data),
            sampleModels: data[Object.keys(data)[0]]
          });
          setCarMakes(data);
        } catch (err) {
          console.error('Error loading car data:', err);
          setCarMakes({ 'Other': ['Other'] });
          setError('Error loading car data. Please try again.');
        }
      }
    };
    loadData();
  }, [open]);

  useEffect(() => {
    if (vehicleData.make) {
      const models = carMakes[vehicleData.make] || [];
      console.log(`Models for ${vehicleData.make}:`, models);
      setAvailableModels(models);
      
      // Reset model if it's not available for the new make
      if (vehicleData.model && !models.includes(vehicleData.model)) {
        setVehicleData(prev => ({ ...prev, model: '' }));
      }
    } else {
      setAvailableModels([]);
    }
  }, [vehicleData.make, carMakes]);

  const fetchAvailableSpots = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view spots');
        return;
      }

      const response = await axios.get('http://localhost:3001/api/parkingspots', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Group spots by section
      const spots = response.data.filter(spot => !spot.occupied);
      spots.sort((a, b) => {
        if (a.section !== b.section) {
          return a.section.localeCompare(b.section);
        }
        return a.spotId.localeCompare(b.spotId);
      });
      
      setAvailableSpots(spots);
    } catch (err) {
      setError('Error fetching parking spots');
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setError('');
    setVehicleData({
      licensePlate: '',
      make: '',
      model: '',
      color: ''
    });
    setSelectedSpot('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log('Form change:', { name, value });
    setVehicleData(prev => {
      const update = { ...prev, [name]: value };
      // Reset model when make changes
      if (name === 'make') {
        update.model = '';
      }
      return update;
    });
  };

  const handleSpotChange = (e) => {
    setSelectedSpot(e.target.value);
  };

  const handleSubmit = async () => {
    try {
      // Validate all required fields
      if (!selectedSpot) {
        setError('Please select a parking spot');
        return;
      }
      if (!vehicleData.licensePlate) {
        setError('Please enter a license plate');
        return;
      }
      if (!vehicleData.make) {
        setError('Please select a make');
        return;
      }
      if (!vehicleData.model) {
        setError('Please select a model');
        return;
      }
      if (!vehicleData.color) {
        setError('Please enter a color');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to add a vehicle');
        return;
      }

      // Clean up model string to remove body style info if present
      const requestData = {
        licensePlate: vehicleData.licensePlate.toUpperCase(),
        spotId: selectedSpot,
        make: vehicleData.make,
        model: vehicleData.model.split('(')[0].trim(),
        color: vehicleData.color
      };

      console.log('Submitting vehicle entry request:', {
        url: 'http://localhost:3001/api/vehicles/enter',
        data: requestData,
        headers: { Authorization: `Bearer ${token}` }
      });

      // Add vehicle entry with selected spot
      const response = await axios.post(
        'http://localhost:3001/api/vehicles/enter', 
        requestData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Vehicle entry response:', {
        status: response.status,
        data: response.data
      });
      
      if (response.data && response.status === 200) {
        // Close dialog only on successful response
        handleClose();
        // Refresh available spots
        fetchAvailableSpots();
      } else {
        setError('Unexpected response from server');
      }
    } catch (err) {
      console.error('Error adding vehicle:', {
        error: err,
        response: err.response ? {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data
        } : 'No response',
        request: err.request || 'No request'
      });

      // Handle specific error cases
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.error) {
        setError(`Error: ${err.response.data.error}`);
      } else {
        setError('Error adding vehicle. Please try again.');
      }

      // Refresh spots if needed
      if (err.response?.data?.message?.includes('already occupied')) {
        fetchAvailableSpots();
      }
    }
  };

  return (
    <div className="quick-actions">
      <h2>Quick Actions</h2>
      <Button variant="contained" color="primary" onClick={handleOpen}>
        Add Vehicle Entry
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Vehicle Entry</DialogTitle>
        <DialogContent>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          
          <FormControl fullWidth margin="dense">
            <InputLabel>Parking Spot</InputLabel>
            <Select
              value={selectedSpot}
              onChange={handleSpotChange}
              label="Parking Spot"
            >
              {availableSpots.map((spot) => (
                <MenuItem 
                  key={spot.spotId} 
                  value={spot.spotId}
                >
                  {`Zone ${spot.section} - Spot ${spot.spotId} (${spot.type})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            autoFocus
            margin="dense"
            name="licensePlate"
            label="License Plate"
            type="text"
            fullWidth
            value={vehicleData.licensePlate}
            onChange={handleChange}
          />

          <FormControl fullWidth margin="dense">
            <InputLabel>Make</InputLabel>
            <Select
              name="make"
              value={vehicleData.make}
              onChange={handleChange}
              label="Make"
            >
              {Object.keys(carMakes)
                .filter(make => make !== 'Other')
                .map((make) => (
                  <MenuItem key={make} value={make}>
                    {make}
                  </MenuItem>
                ))}
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="dense">
            <InputLabel>Model</InputLabel>
            <Select
              name="model"
              value={vehicleData.model}
              onChange={handleChange}
              label="Model"
              disabled={!vehicleData.make}
            >
              {vehicleData.make === 'Other' ? (
                <MenuItem value="Other">Other</MenuItem>
              ) : (
                availableModels.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <TextField
            margin="dense"
            name="color"
            label="Color"
            type="text"
            fullWidth
            value={vehicleData.color}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} color="primary">Add Vehicle</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default QuickActions;
