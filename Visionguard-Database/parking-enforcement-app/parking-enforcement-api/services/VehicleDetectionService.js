const tf = require('@tensorflow/tfjs-node');
const { createCanvas, loadImage } = require('canvas');
const { v4: uuidv4 } = require('uuid');

class VehicleDetectionService {
  constructor() {
    this.model = null;
    this.vehicleFingerprints = new Map(); // Store vehicle fingerprints
    this.frameBuffer = new Map(); // Buffer for frame history
    this.FRAME_BUFFER_SIZE = 10; // Keep last 10 frames for each camera
    this.CONFIDENCE_THRESHOLD = 0.7;
    this.canvas = createCanvas(416, 416);
    this.ctx = this.canvas.getContext('2d');
  }

  async initialize() {
    try {
      // Load pre-trained model for vehicle detection
      this.model = await tf.loadGraphModel('file://./models/vehicle-detection/model.json');
      console.log('Vehicle detection model loaded successfully');
    } catch (error) {
      console.error('Error loading vehicle detection model:', error);
      throw error;
    }
  }

  async preprocessFrame(imageData) {
    const image = await loadImage(imageData);
    this.ctx.drawImage(image, 0, 0, 416, 416);
    const tensor = tf.browser.fromPixels(this.canvas)
      .toFloat()
      .div(255.0)
      .expandDims();
    return tensor;
  }

  async detectVehicles(frame) {
    const tensor = await this.preprocessFrame(frame);
    const predictions = await this.model.predict(tensor);
    tensor.dispose();
    return this.processDetections(predictions);
  }

  processDetections(predictions) {
    const boxes = predictions[0].arraySync();
    const scores = predictions[1].arraySync();
    const classes = predictions[2].arraySync();
    
    const detections = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > this.CONFIDENCE_THRESHOLD && classes[i] === 2) { // class 2 is typically 'car' in COCO
        detections.push({
          bbox: {
            x: boxes[i][0] * 416,
            y: boxes[i][1] * 416,
            width: (boxes[i][2] - boxes[i][0]) * 416,
            height: (boxes[i][3] - boxes[i][1]) * 416
          },
          score: scores[i]
        });
      }
    }
    
    predictions.forEach(t => t.dispose());
    return detections;
  }

  extractFeatures(imageRegion) {
    // Extract color histogram
    const imageData = this.ctx.getImageData(
      imageRegion.x,
      imageRegion.y,
      imageRegion.width,
      imageRegion.height
    );
    
    const features = {
      colorHistogram: this.computeColorHistogram(imageData),
      aspectRatio: imageRegion.width / imageRegion.height,
      area: imageRegion.width * imageRegion.height,
      timestamp: Date.now()
    };
    
    return features;
  }

  computeColorHistogram(imageData) {
    const histogram = new Array(768).fill(0); // 256 * 3 for RGB
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++; // R
      histogram[256 + data[i + 1]]++; // G
      histogram[512 + data[i + 2]]++; // B
    }
    
    // Normalize histogram
    const sum = histogram.reduce((a, b) => a + b, 0);
    return histogram.map(v => v / sum);
  }

  matchVehicleFingerprint(features) {
    let bestMatch = null;
    let highestConfidence = 0;

    for (const [id, storedFeatures] of this.vehicleFingerprints) {
      const confidence = this.computeMatchConfidence(features, storedFeatures);
      if (confidence > this.CONFIDENCE_THRESHOLD && confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = id;
      }
    }

    return { matchId: bestMatch, confidence: highestConfidence };
  }

  computeMatchConfidence(features1, features2) {
    const colorSimilarity = this.compareHistograms(features1.colorHistogram, features2.colorHistogram);
    const aspectRatioSimilarity = 1 - Math.abs(features1.aspectRatio - features2.aspectRatio) / 
                                     Math.max(features1.aspectRatio, features2.aspectRatio);
    const areaSimilarity = 1 - Math.abs(features1.area - features2.area) / 
                              Math.max(features1.area, features2.area);
    
    return (colorSimilarity * 0.6 + aspectRatioSimilarity * 0.2 + areaSimilarity * 0.2);
  }

  compareHistograms(hist1, hist2) {
    let similarity = 0;
    for (let i = 0; i < hist1.length; i++) {
      similarity += Math.min(hist1[i], hist2[i]);
    }
    return similarity;
  }

  updateVehicleFingerprint(vehicleId, features) {
    this.vehicleFingerprints.set(vehicleId, {
      ...features,
      lastSeen: Date.now()
    });
  }

  async processFrame(frame, cameraId) {
    // Store frame in buffer
    this.updateFrameBuffer(cameraId, frame);

    // Detect vehicles in frame
    const detections = await this.detectVehicles(frame);

    // Process each detected vehicle
    const processedVehicles = [];
    for (const detection of detections) {
      const features = this.extractFeatures(detection.bbox);
      
      // Match with existing fingerprints
      const { matchId, confidence } = this.matchVehicleFingerprint(features);

      if (matchId && confidence > this.CONFIDENCE_THRESHOLD) {
        // Update existing vehicle fingerprint
        this.updateVehicleFingerprint(matchId, features);
        processedVehicles.push({
          id: matchId,
          confidence,
          isNew: false,
          bbox: detection.bbox
        });
      } else {
        // Create new vehicle fingerprint
        const newId = uuidv4();
        this.updateVehicleFingerprint(newId, features);
        processedVehicles.push({
          id: newId,
          confidence: detection.score,
          isNew: true,
          bbox: detection.bbox
        });
      }
    }

    return processedVehicles;
  }

  updateFrameBuffer(cameraId, frame) {
    if (!this.frameBuffer.has(cameraId)) {
      this.frameBuffer.set(cameraId, []);
    }

    const buffer = this.frameBuffer.get(cameraId);
    buffer.push(frame);

    // Keep buffer size limited
    if (buffer.length > this.FRAME_BUFFER_SIZE) {
      buffer.shift();
    }
  }

  cleanupOldFingerprints(maxAge = 3600000) { // Default: 1 hour
    const now = Date.now();
    for (const [id, data] of this.vehicleFingerprints) {
      if (now - data.lastSeen > maxAge) {
        this.vehicleFingerprints.delete(id);
      }
    }
  }
}

module.exports = new VehicleDetectionService();
