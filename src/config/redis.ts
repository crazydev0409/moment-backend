import Redis, { RedisOptions } from 'ioredis';

// Module name for logging
const ModuleName = '[redis]';

// Redis connection options
let redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`${ModuleName} Redis connection retry in ${delay}ms`);
    return delay;
  }
};

// Create Redis client
let redisClient: Redis;

// If REDIS_URL is defined, use it directly
if (process.env.REDIS_URL) {
  console.log(`${ModuleName} Connecting to Redis using connection URL: ${process.env.REDIS_URL}`);
  redisClient = new Redis(process.env.REDIS_URL, redisOptions);
} else {
  // Otherwise, use individual connection parameters
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

  // Build connection string properly
  let redisConnectionString = `redis://`;
  if (redisPassword) {
    redisConnectionString += `:${redisPassword}@`;
  }
  redisConnectionString += `${redisHost}:${redisPort}`;

  console.log(`${ModuleName} Connecting to Redis at ${redisConnectionString} database ${redisDb}`);
  
  // Create Redis client with explicit db option
  redisClient = new Redis(redisConnectionString, {
    ...redisOptions,
    db: redisDb // Setting db separately is more reliable than in the URL
  });
}

redisClient.on('connect', () => {
  console.log(`${ModuleName} Connected to Redis successfully`);
});

redisClient.on('error', (err) => {
  console.error(`${ModuleName} Redis connection error:`, err);
});

export default redisClient; 