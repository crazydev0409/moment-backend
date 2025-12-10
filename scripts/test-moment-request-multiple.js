/**
 * Test script for sending a moment request to multiple recipients
 */
const http = require('http');
const jwt = require('jsonwebtoken');

// Module name for logging
const ModuleName = '[test-multiple-request]';

// JWT Secret - use the same default as in config.ts
const JWT_SECRET = process.env.JWT_SECRET || 'development_jwt_secret_at_least_32_chars_long';

// User data for the token
const userData = {
  id: '12345678-1234-1234-1234-123456789012',
  phoneNumber: '+15555555555',
  iat: Math.floor(Date.now() / 1000)
};

// Generate the token
const token = jwt.sign(userData, JWT_SECRET);
console.log(`${ModuleName} Using JWT token:`, token);

// Sample receiver IDs - replace with real contact user IDs from your database
const receiverIds = [
  '87654321-4321-4321-4321-210987654321',
  '87654321-4321-4321-4321-210987654322',
  '87654321-4321-4321-4321-210987654323'
];

// Create a moment 30 minutes from now, lasting 1 hour
const now = new Date();
const startTime = new Date(now.getTime() + 30 * 60 * 1000);
const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

// Update request data to include senderId
const requestData = {
  senderId: userData.id, // Include sender ID for the test endpoint
  receiverIds,
  startTime: startTime.toISOString(),
  endTime: endTime.toISOString(),
  title: 'Team Standup Meeting',
  description: 'Weekly team sync-up call'
};

// API endpoint details
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/test/moment-requests/multiple', // Use the new test route path
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // No authentication needed for test endpoint
  }
};

console.log(`${ModuleName} Sending moment request to ${receiverIds.length} recipients`);
console.log(`${ModuleName} Start time: ${startTime.toLocaleString()}`);
console.log(`${ModuleName} End time: ${endTime.toLocaleString()}`);
console.log(`${ModuleName} Title: ${requestData.title}`);
console.log(`${ModuleName} URL: http://${options.hostname}:${options.port}${options.path}`);

// Send the request
const req = http.request(options, (res) => {
  console.log(`${ModuleName} Status Code: ${res.statusCode}`);
  console.log(`${ModuleName} Headers:`, JSON.stringify(res.headers, null, 2));
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      console.log(`${ModuleName} Response:`, JSON.stringify(parsedData, null, 2));
      
      if (parsedData.result) {
        console.log(`${ModuleName} Successful requests: ${parsedData.result.successful}`);
        console.log(`${ModuleName} Failed requests: ${parsedData.result.failed}`);
        
        if (parsedData.result.failedReceiverIds && parsedData.result.failedReceiverIds.length > 0) {
          console.log(`${ModuleName} Failed receiver IDs:`, parsedData.result.failedReceiverIds);
        }
      }
    } catch (e) {
      console.log(`${ModuleName} Raw response:`, responseData);
    }
  });
});

req.on('error', (error) => {
  console.error(`${ModuleName} Network error:`, error.message);
  console.error(`${ModuleName} Error details:`, error);
});

// Set a timeout
req.setTimeout(5000, () => {
  console.error(`${ModuleName} Request timed out after 5 seconds`);
  req.abort();
});

// Write data to request body
console.log(`${ModuleName} Sending request...`);
req.write(JSON.stringify(requestData));
req.end(); 