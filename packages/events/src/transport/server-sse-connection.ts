import type { EventEnvelope, TransportState, Unsubscribe } from "./types";

function notifyEnvelopeSubscribers(
  subscribers: Iterable<(envelope: EventEnvelope) => void | Promise<void>>,
  envelope: EventEnvelope
): void {
  for (const handler of subscribers) {
    Promise.resolve(handler(envelope)).catch(() => undefined);
  }
}

function createSseResponseWriter(): {
  stream: ReadableStream<Uint8Array>;
  writer: {
    close: () => void;
    write: (envelope: EventEnvelope) => void;
  };
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
    cancel() {
      closed = true;
      controller = null;
    },
  });

  return {
    stream,
    writer: {
      write(envelope) {
        if (closed || !controller) {
          return;
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(envelope)}\n\n`)
        );
      },
      close() {
        if (closed) {
          return;
        }
        closed = true;
        try {
          controller?.close();
        } catch {
          // Stream may already be closed.
        }
        controller = null;
      },
    },
  };
}

/** Server-side per-connection SSE writer with optional inbound delivery. */
export interface ServerSseConnectionTransport {
  close(): Promise<void>;
  readonly connectionId: string;
  publish(envelope: EventEnvelope): Promise<void>;
  /** Delivers an inbound envelope into local subscribers. */
  receive(envelope: EventEnvelope): void;
  readonly state: TransportState;
  subscribe(
    handler: (envelope: EventEnvelope) => void | Promise<void>
  ): Unsubscribe;
}

export interface CreateServerSseConnectionOptions {
  /** Override connection ID generation (defaults to `crypto.randomUUID()`). */
  connectionId?: string;
}

/**
 * Creates a server-side SSE connection: outbound via SSE frames,
 * inbound via {@link ServerSseConnectionTransport.receive}.
 */
export function createServerSseConnection(
  options: CreateServerSseConnectionOptions = {}
): {
  connectionId: string;
  stream: ReadableStream<Uint8Array>;
  transport: ServerSseConnectionTransport;
  writeKeepalive: () => void;
  writeMeta: (data: Record<string, unknown>) => void;
} {
  const connectionId = options.connectionId ?? crypto.randomUUID();
  const { stream: dataStream, writer } = createSseResponseWriter();
  const encoder = new TextEncoder();
  let metaController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const subscribers = new Set<
    (envelope: EventEnvelope) => void | Promise<void>
  >();
  let state: TransportState = "open";

  const transport: ServerSseConnectionTransport = {
    connectionId,

    get state() {
      return state;
    },

    close(): Promise<void> {
      state = "closed";
      writer.close();
      try {
        metaController?.close();
      } catch {
        // Stream may already be closed.
      }
      metaController = null;
      return Promise.resolve();
    },

    publish(envelope): Promise<void> {
      if (state !== "open") {
        throw new Error("Server SSE connection transport is not open.");
      }

      writer.write(envelope);
      return Promise.resolve();
    },

    subscribe(handler) {
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
    },

    receive(envelope) {
      notifyEnvelopeSubscribers(subscribers, envelope);
    },
  };

  const writeToMetaStream = (frame: string): void => {
    if (!metaController) {
      throw new Error("SSE meta writer is not ready.");
    }

    metaController.enqueue(encoder.encode(frame));
  };

  const writeMeta = (data: Record<string, unknown>): void => {
    writeToMetaStream(`event: meta\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const writeKeepalive = (): void => {
    writeToMetaStream(": keepalive\n\n");
  };

  return {
    connectionId,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        metaController = controller;
        const reader = dataStream.getReader();

        const pump = (): void => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }

              controller.enqueue(value);
              pump();
            })
            .catch((error) => {
              controller.error(error);
            });
        };

        pump();
      },
    }),
    transport,
    writeMeta,
    writeKeepalive,
  };
}
