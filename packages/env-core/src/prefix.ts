export function assertClientPrefix(
  clientPrefix: string | undefined,
  clientKeys: readonly string[]
): void {
  if (clientPrefix === undefined) {
    return;
  }

  for (const key of clientKeys) {
    if (!key.startsWith(clientPrefix)) {
      throw new Error(
        `Environment variable "${key}" must start with "${clientPrefix}" to be exposed on the client`
      );
    }
  }
}

export function assertNoOverlappingKeys(
  serverKeys: readonly string[],
  clientKeys: readonly string[]
): void {
  for (const key of serverKeys) {
    if (clientKeys.includes(key)) {
      throw new Error(
        `Environment variable "${key}" cannot be defined in both server and client`
      );
    }
  }
}
