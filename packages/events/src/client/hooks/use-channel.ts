"use client";

import { useEffect, useRef } from "react";
import { useEventProviderContext } from "../provider";

export type UseChannelDataArg<Events extends Record<string, unknown>> = {
  [K in keyof Events & string]: {
    channel: string;
    data: Events[K];
    event: K;
  };
}[keyof Events & string];

export type ChannelHandler<Events extends Record<string, unknown>> = (
  arg: UseChannelDataArg<Events>
) => void;

export function useChannel<Events extends Record<string, unknown>>(
  ...args: string[] | [...string[], ChannelHandler<Events>]
): void {
  const maybeHandler = args.at(-1);
  const hasHandler = typeof maybeHandler === "function";
  const names = (hasHandler ? args.slice(0, -1) : args) as string[];
  const handler = hasHandler
    ? (maybeHandler as ChannelHandler<Events>)
    : undefined;

  const { register, unregister } = useEventProviderContext();
  const registrationId = useRef(Math.random().toString(36).slice(2)).current;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const channelKey = names.join("\0");

  useEffect(() => {
    const channels = channelKey ? channelKey.split("\0") : [];
    if (channels.length === 0) {
      return;
    }

    register(registrationId, channels, (msg) => {
      handlerRef.current?.({
        event: msg.event as keyof Events & string,
        data: msg.data as Events[keyof Events & string],
        channel: msg.channel,
      } as UseChannelDataArg<Events>);
    });

    return () => {
      unregister(registrationId);
    };
  }, [channelKey, register, registrationId, unregister]);
}
