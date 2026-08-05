"use client";

import { useEffect, useRef } from "react";
import { type ConnectionStatus, useEventProviderContext } from "../provider";

export type UseEventDataArg<
  Events extends Record<string, unknown>,
  E extends keyof Events & string,
> = {
  [K in E]: {
    channel: string;
    data: Events[K];
    event: K;
  };
}[E];

export interface UseEventOptions<
  Events extends Record<string, unknown>,
  E extends keyof Events & string = keyof Events & string,
> {
  /** Channel names to subscribe to (undefined entries are ignored). */
  channels?: readonly (string | undefined)[];
  /** When false, skip registering until enabled. */
  enabled?: boolean;
  /** Event names to receive; omit for all typed events. */
  events?: readonly E[];
  /** Called for each matching realtime message. */
  onData?: (arg: UseEventDataArg<Events, E>) => void;
}

/** Subscribe to realtime events. */
export function useEvent<
  Events extends Record<string, unknown>,
  const E extends keyof Events & string = keyof Events & string,
>(opts: UseEventOptions<Events, E>): { status: ConnectionStatus } {
  const { channels = ["default"], events, onData, enabled } = opts;
  const { register, unregister, status } = useEventProviderContext();
  const registrationId = useRef(Math.random().toString(36).slice(2)).current;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const eventsKey = events?.join("\0") ?? "";
  const channelsKey = JSON.stringify(channels.filter(Boolean));

  useEffect(() => {
    if (enabled === false) {
      unregister(registrationId);
      return;
    }

    const validChannels = JSON.parse(channelsKey) as string[];
    if (validChannels.length === 0) {
      return;
    }

    const eventFilter = eventsKey ? (eventsKey.split("\0") as E[]) : undefined;

    register(registrationId, validChannels, (msg) => {
      const eventName = msg.event as E;
      if (
        eventFilter &&
        eventFilter.length > 0 &&
        !eventFilter.includes(eventName)
      ) {
        return;
      }

      const channel =
        validChannels.find((entry) => entry === msg.channel) ??
        msg.channel ??
        validChannels[0] ??
        "default";

      onDataRef.current?.({
        event: eventName,
        data: msg.data as Events[E],
        channel,
      } as UseEventDataArg<Events, E>);
    });

    return () => {
      unregister(registrationId);
    };
  }, [channelsKey, enabled, eventsKey, register, registrationId, unregister]);

  return { status };
}
