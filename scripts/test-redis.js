/**
 * Script to test Redis connection with connection string
 */
const Redis = require('ioredis');

// Module name for logging
const ModuleName = '[redis-test]';

// Redis connection settings
const redisConnectionString = 'redis://localhost:6379/0';

console.log(`${ModuleName} Testing Redis connection with string: ${redisConnectionString}`);

// Create Redis client
const redisClient = new Redis(redisConnectionString, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`${ModuleName} Redis connection retry in ${delay}ms`);
    return delay;
  }
});

// Set timeout for connection
const timeout = setTimeout(() => {
  console.error(`${ModuleName} Connection timeout after 5 seconds`);
  process.exit(1);
}, 5000);

redisClient.on('connect', async () => {
  console.log(`${ModuleName} Connected to Redis using connection string`);
  
  try {
    // Test Redis operations
    await redisClient.set('test-key', 'Connection successful');
    const value = await redisClient.get('test-key');
    console.log(`${ModuleName} Redis read test: ${value}`);
    
    // Test done, close the connection
    console.log(`${ModuleName} Test completed successfully`);
    
    // Clear timeout and exit properly
    clearTimeout(timeout);
    await redisClient.quit();
    process.exit(0);
  } catch (error) {
    console.error(`${ModuleName} Redis operation error:`, error);
    clearTimeout(timeout);
    process.exit(1);
  }
});

redisClient.on('error', (err) => {
  console.error(`${ModuleName} Redis connection error:`, err);
  clearTimeout(timeout);
  process.exit(1);
}); 