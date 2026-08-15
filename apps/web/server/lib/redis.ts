import { Redis } from 'ioredis'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (_redis) return _redis

  const url = process.env.REDIS_URL
  if (url) {
    _redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
  } else {
    // In-memory fallback for local dev without Redis
    _redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1, lazyConnect: true })
  }

  return _redis
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis()
    const value = await redis.get(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  try {
    const redis = getRedis()
    const serialized = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.set(key, serialized, 'EX', ttlSeconds)
    } else {
      await redis.set(key, serialized)
    }
  } catch {
    // Redis unavailable — best effort
  }
}

export async function kvDel(key: string): Promise<void> {
  try {
    const redis = getRedis()
    await redis.del(key)
  } catch {
    // best effort
  }
}

export async function kvIncr(key: string, ttlSeconds?: number): Promise<number | null> {
  try {
    const redis = getRedis()
    const value = await redis.incr(key)
    if (ttlSeconds && value === 1) {
      await redis.expire(key, ttlSeconds)
    }
    return value
  } catch {
    return null
  }
}
