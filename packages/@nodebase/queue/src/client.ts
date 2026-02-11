/**
 * Redis client configuration for BullMQ
 */

import Redis from 'ioredis';

// Get Redis URL from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis connection
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

// Handle connection events
redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisConnection.on('connect', () => {
  console.log('✅ Redis connected');
});

// Export connection for BullMQ workers
export default redisConnection;
