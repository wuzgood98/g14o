import { describe, expect, it } from "vitest";
import type { EventStream } from "./interface";

/**
 * Shared contract suite for {@link EventStream} implementations.
 */
export function describeStream(
  name: string,
  factory: () => EventStream | Promise<EventStream>
): void {
  describe(name, () => {
    it("writes, fans out live, and replays after cursor", async () => {
      const stream = await factory();
      const channel = `contract:${Date.now()}`;

      const received: string[] = [];
      const unsubscribe = stream.subscribe([channel], (message) => {
        received.push(message.id);
      });

      const firstId = await stream.write(channel, {
        event: "demo.ping",
        data: { n: 1 },
        timestamp: Date.now(),
      });

      const secondId = await stream.write(channel, {
        event: "demo.ping",
        data: { n: 2 },
        timestamp: Date.now(),
      });

      await expect
        .poll(() => received.length, { timeout: 2000 })
        .toBeGreaterThanOrEqual(2);

      const afterFirst = await stream.readAfter(channel, firstId);
      expect(afterFirst.map((entry) => entry.id)).toEqual([secondId]);
      expect(afterFirst[0]?.data).toEqual({ n: 2 });

      unsubscribe();
      await stream.close();
    });

    it("returns empty replay when channel has no history", async () => {
      const stream = await factory();
      const replay = await stream.readAfter(`empty:${Date.now()}`, undefined);
      expect(replay).toEqual([]);
      await stream.close();
    });
  });
}
