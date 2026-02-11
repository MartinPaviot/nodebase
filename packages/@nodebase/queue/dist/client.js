"use strict";
/**
 * Redis client configuration for BullMQ
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// Get Redis URL from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// Create Redis connection
exports.redisConnection = new ioredis_1.default(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
});
// Handle connection events
exports.redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});
exports.redisConnection.on('connect', () => {
    console.log('✅ Redis connected');
});
// Export connection for BullMQ workers
exports.default = exports.redisConnection;
