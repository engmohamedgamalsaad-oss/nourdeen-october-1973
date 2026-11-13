import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import JSZip from "npm:jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function envKey(name: string, dictionaryName: string): string {
  const legacy = Deno.env.get(name);
  if (legacy) return legacy;
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) ?? "{}");
    return typeof dictionary.default === "string" ? dictionary.default : "";
  } catch {
    return "";
  }
}
const ANON_KEY = envKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
const SERVICE_KEY = envKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
const GITHUB_TOKEN = Deno.env.get("GITHUB_PUBLISH_TOKEN") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const BUCKET = "khaledoon-audio-review";
const PUBLIC_AUDIO_BUCKET = "khaledoon-story-audio-public";
const OWNER = "engmohamedgamalsaad-oss";
const REPO = "nourdeen-october-1973";
const ALLOWED_ORIGIN = "https://engmohamedgamalsaad-oss.github.io";
const headers = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers });

function validKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{1,80}$/.test(value);
}
function sha256Hex(bytes: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", bytes).then((digest) =>
    Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
  );
}
async function ibnSinaArabicBlock(blockIndex: number) {
  if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex > 16) {
    throw new Error("رقم مقطع ابن سينا غير صالح.");
  }
  const response = await fetch("https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/main/stories/history/005/story.json", {
    headers: { "Accept": "application/vnd.github.raw+json" },
  });
  if (!response.ok) throw new Error("تعذر تحميل نص ابن سينا المعتمد من المستودع.");
  const story = await response.json();
  if (story?.format !== "KHALEDOON_STORY" || story.section !== "history" || story.slug !== "ibn-sina") {
    throw new Error("حزمة ابن سينا لا تطابق هوية التجربة.");
  }
  const blocks = story?.i18n?.ar?.blocks;
  const block = Array.isArray(blocks) ? blocks[blockIndex] : null;
  if (!block || !["narrator", "karma"].includes(block.speaker) || typeof block.text !== "string" || !block.text.trim()) {
    throw new Error("المقطع المحدد غير موجود أو لا يحتوي نصًا صالحًا.");
  }
  const sourceText = block.text.trim();
  const sourceTextHash = await sha256Hex(new TextEncoder().encode(sourceText));
  return { block, sourceText, sourceTextHash, blocks };
}
const storyPathCache = new Map<string, string>();
async function resolveStoryBlock(section: string, slug: string, language: string, blockIndex: number, snapshot?: any) {
  // The preview page sends the story it is showing; use it instead of main so
  // reordered/edited stories work before anything is published to GitHub.
  const fromSnapshot = storyFromSnapshot(snapshot, section, slug);
  if (fromSnapshot) {
    const snapBlock = fromSnapshot?.i18n?.[language]?.blocks?.[blockIndex];
    if (!isSpeakableBlock(snapBlock)) {
      throw new Error("المقطع المحدد غير موجود في لغة الحكاية أو لا يحتوي نصًا صالحًا.");
    }
    const snapText = snapBlock.text.trim();
    return { story: fromSnapshot, block: snapBlock, sourceText: snapText, sourceTextHash: await sha256Hex(new TextEncoder().encode(snapText)) };
  }
  const identity = section + "/" + slug;
  let path = storyPathCache.get(identity);
  if (!path) {
    const treeResponse = await fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/git/trees/main?recursive=1", {
      headers: { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + GITHUB_TOKEN, "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!treeResponse.ok) throw new Error("تعذر البحث عن ملف الحكاية في المستودع.");
    const tree = await treeResponse.json();
    const candidates = (tree.tree ?? []).filter((item: any) =>
      item.type === "blob" && item.path.startsWith("stories/" + section + "/") && item.path.endsWith("/story.json"));
    for (const item of candidates) {
      const response = await fetch("https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/main/" + item.path);
      if (!response.ok) continue;
      const candidate = await response.json();
      if (candidate?.format === "KHALEDOON_STORY" && candidate.section === section && candidate.slug === slug) {
        path = item.path;
        storyPathCache.set(identity, path);
        break;
      }
    }
  }
  if (!path) throw new Error("لم يتم العثور على ملف الحكاية المطابق لهويتها.");
  const response = await fetch("https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/main/" + path);
  if (!response.ok) throw new Error("تعذر تحميل النص المعتمد للحكاية.");
  const story = await response.json();
  const block = story?.i18n?.[language]?.blocks?.[blockIndex];
  if (!block || !["narrator", "karma"].includes(block.speaker) || typeof block.text !== "string" || !block.text.trim()) {
    throw new Error("المقطع المحدد غير موجود في لغة الحكاية أو لا يحتوي نصًا صالحًا.");
  }
  const sourceText = block.text.trim();
  const sourceTextHash = await sha256Hex(new TextEncoder().encode(sourceText));
  return { story, block, sourceText, sourceTextHash };
}
function acceptedBlockIndexes(audioReview: any, language: string): Set<number> {
  return new Set(Object.values(audioReview?.clips ?? {})
    .filter((clip: any) => clip?.lang === language && clip?.status === "accepted")
    .map((clip: any) => Number(clip.block_index)));
}
async function invalidatePublicStoryAudio(service: any, section: string, slug: string) {
  for (const language of ["ar", "en"]) {
    const prefix = section + "/" + slug + "/" + language;
    const { data, error } = await service.storage.from(PUBLIC_AUDIO_BUCKET).list(prefix, { limit: 1000 });
    if (error) throw new Error("تعذر التحقق من ملفات الصوت المنشورة قبل تحديث المراجعة: " + error.message);
    const paths = (data ?? []).filter((item: any) => item?.name).map((item: any) => prefix + "/" + item.name);
    if (paths.length) {
      const { error: removeError } = await service.storage.from(PUBLIC_AUDIO_BUCKET).remove(paths);
      if (removeError) throw new Error("تعذر إلغاء نشر نسخة الصوت السابقة: " + removeError.message);
    }
  }
}

async function invalidatePublicClipAudio(service: any, section: string, slug: string, language: string, blockIndex: number, chunkIndex?: number) {
  const prefix = section + "/" + slug + "/" + language;
  const manifestPath = prefix + "/manifest.json";
  const { data: file, error: downloadError } = await service.storage.from(PUBLIC_AUDIO_BUCKET).download(manifestPath);
  if (downloadError || !file) return;
  let manifest: any;
  try { manifest = JSON.parse(await file.text()); }
  catch { throw new Error("manifest الصوت المنشور غير صالح؛ لم يتم حذف أي ملف."); }
  if (!Array.isArray(manifest.segments)) throw new Error("manifest الصوت المنشور لا يحتوي قائمة مقاطع صالحة.");
  const removed = manifest.segments.filter((segment: any) =>
    Number(segment?.block_index) === blockIndex &&
    (chunkIndex === undefined || Number(segment?.chunk_index || 0) === chunkIndex));
  if (!removed.length) return;
  const removedSet = new Set(removed.map((segment: any) => segment.src));
  const nextManifest = { ...manifest, segments: manifest.segments.filter((segment: any) => !removedSet.has(segment.src)) };
  const { error: manifestError } = await service.storage.from(PUBLIC_AUDIO_BUCKET).upload(
    manifestPath, new TextEncoder().encode(JSON.stringify(nextManifest)),
    { contentType: "application/json", upsert: true, cacheControl: "60" });
  if (manifestError) throw new Error("تعذر تحديث manifest العام لاستبعاد المقطع المرفوض: " + manifestError.message);
  const paths = removed.filter((segment: any) => typeof segment.src === "string" && /^[A-Za-z0-9_-]+\.mp3$/.test(segment.src))
    .map((segment: any) => prefix + "/" + segment.src);
  if (paths.length) {
    const { error: removeError } = await service.storage.from(PUBLIC_AUDIO_BUCKET).remove(paths);
    if (removeError) throw new Error("تم استبعاد المقطع من manifest لكن تعذر حذف نسخته العامة: " + removeError.message);
  }
}
function orderedStoryBlockIndexes(blocks: any[]): number[] {
  // Review order follows the story itself (block order), not speaker groups.
  const ordered: number[] = [];
  blocks.forEach((block: any, index: number) => {
    if (block?.speaker === "karma" || block?.speaker === "narrator") ordered.push(index);
  });
  return ordered;
}
function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}
function acceptedArabicBlockIndexes(audioReview: any): Set<number> {
  return new Set(
    Object.values(audioReview?.clips ?? {})
      .filter((clip: any) => clip?.lang === "ar" && clip?.status === "accepted")
      .map((clip: any) => Number(clip.block_index))
  );
}
function requiredEarlierIbnSinaBlocks(blocks: any[], targetIndex: number): number[] {
  return orderedStoryBlockIndexes(blocks).filter((index) => index < targetIndex);
}

