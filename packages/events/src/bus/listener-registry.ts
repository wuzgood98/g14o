import { DEFAULT_PRIORITY } from "../constants/defaults";
import type { EventHandler, RegisteredListener } from "../types/listener";

interface WildcardNode {
  children: Map<string, WildcardNode>;
  listeners: RegisteredListener[];
  wildcard: RegisteredListener[];
}

function createNode(): WildcardNode {
  return {
    listeners: [],
    children: new Map(),
    wildcard: [],
  };
}

/**
 * Stores exact and wildcard listener registrations with priority ordering.
 * @internal
 */
export class ListenerRegistry {
  private readonly exact = new Map<string, RegisteredListener[]>();
  private readonly wildcardRoot = createNode();

  add(
    pattern: string,
    handler: EventHandler<unknown>,
    options: {
      once?: boolean;
      priority?: number;
      signal?: AbortSignal;
    } = {}
  ): () => void {
    const listener = createRegisteredListener(handler, options);

    if (pattern === "*") {
      this.wildcardRoot.wildcard.push(listener);
      sortByPriority(this.wildcardRoot.wildcard);
      return () => removeFromList(this.wildcardRoot.wildcard, listener);
    }

    if (!pattern.includes("*")) {
      const list = this.exact.get(pattern) ?? [];
      list.push(listener);
      sortByPriority(list);
      this.exact.set(pattern, list);
      return () => removeFromList(list, listener);
    }

    const segments = pattern.split(".");
    let node = this.wildcardRoot;

    for (const segment of segments) {
      if (!segment) {
        continue;
      }

      if (segment === "*") {
        node.wildcard.push(listener);
        sortByPriority(node.wildcard);
        return () => removeFromList(node.wildcard, listener);
      }

      let child = node.children.get(segment);
      if (!child) {
        child = createNode();
        node.children.set(segment, child);
      }
      node = child;
    }

    node.listeners.push(listener);
    sortByPriority(node.listeners);
    return () => removeFromList(node.listeners, listener);
  }

  remove(pattern: string, handler: EventHandler<unknown>): boolean {
    if (pattern === "*") {
      return removeHandler(this.wildcardRoot.wildcard, handler);
    }

    if (!pattern.includes("*")) {
      const list = this.exact.get(pattern);
      if (!list) {
        return false;
      }
      const removed = removeHandler(list, handler);
      if (list.length === 0) {
        this.exact.delete(pattern);
      }
      return removed;
    }

    return removeFromPattern(this.wildcardRoot, pattern.split("."), 0, handler);
  }

  clear(pattern?: string): void {
    if (!pattern) {
      this.exact.clear();
      this.wildcardRoot.listeners = [];
      this.wildcardRoot.wildcard = [];
      this.wildcardRoot.children.clear();
      return;
    }

    if (pattern === "*") {
      this.wildcardRoot.wildcard = [];
      return;
    }

    if (!pattern.includes("*")) {
      this.exact.delete(pattern);
      return;
    }

    clearPattern(this.wildcardRoot, pattern.split("."), 0);
  }

  hasListeners(pattern: string): boolean {
    if (pattern === "*") {
      return this.wildcardRoot.wildcard.length > 0;
    }

    if (!pattern.includes("*")) {
      const list = this.exact.get(pattern);
      return Boolean(list && list.length > 0);
    }

    return hasPatternListeners(this.wildcardRoot, pattern.split("."), 0);
  }

  listenerCount(pattern: string): number {
    if (pattern === "*") {
      return this.wildcardRoot.wildcard.length;
    }

    if (!pattern.includes("*")) {
      return this.exact.get(pattern)?.length ?? 0;
    }

    return countPatternListeners(this.wildcardRoot, pattern.split("."), 0);
  }

