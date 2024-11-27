// Increase timeout for tests
jest.setTimeout(30000);

// Suppress console logs during tests
console.log = jest.fn();
console.info = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();
