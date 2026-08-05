import { expectTypeOf, test } from "vitest";
import { memoryStream } from "../src/stream/memory";

test("memoryStream implements EventStream", () => {
  const stream = memoryStream();
  expectTypeOf(stream.append).toBeFunction();
  expectTypeOf(stream.subscribe).toBeFunction();
});
