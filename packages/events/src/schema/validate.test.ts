import { describe, expect, it } from "vitest";
import {
  CHANNEL_JOIN_EVENT,
  CHANNEL_LEAVE_EVENT,
} from "../constants/control-events";
import { EventValidationError } from "../errors/event-validation-error";
import { createEventValidator, createNoopValidator } from "../schema/validate";
import { alwaysFail, passThrough } from "../test-utils/schema";

const ASYNC_SCHEMA_VALIDATION_ERROR_MESSAGE =
  /Async Standard Schema validation is not supported/;

describe("createEventValidator", () => {
  it("returns validated payload on success", () => {
    const validator = createEventValidator({
      "user.created": passThrough<{ id: string }>(),
    });

    expect(validator.validate("user.created", { id: "1" })).toEqual({
      id: "1",
    });
  });

  it("throws EventValidationError on failure", () => {
    const validator = createEventValidator({
      "user.created": alwaysFail("bad email"),
    });

    expect(() => validator.validate("user.created", { id: "1" })).toThrow(
      EventValidationError
    );

    try {
      validator.validate("user.created", { id: "1" });
    } catch (error) {
      expect(error).toBeInstanceOf(EventValidationError);
      if (error instanceof EventValidationError) {
        expect(error.event).toBe("user.created");
        expect(error.payload).toEqual({ id: "1" });
        expect(error.issues[0]?.message).toBe("bad email");
      }
    }
  });

  it("throws when event has no schema entry", () => {
    const validator = createEventValidator({
      "user.created": passThrough<{ id: string }>(),
    });

    expect(() => validator.validate("user.deleted", { id: "1" })).toThrow(
      EventValidationError
    );
  });

  it("passes through channel control events without a schema entry", () => {
    const validator = createEventValidator({
      "user.created": passThrough<{ id: string }>(),
    });
    const joinPayload = { channels: ["demo"] };
    const leavePayload = { channels: ["demo"] };

    expect(validator.validate(CHANNEL_JOIN_EVENT, joinPayload)).toEqual(
      joinPayload
    );
    expect(validator.validate(CHANNEL_LEAVE_EVENT, leavePayload)).toEqual(
      leavePayload
    );
  });

  it("rejects async validators", () => {
    const validator = createEventValidator({
      "user.created": {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: () => Promise.resolve({ value: { id: "1" } }),
        },
      },
    });

    expect(() => validator.validate("user.created", { id: "1" })).toThrow(
      ASYNC_SCHEMA_VALIDATION_ERROR_MESSAGE
    );
  });
});

describe("createNoopValidator", () => {
  it("returns null for type-only mode", () => {
    expect(createNoopValidator()).toBeNull();
  });
});
