import type { Redis } from "@upstash/redis";
import { defineStream } from "./create-stream";
import { isStreamCursor } from "./cursor";
import type { EventStream, StreamMessage } from "./interface";

/** Default key/channel prefix — must not contain `/` (Upstash REST subscribe path). */
export const DEFAULT_UPSTASH_CHANNEL_PREFIX = "@g14o:events" as const;

export interface UpstashStreamOptions {
  /** Key/channel prefix. @default "@g14o:events" */
  channelPrefix?: string;
  /** Optional TTL applied to stream keys after append. */
  expireAfterSecs?: number;
  /** Max stream length (MAXLEN). */
  maxLength?: number;
  /** Upstash Redis REST client (or compatible). */
  redis: Redis;
}

function assertUrlSafeChannelPrefix(prefix: string): void {
  if (prefix.includes("/")) {
    throw new Error(
      `upstashStream channelPrefix must not contain "/" (got ${JSON.stringify(prefix)}). Upstash REST SUBSCRIBE puts the channel in the URL path, so "/" splits the path and live fan-out silently fails.`
    );
  }
}

function streamKey(prefix: string, channel: string): string {
  return `${prefix}:${channel}`;
}

function resolveXRangeStart(cursor: string | undefined): string {
  if (cursor === undefined) {
    return "-";
  }
  if (isStreamCursor(cursor)) {
    return `(${cursor}`;
  }
  return String(cursor);
}

/**
 * Upstash Redis Streams + pub/sub {@link EventStream}.
 */
export function upstashStream(options: UpstashStreamOptions): EventStream {
  const prefix = options.channelPrefix ?? DEFAULT_UPSTASH_CHANNEL_PREFIX;
  assertUrlSafeChannelPrefix(prefix);
  const { redis } = options;

  return defineStream({
    async append(channel, message) {
      const key = streamKey(prefix, channel);
      const id = await redis.xadd(
        key,
        "*",
        {
          event: message.event,
          data: message.data,
          channel,
          timestamp: message.timestamp,
          ...(message.metadata === undefined
            ? {}
            : { metadata: message.metadata }),
        },
        {
          ...(options.maxLength === undefined
            ? {}
            : {
                trim: {
                  type: "MAXLEN" as const,
                  threshold: options.maxLength,
                  comparison: "=" as const,
                },
              }),
        }
      );

      if (!id) {
        throw new Error("Upstash stream append failed to allocate a cursor.");
      }

      if (options.expireAfterSecs) {
        await redis.expire(key, options.expireAfterSecs);
      }

      return id;
    },

    async publish(channel, message) {
      const key = streamKey(prefix, channel);
      await redis.publish(key, message);
    },

    async readAfter(channel, cursor, readOptions) {
      const key = streamKey(prefix, channel);
      const start = resolveXRangeStart(cursor);

      const history =
        (await redis.xrange(key, start, "+", readOptions?.limit)) ?? {};

      return Object.entries(history).map(([id, value]) => {
        const entry = value as {
          channel?: string;
          data?: unknown;
          event?: string;
          metadata?: Record<string, unknown>;
          timestamp?: number;
        };
        return {
          id,
          channel: entry.channel ?? channel,
          event: String(entry.event ?? ""),
          data: entry.data,
          timestamp: Number(entry.timestamp ?? Date.now()),
          ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
        } satisfies StreamMessage;
      });
    },

    subscribe(channels, onMessage) {
      const keys = channels.map((channel) => streamKey(prefix, channel));
      const sub = redis.subscribe<StreamMessage>(keys);
      let closed = false;

      const onMessageHandler = ({
        message,
      }: {
        message: StreamMessage;
      }): void => {
        if (closed) {
          return;
        }
        Promise.resolve(onMessage(message)).catch(() => undefined);
      };

      sub.on("message", onMessageHandler);
      sub.on("error", (error) => {
        console.error("[@g14o/events] Upstash stream subscribe error", error);
      });

      return () => {
        closed = true;
        sub.unsubscribe();
      };
    },

    close() {
      // Caller owns the Redis client.
      return Promise.resolve();
    },
  });
}
