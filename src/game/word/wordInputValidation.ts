import type { WordFrame } from "../../types/domain";
import { normalizeSurface } from "./createWordFrame";

const MAX_SURFACE_LENGTH = 12;
const urlLikePattern = /(?:https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i;
const controlPattern = /[\u0000-\u001f\u007f]/;

export type WordInputValidation =
  | { ok: true; surface: string }
  | { ok: false; surface: string; message: string; reason: "empty" | "duplicate" | "url" | "control" | "too_long" };

export function validateWordInput(input: string, words: WordFrame[]): WordInputValidation {
  const surface = normalizeSurface(input);
  if (!surface) return { ok: false, surface, reason: "empty", message: "言葉が空っぽです。" };
  if (controlPattern.test(surface)) return { ok: false, surface, reason: "control", message: "その文字はノートに入れられません。" };
  if (urlLikePattern.test(surface)) return { ok: false, surface, reason: "url", message: "URLみたいな言葉は、今は覚えないでおきます。" };
  if (surface.length > MAX_SURFACE_LENGTH) {
    return { ok: false, surface, reason: "too_long", message: `言葉は${MAX_SURFACE_LENGTH}文字までにしてください。` };
  }
  if (words.some((word) => word.surface === surface)) {
    return { ok: false, surface, reason: "duplicate", message: "その言葉、もうノートにあるよ。単語帳で見てみますか？" };
  }
  return { ok: true, surface };
}
