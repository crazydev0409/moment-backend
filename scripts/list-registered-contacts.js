/**
 * Script to list all registered contacts who can receive moment requests
 */
const http = require('http');
const jwt = require('jsonwebtoken');

// Module name for logging
const ModuleName = '[contacts-list]';

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

// Debug: Show token
console.log(`${ModuleName} Using JWT token:`, token);

// API endpoint details
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/users/contacts/registered',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
};

console.log(`${ModuleName} Fetching registered contacts from ${options.hostname}:${options.port}${options.path}...`);

// Send the request
const req = http.request(options, (res) => {
  console.log(`${ModuleName} Status Code: ${res.statusCode}`);
  console.log(`${ModuleName} Headers:`, JSON.stringify(res.headers, null, 2));
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
    console.log(`${ModuleName} Received chunk of data`);
  });
  
  res.on('end', () => {
    console.log(`${ModuleName} Response completed`);
    try {
      const parsedData = JSON.parse(responseData);
      
      if (parsedData.error) {
        console.error(`${ModuleName} Error:`, parsedData.error);
        return;
      }
      
      if (parsedData.contacts && Array.isArray(parsedData.contacts)) {
        console.log(`${ModuleName} Found ${parsedData.contacts.length} registered contacts:`);
        
        if (parsedData.contacts.length === 0) {
          console.log(`${ModuleName} No registered contacts found`);
          return;
        }
        
        // Print contacts in a table format
        console.log('\nID                                     | Display Name         | Phone Number      | User ID');
        console.log('---------------------------------------|----------------------|-------------------|---------------------------------------');
        
        parsedData.contacts.forEach(contact => {
          const id = contact.id || 'N/A';
          const displayName = (contact.displayName || 'Unknown').padEnd(20);
          const phoneNumber = (contact.contactPhone || 'N/A').padEnd(17);
          const userId = contact.contactUserId || 'N/A';
          
          console.log(`${id} | ${displayName} | ${phoneNumber} | ${userId}`);
        });
        
        console.log('\nUse the User IDs in the receiverIds array for the moment-requests/multiple endpoint');
      } else {
        console.log(`${ModuleName} Unexpected response format:`, JSON.stringify(parsedData, null, 2));
      }
    } catch (e) {
      console.log(`${ModuleName} Error parsing response:`, e.message);
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

console.log(`${ModuleName} Sending request...`);
req.end(); 