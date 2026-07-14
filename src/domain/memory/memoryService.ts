import type { CharacterEmotion } from "../model/character";
import type { MemoryEvent, MemoryType } from "../model/memory";

export function createMemory(input: {
  type: MemoryType;
  conceptIds?: string[];
  relationIds?: string[];
  locationId: string;
  emotion?: CharacterEmotion;
  importance?: number;
  payload?: Record<string, unknown>;
  now: number;
}): MemoryEvent {
  return {
    id: `memory_${crypto.randomUUID()}`,
    type: input.type,
    conceptIds: input.conceptIds ?? [],
    relationIds: input.relationIds ?? [],
    participantIds: [],
    locationId: input.locationId,
    emotion: input.emotion ?? "curious",
    importance: input.importance ?? 0.5,
    createdAt: input.now,
    recallCount: 0,
    payload: input.payload ?? {}
  };
}
