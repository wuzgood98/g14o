import IoRedis from "ioredis";
import { createClient } from "redis";
import { getRedisUrl } from "./integration-redis-env";

export async function createNodeRedisClient(): Promise<
  ReturnType<typeof createClient>
> {
  const client = createClient({ url: getRedisUrl() });
  await client.connect();
  return client;
}

export function createIoRedisClient(): IoRedis {
  return new IoRedis(getRedisUrl());
}
