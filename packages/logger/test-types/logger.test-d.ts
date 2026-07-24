import type { Logger } from "@g14o/logger";
import { createLogger } from "@g14o/logger";

const logger: Logger = createLogger({ name: "app" });
const unnamed: Logger = createLogger();

logger.trace("detail", { step: 1 });
logger.info("ok");
logger.fatal(new Error("crash"), "Unrecoverable");
unnamed.warn("unnamed");
