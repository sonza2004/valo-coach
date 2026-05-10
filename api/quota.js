const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const RATE_LIMIT = process.env.NODE_ENV === 'production' ? 3 : 99;
const TEST_MODE  = process.env.NODE_ENV !== 'production';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  if (TEST_MODE) {
    return res.status(200).json({ quota_remaining: RATE_LIMIT, test_mode: true });
  }

  try {
    const ip  = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || 'unknown';
    const ua  = (req.headers['user-agent'] || '').slice(0, 60);
    const key = `valo:rl:${ip}:${Buffer.from(ua).toString('base64').slice(0, 20)}`;

    const used = parseInt(await redis.get(key) || '0', 10);
    return res.status(200).json({ quota_remaining: Math.max(0, RATE_LIMIT - used) });
  } catch {
    return res.status(200).json({ quota_remaining: RATE_LIMIT });
  }
};
