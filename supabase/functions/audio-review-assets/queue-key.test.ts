// Run with:  deno test supabase/functions/audio-review-assets/queue-key.test.ts
// These tests import the real helpers used by index.ts (queue-key.ts). They never call Gemini, the audio
// engine, Colab or Supabase: the queue is an in-memory Map that enforces the same unique idempotency key.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  buildQueueIdempotencyKey,
  bumpRejectionCycles,
  existingJobAction,
  hasOpenRejection,
  rejectionCycleFor,
  sha256Text,
} from "./queue-key.ts";

const base = { section: "history", slug: "ibn-sina", language: "ar", blockIndex: 4, regenRevision: 0 };

async function parts(over: Partial<Parameters<typeof buildQueueIdempotencyKey>[0]> & { text?: string }) {
  const spokenHash = await sha256Text(over.text ?? "نص القراءة");
  return {
    ...base, sourceHash: await sha256Text("النص الأصلي"), spokenHash, rejectionCycle: 0, ...over,
  } as Parameters<typeof buildQueueIdempotencyKey>[0];
}

const rejected = (lang: string, block: number, extra: Record<string, unknown> = {}) =>
  ({ lang, block_index: block, status: "rejected", ...extra });
const accepted = (lang: string, block: number) => ({ lang, block_index: block, status: "accepted" });

// --- tiny in-memory model of story_audio_generation_queue (unique idempotency_key) -----------------
type Job = { id: number; status: string; key: string; attempts: number; block: number; language: string };
class FakeQueue {
  jobs = new Map<string, Job>();
  nextId = 1;
  /** Mirrors the handler: insert; on duplicate key look at the existing row (retry only if failed). */
  async enqueue(p: Parameters<typeof buildQueueIdempotencyKey>[0]) {
    const key = await buildQueueIdempotencyKey(p);
    const existing = this.jobs.get(key);
    if (!existing) {
      const job = { id: this.nextId++, status: "pending", key, attempts: 0, block: p.blockIndex, language: p.language };
      this.jobs.set(key, job);
      return { created: true, retried: false, job };
    }
    if (existingJobAction(existing.status) === "retry") {
      existing.status = "pending"; existing.attempts = 0;
      return { created: false, retried: true, job: existing };
    }
    return { created: false, retried: false, job: existing };
  }
  forBlock(language: string, block: number) {
    return [...this.jobs.values()].filter((j) => j.language === language && j.block === block);
  }
}

// ---------------------------------------------------------------------------------------------------
Deno.test("cycle 0 keeps the historical key formula (existing jobs are not re-created)", async () => {
  const p = await parts({});
  const legacy = await sha256Text([p.section, p.slug, p.language, p.blockIndex, p.sourceHash, p.spokenHash, p.regenRevision].join(":"));
  assertEquals(await buildQueueIdempotencyKey(p), legacy);
});

Deno.test("same reading text + a new rejection cycle => a different key", async () => {
  const k0 = await buildQueueIdempotencyKey(await parts({ rejectionCycle: 0 }));
  const k1 = await buildQueueIdempotencyKey(await parts({ rejectionCycle: 1 }));
  const k2 = await buildQueueIdempotencyKey(await parts({ rejectionCycle: 2 }));
  assertNotEquals(k0, k1);
  assertNotEquals(k1, k2);
  assertNotEquals(k0, k2);
});

Deno.test("text A -> B -> A still gets a new job every cycle", async () => {
  const q = new FakeQueue();
  const a0 = await q.enqueue(await parts({ text: "A", rejectionCycle: 0 }));
  const b1 = await q.enqueue(await parts({ text: "B", rejectionCycle: 1 }));
  const a2 = await q.enqueue(await parts({ text: "A", rejectionCycle: 2 }));
  assert(a0.created && b1.created && a2.created);
  assertEquals(q.forBlock("ar", 4).length, 3);
});

Deno.test("Gemini returns the SAME text after a rejection: a new audio job is really created", async () => {
  const q = new FakeQueue();
  const first = await q.enqueue(await parts({ text: "نفس النص", rejectionCycle: 0 }));
  first.job.status = "completed";
  // the owner rejects the clip -> server bumps the cycle -> Gemini gives the identical text back
  const review = { clips: { k1: accepted("ar", 4) } };
  const after = { clips: { k1: rejected("ar", 4) } };
  const cycles = bumpRejectionCycles(review, after);
  const cycle = rejectionCycleFor({ ...after, reject_cycles: cycles }, "ar", 4);
  assertEquals(cycle, 1);
  const second = await q.enqueue(await parts({ text: "نفس النص", rejectionCycle: cycle }));
  assert(second.created, "a rejection must always produce a fresh audio job");
  assertNotEquals(second.job.id, first.job.id);
  assertEquals(q.forBlock("ar", 4).length, 2);
});

Deno.test("double click / retry inside the SAME cycle does not create a duplicate job", async () => {
  const q = new FakeQueue();
  const p = await parts({ text: "نص", rejectionCycle: 1 });
  const a = await q.enqueue(p);
  const b = await q.enqueue(p);
  assert(a.created && !b.created && !b.retried);
  assertEquals(q.forBlock("ar", 4).length, 1);
});

