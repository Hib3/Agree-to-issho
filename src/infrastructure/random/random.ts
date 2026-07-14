export interface RandomSource {
  next(): number;
}

export class SeededRandom implements RandomSource {
  private state: number;
  constructor(seed = 1) {
    this.state = seed >>> 0 || 1;
  }
  next() {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }
}

export const systemRandom: RandomSource = { next: () => Math.random() };

export function pickOne<T>(items: readonly T[], random: RandomSource): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random.next() * items.length)];
}
