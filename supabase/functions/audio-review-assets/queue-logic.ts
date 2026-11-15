// Pure queue helpers for the audio-review-assets edge function.
// They take the Supabase client as a parameter so behavioural tests can pass a mock.

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Explicit per-block rejection counter written by the admin UI (review.reject_rev["lang:index"]).
// 0 / missing => no approved text rejection ever happened for this block.
export function rejectionRevision(review: any, language: string, index: number): number {
  const value = Number(review?.reject_rev?.[language + ":" + index] ?? 0);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function regenRevisionFor(review: any, language: string, index: number): number {
  const bases = Object.values(review?.clips ?? {})
    .filter((clip: any) => clip?.lang === language && Number(clip.block_index) === index)
    .map((clip: any) => String(clip.base ?? "")).filter(Boolean);
  return bases.reduce((max, base) => Math.max(max, Number(review?.regen?.[base] ?? 0) || 0), 0);
}

// Key parts for the queue idempotency key. The rejection counter is appended ONLY when it is > 0, so
// keys of jobs created before any rejection keep their exact old format (no regeneration of healthy clips).
export function idempotencyKeyParts(
  review: any, section: string, slug: string, language: string, index: number,
  sourceHash: string, spokenHash: string,
): (string | number)[] {
  const regenRevision = regenRevisionFor(review, language, index);
  const parts: (string | number)[] = [section, slug, language, index, sourceHash, spokenHash, regenRevision];
  const rejection = rejectionRevision(review, language, index);
  if (rejection > 0) parts.push("rej" + rejection);
  return parts;
}

export async function buildIdempotencyKey(
  review: any, section: string, slug: string, language: string, index: number,
  sourceHash: string, spokenHash: string,
): Promise<string> {
  const parts = idempotencyKeyParts(review, section, slug, language, index, sourceHash, spokenHash);
  return await sha256Hex(new TextEncoder().encode(parts.join(":")));
}

const JOB_COLUMNS = "id,status,section,slug,language,block_index,speaker,created_at";

// idempotency_key is unique, so a failed job can never be inserted again; retrying means resetting that row.
export async function requeueIfFailed(service: any, idempotencyKey: string): Promise<{ exists: boolean; retried: boolean; job: any }> {
  const { data: existing } = await service.from("story_audio_generation_queue")
    .select(JOB_COLUMNS).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (!existing) return { exists: false, retried: false, job: null };
  if (existing.status !== "failed") return { exists: true, retried: false, job: existing };
  const { data: reset, error } = await service.from("story_audio_generation_queue")
    .update({ status: "pending", attempts: 0, last_error: null, locked_at: null, available_at: new Date().toISOString() })
    .eq("id", existing.id).eq("status", "failed").select(JOB_COLUMNS).maybeSingle();
  if (error || !reset) return { exists: true, retried: false, job: existing };
  return { exists: true, retried: true, job: reset };
}

// Insert one job; on a duplicate key return the existing job (retrying it if it had failed).
export async function insertOrReuseJob(service: any, row: Record<string, unknown>, idempotencyKey: string) {
  const { data: inserted, error } = await service.from("story_audio_generation_queue")
    .insert(row).select(JOB_COLUMNS).maybeSingle();
  if (error && error.code !== "23505") return { ok: false as const, error };
  if (inserted) return { ok: true as const, created: true, retried: false, job: inserted };
  const existing = await requeueIfFailed(service, idempotencyKey);
  if (!existing.exists) return { ok: false as const, error: { message: "existing job not found" } };
  return { ok: true as const, created: false, retried: existing.retried, job: existing.job };
}

// Reviewer notes of text rejections for one block (sent to Gemini together with the text only; never audio).
export function rejectionNotesFor(review: any, language: string, index: number): string[] {
  return Object.values(review?.clips ?? {})
    .filter((clip: any) => clip?.lang === language && Number(clip?.block_index) === index &&
      clip?.status === "rejected" && clip?.issue !== "audio_only")
    .slice(0, 10)
    .map((clip: any) => {
      const note = typeof clip?.note === "string" ? clip.note.trim() : "";
      const suggestion = typeof clip?.suggestion === "string" ? clip.suggestion.trim() : "";
      return [note ? "Reviewer note: " + note : "", suggestion ? "Requested wording: " + suggestion : ""].filter(Boolean).join("\n");
    }).filter(Boolean);
}
