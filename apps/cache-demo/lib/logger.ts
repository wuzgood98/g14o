import { createLogger } from "@g14o/logger";

export const logger = createLogger({
  formatOptions: {
    pretty: true,
    time: {
      enabled: true,
      format: "time12",
    },
    levels: {
      error: {
        kind: "symbol",
      },
      fatal: {
        kind: "badge",
      },
    },
  },
});
