import type { EventBus } from "../bus/create-event-bus";
import {
  DEFAULT_KEEPALIVE_INTERVAL_MS,
  DEFAULT_MAX_STREAM_DURATION_SECS,
} from "../constants/defaults";
import { getEventLogger } from "../logging";
import { compareStreamIds } from "../stream/cursor";
import type { StreamMessage } from "../stream/interface";
import { createServerSseConnection } from "../transport/server-sse-connection";

export type HandlerMiddleware = (args: {
  channels: string[];
  request: Request;
}) => Response | undefined | Promise<Response | undefined>;

export type AuthorizeJoin = (args: {
  action: "join" | "leave";
  channels: string[];
  connectionId: string;
  request: Request;
}) => boolean | Promise<boolean>;

export interface EventHandlerOptions<TEvents extends Record<string, unknown>> {
  /** Gate SSE channel join/leave before the connection is accepted. */
  authorizeJoin?: AuthorizeJoin;
  /** Event bus instance to subscribe and replay from. */
  event: EventBus<TEvents>;
  /** Max SSE connection duration in seconds before the server closes it. */
  maxDurationSecs?: number;
  /** Run before subscribe; return a Response to reject the request. */
  middleware?: HandlerMiddleware;
}

export interface EventRouteHandlers {
  GET: (request: Request) => Promise<Response>;
}

/** Parse `channel` and `last_ack_*` query params from an SSE subscribe URL. */
export function parseSseSubscribeQuery(url: URL): {
  channels: string[];
  lastAcks: Map<string, string>;
} {
  const rawChannels = url.searchParams.getAll("channel").filter(Boolean);
  const channels =
    rawChannels.length > 0 ? [...new Set(rawChannels)] : ["default"];
  const lastAcks = new Map<string, string>();

  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("last_ack_") && value) {
      lastAcks.set(decodeURIComponent(key.slice("last_ack_".length)), value);
    }
  }

  return { channels, lastAcks };
}

async function replayChannelHistory(args: {
  channel: string;
  cursor: string | undefined;
  lastHistoryIds: Map<string, string>;
  stream: EventBus<Record<string, unknown>>["stream"];
  writeUserMessage: (message: StreamMessage) => void;
  writeSystem: (payload: Record<string, unknown>) => void;
}): Promise<void> {
  const {
    channel,
    cursor,
    lastHistoryIds,
    stream,
    writeUserMessage,
    writeSystem,
  } = args;

  writeSystem({ type: "connected", channel });

  const replay = await stream.readAfter(channel, cursor);
  for (const message of replay) {
    writeUserMessage(message);
  }

  const last = replay.at(-1);
  if (last) {
    lastHistoryIds.set(channel, last.id);
  }
}

/**
 * Creates a Fetch API GET handler for SSE realtime delivery.
 *
 * Subscribes to the event stream, replays history via `last_ack_*`, and fans
 * live messages to the client.
 */
export function handler<TEvents extends Record<string, unknown>>(
  options: EventHandlerOptions<TEvents>
): EventRouteHandlers {
  const authorizeJoin = options.authorizeJoin ?? (() => true);
  const stream = options.event.stream;
  const logger = getEventLogger(options.event);
  const maxStreamDurationMs =
    (options.maxDurationSecs ?? DEFAULT_MAX_STREAM_DURATION_SECS) * 1000;

  return {
    async GET(request) {
      const url = new URL(request.url);
      const { channels, lastAcks } = parseSseSubscribeQuery(url);

      if (options.middleware) {
        const rejected = await options.middleware({ request, channels });
        if (rejected) {
          return rejected;
        }
      }

      const allowed = await authorizeJoin({
        connectionId: "pending",
        channels,
        action: "join",
        request,
      });

      if (!allowed) {
        return Response.json(
          { ok: false, error: "Channel join rejected." },
          { status: 403 }
        );
      }

      const {
        connectionId,
        stream: responseStream,
        transport,
        writeKeepalive,
        writeMeta,
      } = createServerSseConnection();

      writeMeta({ connectionId });

      let cleanedUp = false;
      let unsubscribe: (() => void) | undefined;
      let keepaliveTimer: ReturnType<typeof setInterval> | undefined;
      let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      let isHistoryReplayed = false;
      const liveBuffer: StreamMessage[] = [];
      const lastHistoryIds = new Map<string, string>();

      const cleanup = async (): Promise<void> => {
        if (cleanedUp) {
          return;
        }
        cleanedUp = true;
        unsubscribe?.();
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        await transport.close().catch((error) => {
          logger.warn("[events] SSE cleanup failed", error);
        });
      };

      const writeUserMessage = (message: StreamMessage): void => {
        transport
          .publish({
            id: message.id,
            event: message.event,
            payload: message.data,
            channels: [message.channel],
            timestamp: message.timestamp,
            metadata: message.metadata,
          })
          .catch((error) => {
            logger.error("[events] SSE publish failed", error);
          });
      };

      const writeSystem = (payload: Record<string, unknown>): void => {
        transport
          .publish({
            id: `system-${Date.now()}`,
            event: `__system.${String(payload.type ?? "message")}`,
            payload,
            timestamp: Date.now(),
          })
          .catch((error) => {
            logger.error("[events] SSE publish failed", error);
          });
      };

      unsubscribe = stream.subscribe(channels, (message) => {
        if (cleanedUp) {
          return;
        }

        if (!isHistoryReplayed) {
          liveBuffer.push(message);
          return;
        }

        const lastId = lastHistoryIds.get(message.channel);
        if (lastId && compareStreamIds(message.id, lastId) <= 0) {
          return;
        }

        writeUserMessage(message);
      });

      for (const channel of channels) {
        await replayChannelHistory({
          channel,
          cursor: lastAcks.get(channel) ?? String(Date.now()),
          lastHistoryIds,
          stream,
          writeUserMessage,
          writeSystem,
        });
      }

      for (const message of liveBuffer) {
        const lastId = lastHistoryIds.get(message.channel);
        if (lastId && compareStreamIds(message.id, lastId) <= 0) {
          continue;
        }
        writeUserMessage(message);
      }
      liveBuffer.length = 0;
      isHistoryReplayed = true;

      keepaliveTimer = setInterval(() => {
        writeSystem({ type: "ping", timestamp: Date.now() });
        try {
          writeKeepalive();
        } catch {
          cleanup().catch((error) => {
            logger.warn("[events] SSE cleanup failed", error);
          });
        }
      }, DEFAULT_KEEPALIVE_INTERVAL_MS);

      reconnectTimer = setTimeout(() => {
        writeSystem({ type: "reconnect", timestamp: Date.now() });
        writeMeta({ reconnect: true });
        cleanup().catch((error) => {
          logger.warn("[events] SSE cleanup failed", error);
        });
      }, maxStreamDurationMs);

      request.signal.addEventListener("abort", () => {
        cleanup().catch((error) => {
          logger.warn("[events] SSE cleanup failed", error);
        });
      });

      return new Response(responseStream, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
        },
      });
    },
  };
}
