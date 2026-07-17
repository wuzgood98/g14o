import type { Logger as CacheLogger } from "@g14o/cache/types";
import type { Logger } from "@g14o/logger";
import { createLogger } from "@g14o/logger";

declare function acceptCacheLogger(logger: CacheLogger): void;

const logger: Logger = createLogger({ name: "app" });
const unnamed: Logger = createLogger();

acceptCacheLogger(logger);
acceptCacheLogger(unnamed);

logger.trace("detail", { step: 1 });
logger.fatal(new Error("crash"), "Unrecoverable");
