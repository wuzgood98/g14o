"use client";

import { type ChannelHandler, useChannel } from "./hooks/use-channel";
import { type UseEventOptions, useEvent } from "./hooks/use-event";
import { useEventStatus } from "./hooks/use-event-status";
import type { ConnectionStatus } from "./provider";

export interface CreateEventHooks<Events extends Record<string, unknown>> {
  useChannel: {
    (...channels: string[]): void;
    (channel: string, handler: ChannelHandler<Events>): void;
    (...args: [...string[], ChannelHandler<Events>]): void;
  };
  useEvent: <const E extends keyof Events & string>(
    opts: UseEventOptions<Events, E>
  ) => { status: ConnectionStatus };
  useEventStatus: () => ConnectionStatus;
}

/** Creates typed client hooks. */
export function createEvent<
  Events extends Record<string, unknown>,
>(): CreateEventHooks<Events> {
  return {
    useEvent: useEvent as CreateEventHooks<Events>["useEvent"],
    useChannel: useChannel as CreateEventHooks<Events>["useChannel"],
    useEventStatus,
  };
}
