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
  const action = body?.action;
  const languageRequired = action === "stage" || action === "manifest" || action === "generate" || action === "generation_status";
  if (!validKey(section) || !validKey(slug) ||
      (languageRequired && !["ar", "en", "fr", "it", "de"].includes(language))) {
    return reply(400, { error: "هوية الحكاية أو اللغة غير صالحة." });
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const prefix = section + "/" + slug + "/" + language;

  if (body.action === "generate") {
    const storyId = String(body.story_id ?? "");
    const blockIndex = Number(body.block_index);
    if (!/^[0-9]{3}$/.test(storyId) || body.confirm_audio_request !== "yes" ||
        !Number.isInteger(blockIndex) || blockIndex < 0 ||
        (language === "ar" && body.confirm_fish_audio_request !== "yes")) {
      return reply(400, { error: "طلب التوليد يحتاج موافقة صريحة ومقطعًا واحدًا محددًا من الحكاية." });
    }
    if (!GITHUB_TOKEN) return reply(503, { error: "سر GitHub غير متاح لإطلاق التوليد من صفحة المراجعة." });
    const rawStoryUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/stories/${section}/${storyId}/story.json`;
    const storyResponse = await fetch(rawStoryUrl, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (!storyResponse.ok) return reply(404, { error: "تعذر العثور على حزمة الحكاية المنشورة في المسار المعتمد." });
    const storyPackage = await storyResponse.json();
    if (storyPackage?.format !== "KHALEDOON_STORY" || storyPackage.section !== section || storyPackage.slug !== slug) {
      return reply(403, { error: "معرّف الحكاية لا يطابق الحزمة المنشورة؛ تم إيقاف الطلب." });
    }
    const blocks = storyPackage?.i18n?.[language]?.blocks;
    if (!Array.isArray(blocks) || blockIndex >= blocks.length ||
        !["narrator", "karma"].includes(blocks[blockIndex]?.speaker) ||
        !String(blocks[blockIndex]?.text ?? "").trim()) {
      return reply(400, { error: "المقطع المحدد غير موجود أو غير قابل للتوليد في هذه اللغة." });
    }
    const requestId = crypto.randomUUID();
    const workflow = "story-audio-segment-staging.yml";
    const apiHeaders = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
    const dispatchResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/dispatches`, {
      method: "POST", headers: apiHeaders,
      body: JSON.stringify({
        ref: "main",
        inputs: {
          section, slug, story_path: `stories/${section}/${storyId}/story.json`,
          language, block_index: String(blockIndex),
          confirm_fish_audio_request: "yes", request_id,
        },
      }),
    });
    if (dispatchResponse.status !== 204) {
      const detail = await dispatchResponse.text();
      return reply(dispatchResponse.status === 403 ? 503 : 502, {
        error: dispatchResponse.status === 403
          ? "مفتاح GitHub لا يملك صلاحية Actions: write؛ لم يبدأ التوليد."
          : "فشل إطلاق Workflow من صفحة المراجعة.",
        upstream_status: dispatchResponse.status, detail: detail.slice(0, 500),
      });
    }
    return reply(200, { success: true, request_id: requestId, block_index: blockIndex, language, artifact_name: "khaledoon-" + section + "-" + slug + "-" + language + "-audio-staging" });
  }

  if (body.action === "generation_status") {
    const blockIndex = Number(body.block_index);
    const requestId = String(body.request_id ?? "");
    if (typeof body.story_id !== "string" || !/^[0-9]{3}$/.test(body.story_id) ||
        !/^[a-f0-9-]{36}$/.test(requestId) || !Number.isInteger(blockIndex) || blockIndex < 0) {
      return reply(400, { error: "بيانات متابعة طلب التوليد غير صالحة." });
    }
    if (!GITHUB_TOKEN) return reply(503, { error: "سر GitHub غير متاح لمتابعة التوليد." });
    const apiHeaders = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const workflow = "story-audio-segment-staging.yml";
    const runsResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=30`, { headers: apiHeaders });
    if (!runsResponse.ok) return reply(502, { error: "تعذر متابعة تشغيل التوليد.", upstream_status: runsResponse.status });
    const runsData = await runsResponse.json();
    const expectedTitle = "story audio " + requestId + " " + section + "/" + slug + " " + language + " block " + blockIndex;
    const run = (runsData.workflow_runs ?? []).find((item: any) => item.display_title === expectedTitle);
    if (!run) return reply(200, { success: true, status: "queued" });
    if (run.status !== "completed") return reply(200, { success: true, status: run.status || "in_progress", run_id: run.id });
    if (run.conclusion !== "success") {
      return reply(200, { success: true, status: "completed", conclusion: run.conclusion || "failure", run_id: run.id });
    }
    const artifactsResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts?per_page=100`, { headers: apiHeaders });
    if (!artifactsResponse.ok) return reply(502, { error: "انتهى التوليد لكن تعذر جلب بيانات ملف المراجعة.", upstream_status: artifactsResponse.status });
    const artifactsData = await artifactsResponse.json();
    const artifactName = "khaledoon-" + section + "-" + slug + "-" + language + "-audio-staging";
    const artifact = (artifactsData.artifacts ?? []).find((item: any) => item.name === artifactName && item.expired !== true);
    if (!artifact) return reply(422, { error: "انتهى Workflow بنجاح لكن لم يُعثر على Artifact الصوت." });
    return reply(200, {
      success: true, status: "completed", conclusion: "success",
      run_id: run.id, artifact_id: artifact.id, artifact_name: artifact.name,
    });
  }

  if (body.action === "review_get") {
    const { data, error } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (error) return reply(500, { error: "تعذر تحميل سجل مراجعة الصوت.", detail: error.message });
    if (data) return reply(200, { success: true, audio_review: data.audio_review });
    const emptyReview = { version: 1, regen: {}, clips: {}, audio_hashes: {} };
    const created = await service.from("story_audio_reviews")
      .upsert({ section, slug, audio_review: emptyReview }, { onConflict: "section,slug" })
      .select("audio_review").single();
    if (created.error) return reply(500, { error: "تعذر إنشاء سجل مراجعة الصوت.", detail: created.error.message });
    return reply(200, { success: true, audio_review: created.data.audio_review });
  }

  if (body.action === "review_save") {
    const next = body.audio_review;
    if (!next || next.version !== 1 || !next.clips || typeof next.clips !== "object" ||
        Array.isArray(next.clips) || !next.regen || typeof next.regen !== "object" ||
        !next.audio_hashes || typeof next.audio_hashes !== "object" ||
        JSON.stringify(next).length > 1500000) {
      return reply(400, { error: "بيانات مراجعة الصوت غير صالحة أو أكبر من الحد المسموح." });
    }
    const clipEntries = Object.entries(next.clips);
    if (clipEntries.length > 1000 || clipEntries.some(([key, clip]: [string, any]) =>
      !key || key.length > 600 || !clip || !["accepted", "rejected"].includes(clip.status))) {
      return reply(400, { error: "تحتوي مراجعة الصوت على قرارات مقاطع غير صالحة." });
    }
    const saved = await service.from("story_audio_reviews")
      .upsert({ section, slug, audio_review: next }, { onConflict: "section,slug" })
      .select("audio_review").single();
    if (saved.error) return reply(500, { error: "تعذر حفظ مراجعة الصوت.", detail: saved.error.message });
    return reply(200, { success: true, audio_review: saved.data.audio_review });
  }

  if (body.action === "stage") {
    if (!GITHUB_TOKEN) return reply(503, { error: "سر GitHub الخاص بقراءة الـArtifacts غير متاح." });
    const artifactId = Number(body.artifact_id);
    const runId = Number(body.run_id);
    const blockIndex = Number(body.block_index);
    const requestId = String(body.request_id ?? "");
    const expectedName = "khaledoon-" + section + "-" + slug + "-" + language + "-audio-staging";
    if (!Number.isSafeInteger(artifactId) || artifactId < 1 || !Number.isSafeInteger(runId) || runId < 1 ||
        String(body.artifact_name ?? "") !== expectedName ||
        !/^[a-f0-9-]{36}$/.test(requestId) || !Number.isInteger(blockIndex) || blockIndex < 0) {
      return reply(400, { error: "بيانات الـArtifact لا تطابق هوية الحكاية واللغة والمقطع." });
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
    const runResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}`, { headers: apiHeaders });
    if (!runResponse.ok) return reply(502, { error: "تعذر التحقق من تشغيل التوليد قبل نقل الصوت.", upstream_status: runResponse.status });
    const runData = await runResponse.json();
    const expectedTitle = "story audio " + requestId + " " + section + "/" + slug + " " + language + " block " + blockIndex;
    if (runData.display_title !== expectedTitle || runData.status !== "completed" || runData.conclusion !== "success") {
      return reply(403, { error: "تشغيل التوليد لا يطابق طلب المقطع المحدد أو لم ينجح." });
    }
    const zipResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${artifactId}/zip`, { headers: apiHeaders });
    if (!zipResponse.ok) return reply(502, { error: "تعذر تنزيل الـArtifact من GitHub.", upstream_status: zipResponse.status });
    const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer());
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) return reply(422, { error: "الـArtifact لا يحتوي manifest.json." });
    const manifest = JSON.parse(await manifestFile.async("string"));
    if (manifest.version !== 1 || manifest.section !== section || manifest.story !== slug || manifest.language !== language ||
        !Array.isArray(manifest.segments) || !manifest.segments.length || manifest.segments.length > 1000 ||
        manifest.segments.some((segment: any) => Number(segment.block_index) !== blockIndex)) {
      return reply(422, { error: "ملف المقطع لا يطابق الحكاية واللغة ورقم المقطع المطلوب." });
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
    const priorDownload = await service.storage.from(BUCKET).download(prefix + "/manifest.json");
    let priorSegments: any[] = [];
    if (!priorDownload.error && priorDownload.data) {
      const priorManifest = JSON.parse(await priorDownload.data.text());
      if (priorManifest.version !== 1 || priorManifest.section !== section || priorManifest.story !== slug || priorManifest.language !== language || !Array.isArray(priorManifest.segments)) {
        return reply(422, { error: "الحزمة الخاصة الموجودة لا تطابق الحكاية؛ لم يتم استبدالها." });
      }
      priorSegments = priorManifest.segments.filter((segment: any) => Number(segment.block_index) !== blockIndex);
    }
    manifest.segments = priorSegments.concat(manifest.segments).sort((a: any, b: any) => Number(a.block_index) - Number(b.block_index) || Number(a.chunk_index || 0) - Number(b.chunk_index || 0));
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
      const { data, error } = await service.storage.from(BUCKET).createSignedUrl(prefix + "/" + segment.src, 3600);
      if (error || !data?.signedUrl) return reply(500, { error: "تعذر إنشاء رابط مؤقت لأحد المقاطع.", file: segment.src });
      signedSources[segment.src] = new URL(data.signedUrl, SUPABASE_URL + "/storage/v1/").href;
    }
    return reply(200, { success: true, manifest, signed_sources: signedSources, expires_in: 3600 });
  }

  return reply(400, { error: "إجراء غير معروف." });
});
