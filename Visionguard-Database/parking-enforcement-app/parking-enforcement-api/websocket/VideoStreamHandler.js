const WebSocket = require('ws');
const cv = require('opencv4nodejs');
const VehicleDetectionService = require('../services/VehicleDetectionService');

class VideoStreamHandler {
  constructor(wss) {
    this.wss = wss;
    this.initialize();
  }

  async initialize() {
    try {
      await VehicleDetectionService.initialize();
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('Failed to initialize VideoStreamHandler:', error);
      throw error;
    }
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('New video stream connection established');

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          if (data.type === 'video-frame') {
            await this.handleVideoFrame(ws, data);
          }
        } catch (error) {
          console.error('Error processing video frame:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process video frame'
          }));
        }
      });

      ws.on('close', () => {
        console.log('Video stream connection closed');
      });
    });
  }

  async handleVideoFrame(ws, data) {
    const { frame, cameraId, timestamp } = data;
    
    // Convert base64 frame to OpenCV matrix
    const buffer = Buffer.from(frame.split(',')[1], 'base64');
    const cvFrame = cv.imdecode(buffer);

    // Process frame and detect vehicles
    const detectedVehicles = await VehicleDetectionService.processFrame(cvFrame, cameraId);

    // Send results back to client
    ws.send(JSON.stringify({
      type: 'detection-results',
      timestamp,
      cameraId,
      vehicles: detectedVehicles
    }));
  }
}

module.exports = VideoStreamHandler;
