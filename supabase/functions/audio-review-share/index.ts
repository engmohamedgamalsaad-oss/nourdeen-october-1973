// audio-review-share
// Issues a short-lived, single-file signed link to ONE private review clip so a reviewer outside the
// admin's browser can fetch the real MP3. Admin-only. The bucket stays private. Nothing is generated,
// published, queued or modified here: read, verify the file hash, sign, return.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { clampTtl, isExpectedClipPath, LANGUAGES, validKey } from "./clip.ts";

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
const BUCKET = "khaledoon-audio-review";
const ALLOWED_ORIGIN = "https://engmohamedgamalsaad-oss.github.io";
const headers = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers });

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const origin = req.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return reply(403, { error: "Origin not allowed" });
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return reply(500, { error: "Supabase function secrets are incomplete." });

  // Same admin gate as audio-review-assets.
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
  const blockIndex = Number(body?.block_index);
  if (!validKey(section) || !validKey(slug) || !(LANGUAGES as readonly string[]).includes(language) ||
      !Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex > 999) {
    return reply(400, { error: "هوية الحكاية أو اللغة أو رقم المقطع غير صالحة." });
  }
  const ttl = clampTtl(body?.ttl_seconds);

  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) The clip to review is the latest COMPLETED generation job for exactly this block.
  const { data: job, error: jobError } = await service.from("story_audio_generation_queue")
    .select("id,speaker,status,result,payload,completed_at")
    .eq("section", section).eq("slug", slug).eq("language", language).eq("block_index", blockIndex)
    .eq("status", "completed")
    .order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (jobError) return reply(500, { error: "تعذر قراءة سجل توليد المقطع." });
  if (!job) return reply(404, { error: "لا يوجد مقطع مكتمل لهذا الرقم بعد." });
  const result: any = job.result ?? {};
  if (!isExpectedClipPath(result.path, section, slug, language) || (result.bucket && result.bucket !== BUCKET)) {
    return reply(422, { error: "مسار الملف المسجل لهذا المقطع غير متوقع؛ لم يُنشأ أي رابط." });
  }

  // 2) The file must exist and match the recorded SHA-256 (so the reviewer hears the exact recorded clip).
  const { data: file, error: downloadError } = await service.storage.from(BUCKET).download(result.path);
  if (downloadError || !file) return reply(404, { error: "ملف الصوت غير موجود في التخزين الخاص." });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const actualSha = await sha256Hex(bytes);
  if (typeof result.sha256 === "string" && result.sha256 && result.sha256 !== actualSha) {
    return reply(409, { error: "بصمة الملف لا تطابق البصمة المسجلة؛ لم يُنشأ أي رابط." });
  }

  // 3) One object, short expiry. The bucket itself stays private.
  const { data: signed, error: signError } = await service.storage.from(BUCKET).createSignedUrl(result.path, ttl);
  if (signError || !signed?.signedUrl) return reply(500, { error: "تعذر إنشاء الرابط المؤقت." });
  const url = new URL(signed.signedUrl, SUPABASE_URL + "/storage/v1/").href;

  return reply(200, {
    success: true,
    url,
    expires_in: ttl,
    expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    clip: {
      job_id: job.id,
      section, slug, language,
      block_index: blockIndex,
      speaker: job.speaker,
      content_type: "audio/mpeg",
      bytes: bytes.length,
      sha256: actualSha,
      spoken_text: typeof job.payload?.text === "string" ? job.payload.text : null,
    },
  });
});
