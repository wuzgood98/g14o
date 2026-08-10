import type { Redis as IoRedis } from "ioredis";
import type { createClient as createNodeRedis } from "redis";
import { defineStream } from "./create-stream";
import { isStreamCursor } from "./cursor";
import type { EventStream, StreamMessage } from "./interface";

export type NodeRedis = ReturnType<typeof createNodeRedis>;

export type RedisStreamClient = NodeRedis | IoRedis;

export interface RedisStreamOptions {
  /** Key/channel prefix. @default "@g14o:events" */
  channelPrefix?: string;
  /** Redis client (node-redis or ioredis). */
  client: RedisStreamClient;
  /** Optional TTL applied to stream keys after append. */
  expireAfterSecs?: number;
  /** Max stream length (MAXLEN ≈). */
  maxLength?: number;
}

function isIoRedis(client: RedisStreamClient): client is IoRedis {
  return "status" in client && typeof (client as IoRedis).xadd === "function";
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

function ignoreRejected(promise: Promise<unknown>): void {
  promise.catch(() => undefined);
}

function serializeMessage(
  message: Omit<StreamMessage, "id"> & { id?: string }
): Record<string, string> {
  return {
    event: message.event,
    data: JSON.stringify(message.data),
    channel: message.channel,
    timestamp: String(message.timestamp),
    ...(message.metadata === undefined
      ? {}
      : { metadata: JSON.stringify(message.metadata) }),
  };
}

function deserializeMessage(
  id: string,
  fields: Record<string, string>
): StreamMessage {
  return {
    id,
    channel: fields.channel ?? "",
    event: fields.event ?? "",
    data: fields.data ? (JSON.parse(fields.data) as unknown) : null,
    timestamp: Number(fields.timestamp ?? Date.now()),
    ...(fields.metadata === undefined
      ? {}
      : { metadata: JSON.parse(fields.metadata) as Record<string, unknown> }),
  };
}

function fieldsFromIoRedis(flat: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (let index = 0; index < flat.length; index += 2) {
    const key = flat[index];
    const value = flat[index + 1];
    if (key !== undefined && value !== undefined) {
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Redis Streams + pub/sub {@link EventStream} (node-redis or ioredis).
 */
export function redisStream(options: RedisStreamOptions): EventStream {
  const prefix = options.channelPrefix ?? "@g14o:events";
  const client = options.client;
  const io = isIoRedis(client);

  return defineStream({
    async write(channel, message) {
      const key = streamKey(prefix, channel);
      const fields = serializeMessage({
        ...message,
        channel,
      });

      let id: string | null;

      if (io) {
        if (options.maxLength === undefined) {
          const fieldArgs: string[] = [];
          for (const [field, value] of Object.entries(fields)) {
            fieldArgs.push(field, value);
          }
          id = await client.xadd(key, "*", ...fieldArgs);
        } else {
          const fieldArgs: string[] = [];
          for (const [field, value] of Object.entries(fields)) {
            fieldArgs.push(field, value);
          }
          id = await client.xadd(
            key,
            "MAXLEN",
            "~",
            options.maxLength,
            "*",
            ...fieldArgs
          );
        }
      } else {
        id = await client.xAdd(key, "*", fields, {
          ...(options.maxLength === undefined
            ? {}
            : {
                TRIM: {
                  strategy: "MAXLEN" as const,
                  threshold: options.maxLength,
                },
              }),
        });
      }

      if (!id) {
        throw new Error("Redis stream write failed to allocate a cursor.");
      }

      if (options.expireAfterSecs) {
        await client.expire(key, options.expireAfterSecs);
      }

      await client.publish(
        key,
        JSON.stringify({
          id,
          channel,
          event: message.event,
          data: message.data,
          timestamp: message.timestamp,
          ...(message.metadata === undefined
            ? {}
            : { metadata: message.metadata }),
        } satisfies StreamMessage)
      );

      return id;
    },

    async readAfter(channel, cursor, readOptions) {
      const key = streamKey(prefix, channel);
      const start = resolveXRangeStart(cursor);
      const limit = readOptions?.limit;

      if (io) {
        const rows =
          limit === undefined
            ? await client.xrange(key, start, "+")
            : await client.xrange(key, start, "+", "COUNT", limit);
        return rows.map(([id, flat]) =>
          deserializeMessage(id, fieldsFromIoRedis(flat))
        );
      }

      const rows = await client.xRange(key, start, "+", {
        ...(limit === undefined ? {} : { COUNT: limit }),
      });

      return rows.map((row) => deserializeMessage(row.id, row.message));
    },

    subscribe(channels, onMessage) {
      const keys = channels.map((channel) => streamKey(prefix, channel));
      let closed = false;

      if (io) {
        const sub = client.duplicate();
        const startIoSubscription = async (): Promise<void> => {
          if (sub.status !== "ready") {
            // ioredis connects lazily on first command
          }
          await sub.subscribe(...keys);
          sub.on("message", (_channel, raw) => {
            if (closed) {
              return;
            }
            try {
              const message = JSON.parse(raw) as StreamMessage;
              Promise.resolve(onMessage(message)).catch(() => undefined);
            } catch {
              // ignore malformed
            }
          });
        };
        ignoreRejected(startIoSubscription());

        return () => {
          closed = true;
          ignoreRejected(sub.unsubscribe(...keys));
          if (sub.quit) {
            ignoreRejected(sub.quit());
          }
        };
      }

      const sub = client.duplicate();
      const startNodeSubscription = async (): Promise<void> => {
        if (typeof sub.connect === "function" && sub.isOpen !== true) {
          await sub.connect();
        }
        if (typeof sub.subscribe === "function") {
          await sub.subscribe(keys, (raw) => {
            if (closed) {
              return;
            }
            try {
              const message = JSON.parse(raw) as StreamMessage;
              Promise.resolve(onMessage(message)).catch(() => undefined);
            } catch {
              // ignore
            }
          });
        }
      };
      ignoreRejected(startNodeSubscription());

      return () => {
        closed = true;
        if (sub.quit) {
          ignoreRejected(sub.quit());
        }
      };
    },

    close() {
      // Caller owns the primary client lifecycle.
      return Promise.resolve();
    },
  });
}
