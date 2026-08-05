import { createLogger } from "@g14o/logger";

export const logger = createLogger({
  name: "events-demo",
  transports: [{ type: "console" }],
  formatOptions: {
    pretty: true,
    colors: true,
    time: {
      enabled: true,
      format: "time12",
    },
  },
});
