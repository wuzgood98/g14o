"use client";

import { EventProvider } from "@g14o/events/client";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EventProvider api={{ url: "/api/events" }} maxReconnectAttempts={3}>
      {children}
    </EventProvider>
  );
}