Deno.test("a failed job is reset to pending (retried) instead of being stuck behind its unique key", async () => {
  const q = new FakeQueue();
  const p = await parts({ rejectionCycle: 1 });
  const a = await q.enqueue(p);
  a.job.status = "failed"; a.job.attempts = 3;
  const b = await q.enqueue(p);
  assert(b.retried && !b.created);
  assertEquals(b.job.status, "pending");
  assertEquals(b.job.attempts, 0);
  assertEquals(q.forBlock("ar", 4).length, 1);
  for (const status of ["pending", "processing", "completed"]) {
    assertEquals(existingJobAction(status), "reuse", status);
  }
});

Deno.test("rejecting one block never changes the cycle (or the key) of another block", async () => {
  const previous = { clips: { a: accepted("ar", 1), b: accepted("ar", 2), c: accepted("en", 2) } };
  const incoming = { clips: { a: accepted("ar", 1), b: rejected("ar", 2), c: accepted("en", 2) } };
  const cycles = bumpRejectionCycles(previous, incoming);
  const review = { ...incoming, reject_cycles: cycles };
  assertEquals(rejectionCycleFor(review, "ar", 2), 1);
  assertEquals(rejectionCycleFor(review, "ar", 1), 0);
  assertEquals(rejectionCycleFor(review, "en", 2), 0);
  const kOther = await buildQueueIdempotencyKey(await parts({ blockIndex: 1, rejectionCycle: rejectionCycleFor(review, "ar", 1) }));
  const kOtherBefore = await buildQueueIdempotencyKey(await parts({ blockIndex: 1, rejectionCycle: 0 }));
  assertEquals(kOther, kOtherBefore);
});

Deno.test("cycle counter: only NEW rejections count; re-saving the same rejected clip does not", () => {
  const first = bumpRejectionCycles({ clips: {} }, { clips: { k1: rejected("ar", 4) } });
  assertEquals(first["ar:4"], 1);
  // same rejected clip saved again (note edited): still cycle 1
  const resaved = bumpRejectionCycles({ clips: { k1: rejected("ar", 4) }, reject_cycles: first },
    { clips: { k1: rejected("ar", 4, { note: "edited" }) } });
  assertEquals(resaved["ar:4"], 1);
  // regenerated audio (new clip key) rejected again: cycle 2
  const second = bumpRejectionCycles({ clips: { k1: rejected("ar", 4, { resolved: true }), k2: accepted("ar", 4) }, reject_cycles: first },
    { clips: { k1: rejected("ar", 4, { resolved: true }), k2: rejected("ar", 4) } });
  assertEquals(second["ar:4"], 2);
});

Deno.test("cycle counter never goes backwards when rejected records were deleted (counter wins)", () => {
  const cycles = bumpRejectionCycles({ clips: {}, reject_cycles: { "ar:4": 3 } }, { clips: { k9: rejected("ar", 4) } });
  assertEquals(cycles["ar:4"], 4);
  assertEquals(rejectionCycleFor({ clips: {}, reject_cycles: { "ar:4": 3 } }, "ar", 4), 3);
});

Deno.test("English cycles are independent of Arabic cycles for the same block index", async () => {
  const review = { clips: { a: rejected("ar", 4), b: accepted("en", 4) }, reject_cycles: { "ar:4": 1 } };
  assertEquals(rejectionCycleFor(review, "ar", 4), 1);
  assertEquals(rejectionCycleFor(review, "en", 4), 0);
  const q = new FakeQueue();
  const ar = await q.enqueue(await parts({ language: "ar", rejectionCycle: 1 }));
  const en = await q.enqueue(await parts({ language: "en", rejectionCycle: 0 }));
  assert(ar.created && en.created);
});

Deno.test("English clips are independent jobs: queuing all of them creates one job each, no ordering needed", async () => {
  const q = new FakeQueue();
  for (const block of [9, 0, 5, 2, 7]) { // deliberately out of order
    const r = await q.enqueue(await parts({ language: "en", blockIndex: block, text: "english " + block }));
    assert(r.created);
  }
  assertEquals([...q.jobs.values()].filter((j) => j.language === "en").length, 5);
  // regenerating a single English block (after its own rejection) leaves the other four jobs untouched
  const review = { clips: { e5: rejected("en", 5) } };
  const cycle = rejectionCycleFor({ ...review, reject_cycles: bumpRejectionCycles({ clips: {} }, review) }, "en", 5);
  const again = await q.enqueue(await parts({ language: "en", blockIndex: 5, text: "english 5", rejectionCycle: cycle }));
  assert(again.created);
  assertEquals(q.forBlock("en", 5).length, 2);
  for (const block of [9, 0, 2, 7]) assertEquals(q.forBlock("en", block).length, 1);
});

Deno.test("hasOpenRejection: true until a later decision resolves the rejected clip", () => {
  assert(hasOpenRejection({ clips: { k: rejected("ar", 4) } }, "ar", 4));
  assert(!hasOpenRejection({ clips: { k: rejected("ar", 4, { resolved: true }) } }, "ar", 4));
  assert(!hasOpenRejection({ clips: { k: rejected("ar", 4) } }, "ar", 3));
  assert(!hasOpenRejection({ clips: { k: rejected("ar", 4) } }, "en", 4));
  assert(!hasOpenRejection(null, "ar", 4));
});
