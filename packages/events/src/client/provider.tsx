"use client";

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const DEFAULT_API_URL = "/api/events" as const;
const PING_TIMEOUT_MS = 75_000;
const CONNECT_DEBOUNCE_MS = 25;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 3;

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface ProviderApiConfig {
  /** SSE subscribe URL (default `/api/events`). */
  url?: string;
  /** Send cookies on the EventSource request. */
  withCredentials?: boolean;
}

export interface RealtimeUserMessage {
  channel: string;
  data: unknown;
  event: string;
  id: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export type RealtimeMessage =
  | RealtimeUserMessage
  | { type: "connected"; channel?: string; cursor?: string }
  | { type: "reconnect"; timestamp: number }
  | { type: "ping"; timestamp?: number }
  | { type: "error"; error: string }
  | { type: string; [key: string]: unknown };

export interface EventProviderProps {
  /** SSE endpoint and fetch credentials. */
  api?: ProviderApiConfig;
  children: ReactNode;
  /** Max automatic reconnect attempts after disconnect. */
  maxReconnectAttempts?: number;
}

export interface EventProviderContextValue {
  register: (
    id: string,
    channels: string[],
    cb: (msg: RealtimeUserMessage) => void
  ) => void;
  status: ConnectionStatus;
  unregister: (id: string) => void;
}

const EventProviderContext = createContext<EventProviderContextValue | null>(
  null
);

function buildEventSourceUrl(
  baseUrl: string,
  channels: string[],
  lastAcks: Map<string, string>,
  replayEventsSince: number | null
): string {
  const channelParams = channels
    .map((ch) => `channel=${encodeURIComponent(ch)}`)
    .join("&");

  const lastAckParams = channels
    .map((channel) => {
      const lastAck =
        lastAcks.get(channel) ??
        (replayEventsSince === null ? undefined : String(replayEventsSince));
      if (lastAck === undefined) {
        return null;
      }
      return `last_ack_${encodeURIComponent(channel)}=${encodeURIComponent(lastAck)}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join("&");

  const query = [channelParams, lastAckParams].filter(Boolean).join("&");
  return query ? `${baseUrl}?${query}` : baseUrl;
}

function isSystemPayload(
  payload: Record<string, unknown>
): payload is Record<string, unknown> & { type: string } {
  return typeof payload.type === "string";
}

function toUserMessage(
  payload: Record<string, unknown>
): RealtimeUserMessage | null {
  // EventEnvelope shape from @g14o/events handler
  if (typeof payload.event === "string" && "payload" in payload) {
    const channels = Array.isArray(payload.channels)
      ? (payload.channels as string[])
      : [];
    const channel =
      channels[0] ??
      (typeof payload.channel === "string" ? payload.channel : "default");

    if (String(payload.event).startsWith("__system.")) {
      return null;
    }

    return {
      id: String(payload.id ?? ""),
      event: payload.event,
      data: payload.payload,
      channel,
      timestamp:
        typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
      ...(payload.metadata && typeof payload.metadata === "object"
        ? { metadata: payload.metadata as Record<string, unknown> }
        : {}),
    };
  }

  // Upstash user event shape
  if (
    typeof payload.event === "string" &&
    typeof payload.channel === "string" &&
    "data" in payload
  ) {
    return {
      id: String(payload.id ?? ""),
      event: payload.event,
      data: payload.data,
      channel: payload.channel,
      timestamp:
        typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
    };
  }

  return null;
}

function applySystemPayload(
  next: Record<string, unknown> & { type: string },
  lastAck: Map<string, string>,
  reconnect: (timestamp: number) => void
): void {
  if (
    next.type === "connected" &&
    typeof next.channel === "string" &&
    typeof next.cursor === "string"
  ) {
    lastAck.set(next.channel, next.cursor);
  }
  if (next.type === "reconnect" && typeof next.timestamp === "number") {
    reconnect(next.timestamp);
  }
}

function dispatchToSubscribers(
  message: RealtimeUserMessage,
  subscribers: Iterable<{
    channels: Set<string>;
    cb: (msg: RealtimeUserMessage) => void;
  }>
): void {
  for (const sub of subscribers) {
    if (sub.channels.has(message.channel) || sub.channels.has("*")) {
      sub.cb(message);
    }
  }
}

function processInboundPayload(
  payload: Record<string, unknown>,
  lastAck: Map<string, string>,
  subscribers: Iterable<{
    channels: Set<string>;
    cb: (msg: RealtimeUserMessage) => void;
  }>,
  reconnect: (timestamp: number) => void
): void {
  if (isSystemPayload(payload)) {
    applySystemPayload(payload, lastAck, reconnect);
    return;
  }

  const userMessage = toUserMessage(payload);
  if (!userMessage) {
    if (
      typeof payload.event === "string" &&
      payload.event.startsWith("__system.") &&
      payload.payload &&
      typeof payload.payload === "object"
    ) {
      processInboundPayload(
        payload.payload as Record<string, unknown>,
        lastAck,
        subscribers,
        reconnect
      );
    }
    return;
  }

  lastAck.set(userMessage.channel, userMessage.id);
  dispatchToSubscribers(userMessage, subscribers);
}

export function EventProvider({
  children,
  api,
  maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
}: EventProviderProps): React.ReactElement {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const apiUrl = api?.url ?? DEFAULT_API_URL;
  const withCredentials = api?.withCredentials ?? false;

  const localSubsRef = useRef(
    new Map<
      string,
      { channels: Set<string>; cb: (msg: RealtimeUserMessage) => void }
    >()
  );
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastAckRef = useRef(new Map<string, string>());
  const lastReplaySinceRef = useRef<number | null>(null);
  const connectRef = useRef<(opts?: { replayEventsSince?: number }) => void>(
    () => undefined
  );

  const getAllNeededChannels = useCallback(() => {
    const channels = new Set<string>();
    for (const sub of localSubsRef.current.values()) {
      for (const channel of sub.channels) {
        channels.add(channel);
      }
    }
    return channels;
  }, []);

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    closeConnection();
    reconnectAttemptsRef.current = 0;
    setStatus("disconnected");
  }, [closeConnection]);

  const resetPingTimeout = useCallback(() => {
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
    }
    pingTimeoutRef.current = setTimeout(() => {
      connectRef.current();
    }, PING_TIMEOUT_MS);
  }, []);

  const handleMessage = useCallback((payload: Record<string, unknown>) => {
    processInboundPayload(
      payload,
      lastAckRef.current,
      localSubsRef.current.values(),
      (timestamp) => {
        connectRef.current({ replayEventsSince: timestamp });
      }
    );
  }, []);

  const connect = useCallback(
    (opts?: { replayEventsSince?: number }) => {
      const replayEventsSince =
        opts?.replayEventsSince ?? lastReplaySinceRef.current ?? Date.now();
      lastReplaySinceRef.current = replayEventsSince;

      const channels = Array.from(getAllNeededChannels()).filter(
        (channel) => channel !== "*"
      );

      if (channels.length === 0) {
        return;
      }

      closeConnection();
      setStatus("connecting");

      const url = buildEventSourceUrl(
        apiUrl,
        channels,
        lastAckRef.current,
        replayEventsSince
      );

      const eventSource = new EventSource(url, { withCredentials });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setStatus("connected");
        resetPingTimeout();
      };

      eventSource.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data) as Record<string, unknown>;
          resetPingTimeout();
          handleMessage(payload);
        } catch {
          // ignore malformed frames
        }
      };

      eventSource.onerror = () => {
        if (eventSource !== eventSourceRef.current) {
          return;
        }
        if (eventSource.readyState === EventSource.CONNECTING) {
          return;
        }

        setStatus("disconnected");

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(
            () => {
              connect();
            },
            Math.min(1000 * reconnectAttemptsRef.current, 10_000)
          );
        } else {
          setStatus("error");
        }
      };
    },
    [
      apiUrl,
      closeConnection,
      getAllNeededChannels,
      handleMessage,
      maxReconnectAttempts,
      resetPingTimeout,
      withCredentials,
    ]
  );

  connectRef.current = connect;

  const debouncedConnect = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      connect();
      debounceTimeoutRef.current = null;
    }, CONNECT_DEBOUNCE_MS);
  }, [connect]);

  useEffect(
    () => () => {
      disconnect();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    },
    [disconnect]
  );

  const register = useCallback(
    (
      id: string,
      channels: string[],
      cb: (msg: RealtimeUserMessage) => void
    ) => {
      localSubsRef.current.set(id, { channels: new Set(channels), cb });
      debouncedConnect();
    },
    [debouncedConnect]
  );

  const unregister = useCallback(
    (id: string) => {
      const entry = localSubsRef.current.get(id);
      if (entry) {
        for (const channel of entry.channels) {
          lastAckRef.current.delete(channel);
        }
      }
      localSubsRef.current.delete(id);

      if (localSubsRef.current.size === 0) {
        disconnect();
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
          debounceTimeoutRef.current = null;
        }
        return;
      }

      debouncedConnect();
    },
    [debouncedConnect, disconnect]
  );

  return (
    <EventProviderContext.Provider value={{ status, register, unregister }}>
      {children}
    </EventProviderContext.Provider>
  );
}

export function useEventProviderContext(): EventProviderContextValue {
  const context = useContext(EventProviderContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}