  collect(event: string): RegisteredListener[] {
    const seen = new Set<RegisteredListener>();
    const collected: RegisteredListener[] = [];

    const pushUnique = (listener: RegisteredListener): void => {
      if (seen.has(listener) || listener.aborted) {
        return;
      }
      seen.add(listener);
      collected.push(listener);
    };

    const exactListeners = this.exact.get(event);
    if (exactListeners) {
      for (const listener of exactListeners) {
        pushUnique(listener);
      }
    }

    const segments = event.split(".");
    collectFromNode(this.wildcardRoot, segments, 0, pushUnique);

    return collected;
  }
}

function createRegisteredListener(
  handler: EventHandler<unknown>,
  options: {
    once?: boolean;
    priority?: number;
    signal?: AbortSignal;
  }
): RegisteredListener {
  const listener: RegisteredListener = {
    handler,
    priority: options.priority ?? DEFAULT_PRIORITY,
    once: options.once ?? false,
    signal: options.signal,
    aborted: false,
  };

  if (options.signal) {
    if (options.signal.aborted) {
      listener.aborted = true;
    } else {
      options.signal.addEventListener(
        "abort",
        () => {
          listener.aborted = true;
        },
        { once: true }
      );
    }
  }

  return listener;
}

function sortByPriority(listeners: RegisteredListener[]): void {
  listeners.sort((left, right) => right.priority - left.priority);
}

function removeFromList(
  list: RegisteredListener[],
  listener: RegisteredListener
): void {
  const index = list.indexOf(listener);
  if (index >= 0) {
    list.splice(index, 1);
  }
}

function removeHandler(
  list: RegisteredListener[],
  handler: EventHandler<unknown>
): boolean {
  const index = list.findIndex((listener) => listener.handler === handler);
  if (index < 0) {
    return false;
  }
  list.splice(index, 1);
  return true;
}

function removeFromPattern(
  node: WildcardNode,
  segments: string[],
  index: number,
  handler: EventHandler<unknown>
): boolean {
  if (index >= segments.length) {
    return removeHandler(node.listeners, handler);
  }

  const segment = segments[index];
  if (!segment) {
    return false;
  }

  if (segment === "*") {
    return removeHandler(node.wildcard, handler);
  }

  const child = node.children.get(segment);
  if (!child) {
    return false;
  }

  return removeFromPattern(child, segments, index + 1, handler);
}

function clearPattern(
  node: WildcardNode,
  segments: string[],
  index: number
): void {
  if (index >= segments.length) {
    node.listeners = [];
    return;
  }

  const segment = segments[index];
  if (!segment) {
    return;
  }

  if (segment === "*") {
    node.wildcard = [];
    return;
  }

  const child = node.children.get(segment);
  if (child) {
    clearPattern(child, segments, index + 1);
  }
}

function hasPatternListeners(
  node: WildcardNode,
  segments: string[],
  index: number
): boolean {
  if (index >= segments.length) {
    return node.listeners.length > 0;
  }

  const segment = segments[index];
  if (!segment) {
    return false;
  }

  if (segment === "*") {
    return node.wildcard.length > 0;
  }

  const child = node.children.get(segment);
  if (!child) {
    return false;
  }

  return hasPatternListeners(child, segments, index + 1);
}

function countPatternListeners(
  node: WildcardNode,
  segments: string[],
  index: number
): number {
  if (index >= segments.length) {
    return node.listeners.length;
  }

  const segment = segments[index];
  if (!segment) {
    return 0;
  }

  if (segment === "*") {
    return node.wildcard.length;
  }

  const child = node.children.get(segment);
  if (!child) {
    return 0;
  }

  return countPatternListeners(child, segments, index + 1);
}

function collectFromNode(
  node: WildcardNode,
  segments: string[],
  index: number,
  push: (listener: RegisteredListener) => void
): void {
  for (const listener of node.wildcard) {
    push(listener);
  }

  if (index >= segments.length) {
    for (const listener of node.listeners) {
      push(listener);
    }
    return;
  }

  const segment = segments[index];
  if (!segment) {
    return;
  }

  const child = node.children.get(segment);
  if (child) {
    collectFromNode(child, segments, index + 1, push);
  }
}
