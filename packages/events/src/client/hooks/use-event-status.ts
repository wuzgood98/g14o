"use client";

import { type ConnectionStatus, useEventProviderContext } from "../provider";

/** Connection status from {@link EventProvider}. */
export function useEventStatus(): ConnectionStatus {
  return useEventProviderContext().status;
}
