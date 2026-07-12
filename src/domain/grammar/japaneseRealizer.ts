import type { Concept } from "../model/concept";

const honorificLabels: Record<string, string> = {
  none: "",
  san: "さん",
  chan: "ちゃん",
  kun: "くん",
  sama: "さま",
  sensei: "先生"
};

export function displayConcept(concept: Concept) {
  const displayName = typeof concept.attributes.displayName === "string" ? concept.attributes.displayName : concept.surface;
  if (!["famous_person", "person_name", "occupation", "person_descriptor"].includes(concept.userCategory)) return displayName;
  const honorific = String(concept.attributes.honorific ?? "none");
  if (honorific === "custom") return `${displayName}${String(concept.attributes.customHonorific ?? "")}`;
  return `${displayName}${honorificLabels[honorific] ?? ""}`;
}

export function realize(template: string, slots: Record<string, Concept>) {
  return Object.entries(slots).reduce(
    (text, [name, concept]) => text.replaceAll(`{${name}}`, displayConcept(concept)),
    template
  );
}

export function splitJapanesePages(text: string, limit = 45) {
  if (Array.from(text).length <= limit) return [text];
  const clauses = text.split(/(?<=[。！？])/u).filter(Boolean);
  const pages: string[] = [];
  let current = "";
  for (const clause of clauses) {
    if (Array.from(current + clause).length <= limit) {
      current += clause;
      continue;
    }
    if (current) pages.push(current);
    if (Array.from(clause).length > limit) {
      pages.push(clause);
      current = "";
    } else {
      current = clause;
    }
  }
  if (current) pages.push(current);
  return pages;
}
