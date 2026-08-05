/** Default listener priority when none is provided. */
export const DEFAULT_PRIORITY = 0;

/** Default bus behavior when a listener throws. */
export const DEFAULT_ON_LISTENER_ERROR = "continue" as const;

/** Default SSE comment keepalive interval for handler lifecycle. */
export const DEFAULT_KEEPALIVE_INTERVAL_MS = 30_000;

/** Default proactive stream rotation interval before typical platform caps. */
export const DEFAULT_MAX_STREAM_DURATION_SECS = 280;

/** Millisecond equivalent of {@link DEFAULT_MAX_STREAM_DURATION_SECS}. */
export const DEFAULT_MAX_STREAM_DURATION_MS: number =
  DEFAULT_MAX_STREAM_DURATION_SECS * 1000;

/**
 * Wildcard token used to match any event segment in listener patterns.
 * @internal
 */
export const WILDCARD_ALL = "*" as const;
