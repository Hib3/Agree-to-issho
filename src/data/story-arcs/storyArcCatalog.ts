export type StoryArcVariant = {
  id: string;
  cadenceIndex: number;
  turnIndex: number;
  punchlineIndex: number;
};

export const storyArcCadences = [
  "覚えた場面をもう少し考えて、",
  "念のため順番を整えて、",
  "うまくいくところまで想像して、",
  "ノートの端に続きを足して、",
  "一度深呼吸してから、"
] as const;

export const storyArcTurnIds = [
  "frame_followup",
  "memory_mark",
  "spoken_rehearsal",
  "desk_check",
  "calendar_note",
  "backup_plan",
  "sticky_note",
  "honest_last_line"
] as const;

export const storyArcPunchlineIds = [
  "reversal",
  "expectation_violation",
  "literal_interpretation",
  "scale_mismatch",
  "mistaken_target",
  "circular_return",
  "overpreparation",
  "delayed_realization",
  "character_flaw_callback",
  "word_attribute_callback",
  "relation_callback"
] as const;

export const storyArcVariants: StoryArcVariant[] = storyArcCadences.flatMap((_, cadenceIndex) =>
  storyArcTurnIds.flatMap((__, turnIndex) =>
    Array.from({ length: 10 }, (___, punchlineOffset) => ({
      id: `story_arc_${cadenceIndex + 1}_${turnIndex + 1}_${punchlineOffset + 1}`,
      cadenceIndex,
      turnIndex,
      punchlineIndex: (punchlineOffset + cadenceIndex) % storyArcPunchlineIds.length
    }))
  )
);

export const storyArcVariantCount = storyArcVariants.length;
