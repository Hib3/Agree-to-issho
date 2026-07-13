export const CLEANROOM_DB_NAME = "aguri-cleanroom-v1";
export const CLEANROOM_SCHEMA_VERSION = 3;
export const LEGACY_DB_NAME = "with-agree-db";

export type MigrationLog = {
  id: string;
  legacyDatabase: string;
  importedAt: number;
  sourceCounts: Record<string, number>;
  importedConceptIds: string[];
  warnings: string[];
};

export type ImportBackupRecord = { id: string; createdAt: number; reason: string; json: string };
