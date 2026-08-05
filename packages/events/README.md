# @g14o/events

Type-safe realtime events with Standard Schema, pluggable streams, and a Fetch API SSE handler. React client hooks included.

## Install

```bash
pnpm add @g14o/events
```

## Quick start

```ts
import { Event, type InferEvents } from "@g14o/events";
import { handler } from "@g14o/events/handler";
import { memoryStream } from "@g14o/events/memory";
import { EventProvider, createEvent } from "@g14o/events/client";
import { z } from "zod";

export const event = new Event({
  schema: { "demo.ping": z.object({ message: z.string() }) },
  stream: memoryStream(),
});

export const { GET } = handler({ event });

export const { useEvent } = createEvent<InferEvents<typeof event>>();
```

For Hono, Express, TanStack Start, and other mounts, see [Handler — Mounting](https://docs.g14o.dev/packages/events/handler#mounting).

See docs: https://docs.g14o.dev/packages/events
