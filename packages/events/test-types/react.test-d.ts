/** biome-ignore-all lint/complexity/noVoid: type-level assertions */
import { expectTypeOf, test } from "vitest";
import { createEvent } from "../src/client/create-event";

/** biome-ignore lint/style/useConsistentTypeDefinitions: index signature required for Record constraint */
type Events = {
  "demo.notification": { body: string; title: string };
  "demo.ping": { message: string };
};

test("createEvent hooks are typed", () => {
  const { useEvent } = createEvent<Events>();

  expectTypeOf(useEvent).toBeFunction();
});

test("useEvent onData narrows data by event discriminant", () => {
  const { useEvent } = createEvent<Events>();

  void useEvent({
    channels: ["demo"],
    events: ["demo.ping", "demo.notification"],
    onData({ event, data }) {
      if (event === "demo.ping") {
        const _message: string = data.message;
        expectTypeOf(_message).toEqualTypeOf<string>();
        // @ts-expect-error — notification fields are not on ping payload
        void data.title;
      }
      if (event === "demo.notification") {
        const _title: string = data.title;
        expectTypeOf(_title).toEqualTypeOf<string>();
        // @ts-expect-error — ping fields are not on notification payload
        void data.message;
      }
    },
  });
});

test("useChannel handler narrows data by event discriminant", () => {
  const { useChannel } = createEvent<Events>();

  void useChannel("demo", ({ event, data }) => {
    if (event === "demo.ping") {
      const _message: string = data.message;
      expectTypeOf(_message).toEqualTypeOf<string>();
    }
    if (event === "demo.notification") {
      const _body: string = data.body;
      expectTypeOf(_body).toEqualTypeOf<string>();
    }
  });
});
