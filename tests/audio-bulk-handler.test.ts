const MOCK = String.raw`// Minimal in-memory Supabase stand-in for the tables/storage calls the audio function makes.
export const db: { reviews: any[]; queue: any[]; nextId: number } = { reviews: [], queue: [], nextId: 1 };
const matches = (row: any, filters: [string, any][], ins: [string, any[]][]) =>
  filters.every(([k, v]) => row[k] === v) && ins.every(([k, vs]) => vs.includes(row[k]));
function builder(table: string) {
  const rows = () => (table === "story_audio_reviews" ? db.reviews : db.queue);
  const filters: [string, any][] = []; const ins: [string, any[]][] = [];
  let mode = "select", patch: any = null, insertRow: any = null;
  const api: any = {
    select() { return api; },
    eq(k: string, v: any) { filters.push([k, v]); return api; },
    in(k: string, vs: any[]) { ins.push([k, vs]); return api; },
    limit() { return api; },
    order() { return api; },
    insert(row: any) { mode = "insert"; insertRow = row; return api; },
    update(p: any) { mode = "update"; patch = p; return api; },
    upsert(row: any) { const i = db.reviews.findIndex((r) => r.section === row.section && r.slug === row.slug); if (i >= 0) db.reviews[i] = row; else db.reviews.push(row); return Promise.resolve({ error: null }); },
    async maybeSingle() {
      if (mode === "insert") {
        if (db.queue.some((r) => r.idempotency_key === insertRow.idempotency_key)) return { data: null, error: { code: "23505", message: "duplicate" } };
        const row = { id: "job" + db.nextId++, attempts: 0, created_at: "t", ...insertRow }; db.queue.push(row); return { data: row, error: null };
      }
      const found = rows().filter((r) => matches(r, filters, ins));
      if (mode === "update") { const r = found[0]; if (!r) return { data: null, error: null }; Object.assign(r, patch); return { data: r, error: null }; }
      return { data: found[0] ?? null, error: null };
    },
    then(res: any) { return Promise.resolve({ data: rows().filter((r) => matches(r, filters, ins)), error: null }).then(res); },
  };
  return api;
}
export function createClient(_url: string, _key: string, opts?: any) {
  const isAuth = !!opts?.global;
  return {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } }, error: null }) },
    rpc: async () => ({ data: true, error: null }),
    from: (t: string) => builder(t),
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: "Object not found", statusCode: "404" } }), upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
    _isAuth: isAuth,
  };
}
`;

// Behavioural tests for the audio-review-assets edge function: the REAL handler runs against an in-memory
// Supabase stand-in (queue table with the unique idempotency_key, review table, storage). They cover the bulk
// generation action for the four translated languages (en / fr / it / de) and the Arabic one-clip-at-a-time gate.
// Run: deno test --allow-read --allow-write --allow-env tests/audio-bulk-handler.test.ts
import assert from "node:assert/strict";

const FUNCTION_DIR = new URL("../supabase/functions/audio-review-assets/", import.meta.url);
const workDir = await Deno.makeTempDir({ prefix: "audio-bulk-handler-" });

// Same source as production, with only the two remote imports replaced by local stand-ins.
const source = (await Deno.readTextFile(new URL("index.ts", FUNCTION_DIR)))
  .replace('import "jsr:@supabase/functions-js/edge-runtime.d.ts";\n', "")
  .replace('import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";', 'import { createClient } from "./mock-supabase.ts";');
if (source.includes("esm.sh") || source.includes("jsr:")) throw new Error("unexpected remote import left in the handler under test");
await Deno.writeTextFile(`${workDir}/index.ts`, source);
await Deno.writeTextFile(`${workDir}/queue-logic.ts`, await Deno.readTextFile(new URL("queue-logic.ts", FUNCTION_DIR)));
await Deno.writeTextFile(`${workDir}/mock-supabase.ts`, MOCK);