// <reconcile-pure>
function normSpoken(value: any): string { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function isSpeakableBlock(block: any): boolean {
  return !!block && (block.speaker === "karma" || block.speaker === "narrator") &&
    typeof block.text === "string" && !!block.text.trim();
}
function storyFromSnapshot(snapshot: any, section: string, slug: string): any {
  if (!snapshot || typeof snapshot !== "object" || snapshot.section !== section || snapshot.slug !== slug) return null;
  const i18n: Record<string, any> = {};
  for (const lang of ["ar", "en"]) {
    const blocks = snapshot.blocks?.[lang];
    if (!Array.isArray(blocks)) continue;
    if (blocks.length > 400) return null;
    i18n[lang] = {
      blocks: blocks.map((b: any) => ({
        speaker: typeof b?.speaker === "string" ? b.speaker : "",
        text: typeof b?.text === "string" ? b.text.slice(0, 20000) : "",
      })),
    };
  }
  if (!i18n.ar && !i18n.en) return null;
  return { format: "KHALEDOON_STORY", section, slug, i18n };
}
/* يطابق سجل المراجعة والنصوص المعتمدة وmanifest الصوت مع الحكاية الحالية بالمحتوى لا برقم المقطع:
   نص القراءة والصوت اللذان تغيّر مكانهما يتبعان المقطع، وما حُذف أو تغيّر نصه يُسقَط، ولا يُحذف أي صوت صالح بصمت. */
async function reconcilePlan(review: any, snap: any, manifests: Record<string, any>) {
  const summary = { speech_moved: 0, speech_dropped: 0, clips_dropped: 0, segments_moved: 0, segments_dropped: 0 };
  const current: any = review && typeof review === "object"
    ? JSON.parse(JSON.stringify(review)) : { version: 1, regen: {}, clips: {}, audio_hashes: {} };
  if (!current.clips || typeof current.clips !== "object") current.clips = {};
  const encoder = new TextEncoder();
  const arBlocks: any[] = snap?.i18n?.ar?.blocks ?? [];

  const oldSpeech: Record<string, any> = current.speech_texts && typeof current.speech_texts === "object" ? current.speech_texts : {};
  const newSpeech: Record<string, any> = {};
  const usedSpeech = new Set<string>();
  const hashes: string[] = [];
  for (let i = 0; i < arBlocks.length; i++) {
    hashes.push(isSpeakableBlock(arBlocks[i]) ? await sha256Hex(encoder.encode(arBlocks[i].text.trim())) : "");
  }
  const speechMatches = (rec: any, i: number) => !!rec && typeof rec === "object" && !!hashes[i] &&
    rec.source_text_hash === hashes[i] && rec.speaker === arBlocks[i].speaker;
  for (let i = 0; i < arBlocks.length; i++) {
    const key = "ar:" + i;
    if (speechMatches(oldSpeech[key], i)) { newSpeech[key] = oldSpeech[key]; usedSpeech.add(key); }
  }
  for (let i = 0; i < arBlocks.length; i++) {
    const key = "ar:" + i;
    if (!hashes[i] || newSpeech[key]) continue;
    const from = Object.keys(oldSpeech).find((k) => !usedSpeech.has(k) && speechMatches(oldSpeech[k], i));
    if (from) { newSpeech[key] = { ...oldSpeech[from], block_index: i }; usedSpeech.add(from); summary.speech_moved++; }
  }
  summary.speech_dropped = Object.keys(oldSpeech).filter((k) => !usedSpeech.has(k)).length;
  const speechChanged = summary.speech_moved > 0 || summary.speech_dropped > 0;
  if (speechChanged) current.speech_texts = newSpeech;

  const expectedFor = (lang: string, i: number): string => {
    const block = snap?.i18n?.[lang]?.blocks?.[i];
    if (!isSpeakableBlock(block)) return "";
    if (lang === "ar") {
      const rec = newSpeech["ar:" + i];
      return rec && rec.status === "approved" && typeof rec.approved_text === "string" ? normSpoken(rec.approved_text) : "";
    }
    return normSpoken(block.text);
  };

  const newManifests: Record<string, any> = {};
  for (const lang of ["ar", "en"]) {
    const manifest = manifests?.[lang];
    if (!manifest || !Array.isArray(manifest.segments) || !manifest.segments.length) continue;
    const blocks: any[] = snap?.i18n?.[lang]?.blocks ?? [];
    const groups = new Map<number, any[]>();
    const untouched: any[] = [];
    for (const seg of manifest.segments) {
      const b = Number(seg?.block_index);
      if (!Number.isInteger(b)) { untouched.push(seg); continue; }
      const list = groups.get(b) ?? [];
      list.push(seg);
      groups.set(b, list);
    }
    const info = new Map<number, { text: string; speaker: string }>();
    for (const [b, segs] of groups) {
      segs.sort((x: any, y: any) => Number(x.chunk_index || 0) - Number(y.chunk_index || 0));
      info.set(b, { text: normSpoken(segs.map((x: any) => x.text).join(" ")), speaker: String(segs[0]?.speaker ?? "") });
    }
    const assign = new Map<number, number>();
    const usedOld = new Set<number>();
    for (let i = 0; i < blocks.length; i++) {
      const exp = expectedFor(lang, i), g = info.get(i);
      if (exp && g && g.text === exp && g.speaker === blocks[i].speaker) { assign.set(i, i); usedOld.add(i); }
    }
    for (let i = 0; i < blocks.length; i++) {
      if (assign.has(i)) continue;
      const exp = expectedFor(lang, i);
      if (!exp) continue;
      for (const [old, g] of info) {
        if (usedOld.has(old)) continue;
        if (g.text === exp && g.speaker === blocks[i].speaker) { assign.set(i, old); usedOld.add(old); break; }
      }
    }
    const next: any[] = [];
    let moved = 0, dropped = 0;
    for (const [i, old] of assign) {
      for (const seg of groups.get(old) ?? []) {
        if (i !== old) moved++;
        next.push(i === old ? seg : { ...seg, block_index: i });
      }
    }
    for (const [old, segs] of groups) {
      if (usedOld.has(old)) continue;
      if (isSpeakableBlock(blocks[old]) && !assign.has(old)) next.push(...segs);
      else dropped += segs.length;
    }
    next.push(...untouched);
    next.sort((x: any, y: any) => Number(x.block_index) - Number(y.block_index) || Number(x.chunk_index || 0) - Number(y.chunk_index || 0));
    if (moved || dropped) {
      summary.segments_moved += moved;
      summary.segments_dropped += dropped;
      newManifests[lang] = next.length ? { ...manifest, segments: next } : null;
    }
  }

  for (const [clipKey, clip] of Object.entries(current.clips) as [string, any][]) {
    if (!clip || (clip.lang !== "ar" && clip.lang !== "en")) continue;
    const index = Number(clip.block_index);
    const block = snap?.i18n?.[clip.lang]?.blocks?.[index];
    let keep = isSpeakableBlock(block) && block.speaker === clip.speaker;
    if (keep && Number(clip.chunk_index || 0) === 0) keep = normSpoken(clip.text) === expectedFor(clip.lang, index);
    if (!keep) { delete current.clips[clipKey]; summary.clips_dropped++; }
  }

  const changed = speechChanged || summary.clips_dropped > 0 || Object.keys(newManifests).length > 0;
  return { changed, review: current, manifests: newManifests, summary };
}
// </reconcile-pure>

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const origin = req.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return reply(403, { error: "Origin not allowed" });
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return reply(500, { error: "Supabase function secrets are incomplete." });

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return reply(401, { error: "تسجيل الدخول مطلوب." });
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return reply(401, { error: "جلسة الدخول غير صالحة؛ سجّل الدخول مجددًا." });
  const { data: isAdmin, error: adminError } = await authClient.rpc("is_admin");
  if (adminError || isAdmin !== true) return reply(403, { error: "هذا الإجراء متاح للأدمن المعتمد فقط." });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "بيانات الطلب ليست JSON صالحًا." }); }
  const section = body?.section;
  const slug = body?.slug;
  const language = body?.language;
  const action = body?.action;
  const languageRequired = ["stage", "manifest", "enqueue", "queue_status"].includes(action);
  if (!validKey(section) || !validKey(slug) ||
      (languageRequired && !["ar", "en", "fr", "it", "de"].includes(language))) {
    return reply(400, { error: "هوية الحكاية أو اللغة غير صالحة." });
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const prefix = section + "/" + slug + "/" + language;

  // Read/write the per-story audio review record used by the preview UI.
  // These actions remain behind the same authenticated-admin gate as every
  // other mutating audio workflow action in this function.
  if (body.action === "review_get") {
    const { data, error } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (error) return reply(500, { error: "تعذر قراءة سجل مراجعة الصوت.", detail: error.message });
    const audioReview = data?.audio_review && typeof data.audio_review === "object"
      ? data.audio_review : { version: 1, regen: {}, clips: {}, audio_hashes: {}, speech_texts: {} };
    return reply(200, { success: true, audio_review: audioReview });
  }

  if (body.action === "review_save") {
    const incoming = body.audio_review;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming) ||
        (incoming.version !== undefined && incoming.version !== 1) ||
        !incoming.clips || typeof incoming.clips !== "object" || Array.isArray(incoming.clips) ||
        !incoming.regen || typeof incoming.regen !== "object" || Array.isArray(incoming.regen) ||
        !incoming.audio_hashes || typeof incoming.audio_hashes !== "object" || Array.isArray(incoming.audio_hashes) ||
        (incoming.speech_texts !== undefined &&
          (!incoming.speech_texts || typeof incoming.speech_texts !== "object" || Array.isArray(incoming.speech_texts)))) {
      return reply(400, { error: "بنية سجل مراجعة الصوت غير صالحة؛ لم يتم حفظ أي تغيير." });
    }
    const serialized = JSON.stringify(incoming);
    if (serialized.length > 2_000_000) {
      return reply(413, { error: "سجل مراجعة الصوت أكبر من الحد المسموح." });
    }
    const { data: previousRow, error: previousError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (previousError) return reply(500, { error: "تعذر قراءة قرار الصوت السابق قبل تحديثه.", detail: previousError.message });
    const previousReview = previousRow?.audio_review && typeof previousRow.audio_review === "object" ? previousRow.audio_review : {};
    const newlyRejected = section === "history" && slug === "ibn-sina" &&
      Object.entries(incoming.clips).some(([key, clip]: [string, any]) =>
        clip?.lang === "ar" && Number(clip?.block_index) === 4 &&
        clip?.status === "rejected" && previousReview?.clips?.[key]?.status !== "rejected");
    const audioReview = {
      ...incoming,
      version: 1,
      regen: incoming.regen,
      clips: incoming.clips,
      audio_hashes: incoming.audio_hashes,
      speech_texts: incoming.speech_texts ?? {},
    };
    // Rejecting a clip immediately removes the currently published story audio.
    // Private staging files and the old manifest remain untouched for rollback.
    if (newlyRejected) {
      try {
        for (const clip of Object.values(incoming.clips) as any[]) {
          if (clip?.lang === "ar" && Number(clip.block_index) === 4 && clip.status === "rejected") {
            await invalidatePublicClipAudio(service, section, slug, "ar", 4, Number(clip.chunk_index || 0));
          }
        }
      } catch (error) { return reply(500, { error: error instanceof Error ? error.message : "تعذر إيقاف إتاحة المقطع المنشور بعد الرفض." }); }
    }
    const { error } = await service.from("story_audio_reviews").upsert(
      { section, slug, audio_review: audioReview },
      { onConflict: "section,slug" },
    );
    if (error) return reply(500, { error: "تعذر حفظ سجل مراجعة الصوت.", detail: error.message });
    return reply(200, { success: true, audio_review: audioReview, public_audio_invalidated: newlyRejected });
  }

  if (body.action === "reconcile") {
    const snap = storyFromSnapshot(body.story_snapshot, section, slug);
    if (!snap) return reply(400, { error: "لقطة الحكاية الحالية غير صالحة؛ أعد فتح المعاينة من لوحة الإدارة." });
    const { data: reviewRow, error: reviewReadError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (reviewReadError) return reply(500, { error: "تعذر قراءة سجل مراجعة الصوت.", detail: reviewReadError.message });
    const stored: Record<string, any> = {};
    for (const lang of ["ar", "en"]) {
      const { data: file } = await service.storage.from(BUCKET).download(section + "/" + slug + "/" + lang + "/manifest.json");
      if (!file) continue;
      try { stored[lang] = JSON.parse(await file.text()); } catch { /* malformed manifest: leave it for the normal checks */ }
    }
    const plan = await reconcilePlan(reviewRow?.audio_review ?? null, snap, stored);
    if (!plan.changed) return reply(200, { success: true, changed: false });
    const { data: activeJobs, error: jobsError } = await service.from("story_audio_generation_queue")
      .select("id").eq("section", section).eq("slug", slug).in("status", ["pending", "processing"]);
    if (jobsError) return reply(500, { error: "تعذر فحص طابور التوليد قبل مطابقة الحكاية.", detail: jobsError.message });
    if ((activeJobs ?? []).length) {
      return reply(409, {
        error: "تغيّر ترتيب الحكاية أو نصها وهناك " + (activeJobs ?? []).length + " مقطع بالطابور أو قيد التوليد؛ انتظر اكتمالها (أو فشلها) ثم أعد فتح المعاينة.",
        active_jobs: (activeJobs ?? []).length,
      });
    }
    try { await invalidatePublicStoryAudio(service, section, slug); }
    catch (error) { return reply(500, { error: error instanceof Error ? error.message : "تعذر إلغاء نشر النسخة السابقة." }); }
    const { error: saveReviewError } = await service.from("story_audio_reviews")
      .upsert({ section, slug, audio_review: plan.review }, { onConflict: "section,slug" });
    if (saveReviewError) return reply(500, { error: "تعذر حفظ سجل المراجعة بعد المطابقة.", detail: saveReviewError.message });
    for (const [lang, manifest] of Object.entries(plan.manifests) as [string, any][]) {
      const path = section + "/" + slug + "/" + lang + "/manifest.json";
      if (!manifest) {
        const { error } = await service.storage.from(BUCKET).remove([path]);
        if (error) return reply(500, { error: "تعذر تحديث manifest الصوت بعد المطابقة.", detail: error.message });
      } else {
        const { error } = await service.storage.from(BUCKET).upload(path, new TextEncoder().encode(JSON.stringify(manifest)), {
          contentType: "application/json", upsert: true, cacheControl: "60",
        });
        if (error) return reply(500, { error: "تعذر تحديث manifest الصوت بعد المطابقة.", detail: error.message });
      }
    }
    return reply(200, { success: true, changed: true, summary: plan.summary });
  }

  if (body.action === "enqueue") {
    const blockIndex = Number(body.block_index);
    if (!Number.isInteger(blockIndex) || blockIndex < 0) return reply(400, { error: "رقم المقطع غير صالح." });
    if (!["ar", "en"].includes(language)) return reply(400, { error: "التوليد متاح حاليًا للعربية والإنجليزية فقط." });
    let source;
    try { source = await resolveStoryBlock(section, slug, language, blockIndex, body.story_snapshot); }
    catch (error) { return reply(400, { error: error instanceof Error ? error.message : "تعذر تحديد المقطع." }); }
    const { data: reviewRow, error: reviewError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (reviewError) return reply(500, { error: "تعذر قراءة سجل مراجعة الحكاية.", detail: reviewError.message });
    const audioReview = reviewRow?.audio_review ?? {};
    const accepted = acceptedBlockIndexes(audioReview, language);
    const ordered = orderedStoryBlockIndexes(source.story.i18n[language].blocks);
    const targetPosition = ordered.indexOf(blockIndex);
    if (targetPosition < 0 || ordered.slice(0, targetPosition).some((index) => !accepted.has(index))) {
      return reply(409, { error: "يجب إكمال المقاطع السابقة واعتمادها أولًا، بترتيب الحكاية." });
    }
    if (accepted.has(blockIndex)) return reply(409, { error: "هذا المقطع معتمد بالفعل." });
    let spokenText = source.sourceText;
    if (language === "ar") {
      const speechRecord = audioReview?.speech_texts?.["ar:" + blockIndex];
      if (!speechRecord || speechRecord.status !== "approved" || typeof speechRecord.approved_text !== "string" ||
          !speechRecord.approved_text.trim() || speechRecord.source_text_hash !== source.sourceTextHash) {
        return reply(409, { error: "اعتمد نص القراءة الصوتية لهذا المقطع أولًا." });
      }
      spokenText = speechRecord.approved_text.trim();
    }
    try { await invalidatePublicStoryAudio(service, section, slug); }
    catch (error) { return reply(500, { error: error instanceof Error ? error.message : "تعذر إلغاء نشر النسخة السابقة." }); }
    const spokenHash = await sha256Hex(new TextEncoder().encode(spokenText));
    const relatedBases = Object.values(audioReview?.clips ?? {})
      .filter((clip: any) => clip?.lang === language && Number(clip.block_index) === blockIndex)
      .map((clip: any) => String(clip.base ?? "")).filter(Boolean);
    const regenRevision = relatedBases.reduce((max, base) => Math.max(max, Number(audioReview?.regen?.[base] ?? 0) || 0), 0);
    const idempotencyKey = await sha256Hex(new TextEncoder().encode([section, slug, language, blockIndex, source.sourceTextHash, spokenHash, regenRevision].join(":")));
    const payload = {
      text: spokenText,
      speaker: source.block.speaker,
      source_text: source.sourceText,
      source_text_hash: source.sourceTextHash,
      spoken_text_hash: spokenHash,
      regeneration_revision: regenRevision,
      language_code: language === "ar" ? "arz" : "eng",
      reference_role: source.block.speaker,
      sample_rate: 24000,
    };
    const { data: inserted, error: insertError } = await service.from("story_audio_generation_queue").insert({
      section, slug, language, block_index: blockIndex, speaker: source.block.speaker,
      engine: "omnivoice-voicetut", payload, source_text_hash: idempotencyKey,
      idempotency_key: idempotencyKey, status: "pending",
    }).select("id,status,section,slug,language,block_index,speaker,created_at").maybeSingle();
    if (insertError && insertError.code !== "23505") return reply(500, { error: "تعذر إضافة المقطع إلى طابور التوليد.", detail: insertError.message });
    if (!inserted) {
      const { data: existing, error: existingError } = await service.from("story_audio_generation_queue")
        .select("id,status,section,slug,language,block_index,speaker,created_at")
        .eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existingError || !existing) return reply(500, { error: "تعذر استرجاع طلب التوليد الموجود." });
      return reply(200, { success: true, already_queued: true, job: existing });
    }
    return reply(200, { success: true, queued: true, job: inserted });
  }

  if (body.action === "queue_status") {
    const { data, error } = await service.from("story_audio_generation_queue")
      .select("id,language,block_index,speaker,status,attempts,last_error,result,created_at,updated_at,completed_at,payload")
      .eq("section", section).eq("slug", slug).order("created_at", { ascending: false }).limit(100);
    if (error) return reply(500, { error: "تعذر قراءة حالة طابور الحكاية.", detail: error.message });
    let jobs: any[] = data ?? [];
    const queueSnap = storyFromSnapshot(body.story_snapshot, section, slug);
    if (queueSnap) {
      const kept: any[] = [];
      for (const job of jobs) {
        const block = queueSnap.i18n?.[job.language]?.blocks?.[job.block_index];
        if (!isSpeakableBlock(block) || block.speaker !== job.speaker) continue;
        if (job.payload?.source_text_hash !== await sha256Hex(new TextEncoder().encode(block.text.trim()))) continue;
        kept.push(job);
      }
      jobs = kept;
    }
    return reply(200, { success: true, jobs: jobs.map(({ payload: _payload, ...rest }: any) => rest) });
  }

  if (body.action === "publish_audio") {
    const { data: reviewRow, error: reviewError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (reviewError) return reply(500, { error: "تعذر قراءة قرارات مراجعة الصوت.", detail: reviewError.message });
    const audioReview = reviewRow?.audio_review ?? {};
    const published = [];
    for (const lang of ["ar", "en"]) {
      let source;
      try { source = await resolveStoryBlock(section, slug, lang, 0, body.story_snapshot); }
      catch (error) { return reply(400, { error: error instanceof Error ? error.message : "تعذر قراءة الحكاية قبل نشر الصوت." }); }
      const blocks = source.story?.i18n?.[lang]?.blocks;
      if (!Array.isArray(blocks) || !blocks.length) return reply(409, { error: "الحكاية لا تحتوي مقاطع صالحة باللغة " + lang + "." });
      const prefix = section + "/" + slug + "/" + lang;
      const { data: manifestFile, error: manifestError } = await service.storage.from(BUCKET).download(prefix + "/manifest.json");
      if (manifestError || !manifestFile) return reply(409, { error: "لا توجد حزمة صوت خاصة مكتملة باللغة " + lang + "." });
      let manifest: any;
      try { manifest = JSON.parse(await manifestFile.text()); }
      catch { return reply(422, { error: "ملف manifest غير صالح باللغة " + lang + "." }); }
      if (manifest?.version !== 1 || manifest.section !== section || manifest.story !== slug ||
          manifest.language !== lang || !Array.isArray(manifest.segments) || manifest.segments.length !== blocks.length) {
        return reply(409, { error: "حزمة الصوت لا تغطي جميع مقاطع الحكاية باللغة " + lang + "." });
      }
      const seen = new Set<number>();
      for (const segment of manifest.segments) {
        const index = Number(segment?.block_index);
        const block = Number.isInteger(index) ? blocks[index] : null;
        if (!block || seen.has(index) || segment.speaker !== block.speaker ||
            segment.provider !== "omnivoice" || segment.model !== "VoiceTut Egyptian Tashkeel" ||
            segment.voice !== (block.speaker === "karma" ? "omnivoice-karma-reference" : "omnivoice-narrator-reference") ||
            typeof segment.src !== "string" || !/^[A-Za-z0-9_-]+\.mp3$/.test(segment.src) ||
            !/^[a-f0-9]{64}$/i.test(String(segment.audio_sha256 ?? ""))) {
          return reply(422, { error: "أحد مقاطع الصوت لا يطابق عقد VoiceTut أو نص الحكاية باللغة " + lang + "." });
        }
        const savedClip = Object.values(audioReview?.clips ?? {}).find((clip: any) =>
          clip?.lang === lang && Number(clip.block_index) === index && clip?.status === "accepted" &&
          String(clip.audio_sha256 ?? "").toLowerCase() === String(segment.audio_sha256).toLowerCase());
        if (!savedClip) return reply(409, { error: "لم تعتمد كل المقاطع الصوتية أو تغير ملف أحدها باللغة " + lang + "." });
        const expectedText = lang === "ar"
          ? audioReview?.speech_texts?.["ar:" + index]?.approved_text
          : block.text;
        if (typeof expectedText !== "string" || expectedText.trim() !== String(segment.text ?? "").trim()) {
          return reply(409, { error: "نص المقطع الصوتي لا يطابق النص المعتمد باللغة " + lang + "." });
        }
        seen.add(index);
      }
      if (seen.size !== blocks.length) return reply(409, { error: "هناك مقاطع مفقودة من حزمة الصوت باللغة " + lang + "." });
      for (const segment of manifest.segments) {
        const path = prefix + "/" + segment.src;
        const { data: audioFile, error: audioError } = await service.storage.from(BUCKET).download(path);
        if (audioError || !audioFile) return reply(500, { error: "تعذر قراءة ملف صوت معتمد للنشر.", file: segment.src });
        const bytes = new Uint8Array(await audioFile.arrayBuffer());
        if (await sha256Hex(bytes) !== String(segment.audio_sha256).toLowerCase()) {
          return reply(422, { error: "بصمة ملف الصوت لا تطابق manifest قبل النشر.", file: segment.src });
        }
        const { error: uploadError } = await service.storage.from(PUBLIC_AUDIO_BUCKET).upload(path, bytes, {
          contentType: "audio/mpeg", upsert: true, cacheControl: "31536000",
        });
        if (uploadError) return reply(500, { error: "تعذر نشر ملف صوت معتمد.", file: segment.src, detail: uploadError.message });
      }
      const publicManifest = {
        version: 1, section, story: slug, language: lang, provider: "omnivoice",
        model: "VoiceTut Egyptian Tashkeel", published_at: new Date().toISOString(),
        segments: manifest.segments,
      };
      const { error: publicManifestError } = await service.storage.from(PUBLIC_AUDIO_BUCKET).upload(
        prefix + "/manifest.json", new TextEncoder().encode(JSON.stringify(publicManifest)),
        { contentType: "application/json", upsert: true, cacheControl: "60" },
      );
      if (publicManifestError) return reply(500, { error: "تعذر نشر manifest الصوت العام.", language: lang, detail: publicManifestError.message });
      published.push({ language: lang, segments: manifest.segments.length });
    }
    return reply(200, { success: true, published: true, section, slug, languages: published });
  }

  if (body.action === "prepare_speech_text") {
    if (language !== "ar") return reply(400, { error: "تجهيز النص الصوتي متاح حاليًا للمقاطع العربية فقط." });
    if (!GEMINI_API_KEY) return reply(503, { error: "مفتاح Gemini غير متاح في أسرار دالة Supabase؛ لم يُرسل أي نص." });
    let source;
    try { source = await resolveStoryBlock(section, slug, "ar", Number(body.block_index), body.story_snapshot); }
    catch (error) { return reply(400, { error: error instanceof Error ? error.message : "تعذر تحديد المقطع." }); }
    const index = Number(body.block_index);
    const { data: progressRow, error: progressError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (progressError) return reply(500, { error: "تعذر قراءة ترتيب مراجعة المقاطع.", detail: progressError.message });
    const accepted = acceptedBlockIndexes(progressRow?.audio_review, "ar");
    const ordered = orderedStoryBlockIndexes(source.story.i18n.ar.blocks);
    const targetPosition = ordered.indexOf(index);
    if (targetPosition < 0 || accepted.has(index) || ordered.slice(0, targetPosition).some((prior) => !accepted.has(prior))) {
      return reply(409, { error: "هذا المقطع لم يحن دوره بعد؛ أكمل اعتماد المقاطع بترتيب الحكاية." });
    }
    const rejectedNotes = Object.values(progressRow?.audio_review?.clips ?? {})
      .filter((clip: any) => section === "history" && slug === "ibn-sina" && index === 4 &&
        clip?.lang === "ar" && Number(clip.block_index) === index &&
        clip?.status === "rejected" && clip?.issue !== "audio_only" && typeof clip?.note === "string" && clip.note.trim())
      .map((clip: any) => clip.note.trim()).slice(0, 5);
    const previous = index > 0 ? source.story.i18n.ar.blocks[index - 1] : null;
    const next = index + 1 < source.story.i18n.ar.blocks.length ? source.story.i18n.ar.blocks[index + 1] : null;
    const speakerName = source.block.speaker === "karma" ? "كارما" : "الراوي";
    const prompt = [
      ...(rejectedNotes.length ? [
        "ملاحظات الرفض المسجلة من صاحب المشروع على نسخة الصوت السابقة لهذا المقطع — عالجها صراحةً في نص القراءة، ولا تتجاهلها:",
        ...rejectedNotes.map((note: string, i: number) => (i + 1) + ") " + note),
        "هذه الملاحظات توجيهات تحريرية ملزمة لهذا الاقتراح. لا تغيّر أي حقيقة تاريخية ولا تضف معلومة جديدة."
      ] : []),
      "جهّز نص قراءة صوتية منفصلًا للمقطع التالي من الحكاية.",
      "المتحدث: " + speakerName + ".",
      "قواعد ثابتة: عامية مصرية طبيعية غير صعيدية، لا فصحى مذيعين ولا مبالغة في العامية.",
      source.block.speaker === "karma"
        ? [
            "هوية كارما الصوتية والشخصية ثابتة في كل الحكايات، وليست شخصية يعاد اختراعها من مقطع لآخر:",
            "كارما بنت مصرية عمرها 12 سنة، ذكية وفضولية وخفيفة الظل بطبيعتها. تتحدث إلى صديق أو شخص قريب منها، لا إلى جمهور في برنامج.",
            "صوتها في النص يجب أن يوحي بطفلة حقيقية في سنها: عفوي، حي، واضح، ودود، واثق ببساطة، وفيه فضول وانفعال إنساني خفيف. لا تجعليها تبدو امرأة بالغة أو مذيعة أو معلمة أو ممثلة تؤدي دور طفلة.",
            "اللهجة مصرية بيضاء طبيعية ومفهومة في القاهرة والإسكندرية. ابتعدي عن الفصحى الإذاعية، واللهجة الصعيدية، والتعبيرات السوقية، والمبالغة أو التصنع في العامية.",
            "استخدمي جملًا قصيرة ومتوسطة سهلة النطق، وتنوعًا طبيعيًا في بدايات الجمل ونهاياتها. لا تكرري لازمة واحدة، ولا تفرطي في كلمات مثل: يعني، بص، بجد، تخيلوا.",
            "الإيقاع متوازن من أول الجملة إلى آخرها. لا تضغطي آخر أربع أو خمس كلمات، ولا تختصري نهاية الجملة أو تحذفيها. اتركي للنهاية مساحة لغوية طبيعية وعلامة ترقيم واضحة.",
            "المشاعر تتبع معنى الموقف: دهشة عند الدهشة، حماس عند الاكتشاف، وهدوء عند المعلومة الجادة؛ من غير صراخ أو دلع أو تمثيل مبالغ فيه.",
            "لا تختلقي معلومة أو حدثًا أو حوارًا أو تجربة شخصية. لا تقولي إن كارما زارت مكانًا أو قابلت شخصًا. عند الحاجة قولي بصورة طبيعية: سمعت عن... أو تعالوا نعرف... دون ادعاء تجربة لم تحدث.",
            "حافظي على شخصية كارما نفسها في كل المقاطع: نفس العمر، والقرب، والعفوية، والذكاء، ودرجة الحماس المعتدلة. لا تتحولي إلى راوٍ تاريخي أو صوت وثائقي.",
          ].join(" ")
        : "الراوي: أداء لغوي دافئ وهادئ وواثق، بصياغة مصرية مسموعة ورصينة دون تكلف.",
      "قبل إعادة الصياغة، حلّل المقطع كاملًا وسياقه السابق واللاحق: حدّد موضوع الكلام، ومن المقصود بكل اسم أو ضمير، والعلاقات بين الكلمات، والمعنى المقصود لكل لفظ يحتمل أكثر من قراءة. لا تتعامل مع الكلمات منفصلة عن الجملة.",
      "تمييز المعنى والنطق إلزامي: اختر نطق الكلمة من سياق الجملة لا من شكلها وحده. مثال: (عالِم) بمعنى شخص صاحب علم، و(عالَم) بمعنى الدنيا أو الكون؛ لا تخلط بينهما. راجع الحركات المؤثرة في المعنى، خصوصًا اللام والحروف المتشابهة، واستخدم التشكيل الجزئي عند الحاجة فقط لتوجيه النطق الصحيح دون إثقال النص.",
      "إذا احتمل لفظٌ أكثر من معنى ولم يحسمه السياق، لا تخمّن ولا تغيّر المعلومة؛ أعد صياغة الجملة بأقل تغيير يزيل الالتباس، أو سجّل المسألة بوضوح في pronunciation_notes وreview_flags ليحسمها صاحب المشروع.",
      "تعامل مع نفسك كمحرر لغوي ومخرج أداء صوتي معًا: افهم المعنى أولًا، ثم اكتب جملة مصرية طبيعية واضحة، ثم راجعها ذهنيًا كما ستُنطق بصوت مسموع. لا تكتفِ باستبدال كلمات بالفصحى بمقابلات عامية.",
      "حافظ على كل الحقائق والأسماء والتواريخ والأرقام والعلاقات وتسلسل الأحداث والمعنى. ممنوع الإضافة أو الحذف أو التلخيص أو اختراع حوار.",
      "هدف الإلقاء أبطأ بوضوح من النسخة السابقة: أداء هادئ ومتمهّل ومريح للاستماع، لا قراءة سريعة ولا أسلوب إعلان أو تعليق رياضي. اجعل كل جملة تأخذ زمنها الطبيعي، مع وقفات قصيرة مفهومة بين الأفكار، ووقفة أوضح عند الانتقال إلى فكرة جديدة.",
      "اكتب الجمل في وحدات نطق قصيرة إلى متوسطة، وتجنب تراكم أكثر من فكرة في نفس النفس. لا تكدّس عدة كلمات ثقيلة أو أسماء متتابعة في نهاية الجملة. حافظ على توازن طول الجملة، ولا تجعل آخر 4 إلى 6 كلمات أسرع أو أكثر ازدحامًا من بدايتها.",
      "ضع علامات ترقيم عربية في مواضع الوقف الدلالي والتنفس الطبيعي، لا لمجرد الزينة. استخدم الفاصلة عند استمرار الفكرة، والنقطة عند اكتمالها، ويمكن تقسيم الجملة الطويلة إلى جملتين دون حذف أو إضافة أي معلومة.",
      "راجع نهاية كل جملة على حدة: يجب أن تُقال الكلمات الأخيرة بوضوح وبنفس التمهّل، مع عدم ابتلاع الحروف أو اختصار المقاطع الصوتية أو إسقاط آخر كلمة.",
      "حسّن كتابة الأسماء والمصطلحات والألفاظ التي قد يخطئ محرك الصوت في قراءتها. استخدم التشكيل الجزئي للكلمة الملتبسة أو صياغة بديلة طبيعية إذا كان ذلك أوضح، ولا تضف تشكيلًا شاملًا للنص.",
      "لا تضف نقاطًا متتابعة أو فواصل مصطنعة أو مدودًا كتابية. المطلوب نص مصري سليم المعنى، واضح النطق، وإيقاعه أبطأ ومتزن من البداية إلى آخر كلمة.",
      "أعد JSON فقط بالحقول: speech_text, changes_summary, pronunciation_notes, review_flags.",
      "السياق السابق (للفهم فقط، لا تعِد صياغته): " + (previous?.text ?? "لا يوجد"),
      "السياق التالي (للفهم فقط، لا تعِد صياغته): " + (next?.text ?? "لا يوجد"),
      "النص الأصلي المطلوب تجهيزه فقط:\n" + source.sourceText,
    ].join("\n\n");
    const totalDeadlineMs = 78000;
    const perAttemptTimeoutMs = 22000;
    const startedAt = Date.now();
    const deadlineAt = startedAt + totalDeadlineMs;
    let geminiResponse: Response | null = null;
    let geminiResponseText = "";
    let successfulModel = "";
    let lastFailure = { status: 0, message: "", model: "", attempt: 0 };
    const attemptTrace: string[] = [];
    const geminiModels = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.6-flash"];
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: "أنت محرر لغوي ومخرج أداء صوتي متخصص في الحكايات التعليمية المصرية. لا تنفّذ استبدالًا آليًا للفصحى بالعامية: افهم المعنى والسياق الكامل أولًا، وميّز الكلمات المتشابهة بحسب معناها داخل الجملة، ثم اضبط كتابتها ونطقها بالتشكيل الجزئي أو بإعادة صياغة طبيعية عند الحاجة. مثال لازم للفهم: (عالِم) شخص صاحب علم، و(عالَم) الدنيا أو الكون؛ السياق هو الذي يحسم، وليس شكل الكلمة منفردًا. مهمتك تجهيز نص القراءة فقط، لا توليد الصوت ولا اعتماد النص نيابة عن صاحب المشروع. لا تغيّر الحقائق أو الأسماء أو الأرقام أو ترتيب الأحداث. اجعل الأداء المستهدف هادئًا ومتمهلًا بوضوح، أبطأ من القراءة الحوارية العادية، مع وحدات نطق قصيرة ومتوسطة ووقفات دلالية طبيعية، ومن دون ضغط أو ابتلاع آخر الكلمات. راجع نهاية كل جملة خصوصًا حتى تُنطق كاملة وبنفس الهدوء. عند تحرير مقاطع كارما، حافظ حرفيًا على هوية الشخصية الثابتة: طفلة مصرية عمرها 12 سنة، ذكية وفضولية وعفوية وودودة، تتحدث بعامية مصرية بيضاء طبيعية، لا كمذيعة أو معلمة أو امرأة بالغة أو طفلة متصنعة. يجب أن يظل أسلوبها واحدًا عبر جميع المقاطع والحكايات؛ لا تغيّر شخصيتها أو درجة نضجها أو طريقة مخاطبتها من مقطع لآخر. لا تختلق تجارب شخصية أو زيارات." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2200,
        thinkingConfig: { thinkingLevel: "MEDIUM" },
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            speech_text: { type: "STRING" },
            changes_summary: { type: "STRING" },
            pronunciation_notes: { type: "ARRAY", items: { type: "STRING" } },
            review_flags: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["speech_text", "changes_summary", "pronunciation_notes", "review_flags"],
        },
      },
    });
    const retryableStatuses = new Set([429, 500, 502, 503, 504]);
    let timedOut = false;
    let hadTimeout = false;
    for (let modelIndex = 0; modelIndex < geminiModels.length; modelIndex++) {
      const model = geminiModels[modelIndex];
      for (let attempt = 1; attempt <= 2; attempt++) {
        const remainingMs = deadlineAt - Date.now();
        const reserveForFallbackMs = (geminiModels.length - modelIndex - 1) * 16000;
        const availableMs = remainingMs - reserveForFallbackMs;
        if (availableMs < 1000) break;
        const attemptTimeoutMs = Math.min(perAttemptTimeoutMs, availableMs);
        const attemptController = new AbortController();
        const attemptTimeout = setTimeout(() => attemptController.abort(), attemptTimeoutMs);
        try {
          geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
            signal: attemptController.signal,
            body: requestBody,
          });
          geminiResponseText = await geminiResponse.text();
        } catch (requestError) {
          if (requestError instanceof Error && requestError.name === "AbortError") {
            timedOut = true;
            hadTimeout = true;
            lastFailure = { status: 0, message: "انتهت مهلة المحاولة قبل استجابة Gemini.", model, attempt };
            attemptTrace.push(model + " #" + attempt + ": TIMEOUT (" + attemptTimeoutMs + "ms)");
            console.error("gemini_timeout " + JSON.stringify(lastFailure));
            break;
          }
          lastFailure = {
            status: 0,
            message: requestError instanceof Error ? requestError.message.slice(0, 300) : String(requestError).slice(0, 300),
            model,
            attempt,
          };
          attemptTrace.push(model + " #" + attempt + ": NETWORK_ERROR");
          console.error("gemini_network_failure " + JSON.stringify(lastFailure));
          break;
        } finally {
          clearTimeout(attemptTimeout);
        }
        if (geminiResponse.ok) {
          successfulModel = model;
          break;
        }
        let failureMessage = geminiResponse.statusText || "Gemini returned an empty error.";
        try {
          const parsedFailure = JSON.parse(geminiResponseText);
          failureMessage = parsedFailure?.error?.message || parsedFailure?.message || failureMessage;
        } catch {
          failureMessage = geminiResponseText || failureMessage;
        }
        lastFailure = {
          status: geminiResponse.status,
          message: String(failureMessage).replace(/\s+/g, " ").slice(0, 300),
          model,
          attempt,
        };
        attemptTrace.push(model + " #" + attempt + ": HTTP " + geminiResponse.status);
        console.error("gemini_failure " + JSON.stringify(lastFailure));
        if (geminiResponse.status === 429 || !retryableStatuses.has(geminiResponse.status) || attempt === 2) break;
        const retryAfter = Number(geminiResponse.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 2500)
          : 800;
        if (deadlineAt - Date.now() - delayMs - reserveForFallbackMs < 1000) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (successfulModel) break;
      if (Date.now() >= deadlineAt) break;
      // Try the next model after quota exhaustion, service unavailability, or a timed-out request.
      if (timedOut || !geminiResponse || [429, 503].includes(geminiResponse.status) ||
          (lastFailure.status === 0 && lastFailure.model === model)) {
        timedOut = false;
        continue;
      }
      // Preserve the existing behavior for non-fallback HTTP failures.
      break;
    }
    if (!successfulModel) {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      return reply(hadTimeout || Date.now() >= deadlineAt ? 504 : 502, {
        error: hadTimeout || Date.now() >= deadlineAt
          ? "لم يستجب Gemini ضمن المهلة المحددة؛ لم يتم حفظ أو اعتماد أي نص. أعد المحاولة."
          : "تعذر الحصول على اقتراح صالح من Gemini؛ لم يتم حفظ أو اعتماد أي نص.",
        elapsed_seconds: elapsedSeconds,
        last_upstream_failure: lastFailure.status || lastFailure.message ? lastFailure : undefined,
        attempt_trace: attemptTrace,
      });
    }
    if (!geminiResponse) {
      return reply(502, { error: "لم تصل استجابة من Gemini؛ لم يتم حفظ أو اعتماد أي نص.", attempt_trace: attemptTrace });
    }
    if (!geminiResponse.ok) {
      return reply(502, {
        error: "تعذر الحصول على اقتراح من Gemini بعد إعادة المحاولة.",
        upstream_status: lastFailure.status || geminiResponse.status,
        upstream_message: lastFailure.message || "Gemini لم يُرجع تفاصيل خطأ قابلة للقراءة.",
        upstream_model: lastFailure.model || "unknown",
        upstream_attempt: lastFailure.attempt || 0,
        attempt_trace: attemptTrace,
      });
    }
    const geminiData = JSON.parse(geminiResponseText);
    const candidateText = (geminiData?.candidates?.[0]?.content?.parts ?? [])
      .map((part: any) => typeof part.text === "string" ? part.text : "").join("").trim();
    let proposal: any;
    try { proposal = JSON.parse(candidateText); }
    catch { return reply(502, { error: "أعاد Gemini نتيجة لا تطابق صيغة JSON المطلوبة؛ لم يتم حفظها." }); }
    if (typeof proposal.speech_text !== "string" || !proposal.speech_text.trim() ||
        proposal.speech_text.length > 6000 ||
        typeof proposal.changes_summary !== "string" ||
        !Array.isArray(proposal.pronunciation_notes) || !Array.isArray(proposal.review_flags)) {
      return reply(502, { error: "اقتراح Gemini ناقص أو غير صالح؛ لم يتم حفظه." });
    }
    return reply(200, {
      success: true, language: "ar", block_index: index, speaker: source.block.speaker,
      source_text: source.sourceText, source_text_hash: source.sourceTextHash,
      speech_text: proposal.speech_text.trim(),
      changes_summary: proposal.changes_summary,
      pronunciation_notes: proposal.pronunciation_notes.filter((item: any) => typeof item === "string").slice(0, 20),
      review_flags: proposal.review_flags.filter((item: any) => typeof item === "string").slice(0, 20),
      model: successfulModel,
    });
  }

  if (body.action === "speech_text_save") {
    if (language !== "ar") return reply(400, { error: "حفظ نص القراءة الصوتية متاح حاليًا للمقاطع العربية فقط." });
    const index = Number(body.block_index);
    const decision = body.decision;
    const speechText = String(body.speech_text ?? "").trim();
    if (!Number.isInteger(index) || index < 0 ||
        !["suggested", "approved"].includes(decision) || !speechText || speechText.length > 6000 ||
        typeof body.source_text_hash !== "string" || !/^[a-f0-9]{64}$/i.test(body.source_text_hash)) {
      return reply(400, { error: "بيانات نص القراءة أو قرار اعتماده غير صالحة." });
    }
    let source;
    try { source = await resolveStoryBlock(section, slug, "ar", index, body.story_snapshot); }
    catch (error) { return reply(400, { error: error instanceof Error ? error.message : "تعذر التحقق من النص الأصلي." }); }
    if (source.sourceTextHash !== body.source_text_hash.toLowerCase()) {
      return reply(409, { error: "تغير النص الأصلي للحكاية؛ أعد تجهيز نص القراءة قبل اعتماده." });
    }
    const { data: progressRow, error: progressError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (progressError) return reply(500, { error: "تعذر قراءة ترتيب اعتماد المقاطع.", detail: progressError.message });
    const accepted = acceptedBlockIndexes(progressRow?.audio_review, "ar");
    const ordered = orderedStoryBlockIndexes(source.story.i18n.ar.blocks);
    const targetPosition = ordered.indexOf(index);
    if (targetPosition < 0 || accepted.has(index) || ordered.slice(0, targetPosition).some((prior) => !accepted.has(prior))) {
      return reply(409, { error: "لا يمكن اعتماد نص مقطع خارج دوره؛ الترتيب هو ترتيب مقاطع الحكاية." });
    }
    const { data: existing, error: readError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (readError) return reply(500, { error: "تعذر تحميل سجل نص القراءة.", detail: readError.message });
    const current = existing?.audio_review && typeof existing.audio_review === "object"
      ? existing.audio_review : { version: 1, regen: {}, clips: {}, audio_hashes: {} };
    const speechTexts = current.speech_texts && typeof current.speech_texts === "object" ? current.speech_texts : {};
    const key = "ar:" + index;
    const old = speechTexts[key] && typeof speechTexts[key] === "object" ? speechTexts[key] : {};
    const invalidatesAudioDecision = decision === "suggested" || old.approved_text !== speechText;
    speechTexts[key] = decision === "approved"
      ? { ...old, language: "ar", block_index: index, speaker: source.block.speaker,
          source_text_hash: source.sourceTextHash, suggested_text: old.suggested_text || speechText,
          approved_text: speechText, status: "approved", approved_at: new Date().toISOString() }
      : { ...old, language: "ar", block_index: index, speaker: source.block.speaker,
          source_text_hash: source.sourceTextHash, suggested_text: speechText,
          approved_text: null, status: "suggested", model: String(body.model || "gemini-3.8-flash"),
          changes_summary: String(body.changes_summary || "").slice(0, 1200),
          pronunciation_notes: Array.isArray(body.pronunciation_notes) ? body.pronunciation_notes.filter((v: any) => typeof v === "string").slice(0, 20) : [],
          review_flags: Array.isArray(body.review_flags) ? body.review_flags.filter((v: any) => typeof v === "string").slice(0, 20) : [] };
    if (invalidatesAudioDecision && current.clips && typeof current.clips === "object") {
      for (const [clipKey, clip] of Object.entries(current.clips) as [string, any][]) {
        // Keep rejected records: they contain the admin's correction note and
        // the private old-file reference needed for post-acceptance cleanup.
        if (clip?.lang === "ar" && Number(clip.block_index) === index && clip?.status !== "rejected") {
          delete current.clips[clipKey];
        }
      }
    }
    current.speech_texts = speechTexts;
    try {
      if (section === "history" && slug === "ibn-sina" && index === 4) {
        await invalidatePublicClipAudio(service, section, slug, "ar", index);
      } else {
        await invalidatePublicStoryAudio(service, section, slug);
      }
    } catch (error) { return reply(500, { error: error instanceof Error ? error.message : "تعذر إلغاء نشر النسخة السابقة." }); }
    const { data: saved, error: saveError } = await service.from("story_audio_reviews")
      .upsert({ section, slug, audio_review: current }, { onConflict: "section,slug" })
      .select("audio_review").single();
    if (saveError) return reply(500, { error: "تعذر حفظ نص القراءة في سجل المراجعة.", detail: saveError.message });
    return reply(200, { success: true, speech_text: speechTexts[key] });
  }

  if (["generate", "generation_status", "stage"].includes(action)) {
    return reply(410, { error: "مسار التوليد القديم معطّل. استخدم طابور VoiceTut الدائم." });
  }

  if (body.action === "stage") {
    if (!GITHUB_TOKEN) return reply(503, { error: "سر GitHub الخاص بقراءة الـArtifacts غير متاح." });
    const artifactId = Number(body.artifact_id);
    const runId = Number(body.run_id);
    const expectedName = String(body.artifact_name ?? "");
    const canonicalName = section === "history" && slug === "ibn-sina" && language === "ar"
      ? "ibn-sina-arabic-audio-staging"
      : "khaledoon-" + section + "-" + slug + "-" + language + "-audio-staging";
    if (!Number.isSafeInteger(artifactId) || artifactId < 1 || !Number.isSafeInteger(runId) || runId < 1 ||
        expectedName !== canonicalName) {
      return reply(400, { error: "بيانات الـArtifact لا تطابق اسم الحكاية والقسم واللغة." });
    }
    const apiHeaders = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const metaResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${artifactId}`, { headers: apiHeaders });
    if (!metaResponse.ok) return reply(502, { error: "تعذر التحقق من GitHub Artifact.", upstream_status: metaResponse.status });
    const artifact = await metaResponse.json();
    if (artifact.expired || artifact.name !== expectedName || Number(artifact.workflow_run?.id) !== runId) {
      return reply(403, { error: "الـArtifact منتهي أو لا يطابق تشغيل التوليد المحدد." });
    }
    const isIbnSinaArabic = section === "history" && slug === "ibn-sina" && language === "ar";
    // The restart baseline is the newly generated, approved-text Arabic package
    // from run #42344425713. It may replace an older private manifest, but only
    // when the review page explicitly requests this exact pinned artifact.
    const isPinnedRestartBaseline = isIbnSinaArabic &&
      body.baseline_restore === true && !body.request_id &&
      artifactId === 13563200242 && runId === 42344425713;
    if (isIbnSinaArabic && body.request_id) {
      const requestId = String(body.request_id ?? "");
      const blockIndex = Number(body.block_index);
      if (!/^[a-f0-9-]{36}$/.test(requestId) || !Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex > 16) {
        return reply(400, { error: "لا يمكن استبدال حزمة ابن سينا دون هوية طلب التوليد ورقم المقطع." });
      }
      const runResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}`, { headers: apiHeaders });
      if (!runResponse.ok) return reply(502, { error: "تعذر التحقق من تشغيل التوليد قبل نقل الصوت.", upstream_status: runResponse.status });
      const runData = await runResponse.json();
      const expectedTitle = "ابن سينا audio " + requestId + " block " + blockIndex;
      if (runData.display_title !== expectedTitle || runData.status !== "completed" || runData.conclusion !== "success") {
        return reply(403, { error: "تشغيل التوليد لا يطابق طلب المقطع المحدد أو لم ينجح." });
      }
    } else if (isIbnSinaArabic && !isPinnedRestartBaseline) {
      return reply(403, { error: "تحميل الحزمة الأساسية مسموح فقط لحزمة إعادة التشغيل المرجعية المحددة." });
    }
    if (!body.request_id && !isPinnedRestartBaseline) {
      const existing = await service.storage.from(BUCKET).list(prefix, { limit: 100 });
      if (existing.error) return reply(500, { error: "تعذر فحص التخزين الخاص.", detail: existing.error.message });
      if (existing.data?.some((item: any) => item.name === "manifest.json")) {
        return reply(200, { success: true, already_staged: true, bucket: BUCKET, prefix });
      }
    }
    const zipResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${artifactId}/zip`, { headers: apiHeaders });
    if (!zipResponse.ok) return reply(502, { error: "تعذر تنزيل الـArtifact من GitHub.", upstream_status: zipResponse.status });
    const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer());
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) return reply(422, { error: "الـArtifact لا يحتوي manifest.json." });
    const manifest = JSON.parse(await manifestFile.async("string"));
    if (isIbnSinaArabic && body.request_id && Number(body.block_index) === 4) {
      const index = Number(body.block_index);
      const { data: reviewRow, error: reviewReadError } = await service.from("story_audio_reviews")
        .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
      if (reviewReadError) return reply(500, { error: "تعذر التحقق من نص القراءة المعتمد قبل حفظ الصوت.", detail: reviewReadError.message });
      const speechRecord = reviewRow?.audio_review?.speech_texts?.["ar:" + index];
      if (!speechRecord || speechRecord.status !== "approved" ||
          !Array.isArray(manifest.segments) || manifest.segments.length !== 1 ||
          manifest.segments[0]?.block_index !== index ||
          manifest.segments[0]?.text !== speechRecord.approved_text) {
        return reply(409, { error: "ملف NAMAA لا يطابق نص القراءة المعتمد لهذا المقطع؛ لم يُنقل إلى التخزين الخاص." });
      }
    }
    if (manifest.version !== 1 || manifest.section !== section || manifest.story !== slug || manifest.language !== language ||
        !Array.isArray(manifest.segments) || !manifest.segments.length || manifest.segments.length > 1000 ||
        (section === "history" && slug === "ibn-sina" && language === "ar" && ![1, 17].includes(manifest.segments.length))) {
      return reply(422, { error: "بيانات manifest لا تطابق الحكاية أو نطاق المقاطع المسموح." });
    }
    // The pinned restart artifact predates the corrected opening order.
    // Its first two audio files are valid but their block indices must follow
    // the corrected story sequence: Karma first, narrator second.
    if (isPinnedRestartBaseline) {
      const first = manifest.segments.find((segment: any) => segment.block_index === 0);
      const second = manifest.segments.find((segment: any) => segment.block_index === 1);
      if (!first || !second) return reply(422, { error: "حزمة البداية لا تحتوي المقطعين الأول والثاني المطلوبين لإصلاح الترتيب." });
      first.block_index = 1;
      second.block_index = 0;
    }
    const seen = new Set<string>();
    for (const segment of manifest.segments) {
      const engineOk = segment?.provider === "omnivoice" &&
        segment?.model === "VoiceTut Egyptian Tashkeel" &&
        segment?.voice === (segment?.speaker === "karma"
          ? "omnivoice-karma-reference" : "omnivoice-narrator-reference");
      if (!segment || !["narrator", "karma"].includes(segment.speaker) || !engineOk ||
          !/^[A-Za-z0-9_-]+\.mp3$/.test(String(segment.src ?? "")) ||
          !/^[a-f0-9]{64}$/i.test(String(segment.audio_sha256 ?? "")) ||
          typeof segment.text !== "string" || !segment.text.trim() || seen.has(segment.src)) {
        return reply(422, { error: "أحد المقاطع لا يطابق عقد الصوت العربي أو بصمة الملف." });
      }
      seen.add(segment.src);
    }
    // Merge a single replacement segment into the existing package; never discard the other story segments.
    let priorSegmentsForMerge: any[] | null = null;
    // Never overwrite the rejected file in place: it must remain available until
    // the replacement has been listened to and explicitly accepted.
    if (isIbnSinaArabic && body.request_id && Number(body.block_index) === 4) {
      const index = Number(body.block_index);
      const { data: oldReviewRow, error: oldReviewError } = await service.from("story_audio_reviews")
        .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
      if (oldReviewError) return reply(500, { error: "تعذر فحص ملف الصوت المرفوض قبل الاستبداله.", detail: oldReviewError.message });
      const oldSources = Object.values(oldReviewRow?.audio_review?.clips ?? {})
        .filter((clip: any) => clip?.lang === language && Number(clip.block_index) === index &&
          clip?.status === "rejected" && typeof clip?.src === "string" && clip.src)
        .map((clip: any) => clip.src);
      if (manifest.segments.some((segment: any) => oldSources.includes(segment.src))) {
        return reply(409, { error: "اسم ملف الصوت الجديد يطابق الملف المرفوض. أُوقف الاستبدال حتى لا يُمحى الصوت القديم قبل اعتماد البديل؛ يلزم Artifact باسم ملف جديد." });
      }
      const oldManifestResult = await service.storage.from(BUCKET).download(prefix + "/manifest.json");
      if (oldManifestResult.error || !oldManifestResult.data) {
        return reply(409, { error: "لا يمكن ضمان الاحتفاظ بالصوت القديم: تعذر قراءة manifest السابق قبل الاستبدال." });
      }
      let oldManifest: any;
      try { oldManifest = JSON.parse(await oldManifestResult.data.text()); }
      catch { return reply(422, { error: "manifest السابق غير صالح؛ أُوقف الاستبدال حفاظًا على الصوت القديم." }); }
      const newSegment = manifest.segments.find((segment: any) => Number(segment.block_index) === index);
      const oldSegment = (oldManifest.segments ?? []).find((segment: any) =>
        Number(segment.block_index) === index && Number(segment.chunk_index || 0) === Number(newSegment?.chunk_index || 0));
      priorSegmentsForMerge = (oldManifest.segments ?? []).filter((segment: any) =>
        !(Number(segment.block_index) === index && Number(segment.chunk_index || 0) === Number(newSegment?.chunk_index || 0)));
      if (!newSegment || !oldSegment || !oldSegment.src || !oldSegment.audio_sha256 ||
          oldSegment.src === newSegment.src) {
        return reply(409, { error: "تعذر تحديد ملف قديم وملف بديل مختلفين للمقطع؛ لم يتم استبدال أي ملف." });
      }
      const oldFileResult = await service.storage.from(BUCKET).download(prefix + "/" + oldSegment.src);
      if (oldFileResult.error || !oldFileResult.data) {
        return reply(409, { error: "ملف الصوت القديم غير موجود في التخزين الخاص؛ أُوقف الاستبدال." });
      }
      const oldFileBytes = new Uint8Array(await oldFileResult.data.arrayBuffer());
      if (await sha256Hex(oldFileBytes) !== String(oldSegment.audio_sha256).toLowerCase()) {
        return reply(422, { error: "بصمة الصوت القديم لا تطابق manifest؛ أُوقف الاستبدال حفاظًا على النسخة القديمة." });
      }
      const currentReview = oldReviewRow?.audio_review && typeof oldReviewRow.audio_review === "object"
        ? oldReviewRow.audio_review : null;
      if (!currentReview || !currentReview.clips || typeof currentReview.clips !== "object") {
        return reply(409, { error: "لا يوجد قرار رفض محفوظ للمقطع؛ أُوقف الاستبدال." });
      }
      let matchedRejected = false;
      for (const clip of Object.values(currentReview.clips) as any[]) {
        if (clip?.lang === language && Number(clip.block_index) === index &&
            Number(clip.chunk_index || 0) === Number(oldSegment.chunk_index || 0) && clip.status === "rejected") {
          clip.src = oldSegment.src;
          clip.replacement_cleanup = {
            status: "pending", old_src: oldSegment.src,
            old_sha256: String(oldSegment.audio_sha256).toLowerCase(),
            new_src: newSegment.src,
            new_sha256: String(newSegment.audio_sha256).toLowerCase(),
            language, block_index: index, chunk_index: Number(oldSegment.chunk_index || 0),
          };
          matchedRejected = true;
        }
      }
      if (!matchedRejected) return reply(409, { error: "المقطع لم يُسجل كمرفوض؛ لم يتم استبدال الصوت." });
      const { error: saveCleanupError } = await service.from("story_audio_reviews").upsert(
        { section, slug, audio_review: currentReview }, { onConflict: "section,slug" });
      if (saveCleanupError) return reply(500, { error: "تعذر حفظ مرجع الصوت القديم قبل الاستبدال.", detail: saveCleanupError.message });
    }
    if (priorSegmentsForMerge) {
      manifest.segments = [...priorSegmentsForMerge, ...manifest.segments]
        .sort((a: any, b: any) => Number(a.block_index) - Number(b.block_index) ||
          Number(a.chunk_index || 0) - Number(b.chunk_index || 0));
    }
    const uploaded: string[] = [];
    for (const segment of manifest.segments) {
      const file = zip.file(segment.src);
      const path = prefix + "/" + segment.src;
      if (!file) {
        const { data: existingFile, error: existingFileError } = await service.storage.from(BUCKET).download(path);
        if (existingFileError || !existingFile) return reply(422, { error: "ملف صوت محفوظ سابقًا مفقود أثناء دمج المقطع: " + segment.src });
        const existingBytes = new Uint8Array(await existingFile.arrayBuffer());
        if (await sha256Hex(existingBytes) !== String(segment.audio_sha256).toLowerCase()) {
          return reply(422, { error: "بصمة ملف صوت محفوظ سابقًا لا تطابق manifest أثناء الدمج: " + segment.src });
        }
        uploaded.push(path);
        continue;
      }
      const bytes = new Uint8Array(await file.async("uint8array"));
      if (await sha256Hex(bytes) !== String(segment.audio_sha256).toLowerCase()) {
        return reply(422, { error: "بصمة MP3 لا تطابق manifest: " + segment.src });
      }
      const { error } = await service.storage.from(BUCKET).upload(path, bytes, {
        contentType: "audio/mpeg", upsert: true, cacheControl: "60",
      });
      if (error) return reply(500, { error: "تعذر حفظ ملف صوتي في التخزين الخاص.", file: segment.src, detail: error.message });
      uploaded.push(path);
    }
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    const manifestUpload = await service.storage.from(BUCKET).upload(prefix + "/manifest.json", manifestBytes, {
      contentType: "application/json", upsert: true, cacheControl: "60",
    });
    if (manifestUpload.error) return reply(500, { error: "تعذر حفظ manifest في التخزين الخاص.", detail: manifestUpload.error.message });
    return reply(200, { success: true, staged: true, bucket: BUCKET, prefix, segments: uploaded.length });
  }

  if (body.action === "cleanup_replaced_audio") {
    const clipKey = String(body.clip_key ?? "");
    if (!clipKey || clipKey.length > 256) return reply(400, { error: "مفتاح المقطع غير صالح." });
    const { data: reviewRow, error: reviewError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (reviewError) return reply(500, { error: "تعذر قراءة سجل المراجعة قبل تنظيف الصوت القديم.", detail: reviewError.message });
    const audioReview = reviewRow?.audio_review;
    const acceptedClip = audioReview?.clips?.[clipKey];
    if (!acceptedClip || acceptedClip.status !== "accepted" || !["ar", "en"].includes(acceptedClip.lang)) {
      return reply(409, { error: "لا يمكن حذف الصوت القديم قبل قبول المقطع البديل." });
    }
    const oldClip = Object.values(audioReview.clips ?? {}).find((clip: any) =>
      clip?.status === "rejected" && clip?.lang === acceptedClip.lang &&
      Number(clip.block_index) === Number(acceptedClip.block_index) &&
      Number(clip.chunk_index || 0) === Number(acceptedClip.chunk_index || 0) &&
      clip?.replacement_cleanup?.status === "pending");
    if (!oldClip) return reply(200, { success: true, cleaned: false, already_clean: true });
    const cleanup = (oldClip as any).replacement_cleanup;
    const langPrefix = section + "/" + slug + "/" + acceptedClip.lang;
    if (cleanup.language !== acceptedClip.lang ||
        Number(cleanup.block_index) !== Number(acceptedClip.block_index) ||
        Number(cleanup.chunk_index || 0) !== Number(acceptedClip.chunk_index || 0) ||
        cleanup.old_src === cleanup.new_src || acceptedClip.src !== cleanup.new_src ||
        String(acceptedClip.audio_sha256 ?? "").toLowerCase() !== cleanup.new_sha256 ||
        !/^[A-Za-z0-9_-]+\.mp3$/.test(String(cleanup.old_src)) ||
        !/^[A-Za-z0-9_-]+\.mp3$/.test(String(cleanup.new_src))) {
      return reply(409, { error: "بيانات استبدال الصوت لا تطابق المقطع المقبول؛ لم يُحذف الملف القديم." });
    }
    const { data: activeJobs, error: jobsError } = await service.from("story_audio_generation_queue")
      .select("id").eq("section", section).eq("slug", slug)
      .eq("language", acceptedClip.lang).eq("block_index", acceptedClip.block_index)
      .in("status", ["pending", "processing"]);
    if (jobsError) return reply(500, { error: "تعذر فحص طابور التوليد قبل الحذف.", detail: jobsError.message });
    if ((activeJobs ?? []).length) return reply(409, { error: "يوجد طلب توليد نشط للمقطع؛ لم يُحذف الصوت القديم." });
    const { data: manifestFile, error: manifestError } = await service.storage.from(BUCKET).download(langPrefix + "/manifest.json");
    if (manifestError || !manifestFile) return reply(409, { error: "لا يوجد manifest جديد يمكن التحقق منه؛ لم يُحذف الصوت القديم." });
    let manifest: any;
    try { manifest = JSON.parse(await manifestFile.text()); }
    catch { return reply(422, { error: "manifest الجديد غير صالح؛ لم يُحذف الصوت القديم." }); }
    const newSegment = (manifest.segments ?? []).find((segment: any) =>
      Number(segment.block_index) === Number(acceptedClip.block_index) &&
      Number(segment.chunk_index || 0) === Number(acceptedClip.chunk_index || 0) &&
      segment.src === cleanup.new_src &&
      String(segment.audio_sha256 ?? "").toLowerCase() === cleanup.new_sha256);
    if (!newSegment) return reply(409, { error: "manifest لا يشير إلى ملف الصوت البديل المقبول؛ لم يُحذف القديم." });
    const { data: newFile, error: newFileError } = await service.storage.from(BUCKET).download(langPrefix + "/" + cleanup.new_src);
    if (newFileError || !newFile) return reply(409, { error: "ملف الصوت البديل غير موجود؛ لم يُحذف القديم." });
    const newBytes = new Uint8Array(await newFile.arrayBuffer());
    if (await sha256Hex(newBytes) !== cleanup.new_sha256) return reply(422, { error: "بصمة الصوت البديل غير مطابقة؛ لم يُحذف القديم." });
    const oldPath = langPrefix + "/" + cleanup.old_src;
    const { data: oldFile, error: oldFileError } = await service.storage.from(BUCKET).download(oldPath);
    if (oldFileError || !oldFile) {
      return reply(200, { success: true, cleaned: true, already_missing: true, old_file_missing: true, new_file_verified: true });
    }
    const oldBytes = new Uint8Array(await oldFile.arrayBuffer());
    if (await sha256Hex(oldBytes) !== cleanup.old_sha256) {
      return reply(409, { error: "ملف الصوت القديم تغيرت بصمته؛ لم يُحذف حفاظًا على سلامة التخزين." });
    }
    const { error: removeError } = await service.storage.from(BUCKET).remove([oldPath]);
    if (removeError) return reply(500, { error: "تعذر حذف ملف الصوت القديم؛ سيظل محفوظًا.", detail: removeError.message });
    const { data: oldAfter, error: oldCheckError } = await service.storage.from(BUCKET).download(oldPath);
    if (!oldCheckError && oldAfter) return reply(500, { error: "لم يؤكد التخزين اختفاء ملف الصوت القديم بعد الحذف." });
    (oldClip as any).replacement_cleanup = { ...cleanup, status: "complete", completed_at: new Date().toISOString() };
    const { error: saveStateError } = await service.from("story_audio_reviews").upsert(
      { section, slug, audio_review: audioReview }, { onConflict: "section,slug" });
    if (saveStateError) return reply(500, { error: "تم حذف الملف القديم لكن تعذر تسجيل حالة التنظيف.", detail: saveStateError.message });
    return reply(200, { success: true, cleaned: true, old_file_missing: true, new_file_verified: true, completed_at: (oldClip as any).replacement_cleanup.completed_at });
  }

  if (body.action === "manifest") {
    const { data: manifestFile, error: downloadError } = await service.storage.from(BUCKET).download(prefix + "/manifest.json");
    if (downloadError || !manifestFile) return reply(404, { error: "لا توجد حزمة صوت مخزنة لهذه الحكاية واللغة." });
    const manifest = JSON.parse(await manifestFile.text());
    const signedSources: Record<string, string> = {};
    for (const segment of manifest.segments ?? []) {
      const { data, error } = await service.storage.from(BUCKET).createSignedUrl(prefix + "/" + segment.src, 3600);
      if (error || !data?.signedUrl) return reply(500, { error: "تعذر إنشاء رابط مؤقت لأحد المقاطع.", file: segment.src });
      signedSources[segment.src] = new URL(data.signedUrl, SUPABASE_URL + "/storage/v1/").href;
    }
    return reply(200, { success: true, manifest, signed_sources: signedSources, expires_in: 3600 });
  }

  return reply(400, { error: "إجراء غير معروف." });
});