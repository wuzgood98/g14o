import { defineStream } from "./create-stream";
import { compareStreamIds, createMemoryCursor, isStreamCursor } from "./cursor";
import type { EventStream, StreamMessage } from "./interface";

const DEFAULT_MAX_LENGTH = 100;

export interface MemoryStreamOptions {
  /**
   * Max messages retained per channel.
   *
   * @default 100
   */
  maxLength?: number;
}

/**
 * In-process {@link EventStream} with ring-buffer history and local pub/sub.
 *
 * Default stream for {@link Event} when none is provided. Best-effort only —
 * does not survive process restarts or multi-instance fan-out.
 */
export function memoryStream(options: MemoryStreamOptions = {}): EventStream {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const byChannel = new Map<string, StreamMessage[]>();
  const subscribers = new Set<{
    channels: ReadonlySet<string>;
    onMessage: (message: StreamMessage) => void | Promise<void>;
  }>();
  let sequence = 0;
  let closed = false;

  const assertOpen = (): void => {
    if (closed) {
      throw new Error("Memory stream is closed.");
    }
  };

  const trim = (channel: string): void => {
    const entries = byChannel.get(channel);
    if (!entries || entries.length <= maxLength) {
      return;
    }
    entries.splice(0, entries.length - maxLength);
  };

  const fanOut = (message: StreamMessage): void => {
    for (const subscriber of subscribers) {
      if (!subscriber.channels.has(message.channel)) {
        continue;
      }
      Promise.resolve(subscriber.onMessage(message)).catch(() => undefined);
    }
  };

  return defineStream({
    write(channel, message) {
      assertOpen();
      sequence += 1;
      const id = createMemoryCursor(sequence);
      const entry: StreamMessage = {
        id,
        channel,
        event: message.event,
        data: message.data,
        timestamp: message.timestamp,
        ...(message.metadata === undefined
          ? {}
          : { metadata: message.metadata }),
      };

      const existing = byChannel.get(channel) ?? [];
      existing.push(entry);
      byChannel.set(channel, existing);
      trim(channel);
      fanOut(entry);

      return Promise.resolve(id);
    },

    readAfter(channel, cursor, readOptions) {
      assertOpen();
      const entries = byChannel.get(channel) ?? [];
      let filtered: StreamMessage[];

      if (!cursor) {
        filtered = [...entries];
      } else if (isStreamCursor(cursor)) {
        const index = entries.findIndex((entry) => entry.id === cursor);
        filtered =
          index === -1
            ? entries.filter((entry) => compareStreamIds(entry.id, cursor) > 0)
            : entries.slice(index + 1);
      } else {
        const since = Number(cursor);
        filtered = Number.isFinite(since)
          ? entries.filter((entry) => entry.timestamp >= since)
          : [...entries];
      }

      const limit = readOptions?.limit;
      return Promise.resolve(
        limit === undefined ? filtered : filtered.slice(0, limit)
      );
    },

    subscribe(channels, onMessage) {
      assertOpen();
      const entry = {
        channels: new Set(channels),
        onMessage,
      };
      subscribers.add(entry);
      return () => {
        subscribers.delete(entry);
      };
    },

    close() {
      closed = true;
      subscribers.clear();
      byChannel.clear();
      return Promise.resolve();
    },
  });
}
