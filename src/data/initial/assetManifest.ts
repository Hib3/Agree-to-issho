import type { CharacterExpression as AppCharacterExpression } from "../../types/domain";

export type AssetStatus = "approved" | "pending" | "rejected" | "missing";

export type CharacterAssetExpression =
  | "normal"
  | "smile"
  | "talk_normal"
  | "talk_smile"
  | "happy"
  | "thinking"
  | "confused"
  | "surprised"
  | "embarrassed"
  | "shy"
  | "sad"
  | "lonely"
  | "sleepy"
  | "angry"
  | "proud";

export type CharacterAssetManifestItem = {
  id: string;
  expression: CharacterAssetExpression;
  path: string;
  status: AssetStatus;
  notes: string;
};

const approvedBasePath = "assets/characters/main/fullbody/approved";
export const fallbackCharacterAssetExpression: CharacterAssetExpression = "normal";

export const mainCharacterAssetManifest: CharacterAssetManifestItem[] = [
  {
    id: "aguri_normal",
    expression: "normal",
    path: `${approvedBasePath}/aguri_normal.png`,
    status: "approved",
    notes: "user-provided original standing art; first approved in-game image"
  }
];

const appExpressionToAssetExpression: Record<AppCharacterExpression, CharacterAssetExpression> = {
  idle_normal: "normal",
  idle_smile: "normal",
  idle_blink: "normal",
  talk_normal: "normal",
  talk_smile: "normal",
  happy: "normal",
  sad: "normal",
  surprised: "normal",
  angry: "normal",
  embarrassed: "normal",
  thinking: "normal",
  sleepy: "normal",
  lonely: "normal",
  confused: "normal",
  proud: "normal"
};

function toAssetExpression(expression: AppCharacterExpression | CharacterAssetExpression): CharacterAssetExpression {
  return appExpressionToAssetExpression[expression as AppCharacterExpression] ?? expression as CharacterAssetExpression;
}

export function getCharacterAsset(expression: AppCharacterExpression | CharacterAssetExpression): CharacterAssetManifestItem {
  const normalized = toAssetExpression(expression);
  const approved = mainCharacterAssetManifest.find((asset) => asset.expression === normalized && asset.status === "approved");
  return approved ?? getFallbackCharacterAsset();
}

export function getCharacterImagePath(expression: AppCharacterExpression | CharacterAssetExpression): string {
  return getCharacterAsset(expression).path;
}

export function getFallbackCharacterAsset(): CharacterAssetManifestItem {
  const fallback = mainCharacterAssetManifest.find(
    (asset) => asset.expression === fallbackCharacterAssetExpression && asset.status === "approved"
  );
  if (!fallback) throw new Error("Approved Aguri normal asset is missing from the asset manifest.");
  return fallback;
}

export function getFallbackCharacterImagePath(): string {
  return getFallbackCharacterAsset().path;
}
