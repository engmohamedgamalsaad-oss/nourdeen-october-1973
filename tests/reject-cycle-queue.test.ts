// Behavioural tests for the reject -> re-prepare -> re-generate cycle.
// A mock Supabase client stands in for the queue table (unique idempotency_key, like the real table).
// Run: deno test --allow-read tests/reject-cycle-queue.test.ts
import { createRequire } from "node:module";
import assertStrict from "node:assert/strict"; // no network-hosted test deps needed
const assert = (v: unknown, m?: string) => assertStrict.ok(v, m);
const assertEquals = (a: unknown, b: unknown) => assertStrict.deepStrictEqual(a, b);
const assertNotEquals = (a: unknown, b: unknown) => assertStrict.notDeepStrictEqual(a, b);
import {
  buildIdempotencyKey, insertOrReuseJob, rejectionRevision, sha256Hex,
} from "../supabase/functions/audio-review-assets/queue-logic.ts";

const core = createRequire(import.meta.url)("../khaledoon/assets/audio-review-core.js");

// ---- mock Supabase: only the calls queue-logic makes ----
function mockSupabase() {
  const rows: any[] = [];
  let nextId = 1;
  const client = {
    rows,
    from(table: string) {
      assertEquals(table, "story_audio_generation_queue");
      return {
        insert(row: any) {
          const duplicate = rows.some((r) => r.idempotency_key === row.idempotency_key);
          let created: any = null;
          if (!duplicate) { created = { id: nextId++, attempts: 0, created_at: "t", ...row }; rows.push(created); }
          return { select: (_c: string) => ({
            maybeSingle: async () => duplicate
              ? { data: null, error: { code: "23505", message: "duplicate key" } }
              : { data: { ...created }, error: null },
          }) };
        },
        select(_c: string) {
          return { eq: (_col: string, value: string) => ({
            maybeSingle: async () => ({ data: rows.find((r) => r.idempotency_key === value) ?? null, error: null }),
          }) };
        },
        update(patch: any) {
          const filters: Record<string, unknown> = {};
          const chain: any = {
            eq(col: string, value: unknown) { filters[col] = value; return chain; },
            select(_c: string) { return { maybeSingle: async () => {
              const row = rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
              if (!row) return { data: null, error: null };
              Object.assign(row, patch);
              return { data: { ...row }, error: null };
            } }; },
          };
          return chain;
        },
      };
    },
  };
  return client;
}

// ---- helpers mirroring what the edge function does per block ----
const SECTION = "history", SLUG = "ibn-sina";
const enc = (s: string) => new TextEncoder().encode(s);

async function enqueue(service: any, review: any, lang: string, index: number, sourceText: string, spokenText: string) {
  const sourceHash = await sha256Hex(enc(sourceText));
  const spokenHash = await sha256Hex(enc(spokenText));
  const key = await buildIdempotencyKey(review, SECTION, SLUG, lang, index, sourceHash, spokenHash);
  const result = await insertOrReuseJob(service, {
    section: SECTION, slug: SLUG, language: lang, block_index: index, speaker: "narrator",
    engine: "omnivoice-voicetut", payload: { text: spokenText }, source_text_hash: key,
    idempotency_key: key, status: "pending",
  }, key);
  return { key, result };
}

function entryFor(lang: string, index: number, regen = 0) {
  return { story_id: "s", lang, block_index: index, chunk_index: 0, speaker: "narrator",
    base: lang + "-" + index, key: lang + "-" + index + "@" + regen, text: "t", src: "", audio_sha256: "" };
}

function accepted(review: any, entry: any) { return core.applyDecision(review, entry, { status: "accepted" }); }
function rejected(review: any, entry: any, note = "fix the name") {
  return core.applyDecision(review, entry, { status: "rejected", note, suggestion: "", issue: "text" });
}

Deno.test("Gemini returns the same text word for word -> a NEW job is still created", async () => {
  const db = mockSupabase();
  let review = core.emptyReview();
  const first = await enqueue(db, review, "ar", 2, "src", "same text");
  assertEquals(first.result.ok && first.result.created, true);
  review = accepted(review, entryFor("ar", 2));
  review = rejected(review, entryFor("ar", 2));              // reviewer rejects with a note
  assertEquals(rejectionRevision(review, "ar", 2), 1);
  const second = await enqueue(db, review, "ar", 2, "src", "same text"); // Gemini gave identical text
  assertNotEquals(second.key, first.key);
  assertEquals(second.result.ok && second.result.created, true);
  assertEquals(db.rows.length, 2);
});

