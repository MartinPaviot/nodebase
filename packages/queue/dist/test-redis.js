/**
 * Test Redis connection
 *
 * Run with: pnpm --filter @nodebase/queue test:redis
 */
import { config } from "dotenv";
import { resolve } from "path";
import { Redis } from "ioredis";
import { getRedisConfig } from "@nodebase/config";
// Load .env from root directory
config({ path: resolve(process.cwd(), "../../.env") });
async function testRedisConnection() {
    console.log("🔌 Testing Redis connection...\n");
    try {
        // Debug: check if env var is loaded
        console.log("🔍 Debug - REDIS_URL from process.env:", process.env.REDIS_URL ? "✓ Found" : "✗ Not found");
        const config = getRedisConfig();
        console.log("📋 Config loaded:");
        console.log(`   URL: ${config.url ? config.url.replace(/:[^:]*@/, ':****@') : 'undefined'}`);
        console.log(`   Max retries: ${config.maxRetriesPerRequest}\n`);
        const redis = new Redis(config.url, {
            maxRetriesPerRequest: config.maxRetriesPerRequest,
            lazyConnect: true,
        });
        // Test connection
        console.log("⏳ Connecting to Redis...");
        await redis.connect();
        console.log("✅ Connected to Redis!\n");
        // Test PING
        console.log("⏳ Testing PING...");
        const pong = await redis.ping();
        console.log(`✅ PING successful: ${pong}\n`);
        // Test SET/GET
        console.log("⏳ Testing SET/GET...");
        await redis.set("test:nodebase", "Hello from Nodebase!", "EX", 60);
        const value = await redis.get("test:nodebase");
        console.log(`✅ SET/GET successful: ${value}\n`);
        // Test INFO
        console.log("⏳ Getting Redis info...");
        const info = await redis.info("server");
        const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
        console.log(`✅ Redis version: ${version}\n`);
        // Cleanup
        await redis.del("test:nodebase");
        await redis.quit();
        console.log("🎉 All Redis tests passed!\n");
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Redis connection failed:");
        console.error(error);
        process.exit(1);
    }
}
testRedisConnection();
