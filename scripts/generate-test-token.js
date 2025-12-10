/**
 * Script to generate a JWT token for testing WebSocket connections
 */
const jwt = require('jsonwebtoken');

// Module name for logging
const ModuleName = '[token-generator]';

// JWT Secret - should match the one in your application
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// User data for the token
const userData = {
  id: '12345678-1234-1234-1234-123456789012', // Replace with a real user ID if needed
  phoneNumber: '+15555555555',
  iat: Math.floor(Date.now() / 1000)
};

// Generate the token
const token = jwt.sign(userData, JWT_SECRET);

console.log(`${ModuleName} Generated JWT token:`);
console.log(token);
console.log('\n');
console.log(`${ModuleName} Use this token in the test-socket.js script`);
console.log(`${ModuleName} Replace the mockToken value with this token`);

// Verify the token to make sure it works
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log(`\n${ModuleName} Token verified successfully:`);
  console.log(decoded);
} catch (error) {
  console.error(`\n${ModuleName} Token verification failed:`, error);
} 