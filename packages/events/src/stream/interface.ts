/** Wire message through {@link EventStream}. Cursor ids match Redis stream shape. */
export interface StreamMessage {
  channel: string;
  data: unknown;
  event: string;
  id: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

/** Options for {@link EventStream.readAfter}. */
export interface StreamReadOptions {
  /** Max messages to return. */
  limit?: number;
}

/** Durable channel backend (persistence + live fan-out). SSE is {@link handler}. */
export interface EventStream {
  append(
    channel: string,
    message: Omit<StreamMessage, "id" | "channel"> & { channel?: string }
  ): Promise<string>;
  close(): Promise<void>;
  publish(channel: string, message: StreamMessage): Promise<void>;
  readAfter(
    channel: string,
    cursor: string | undefined,
    options?: StreamReadOptions
  ): Promise<StreamMessage[]>;
  subscribe(
    channels: readonly string[],
    onMessage: (message: StreamMessage) => void | Promise<void>
  ): () => void;
}
