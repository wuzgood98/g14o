import type { InferEvents } from "@g14o/events";
import { Event } from "@g14o/events";
import { memoryStream } from "@g14o/events/memory";
import { redisStream } from "@g14o/events/redis";
import { upstashStream } from "@g14o/events/upstash";
import { Redis as UpstashRedis } from "@upstash/redis";
import Redis from "ioredis";
import { logger } from "./logger";
import { demoEventSchema } from "./schema";

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisUrl = process.env.REDIS_URL;

function resolveStreamAdapter(): "memory" | "redis" | "upstash" {
  if (upstashUrl && upstashToken) {
    return "upstash";
  }
  if (redisUrl) {
    return "redis";
  }
  return "memory";
}

export const streamAdapter = resolveStreamAdapter();

function getStream() {
  if (upstashUrl && upstashToken) {
    return upstashStream({
      redis: new UpstashRedis({
        url: upstashUrl,
        token: upstashToken,
      }),
    });
  }
  if (redisUrl) {
    return redisStream({
      client: new Redis(redisUrl),
    });
  }
  return memoryStream();
}

export const event = new Event({
  schema: demoEventSchema,
  stream: getStream(),
  hooks: {
    onValidationError: (error) => {
      logger.error(error, "validation error");
    },
  },
});

export type Events = InferEvents<typeof event>;

event.channel("room-1").subscribe({
  events: ["demo.ping"],
  onData(ctx) {
    logger.info(`[server] ${ctx.event} on ${ctx.channel}:`, ctx.payload);
  },
});
