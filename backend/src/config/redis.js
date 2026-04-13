const { createClient } = require('redis');
require('dotenv').config();

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
  },
});

client.on('error', (err) => {
  console.error('Redis client error:', err.message);
});

client.on('connect', () => {
  console.log('Redis connected');
});

/**
 * Connect the Redis client. Called once at server startup.
 */
async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
  }
}

module.exports = { client, connectRedis };
