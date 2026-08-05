/**
 * Wire-level envelope for events crossing the SSE boundary.
 *
 * Mirrors the core {@link EventContext} shape (`event` corresponds to
 * `EventContext.name`) plus broadcast scoping and provenance fields.
 *
 * **Serialization boundary:** anything written as an SSE data frame must be
 * structurally cloneable (JSON-safe).
 */
export interface EventEnvelope<Payload = unknown> {
  /**
   * Broadcast scoping — which channel(s) this envelope was published to.
   *
   * Absent or empty `channels` must **not** silently mean "everyone".
   * Require an explicit channel (even a conventionally-named `"broadcast:all"`)
   * so "goes to every connection" is a deliberate choice, not a default.
   */
  channels?: string[];
  /** Fully qualified event name — same as {@link EventContext.name}. */
  event: string;
  /** Unique emission identifier. */
  id: string;
  /** Optional metadata bag. Must be JSON-serializable when crossing the wire. */
  metadata?: Record<string, unknown>;
  /** Validated payload for this emission. */
  payload: Payload;
  /**
   * Set by the server-side writer only; never trust an incoming value for this.
   */
  source?: { connectionId?: string; authenticatedUserId?: string };
  /** Emission timestamp in milliseconds. */
  timestamp: number;
}

/** Unsubscribe function — matches the core bus `on()`/`once()` convention. */
export type Unsubscribe = () => void;

/** Connection lifecycle state for the SSE writer. */
export type TransportState = "connecting" | "open" | "closed";