Deno.env.set("SUPABASE_URL", "http://x"); Deno.env.set("SUPABASE_ANON_KEY", "a"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "s"); Deno.env.set("GEMINI_API_KEY", "test-key");
let handler: any = null;
(Deno as any).serve = (h: any) => { handler = h; return {}; };
await import(`file://${workDir}/index.ts`);
const { db } = await import(`file://${workDir}/mock-supabase.ts`);
const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const ar = [
  { speaker: "karma", text: "مرحبا" }, { speaker: "narrator", text: "حكاية" }, { speaker: "title", text: "عنوان" },
  { speaker: "karma", text: "سؤال" }, { speaker: "narrator", text: "جواب" },
];
const snapshot = { section: "science", slug: "t", blocks: { ar, en: ar, fr: ar, it: ar, de: ar } };
async function call(body: any) {
  const res = await handler(new Request("http://x", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ section: "science", slug: "t", story_snapshot: snapshot, ...body }) }));
  return { status: res.status, json: await res.json() };
}
async function translations(lang: string, indexes: number[], skip: number[] = []) {
  const t: any = {};
  for (const i of indexes) if (!skip.includes(i)) t[lang + ":" + i] = { status: "approved", translation_text: lang + " text " + i, source_arabic_hash: await sha(ar[i].text.trim()), speaker: ar[i].speaker };
  return t;
}
function setReview(extra: any) { db.reviews.length = 0; db.reviews.push({ section: "science", slug: "t", audio_review: { version: 1, regen: {}, clips: {}, audio_hashes: {}, speech_texts: {}, ...extra } }); }

Deno.test("Arabic bulk is rejected", async () => {
  setReview({}); const r = await call({ action: "enqueue_approved_language", language: "ar" });
  assert.equal(r.status, 409);
});
Deno.test("bulk queues every speakable block of a translated language, skipping non-speaker blocks", async () => {
  db.queue.length = 0; setReview({ translations: await translations("fr", [0, 1, 3, 4]) });
  const r = await call({ action: "enqueue_approved_language", language: "fr" });
  assert.equal(r.status, 200); assert.equal(r.json.counts.total, 4); assert.equal(r.json.counts.queued, 4); assert.equal(r.json.complete, true);
  assert.equal(db.queue.length, 4);
  assert.ok(db.queue.every((j: any) => j.engine === "omnivoice-multilingual" && j.language === "fr" && j.status === "pending"));
  assert.deepEqual(db.queue.map((j: any) => j.block_index), [0, 1, 3, 4]);
});
Deno.test("running bulk again reuses identical jobs: nothing duplicated or regenerated", async () => {
  const before = db.queue.length; const r = await call({ action: "enqueue_approved_language", language: "fr" });
  assert.equal(r.json.counts.already_queued, 4); assert.equal(r.json.counts.queued, 0); assert.equal(db.queue.length, before);
});
Deno.test("a block without an approved translation is blocked, the rest still queue", async () => {
  db.queue.length = 0; setReview({ translations: await translations("it", [0, 1, 3, 4], [3]) });
  const r = await call({ action: "enqueue_approved_language", language: "it" });
  assert.equal(r.status, 200); assert.equal(r.json.counts.queued, 3); assert.equal(r.json.counts.blocked, 1); assert.equal(r.json.complete, false);
  const bad = r.json.results.find((x: any) => x.block_index === 3); assert.equal(bad.state, "blocked");
  assert.equal(db.queue.length, 3);
});
Deno.test("a failed job is retried, a completed one is untouched", async () => {
  db.queue.length = 0; setReview({ translations: await translations("de", [0, 1, 3, 4]) });
  await call({ action: "enqueue_approved_language", language: "de" });
  db.queue[0].status = "failed"; db.queue[0].last_error = "boom"; db.queue[1].status = "completed";
  const r = await call({ action: "enqueue_approved_language", language: "de" });
  assert.equal(r.json.counts.retried, 1); assert.equal(r.json.counts.already_queued, 3);
  assert.equal(db.queue[0].status, "pending"); assert.equal(db.queue[1].status, "completed"); assert.equal(db.queue.length, 4);
});
Deno.test("already accepted blocks are skipped", async () => {
  db.queue.length = 0;
  setReview({ translations: await translations("en", [0, 1, 3, 4]), clips: { k: { lang: "en", block_index: 0, status: "accepted" } } });
  const r = await call({ action: "enqueue_approved_language", language: "en" });
  assert.equal(r.json.counts.accepted, 1); assert.equal(r.json.counts.queued, 3); assert.ok(!db.queue.some((j: any) => j.block_index === 0));
});
Deno.test("single enqueue for a translated language is no longer order-gated", async () => {
  db.queue.length = 0; setReview({ translations: await translations("fr", [0, 1, 3, 4]) });
  const r = await call({ action: "enqueue", language: "fr", block_index: 4 });
  assert.equal(r.status, 200); assert.equal(r.json.queued, true);
});
Deno.test("Arabic single enqueue stays strictly in order", async () => {
  db.queue.length = 0;
  const speech: any = {}; for (const i of [0, 1, 3, 4]) speech["ar:" + i] = { status: "approved", approved_text: "x" + i, source_text_hash: await sha(ar[i].text.trim()) };
  setReview({ speech_texts: speech });
  const skip = await call({ action: "enqueue", language: "ar", block_index: 3 });
  assert.equal(skip.status, 409); assert.match(skip.json.error, /يجب اعتماد المقطع 1/);
  const first = await call({ action: "enqueue", language: "ar", block_index: 0 });
  assert.equal(first.status, 200);
  const second = await call({ action: "enqueue", language: "ar", block_index: 1 });
  assert.equal(second.status, 409); // block 0 still pending and not accepted
});
Deno.test("fr jobs in flight do not block Arabic enqueue (per-language active-job gate)", async () => {
  db.queue.length = 0;
  const speech: any = {}; for (const i of [0, 1, 3, 4]) speech["ar:" + i] = { status: "approved", approved_text: "x" + i, source_text_hash: await sha(ar[i].text.trim()) };
  setReview({ speech_texts: speech, translations: await translations("fr", [0, 1, 3, 4]) });
  await call({ action: "enqueue_approved_language", language: "fr" });
  const r = await call({ action: "enqueue", language: "ar", block_index: 0 });
  assert.equal(r.status, 200);
});

