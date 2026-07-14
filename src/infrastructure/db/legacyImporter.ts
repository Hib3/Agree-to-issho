import type { Concept, ConceptCategory } from "../../domain/model/concept";
import { grammarForCategory } from "../../domain/learning/conceptFactory";
import { normalizeJapanese } from "../../domain/grammar/japaneseNormalizer";
import { db } from "./database";
import { LEGACY_DB_NAME } from "./schema";

type LegacyWord = {
  id?: string;
  surface?: string;
  reading?: string;
  category?: string;
  confidence?: number;
  created_at?: string;
};

export type LegacyPreview = {
  available: boolean;
  sourceCounts: Record<string, number>;
  concepts: Concept[];
  warnings: string[];
};

export async function detectLegacyDatabase() {
  if (!("databases" in indexedDB)) return false;
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === LEGACY_DB_NAME);
}

export async function previewLegacyImport(): Promise<LegacyPreview> {
  if (!(await detectLegacyDatabase()))
    return { available: false, sourceCounts: {}, concepts: [], warnings: [] };
  const legacy = await openExistingLegacyDatabase();
  try {
    const sourceCounts: Record<string, number> = {};
    for (const storeName of Array.from(legacy.objectStoreNames)) {
      sourceCounts[storeName] = await countStore(legacy, storeName);
    }
    const words = legacy.objectStoreNames.contains("words")
      ? await readStore<LegacyWord>(legacy, "words")
      : [];
    const warnings: string[] = [];
    const concepts = words.flatMap((word, index): Concept[] => {
      if (!word.surface?.trim()) {
        warnings.push(`words[${index}] はsurfaceがないため変換できません。`);
        return [];
      }
      const category = mapLegacyCategory(word.category);
      const surface = normalizeJapanese(word.surface);
      return [
        {
          id: `legacy_${word.id ?? index}`,
          source: "user",
          surface,
          normalized: surface,
          ...(word.reading ? { reading: normalizeJapanese(word.reading) } : {}),
          aliases: [],
          userCategory: category,
          systemHintCategory: category,
          categoryConfidence: word.confidence ?? 0.5,
          grammar: grammarForCategory(category),
          attributes: { legacySourceId: word.id ?? String(index) },
          learnedAt: word.created_at ? Date.parse(word.created_at) || Date.now() : Date.now(),
          usageCount: 0,
          reviewCount: 0,
          understanding: word.confidence ?? 0.5,
          ambiguity: 0.5,
          active: true
        }
      ];
    });
    return { available: true, sourceCounts, concepts, warnings };
  } finally {
    legacy.close();
  }
}

export async function importLegacyPreview(preview: LegacyPreview, now = Date.now()) {
  if (!preview.available) throw new Error("旧データが見つかりません。");
  const existing = await db.migrationLogs.where("legacyDatabase").equals(LEGACY_DB_NAME).first();
  if (existing) throw new Error("この旧データはすでに取り込み済みです。");
  await db.transaction("rw", db.concepts, db.migrationLogs, async () => {
    await db.concepts.bulkPut(preview.concepts);
    await db.migrationLogs.put({
      id: `migration_${crypto.randomUUID()}`,
      legacyDatabase: LEGACY_DB_NAME,
      importedAt: now,
      sourceCounts: preview.sourceCounts,
      importedConceptIds: preview.concepts.map((concept) => concept.id),
      warnings: preview.warnings
    });
  });
}

function openExistingLegacyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("旧DBを開けません。"));
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(new Error("旧DBの変更を防ぐため処理を中止しました。"));
    };
  });
}

function countStore(database: IDBDatabase, storeName: string) {
  return new Promise<number>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`${storeName}の件数を読めません。`));
  });
}

function readStore<T>(database: IDBDatabase, storeName: string) {
  return new Promise<T[]>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error(`${storeName}を読めません。`));
  });
}

function mapLegacyCategory(category?: string): ConceptCategory {
  const map: Record<string, ConceptCategory> = {
    person: "person_name",
    place: "place",
    food: "food_drink",
    object: "usable_object",
    action: "action",
    feeling: "abstract",
    time: "other",
    idea: "abstract"
  };
  return map[category ?? ""] ?? "other";
}
