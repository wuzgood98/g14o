/** Reserved control event: join one or more broadcast channels. */
export const CHANNEL_JOIN_EVENT = "__channel.join" as const;

/** Reserved control event: leave one or more broadcast channels. */
export const CHANNEL_LEAVE_EVENT = "__channel.leave" as const;

/** Payload for {@link CHANNEL_JOIN_EVENT} and {@link CHANNEL_LEAVE_EVENT}. */
export interface ChannelControlPayload {
  channels: string[];
}

/** Returns true for reserved channel join/leave control events. */
export function isControlEvent(
  event: string
): event is typeof CHANNEL_JOIN_EVENT | typeof CHANNEL_LEAVE_EVENT {
  return event === CHANNEL_JOIN_EVENT || event === CHANNEL_LEAVE_EVENT;
}

/**
 * Local-only metadata marker set when an envelope re-enters the bus from a
 * transport. Prevents outbound bridge middleware from re-publishing inbound
 * events. Must never be serialized onto the wire — strip before `publish()`.
 */
export const REMOTE_INBOUND_METADATA_KEY = "__remote.inbound" as const;
