import type { Concept, LexicalProfile } from "../model/concept";

const honorificLabels: Record<string, string> = {
  none: "",
  san: "さん",
  chan: "ちゃん",
  kun: "くん",
  sama: "さま",
  sensei: "先生"
};

export function displayConcept(concept: Concept) {
  const displayName =
    typeof concept.attributes.displayName === "string" ? concept.attributes.displayName : concept.surface;
  if (!["famous_person", "person_name", "occupation", "person_descriptor"].includes(concept.userCategory))
    return displayName;
  const honorific = String(concept.attributes.honorific ?? "none");
  const suffix =
    honorific === "custom"
      ? String(concept.attributes.customHonorific ?? "")
      : (honorificLabels[honorific] ?? "");
  if (!suffix || hasHonorific(displayName)) return displayName;
  return `${displayName}${suffix}`;
}

export function realize(template: string, slots: Record<string, Concept>) {
  return Object.entries(slots).reduce(
    (text, [name, concept]) =>
      text
        .replaceAll(`{${name}:doing}`, doingPhrase(concept))
        .replaceAll(`{${name}:do}`, doPhrase(concept))
        .replaceAll(`{${name}}`, displayConcept(concept)),
    template
  );
}

export function doingPhrase(concept: Concept) {
  if (canUseExplicitInflection(concept) && concept.grammar.teForm) return `${concept.grammar.teForm}いる`;
  if (lexicalProfile(concept).partOfSpeech === "verbal_noun" && !/こと$/u.test(displayConcept(concept))) {
    return `${displayConcept(concept)}をしている`;
  }
  return `「${displayConcept(concept)}」を続けている`;
}

export function doPhrase(concept: Concept) {
  if (canUseExplicitInflection(concept) && concept.grammar.verbDictionaryForm) {
    return concept.grammar.verbDictionaryForm;
  }
  if (lexicalProfile(concept).partOfSpeech === "verbal_noun" && !/こと$/u.test(displayConcept(concept))) {
    return `${displayConcept(concept)}をする`;
  }
  return `「${displayConcept(concept)}」を始める`;
}

function lexicalProfile(concept: Concept): LexicalProfile {
  return (
    concept.lexicalProfile ?? {
      partOfSpeech: "unknown",
      quotePolicy: "mention_only",
      honorificPolicy: "none",
      confidence: 0
    }
  );
}

function canUseExplicitInflection(concept: Concept) {
  const profile = lexicalProfile(concept);
  return profile.quotePolicy === "allow_inflection" && profile.confidence >= 0.7;
}

function hasHonorific(value: string) {
  return /(?:さん|ちゃん|くん|君|さま|様|先生)$/u.test(value);
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