Deno.test("pressing reject twice with the same note does not duplicate the job", async () => {
  const db = mockSupabase();
  let review = core.emptyReview();
  review = rejected(review, entryFor("ar", 1));
  review = rejected(review, entryFor("ar", 1));              // double click, same decision
  assertEquals(rejectionRevision(review, "ar", 1), 1);
  const a = await enqueue(db, review, "ar", 1, "src", "txt");
  const b = await enqueue(db, review, "ar", 1, "src", "txt");
  assertEquals(a.result.ok && a.result.created, true);
  assertEquals(b.result.ok && !b.result.created && !b.result.retried, true);
  assertEquals(db.rows.length, 1);
});

Deno.test("a second, different rejection gets the next counter value and a new job", async () => {
  const db = mockSupabase();
  let review = rejected(core.emptyReview(), entryFor("ar", 1, 0), "first note");
  const a = await enqueue(db, review, "ar", 1, "src", "txt");
  review = rejected(review, entryFor("ar", 1, 1), "second note");
  assertEquals(rejectionRevision(review, "ar", 1), 2);
  const b = await enqueue(db, review, "ar", 1, "src", "txt");
  assertNotEquals(a.key, b.key);
  assertEquals(db.rows.length, 2);
});

Deno.test("a failed job is retried (reset to pending) instead of being dropped", async () => {
  const db = mockSupabase();
  const review = rejected(core.emptyReview(), entryFor("ar", 3));
  const a = await enqueue(db, review, "ar", 3, "src", "txt");
  Object.assign(db.rows[0], { status: "failed", attempts: 3, last_error: "colab down" });
  const b = await enqueue(db, review, "ar", 3, "src", "txt");
  assertEquals(b.key, a.key);
  assert(b.result.ok && b.result.retried);
  assertEquals(db.rows.length, 1);
  assertEquals(db.rows[0].status, "pending");
  assertEquals(db.rows[0].attempts, 0);
  assertEquals(db.rows[0].last_error, null);
});

Deno.test("old completed jobs keep their old key: healthy clips are never regenerated", async () => {
  const sourceHash = await sha256Hex(enc("src")), spokenHash = await sha256Hex(enc("txt"));
  const legacy = await sha256Hex(enc([SECTION, SLUG, "ar", 0, sourceHash, spokenHash, 0].join(":")));
  assertEquals(await buildIdempotencyKey(core.emptyReview(), SECTION, SLUG, "ar", 0, sourceHash, spokenHash), legacy);

  const db = mockSupabase();
  const oldJob = await enqueue(db, core.emptyReview(), "ar", 0, "src", "txt");
  Object.assign(db.rows[0], { status: "completed" });
  // block 2 gets rejected; block 0 must still map to the very same (completed) job
  const review = rejected(core.emptyReview(), entryFor("ar", 2));
  const again = await enqueue(db, review, "ar", 0, "src", "txt");
  assertEquals(again.key, oldJob.key);
  assert(again.result.ok && !again.result.created && !again.result.retried);
  assertEquals(db.rows.length, 1);
  assertEquals(db.rows[0].status, "completed");
});

Deno.test("rejecting one block does not remove or change another block's decision or counter", () => {
  let review = accepted(core.emptyReview(), entryFor("ar", 0));
  review = accepted(review, entryFor("ar", 1));
  review = rejected(review, entryFor("ar", 2));
  assertEquals(review.clips["ar-0@0"].status, "accepted");
  assertEquals(review.clips["ar-1@0"].status, "accepted");
  assertEquals(review.clips["ar-2@0"].status, "rejected");
  assertEquals(rejectionRevision(review, "ar", 0), 0);
  assertEquals(rejectionRevision(review, "ar", 1), 0);
  assertEquals(rejectionRevision(review, "ar", 2), 1);
  // same index in another language is independent too
  assertEquals(rejectionRevision(review, "en", 2), 0);
});

Deno.test("after the new audio is accepted the key stays stable (no second regeneration)", async () => {
  const db = mockSupabase();
  let review = rejected(core.emptyReview(), entryFor("ar", 2, 0));
  const a = await enqueue(db, review, "ar", 2, "src", "txt");
  Object.assign(db.rows[0], { status: "completed" });
  review = accepted(review, entryFor("ar", 2, 1));
  assertEquals(rejectionRevision(review, "ar", 2), 1);       // counter persists after acceptance
  const b = await enqueue(db, review, "ar", 2, "src", "txt");
  assertEquals(b.key, a.key);
  assertEquals(db.rows.length, 1);
});
