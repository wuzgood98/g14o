/** Wire-level envelope for events crossing the SSE boundary. @internal */
interface EventEnvelope<Payload = unknown> {
  channels?: string[];
  event: string;
  id: string;
  metadata?: Record<string, unknown>;
  payload: Payload;
  source?: { connectionId?: string; authenticatedUserId?: string };
  timestamp: number;
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

export interface CreateSseSessionOptions {
  /** Override connection ID generation (defaults to `crypto.randomUUID()`). */
  connectionId?: string;
}

/**
 * Creates one server-side SSE session: merged meta + data frames for a single
 * GET connection.
 */
export function createSseSession(options: CreateSseSessionOptions = {}): {
  close(): Promise<void>;
  connectionId: string;
  stream: ReadableStream<Uint8Array>;
  writeData(envelope: EventEnvelope): void;
  writeKeepalive(): void;
  writeMeta(data: Record<string, unknown>): void;
} {
  const connectionId = options.connectionId ?? crypto.randomUUID();
  const { stream: dataStream, writer } = createSseResponseWriter();
  const encoder = new TextEncoder();
  let metaController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let closePromise: Promise<void> | null = null;
  let resolveClose: (() => void) | null = null;

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

  const writeData = (envelope: EventEnvelope): void => {
    if (closed) {
      throw new Error("SSE session is closed.");
    }

    writer.write(envelope);
  };

  const close = (): Promise<void> => {
    if (closePromise) {
      return closePromise;
    }

    closed = true;
    writer.close();

    if (!metaController) {
      closePromise = Promise.resolve();
      return closePromise;
    }

    closePromise = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    return closePromise;
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
                try {
                  controller.close();
                } catch {
                  // Stream may already be closed.
                }
                metaController = null;
                resolveClose?.();
                resolveClose = null;
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
    writeData,
    writeMeta,
    writeKeepalive,
    close,
  };
}
