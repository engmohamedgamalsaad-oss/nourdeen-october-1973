// Pure helpers for audio-review-share. No imports, so they can be unit-tested outside Deno.

export const LANGUAGES = ["ar", "en", "fr", "it", "de"] as const;
export const MIN_TTL_SECONDS = 60;
export const DEFAULT_TTL_SECONDS = 600;
export const MAX_TTL_SECONDS = 900;

export function validKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{1,80}$/.test(value);
}

export function clampTtl(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(n)));
}

/**
 * The storage path always comes from a completed queue job, never from the client.
 * It must still be exactly "<section>/<slug>/<language>/block-NNNN-<16 hex>.mp3"
 * for the story/language that was asked for, so a bad row can never expose another object.
 */
export function isExpectedClipPath(path: unknown, section: string, slug: string, language: string): path is string {
  if (typeof path !== "string") return false;
  const expectedPrefix = section + "/" + slug + "/" + language + "/";
  if (!path.startsWith(expectedPrefix)) return false;
  const file = path.slice(expectedPrefix.length);
  return /^block-\d{4}-[a-f0-9]{16}\.mp3$/.test(file);
}
