const localQueues = new Map<string, Promise<void>>();
const flights = new Map<string, Promise<unknown>>();

export async function withExclusiveLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`aguri-word-room:${name}`, { mode: "exclusive" }, operation);
  }
  const previous = localQueues.get(name) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  localQueues.set(name, tail);
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (localQueues.get(name) === tail) localQueues.delete(name);
  }
}

export function withSingleFlight<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const active = flights.get(name) as Promise<T> | undefined;
  if (active) return active;
  const next = operation().finally(() => {
    if (flights.get(name) === next) flights.delete(name);
  });
  flights.set(name, next);
  return next;
}
