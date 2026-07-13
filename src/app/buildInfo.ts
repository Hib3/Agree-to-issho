import { CLEANROOM_SCHEMA_VERSION } from "../infrastructure/db/schema";

export const BUILD_ID = import.meta.env.VITE_BUILD_ID || "development";
export const GIT_SHA = import.meta.env.VITE_GIT_SHA || "unknown";
export const INDEXED_DB_VERSION = 2;
export const SERVICE_WORKER_RUNTIME_CACHE = "aguri-approved-assets-v3";
export const APP_SCHEMA_VERSION = CLEANROOM_SCHEMA_VERSION;
