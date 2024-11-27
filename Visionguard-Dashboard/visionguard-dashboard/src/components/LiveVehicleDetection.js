import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { useWebSocket } from '../context/WebSocketContext';

const LiveVehicleDetection = ({ cameraId }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ws = useWebSocket();
  const [detectedVehicles, setDetectedVehicles] = useState([]);
  const frameInterval = useRef(null);

  useEffect(() => {
    let stream;

    const startVideoStream = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    const setupWebSocket = () => {
      if (!ws) return;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'detection-results') {
          handleDetectionResults(data);
        }
      };
    };

    const sendVideoFrame = () => {
      if (!canvasRef.current || !videoRef.current || !ws) return;

      const context = canvasRef.current.getContext('2d');
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      const frame = canvasRef.current.toDataURL('image/jpeg', 0.8);
      
      ws.send(JSON.stringify({
        type: 'video-frame',
        frame,
        cameraId,
        timestamp: Date.now()
      }));
    };

    startVideoStream();
    setupWebSocket();

    // Send frames every 100ms (10 fps)
    frameInterval.current = setInterval(sendVideoFrame, 100);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (frameInterval.current) {
        clearInterval(frameInterval.current);
      }
    };
  }, [ws, cameraId]);

  const handleDetectionResults = (data) => {
    setDetectedVehicles(data.vehicles);
    drawDetectionBoxes(data.vehicles);
  };

  const drawDetectionBoxes = (vehicles) => {
    if (!canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    vehicles.forEach(vehicle => {
      context.strokeStyle = vehicle.isNew ? '#00ff00' : '#ff0000';
      context.lineWidth = 2;
      context.strokeRect(
        vehicle.bbox.x,
        vehicle.bbox.y,
        vehicle.bbox.width,
        vehicle.bbox.height
      );

      // Draw vehicle ID and confidence
      context.fillStyle = vehicle.isNew ? '#00ff00' : '#ff0000';
      context.font = '12px Arial';
      context.fillText(
        `ID: ${vehicle.id.slice(0, 8)}... (${(vehicle.confidence * 100).toFixed(1)}%)`,
        vehicle.bbox.x,
        vehicle.bbox.y - 5
      );
    });
  };

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Live Vehicle Detection - Camera {cameraId}
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Box sx={{ position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{ width: '100%', height: 'auto' }}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2, maxHeight: 480, overflow: 'auto' }}>
            <Typography variant="subtitle1" gutterBottom>
              Detected Vehicles
            </Typography>
            {detectedVehicles.map((vehicle) => (
              <Box
                key={vehicle.id}
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: vehicle.isNew ? 'success.light' : 'primary.light',
                }}
              >
                <Typography variant="body2">
                  ID: {vehicle.id.slice(0, 8)}...
                </Typography>
                <Typography variant="body2">
                  Confidence: {(vehicle.confidence * 100).toFixed(1)}%
                </Typography>
                <Typography variant="body2">
                  Status: {vehicle.isNew ? 'New Detection' : 'Tracked'}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default LiveVehicleDetection;
