/** biome-ignore-all lint/style/noExportedImports: published package entry */
import { noopVerboseLogger, type VerboseLogger } from "@g14o/logger/verbose";

export type { VerboseLogger };

const eventLoggers = new WeakMap<object, VerboseLogger>();

/** Associates a verbose logger with a bus instance. @internal */
export function bindEventLogger(bus: object, logger: VerboseLogger): void {
  eventLoggers.set(bus, logger);
}

/** Resolves the logger bound to a bus, or {@link noopVerboseLogger}. @internal */
export function getEventLogger(bus: object): VerboseLogger {
  return eventLoggers.get(bus) ?? noopVerboseLogger;
}
