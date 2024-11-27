const WebSocket = require('ws');
const VideoStreamHandler = require('./VideoStreamHandler');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.videoStreamHandler = null;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize video stream handler
      this.videoStreamHandler = new VideoStreamHandler(this.wss);
      
      // Set up connection handling
      this.wss.on('connection', (ws) => {
        console.log('New WebSocket connection established');

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
        });

        ws.on('close', () => {
          console.log('Client disconnected');
        });
      });

      console.log('WebSocket server initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  broadcast(data) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

module.exports = WebSocketServer;
