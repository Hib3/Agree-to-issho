export interface RandomSource {
  next(): number;
}

export class SystemRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

export class SeededRandomSource implements RandomSource {
  private state: number;

  constructor(seed = 1) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }
}

export const systemRandom = new SystemRandomSource();

export function weightedPick<T>(items: Array<{ value: T; weight: number }>, random: RandomSource): T | null {
  const usable = items
    .map((item) => ({ ...item, weight: Number.isFinite(item.weight) ? Math.max(0, item.weight) : 0 }))
    .filter((item) => item.weight > 0);
  const total = usable.reduce((sum, item) => sum + item.weight, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  let cursor = random.next() * total;
  for (const item of usable) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return usable[usable.length - 1]?.value ?? null;
}
