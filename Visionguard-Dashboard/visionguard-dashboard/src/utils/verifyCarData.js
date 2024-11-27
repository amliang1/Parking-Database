import { loadCarData } from './carData';

async function verifyCarData() {
  try {
    console.log('Starting car data verification...');
    const carData = await loadCarData();
    console.log('Number of makes:', Object.keys(carData).length);
    console.log('Sample makes:', Object.keys(carData).slice(0, 5));
    
    // Check a few specific makes
    const makes = ['Toyota', 'Honda', 'Ford'];
    makes.forEach(make => {
      if (carData[make]) {
        console.log(`${make} models:`, carData[make].slice(0, 3));
      } else {
        console.log(`${make} not found in data`);
      }
    });
  } catch (error) {
    console.error('Error verifying car data:', error);
  }
}

verifyCarData();
