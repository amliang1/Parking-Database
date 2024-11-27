import React, { useState, useCallback, useContext } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Stack,
  Autocomplete
} from '@mui/material';
import { PhotoCamera, Delete } from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const violationTypes = [
  { value: 'overtime', label: 'Overtime Parking' },
  { value: 'no_permit', label: 'No Permit' },
  { value: 'wrong_spot', label: 'Wrong Parking Spot' },
  { value: 'unauthorized', label: 'Unauthorized Parking' },
  { value: 'other', label: 'Other' }
];

const ViolationEntry = () => {
  const { token } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    licensePlate: '',
    type: '',
    location: '',
    notes: '',
    images: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    setLoading(true);
    setError(null);
    
    try {
      const uploadedUrls = await Promise.all(
        acceptedFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);

          const response = await axios.post(
            `${process.env.REACT_APP_API_URL}/api/upload`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${token}`
              }
            }
          );

          return response.data.url;
        })
      );

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading images');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    multiple: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/violations`,
        {
          ...formData,
          evidence: formData.images
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setSuccess(true);
      setFormData({
        licensePlate: '',
        type: '',
        location: '',
        notes: '',
        images: []
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting violation');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  return (
    <Box component={Paper} p={3} m={2}>
      <Typography variant="h5" gutterBottom>
        Record New Violation
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Violation recorded successfully!
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="License Plate"
              value={formData.licensePlate}
              onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))}
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Violation Type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              required
            >
              {violationTypes.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12}>
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'grey.300',
                borderRadius: 1,
                p: 2,
                textAlign: 'center',
                cursor: 'pointer'
              }}
            >
              <input {...getInputProps()} />
              <PhotoCamera sx={{ fontSize: 40, color: 'grey.500', mb: 1 }} />
              <Typography>
                {isDragActive
                  ? 'Drop the images here'
                  : 'Drag and drop images here, or click to select files'}
              </Typography>
            </Box>
          </Grid>

          {formData.images.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Uploaded Images:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {formData.images.map((url, index) => (
                  <Box
                    key={index}
                    sx={{
                      position: 'relative',
                      width: 100,
                      height: 100
                    }}
                  >
                    <img
                      src={`${process.env.REACT_APP_API_URL}${url}`}
                      alt={`Evidence ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    <IconButton
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bgcolor: 'background.paper'
                      }}
                      onClick={() => removeImage(index)}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            </Grid>
          )}

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              startIcon={loading && <CircularProgress size={20} />}
            >
              {loading ? 'Submitting...' : 'Submit Violation'}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default ViolationEntry;
