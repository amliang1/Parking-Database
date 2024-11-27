const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

async function downloadModel() {
  // Using COCO-SSD model which is specifically designed for object detection including vehicles
  const MODEL_PATH = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json';
  const OUTPUT_DIR = path.join(__dirname, '..', 'models', 'vehicle-detection');

  try {
    console.log('Creating output directory...');
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('Loading COCO-SSD model...');
    const model = await tf.loadGraphModel(MODEL_PATH);

    console.log('Saving model to disk...');
    await model.save(`file://${OUTPUT_DIR}`);

    console.log('Model downloaded and saved successfully!');
  } catch (error) {
    console.error('Error downloading model:', error);
    process.exit(1);
  }
}

downloadModel();
