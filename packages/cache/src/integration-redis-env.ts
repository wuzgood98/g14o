export function hasRedisUrl(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Missing REDIS_URL for Redis integration tests");
  }
  return url;
}
