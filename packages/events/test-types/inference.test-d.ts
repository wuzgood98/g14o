import { expectTypeOf, test } from "vitest";
import { Event } from "../src/bus/event";
import { memoryStream } from "../src/stream/memory";
import { createMockSchema } from "../src/test-utils/schema";

test("Event infers schema events", () => {
  const event = new Event({
    schema: {
      "user.created": createMockSchema((value) => ({
        value: value as { id: string },
      })),
    },
    stream: memoryStream(),
  });

  expectTypeOf(event.emit).parameter(0).toEqualTypeOf<"user.created">();
});