Deno.test("translation falls back to the next Gemini model when the first model answers 404 and reports each attempt", async () => {
  const realFetch = globalThis.fetch;
  const asked: string[] = [];
  (globalThis as any).fetch = async (url: any) => {
    const u = String(url);
    if (!u.includes("generativelanguage.googleapis.com")) return realFetch(url);
    const model = u.split("/models/")[1].split(":")[0];
    asked.push(model);
    if (model === "gemini-3.8-flash") return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translation_text: "Hello", review_notes: [] }) }] } }] }), { status: 200 });
  };
  try {
    setReview({});
    const r = await call({ action: "translation_generate", language: "de", block_index: 0 });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.translation.model, "gemini-3.7-flash");
    assert.deepEqual(asked, ["gemini-3.8-flash", "gemini-3.7-flash"]);
  } finally { (globalThis as any).fetch = realFetch; }
});
Deno.test("translation failure message lists the model and HTTP status of every attempt", async () => {
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: any) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return realFetch(url);
    return new Response("{}", { status: 404 });
  };
  try {
    setReview({});
    const r = await call({ action: "translation_generate", language: "de", block_index: 0 });
    assert.equal(r.status, 502);
    assert.match(r.json.error, /gemini-3\.8-flash #1: HTTP 404/);
    assert.match(r.json.error, /gemini-3\.6-flash #1: HTTP 404/);
  } finally { (globalThis as any).fetch = realFetch; }
});
Deno.test("a refused key (403) stops after the first model instead of trying the others", async () => {
  const realFetch = globalThis.fetch;
  const asked: string[] = [];
  (globalThis as any).fetch = async (url: any) => {
    const u = String(url);
    if (!u.includes("generativelanguage.googleapis.com")) return realFetch(url);
    asked.push(u.split("/models/")[1].split(":")[0]);
    return new Response("{}", { status: 403 });
  };
  try {
    setReview({});
    const r = await call({ action: "translation_generate", language: "de", block_index: 0 });
    assert.equal(r.status, 502);
    assert.deepEqual(asked, ["gemini-3.8-flash"]);
    assert.match(r.json.error, /gemini-3\.8-flash #1: HTTP 403/);
  } finally { (globalThis as any).fetch = realFetch; }
});
