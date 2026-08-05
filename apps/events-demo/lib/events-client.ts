"use client";

import { createEvent } from "@g14o/events/client";
import type { Events } from "./events";

export const { useChannel, useEvent, useEventStatus } = createEvent<Events>();
