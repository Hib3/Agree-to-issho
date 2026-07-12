export type OnboardingScenario = { id: string; title: string; promptContext: string };

export const onboardingScenarios: OnboardingScenario[] = [
  { id: "first_room", title: "部屋のもの", promptContext: "room_object" },
  { id: "first_food", title: "好きな味", promptContext: "favorite_food" },
  { id: "first_place", title: "行きたい場所", promptContext: "wanted_place" },
  { id: "first_person", title: "大切な人", promptContext: "companion" },
  { id: "first_feeling", title: "今日の気持ち", promptContext: "feeling" }
];
