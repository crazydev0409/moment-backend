/**
 * Script to send a test notification via the API
 */
const http = require('http');
const jwt = require('jsonwebtoken');

// Module name for logging
const ModuleName = '[notification-sender]';

// JWT Secret - should match the one in your application
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// User data for the token
const userData = {
  id: '12345678-1234-1234-1234-123456789012', // Same as in test-socket.js
  phoneNumber: '+15555555555',
  iat: Math.floor(Date.now() / 1000)
};

// Generate the token
const token = jwt.sign(userData, JWT_SECRET);

// Verify the token
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log(`${ModuleName} Token verified successfully. Payload:`, decoded);
} catch (error) {
  console.error(`${ModuleName} Token verification failed:`, error);
  process.exit(1);
}

// Log the token for debugging
console.log(`${ModuleName} Bearer token: ${token}`);

// API endpoint details
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/users/notifications/test',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
};

// Notification type (optional)
const notificationType = process.argv[2] || 'moment-reminder';

// Request data
const data = JSON.stringify({
  type: notificationType
});

console.log(`${ModuleName} Sending test notification of type: ${notificationType}`);

// Send the request
const req = http.request(options, (res) => {
  console.log(`${ModuleName} Status Code: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      console.log(`${ModuleName} Response:`, parsedData);
    } catch (e) {
      console.log(`${ModuleName} Raw response:`, responseData);
    }
  });
});

req.on('error', (error) => {
  console.error(`${ModuleName} Error:`, error.message);
});

// Write data to request body
req.write(data);
req.end(); 