/** biome-ignore lint/performance/noBarrelFile: re-export shared types for @g14o/ratelimit/config consumers */
export {
  isBuildLikePhase,
  isInMemoryEnv,
  resolveEnvName,
} from "./env";
export type { Environment, InMemoryEnvOptions } from "./types";
export {
  createRedisClient,
  type RedisConfig,
  type RedisCredentials,
  resolveRedisClient,
} from "./upstash-config";
