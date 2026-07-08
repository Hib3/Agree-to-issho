import { ChoiceButtons } from "../components/ChoiceButtons";
import type { WordCategory } from "../types/domain";

export const wordCategoryLabels: Record<WordCategory, string> = {
  person: "人",
  place: "場所",
  food: "食べ物",
  object: "もの",
  action: "行動",
  feeling: "気持ち",
  time: "時間",
  idea: "考え",
  unknown: "まだ不明"
};

const options: Array<{ value: WordCategory; label: string }> = [
  { value: "person", label: "人" },
  { value: "place", label: "場所" },
  { value: "food", label: "食べ物" },
  { value: "object", label: "もの" },
  { value: "action", label: "行動" },
  { value: "feeling", label: "気持ち" },
  { value: "time", label: "時間" },
  { value: "idea", label: "考え" },
  { value: "unknown", label: "まだ不明" }
];

type WordCategorySelectorProps = {
  value: WordCategory;
  onChange: (value: WordCategory) => void;
};

export function WordCategorySelector({ value, onChange }: WordCategorySelectorProps) {
  return <ChoiceButtons options={options} value={value} ariaLabel="種類を選ぶ" onChoose={onChange} />;
}
