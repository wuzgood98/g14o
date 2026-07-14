import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasRedisUrl } from "../integration-redis-env";
import { type IoRedisLike, redisStore } from "./redis";
import { describeStore } from "./store-contract";

const REDIS_CONNECTION_ERROR_REGEX = /Redis|Connection is closed/i;

describe.skipIf(!hasRedisUrl())("Redis integration", () => {
  let createNodeRedisClient: typeof import("../integration-redis-clients")["createNodeRedisClient"];
  let createIoRedisClient: typeof import("../integration-redis-clients")["createIoRedisClient"];

  beforeAll(async () => {
    const clients = await import("../integration-redis-clients");
    createNodeRedisClient = clients.createNodeRedisClient;
    createIoRedisClient = clients.createIoRedisClient;
  });

  describe("node-redis", () => {
    let client: Awaited<ReturnType<typeof createNodeRedisClient>>;

    beforeAll(async () => {
      client = await createNodeRedisClient();
    });

    afterAll(async () => {
      await client.quit();
    });

    describeStore("redisStore (node-redis)", () => redisStore(client));
  });

  describe("ioredis", () => {
    let client: ReturnType<typeof createIoRedisClient>;

    beforeAll(() => {
      client = createIoRedisClient();
    });

    afterAll(async () => {
      await client.quit();
    });

    describeStore("redisStore (ioredis)", () =>
      redisStore(client as IoRedisLike)
    );
  });

  describe("network failures", () => {
    it("propagates connection errors from get()", async () => {
      const client = createIoRedisClient();
      await client.quit();

      const store = redisStore(client as IoRedisLike);
      const key = `@cache:dead-${randomUUID()}`;

      await expect(store.get(key)).rejects.toThrow(
        REDIS_CONNECTION_ERROR_REGEX
      );
    });
  });
});
