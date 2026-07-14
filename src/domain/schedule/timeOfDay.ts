export type TimeOfDay = "morning" | "day" | "evening" | "night";

export function getTimeOfDay(now: number): TimeOfDay {
  const hour = new Date(now).getHours();
  if (hour >= 5 && hour < 10) return "morning";
  if (hour < 17) return "day";
  if (hour < 22) return "evening";
  return "night";
}

export const timeLabels: Record<TimeOfDay, string> = {
  morning: "朝",
  day: "昼",
  evening: "夕方",
  night: "夜"
};
