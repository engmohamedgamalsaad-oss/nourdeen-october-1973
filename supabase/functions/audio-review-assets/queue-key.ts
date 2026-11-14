// Pure helpers for the persistent audio generation queue.
// No Deno / Supabase imports on purpose: this module is unit-tested on its own (queue-key.test.ts)
// and imported by index.ts, so the tests exercise the exact code the Edge Function runs.

export type ReviewLike = {
  clips?: Record<string, any>;
  reject_cycles?: Record<string, number>;
  [key: string]: unknown;
} | null | undefined;

export interface QueueKeyParts {
  section: string;
  slug: string;
  language: string;
  blockIndex: number;
  sourceHash: string;
  spokenHash: string;
  regenRevision: number;
  rejectionCycle: number;
}

export async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function cycleKey(language: string, blockIndex: number): string {
  return language + ":" + blockIndex;
}

function rejectedRecordCount(review: ReviewLike, language: string, blockIndex: number): number {
  return Object.values(review?.clips ?? {}).filter((clip: any) =>
    clip?.lang === language && Number(clip?.block_index) === blockIndex && clip?.status === "rejected").length;
}

/**
 * Number of rejection cycles this block has gone through.
 * It is the larger of the server-side counter and the number of rejected records, so it never goes
 * backwards even if one of the two is missing (older reviews have no counter).
 */
export function rejectionCycleFor(review: ReviewLike, language: string, blockIndex: number): number {
  const counter = Number(review?.reject_cycles?.[cycleKey(language, blockIndex)] ?? 0) || 0;
  return Math.max(counter, rejectedRecordCount(review, language, blockIndex));
}

/** True while a rejection of this block has not been superseded by a later decision. */
export function hasOpenRejection(review: ReviewLike, language: string, blockIndex: number): boolean {
  return Object.values(review?.clips ?? {}).some((clip: any) =>
    clip?.lang === language && Number(clip?.block_index) === blockIndex &&
    clip?.status === "rejected" && !clip?.resolved);
}

/**
 * Server-authoritative counter update, run when a review is saved.
 * A cycle is counted only when a clip becomes rejected for the first time
 * (previous status was not "rejected"); re-saving an already rejected clip does not count.
 * Counters of other blocks / languages are carried over unchanged.
 */
export function bumpRejectionCycles(previous: ReviewLike, incoming: ReviewLike): Record<string, number> {
  const next: Record<string, number> = {};
  const seed = (review: ReviewLike) => {
    Object.entries(review?.reject_cycles ?? {}).forEach(([key, value]) => {
      const n = Number(value) || 0;
      if (n > (next[key] ?? 0)) next[key] = n;
    });
    Object.values(review?.clips ?? {}).forEach((clip: any) => {
      if (clip?.status !== "rejected" || typeof clip?.lang !== "string") return;
      const key = cycleKey(clip.lang, Number(clip.block_index));
      const count = rejectedRecordCount(review, clip.lang, Number(clip.block_index));
      if (count > (next[key] ?? 0)) next[key] = count;
    });
  };
  seed(previous);
  seed(incoming);
  Object.entries(incoming?.clips ?? {}).forEach(([clipKey, clip]: [string, any]) => {
    if (clip?.status !== "rejected" || typeof clip?.lang !== "string") return;
    if (previous?.clips?.[clipKey]?.status === "rejected") return;
    const key = cycleKey(clip.lang, Number(clip.block_index));
    // Start from what the previous review had, then add exactly one cycle for this new rejection.
    const base = Math.max(
      Number(previous?.reject_cycles?.[key] ?? 0) || 0,
      rejectedRecordCount(previous, clip.lang, Number(clip.block_index)),
    );
    next[key] = Math.max(next[key] ?? 0, base + 1);
  });
  return next;
}

/**
 * Idempotency key of a queue job.
 * Cycle 0 keeps the historical formula, so jobs that already exist keep their keys.
 * From the first rejection on, the cycle number is part of the key: a new rejection always produces
 * a new key, even when Gemini returns the exact same reading text (or goes back to an earlier text).
 */
export async function buildQueueIdempotencyKey(parts: QueueKeyParts): Promise<string> {
  const base = [parts.section, parts.slug, parts.language, parts.blockIndex, parts.sourceHash, parts.spokenHash, parts.regenRevision];
  const withCycle = parts.rejectionCycle > 0 ? [...base, "cycle", parts.rejectionCycle] : base;
  return await sha256Text(withCycle.join(":"));
}

/** What to do when a job with the same idempotency key already exists. */
export function existingJobAction(status: string | null | undefined): "retry" | "reuse" {
  return status === "failed" ? "retry" : "reuse";
}
