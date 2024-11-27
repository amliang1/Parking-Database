export const loadCarData = async () => {
  try {
    const response = await fetch('/2023.csv');
    if (!response.ok) {
      throw new Error(`Failed to fetch car data: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    if (!csvText) {
      throw new Error('Empty CSV file');
    }

    console.log('Raw CSV data:', csvText.slice(0, 500)); // Debug log

    // Skip header row and parse CSV
    const rows = csvText.split('\n')
      .slice(1)
      .filter(row => row.trim()); // Remove empty lines
    
    console.log('Number of rows:', rows.length); // Debug log
    
    // Group by make and include body styles
    const carData = rows.reduce((acc, row) => {
      const parts = row.split(',').map(str => str.trim());
      if (parts.length < 4) {
        console.log('Invalid row:', row); // Debug log
        return acc;
      }

      const [year, make, model, bodyStyles] = parts;
      if (!make || !model) {
        console.log('Missing make or model:', { make, model }); // Debug log
        return acc;
      }
      
      if (!acc[make]) {
        acc[make] = new Set(); // Use Set to avoid duplicates
      }

      // Parse body styles from JSON string and format for display
      let styles = '';
      try {
        // Remove quotes and clean up the JSON string
        const cleanBodyStyles = bodyStyles.replace(/^"|"$/g, '').replace(/\\"/g, '"');
        styles = JSON.parse(cleanBodyStyles).join(', ');
      } catch (e) {
        console.log('Error parsing body styles:', { make, model, bodyStyles }); // Debug log
        styles = 'N/A';
      }
      
      // Add model with body styles
      const modelWithStyle = `${model} (${styles})`;
      acc[make].add(modelWithStyle);
      
      return acc;
    }, {});

    // Convert Sets to sorted arrays and create final object
    const sortedCarData = Object.keys(carData)
      .sort()
      .reduce((acc, make) => {
        acc[make] = Array.from(carData[make]).sort();
        return acc;
      }, {});

    // Add "Other" option at the end
    sortedCarData['Other'] = ['Other'];
    
    console.log('Loaded car data:', {
      numberOfMakes: Object.keys(sortedCarData).length,
      makes: Object.keys(sortedCarData),
      sampleModels: sortedCarData[Object.keys(sortedCarData)[0]]
    });
    
    return sortedCarData;
  } catch (error) {
    console.error('Error loading car data:', error);
    return { 'Other': ['Other'] };
  }
};
