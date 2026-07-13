export type StoryArcVariant = {
  id: string;
  cadenceIndex: number;
  turnIndex: number;
  punchlineIndex: number;
};

export const storyArcCadences = [
  "その場面をもう少し考えて、",
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
  "overprepared",
  "wrong_target",
  "back_to_start",
  "tiny_result",
  "oversized_note",
  "lost_track_of_time",
  "visible_clue",
  "remembered_only_word",
  "already_done"
] as const;

export const storyArcVariants: StoryArcVariant[] = storyArcCadences.flatMap((_, cadenceIndex) =>
  storyArcTurnIds.flatMap((__, turnIndex) =>
    storyArcPunchlineIds.map((___, punchlineIndex) => ({
      id: `story_arc_${cadenceIndex + 1}_${turnIndex + 1}_${punchlineIndex + 1}`,
      cadenceIndex,
      turnIndex,
      punchlineIndex
    }))
  )
);

export const storyArcVariantCount = storyArcVariants.length;
