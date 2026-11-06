import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import JSZip from "npm:jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_PUBLISH_TOKEN") ?? "";
const BUCKET = "khaledoon-audio-review";
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
  if (!validKey(section) || !validKey(slug) || !["ar", "en", "fr", "it", "de"].includes(language)) {
    return reply(400, { error: "هوية الحكاية أو اللغة غير صالحة." });
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const prefix = section + "/" + slug + "/" + language;

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
    const existing = await service.storage.from(BUCKET).list(prefix, { limit: 100 });
    if (existing.error) return reply(500, { error: "تعذر فحص التخزين الخاص.", detail: existing.error.message });
    if (existing.data?.some((item: any) => item.name === "manifest.json")) {
      return reply(200, { success: true, already_staged: true, bucket: BUCKET, prefix });
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
    const zipResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${artifactId}/zip`, { headers: apiHeaders });
    if (!zipResponse.ok) return reply(502, { error: "تعذر تنزيل الـArtifact من GitHub.", upstream_status: zipResponse.status });
    const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer());
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) return reply(422, { error: "الـArtifact لا يحتوي manifest.json." });
    const manifest = JSON.parse(await manifestFile.async("string"));
    if (manifest.version !== 1 || manifest.section !== section || manifest.story !== slug || manifest.language !== language ||
        !Array.isArray(manifest.segments) || !manifest.segments.length || manifest.segments.length > 1000 ||
        (section === "history" && slug === "ibn-sina" && language === "ar" && manifest.segments.length !== 17)) {
      return reply(422, { error: "بيانات manifest لا تطابق الحكاية أو نطاق المقاطع المسموح." });
    }
    const expectedVoices: Record<string, string> = {
      narrator: "a02a8220d6014812aa5ff73434c54cc0",
      karma: "592625f68416462f8b6161ddf5fdbffb",
    };
    const seen = new Set<string>();
    for (const segment of manifest.segments) {
      const engineOk = language === "ar"
        ? segment?.provider === "fish-audio" && segment?.model === "s2.1-pro-free" &&
          segment?.voice === expectedVoices[segment?.speaker]
        : segment?.provider === "edge-tts" && segment?.model === "edge-tts" &&
          typeof segment?.voice === "string" && !!segment.voice.trim();
      if (!segment || !["narrator", "karma"].includes(segment.speaker) || !engineOk ||
          !/^[A-Za-z0-9_-]+\.mp3$/.test(String(segment.src ?? "")) ||
          !/^[a-f0-9]{64}$/i.test(String(segment.audio_sha256 ?? "")) ||
          typeof segment.text !== "string" || !segment.text.trim() || seen.has(segment.src)) {
        return reply(422, { error: "أحد المقاطع لا يطابق عقد الصوت العربي أو بصمة الملف." });
      }
      seen.add(segment.src);
    }
    const uploaded: string[] = [];
    for (const segment of manifest.segments) {
      const file = zip.file(segment.src);
      if (!file) return reply(422, { error: "ملف MP3 مفقود من الـArtifact: " + segment.src });
      const bytes = new Uint8Array(await file.async("uint8array"));
      if (await sha256Hex(bytes) !== String(segment.audio_sha256).toLowerCase()) {
        return reply(422, { error: "بصمة MP3 لا تطابق manifest: " + segment.src });
      }
      const path = prefix + "/" + segment.src;
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

  if (body.action === "manifest") {
    const { data: manifestFile, error: downloadError } = await service.storage.from(BUCKET).download(prefix + "/manifest.json");
    if (downloadError || !manifestFile) return reply(404, { error: "لا توجد حزمة صوت مخزنة لهذه الحكاية واللغة." });
    const manifest = JSON.parse(await manifestFile.text());
    const signedSources: Record<string, string> = {};
    for (const segment of manifest.segments ?? []) {
      const { data, error } = await service.storage.from(BUCKET).createSignedUrl(prefix + "/" + segment.src, 14400);
      if (error || !data?.signedUrl) return reply(500, { error: "تعذر إنشاء رابط مؤقت لأحد المقاطع.", file: segment.src });
      signedSources[segment.src] = new URL(data.signedUrl, SUPABASE_URL + "/storage/v1/").href;
    }
    return reply(200, { success: true, manifest, signed_sources: signedSources, expires_in: 14400 });
  }

  return reply(400, { error: "إجراء غير معروف." });
});
