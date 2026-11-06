import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const OWNER = "engmohamedgamalsaad-oss";
const REPO = "nourdeen-october-1973";
const BASE = "main";
const ALLOWED_ORIGIN = "https://engmohamedgamalsaad-oss.github.io";
const headers = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers });

function contentForSafetyScan(file: { content: string; encoding?: string }): string {
  if (file.encoding !== "base64") return file.content;
  // GitHub accepts base64 content for binary assets, but V1 must not let
  // encoded HTML/JSON bypass the V2-artifact rejection below.
  const compact = file.content.replace(/\s/g, "");
  const bytes = Uint8Array.from(atob(compact), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function stableJson(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

function validateAudioReviewGate(
  packageData: any,
  audioReview: any,
  files: any[],
  section: string,
): string | null {
  const languages = ["ar", "en", "fr", "it", "de"];
  const slug = String(packageData?.slug ?? "");
  if (!slug || !packageData?.i18n || !audioReview || typeof audioReview !== "object" ||
      !audioReview.clips || typeof audioReview.clips !== "object") {
    return "لا يوجد سجل مراجعة صوت محفوظ للحكاية؛ لا يمكن اعتماد النشر.";
  }
  const pronunciationFile = files.find((file: any) =>
    file.path === "stories/" + section + "/" + String(packageData.id ?? "").padStart(3, "0") + "/audio-pronunciation.json"
  );
  let approvedArabic: Record<string, string> = {};
  if (pronunciationFile) {
    try {
      const pronunciation = JSON.parse(contentForSafetyScan(pronunciationFile));
      if (pronunciation.version !== 1 || pronunciation.story !== slug ||
          pronunciation.language !== "ar" || !pronunciation.blocks ||
          !Array.isArray(pronunciation.approved_audio_only_rewrites)) {
        return "ملف نص النطق العربي لا يطابق الحكاية؛ تعذر التحقق من اعتماد الصوت.";
      }
      for (const rawIndex of pronunciation.approved_audio_only_rewrites) {
        const index = Number(rawIndex);
        const value = pronunciation.blocks[String(index)];
        if (!Number.isInteger(index) || index < 0 || typeof value !== "string" || !value.trim()) {
          return "ملف نص النطق العربي يحتوي اعتمادًا غير صالح.";
        }
        approvedArabic[String(index)] = value;
      }
    } catch {
      return "تعذر قراءة ملف نص النطق العربي قبل النشر.";
    }
  }
  const clips = Object.values(audioReview.clips) as any[];
  if (clips.some((clip: any) => clip && clip.story_id === section + "/" + slug &&
      clip.status === "rejected" && clip.resolved !== true)) {
    return "يوجد مقطع صوت مرفوض لم تتم معالجته؛ لا يمكن النشر.";
  }
  for (const lang of languages) {
    const localized = packageData.i18n[lang];
    if (!localized || !Array.isArray(localized.blocks) || !localized.blocks.length) {
      return "ترجمة " + lang + " غير متاحة للتحقق من مراجعة الصوت.";
    }
    const currentClips = clips.filter((clip: any) =>
      clip && clip.story_id === section + "/" + slug && clip.lang === lang
    );
    for (let blockIndex = 0; blockIndex < localized.blocks.length; blockIndex++) {
      const block = localized.blocks[blockIndex];
      if (!block || !["karma", "narrator"].includes(block.speaker) || !String(block.text ?? "").trim()) continue;
      const expected = lang === "ar" && approvedArabic[String(blockIndex)]
        ? approvedArabic[String(blockIndex)]
        : String(block.text);
      const blockClips = currentClips.filter((clip: any) =>
        Number(clip.block_index) === blockIndex && clip.speaker === block.speaker
      ).sort((a: any, b: any) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0));
      if (!blockClips.length || blockClips.some((clip: any, index: number) =>
        clip.status !== "accepted" || Number(clip.chunk_index || 0) !== index ||
        typeof clip.audio_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(clip.audio_sha256) ||
        typeof clip.text !== "string" || !clip.text.trim()
      )) {
        return "اللغة " + lang + "، المقطع " + (blockIndex + 1) + ": الصوت غير جاهز أو لم يُقبل بالكامل بعد الاستماع.";
      }
      const joined = blockClips.map((clip: any) => String(clip.text).replace(/\\s+/g, " ").trim()).join(" ");
      const normalize = (value: string) => value.normalize("NFKC").replace(/\\s+/g, " ").trim();
      if (normalize(joined) !== normalize(expected)) {
        return "اللغة " + lang + "، المقطع " + (blockIndex + 1) + ": نص الصوت المقبول لا يطابق النص الحالي للحكاية.";
      }
    }
  }
  return null;
}

function allowedPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length > 240 || path.startsWith("/") ||
      path.includes("\\") || path.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  if (path === "stories/index.json" || path === "stories/places.json") return true;
  if (/^stories\/quizzes\/[0-9]{3}\.json$/.test(path)) return true;
  if (!/^stories\/[a-z0-9-]+\/[0-9]{3}\/[A-Za-z0-9._/-]+$/.test(path)) return false;
  return ["html","json","css","js","svg","png","jpg","jpeg","webp","avif","woff2","md"].includes(path.split(".").pop()?.toLowerCase() ?? "");
}

async function github(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const raw = await response.text();
  let result: any;
  try { result = raw ? JSON.parse(raw) : {}; } catch { result = { message: raw.slice(0, 200) }; }
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${result.message ?? "request failed"}`);
  return result;
}

async function githubAllPages(path: string, token: string, maxPages = 20) {
  const rows: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await github(`${path}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error("GitHub list endpoint returned a non-array response.");
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
  throw new Error(`GitHub pagination exceeded ${maxPages} pages; refusing to continue with incomplete pull-request results.`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const origin = req.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return reply(403, { error: "Origin not allowed" });
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return reply(401, { error: "تسجيل الدخول مطلوب." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const githubToken = Deno.env.get("GITHUB_PUBLISH_TOKEN");
  if (!url || !anonKey) return reply(500, { error: "إعدادات التحقق في Supabase غير مكتملة." });
  if (!githubToken) return reply(503, { error: "يلزم إضافة السر GITHUB_PUBLISH_TOKEN في Supabase Secrets." });

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return reply(401, { error: "جلسة الدخول غير صالحة؛ سجّل الدخول مجددًا." });
  const { data: admin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || admin !== true) return reply(403, { error: "هذا الإجراء متاح للأدمن المعتمد فقط." });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "بيانات الطلب ليست JSON صالحًا." }); }
  if (body?.action === "capabilities") {
    return reply(200, { success: true, publisher_mode: "direct_main", version: "2026-11-02-direct-main-publisher-1", story_publish_version: "2026-11-02-canonical-story-publish-1", writes_main_directly: true, supports_story_move: true, requires_submission_id: true, rejects_story_only_drafts: true, supports_story_package_publish: true, rejects_v2_only_drafts: true, supports_v2_publish: false });
  }
  if (body?.action === "verify_pr") {
    const number = Number(body.pull_request_number);
    const expectedBranch = typeof body.branch === "string" ? body.branch.trim() : "";
    if (!Number.isSafeInteger(number) || number < 1 || !expectedBranch || expectedBranch.length > 200) {
      return reply(400, { error: "رقم طلب الدمج أو اسم فرعه غير صالح." });
    }
    try {
      const pull = await github(`/repos/${OWNER}/${REPO}/pulls/${number}`, githubToken);
      if (pull.base?.ref !== BASE || pull.head?.repo?.full_name !== OWNER + "/" + REPO || pull.head?.ref !== expectedBranch) {
        return reply(403, { error: "طلب الدمج لا يطابق الفرع المسجل لهذه الحكاية أو لا يستهدف main." });
      }
      return reply(200, {
        success: true,
        pull_request_number: number,
        pull_request_url: pull.html_url,
        state: pull.state,
        draft: pull.draft === true,
        merged: pull.merged === true || Boolean(pull.merged_at),
        merged_at: pull.merged_at ?? null,
        merge_commit_sha: pull.merge_commit_sha ?? null,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      return reply(502, { error: "تعذر التحقق من حالة طلب الدمج.", detail: detail.slice(0, 500) });
    }
  }
  if (!Array.isArray(body?.files) || body.files.length < 1 || body.files.length > 50)
    return reply(400, { error: "أرسل من 1 إلى 50 ملفًا." });
  const seen = new Set<string>();
  let total = 0;
  for (const file of body.files) {
    if (!file || !allowedPath(file.path) || seen.has(file.path)) return reply(400, { error: "مسار ملف غير مسموح أو مكرر." });
    seen.add(file.path);
    if (typeof file.content !== "string" || file.content.length > 5_000_000 ||
        (file.encoding !== undefined && file.encoding !== "base64")) return reply(400, { error: "محتوى ملف أو ترميز غير صالح." });
    total += file.content.length;
    if (total > 8_000_000) return reply(413, { error: "إجمالي الملفات يتجاوز الحد المسموح." });
  }

  const submissionTable = body.submission_table === "submitted_stories" ? "submitted_stories"
    : body.submission_table === "khaledoon_submissions" ? "khaledoon_submissions" : "";
  const submissionId = typeof body.submission_id === "string" ? body.submission_id.trim() : "";
  if (!submissionTable || !/^[A-Za-z0-9-]{1,100}$/.test(submissionId)) {
    return reply(400, { error: "يلزم إرسال رقم سجل الحكاية وجدولها للتحقق من صلاحية النشر." });
  }
  const { data: sourceRecord, error: sourceRecordError } = await supabase
    .from(submissionTable).select("id,story_meta").eq("id", submissionId).maybeSingle();
  if (sourceRecordError) return reply(500, { error: "تعذر التحقق من سجل الحكاية قبل إنشاء طلب المراجعة." });
  if (!sourceRecord) return reply(404, { error: "سجل الحكاية المطلوب غير موجود أو غير متاح للأدمن الحالي." });
  const sourceMeta = sourceRecord.story_meta && typeof sourceRecord.story_meta === "object" ? sourceRecord.story_meta as Record<string, unknown> : {};
  const pendingMeta = sourceMeta.pending_draft && typeof sourceMeta.pending_draft === "object" ? sourceMeta.pending_draft as Record<string, unknown> : {};
  const isStoryOnlyDraft = sourceMeta.story_only_draft === true || pendingMeta.story_only_draft === true ||
    sourceMeta.v2_only_draft === true || pendingMeta.v2_only_draft === true;
  const isV2OnlyDraft = sourceMeta.v2_only_draft === true || pendingMeta.v2_only_draft === true;
  const submittedStoryPage = body.files.find((file: any) => /^stories\/[a-z0-9-]+\/[0-9]{3}\/index\.html$/.test(file.path));
  const submittedStoryMatch = submittedStoryPage?.path.match(/^stories\/([a-z0-9-]+)\/([0-9]{3})\/index\.html$/);
  const submittedStorySection = submittedStoryMatch?.[1] ?? "";
  const savedStoryPackageRaw: any = (pendingMeta.story_only_draft === true ? pendingMeta.story_package : null) ??
    (sourceMeta.story_only_draft === true ? sourceMeta.story_package : null) ??
    (pendingMeta.v2_only_draft === true ? pendingMeta.v2_package : null) ??
    (sourceMeta.v2_only_draft === true ? sourceMeta.v2_package : null);
  const savedStoryPackage: any = savedStoryPackageRaw && typeof savedStoryPackageRaw === "object"
    ? { ...savedStoryPackageRaw, format: savedStoryPackageRaw.format === "KHALEDOON_STORY_V2" ? "KHALEDOON_STORY" : savedStoryPackageRaw.format }
    : null;
  let hasStoryArtifacts = false;
  try {
    hasStoryArtifacts = body.files.some((file: any) =>
      /\/(?:story|data\.v2)\.json$/.test(file.path) ||
      /KHALEDOON_STORY(?:_V2)?|(?:story|data)\.v2\.json|data-kh-(?:story|v2)-reader/.test(contentForSafetyScan(file))
    );
  } catch {
    return reply(400, { error: "تعذر فك ترميز أحد الملفات للتحقق من توافق الحكاية." });
  }
  if (isStoryOnlyDraft) {
    if (!savedStoryPackage || !["KHALEDOON_STORY", "KHALEDOON_STORY_V2"].includes(savedStoryPackage.format)) {
      return reply(409, { error: "حزمة الحكاية الأصلية غير موجودة في سجل الإدارة؛ لم ننشئ طلب مراجعة." });
    }
    const review = sourceMeta.preview_review && typeof sourceMeta.preview_review === "object"
      ? sourceMeta.preview_review as Record<string, unknown> : {};
    if (review.decision !== "approved_waiting_for_github_upload") {
      return reply(409, { error: "يجب اعتماد معاينة الحكاية قبل إنشاء طلب مراجعة للنشر." });
    }
    try {
      const packageFiles = body.files.filter((file: any) => /\/(?:story|data\.v2)\.json$/.test(file.path));
      const pageFiles = body.files.filter((file: any) => /^stories\/[a-z0-9-]+\/[0-9]{3}\/index\.html$/.test(file.path));
      const quizFiles = body.files.filter((file: any) => /^stories\/quizzes\/[0-9]{3}\.json$/.test(file.path));
      const packageFile = packageFiles[0], pageFile = pageFiles[0], quizFile = quizFiles[0];
      const indexFile = body.files.find((file: any) => file.path === "stories/index.json");
      const placesFile = body.files.find((file: any) => file.path === "stories/places.json");
      if (packageFiles.length !== 1 || pageFiles.length !== 1 || quizFiles.length !== 1 || !packageFile || !pageFile || !quizFile || !indexFile || !placesFile) {
        return reply(400, { error: "حزمة الحكاية للنشر تحتاج صفحة index.html وملف الحكاية وبنك الأسئلة والفهرس وبيانات الخريطة." });
      }
      const packageData = JSON.parse(contentForSafetyScan(packageFile));
      if (!["KHALEDOON_STORY", "KHALEDOON_STORY_V2"].includes(packageData.format) || stableJson(packageData) !== stableJson(savedStoryPackage)) {
        return reply(409, { error: "ملف الحكاية لا يطابق الحزمة المحفوظة والمعتمدة في سجل الإدارة." });
      }
      if (!Object.prototype.hasOwnProperty.call(packageData, "map_location")) {
        return reply(400, { error: "يجب تحديد map_location صراحةً: موقع موثق أو null." });
      }
      if (!Array.isArray(packageData.quiz) || packageData.quiz.length < 5) {
        return reply(400, { error: "حزمة الحكاية يجب أن تحتوي على خمسة أسئلة على الأقل." });
      }
      const pageMatch = pageFile.path.match(/^stories\/([a-z0-9-]+)\/([0-9]{3})\/index\.html$/);
      const storySection = pageMatch?.[1], storyId = pageMatch?.[2];
      const storyRoot = storySection && storyId ? "stories/" + storySection + "/" + storyId + "/" : "";
      const pageHtml = contentForSafetyScan(pageFile);
      if (isV2OnlyDraft || savedStoryPackageRaw?.format === "KHALEDOON_STORY_V2" ||
          packageData.format !== "KHALEDOON_STORY" ||
          packageFile.path !== storyRoot + "story.json" ||
          !pageHtml.includes("data-kh-story-reader") ||
          !pageHtml.includes('data-story-path="story.json"') ||
          pageHtml.includes("data-kh-v2-reader") ||
          pageHtml.includes('data-story-path="data.v2.json"')) {
        return reply(409, { error: "كل الأقسام، بما فيها أكتوبر، يجب أن تُنشر من KHALEDOON_STORY وstory.json والقارئ المشترك فقط." });
      }
      const audioGateError = validateAudioReviewGate(packageData, sourceMeta.audio_review, body.files, storySection);
      if (audioGateError) return reply(409, { error: audioGateError });

      if (!storyRoot || packageData.section !== storySection ||
          !(pageHtml.includes("data-kh-story-reader") || pageHtml.includes("data-kh-v2-reader")) ||
          !(pageHtml.includes('data-story-path="story.json"') || pageHtml.includes('data-story-path="data.v2.json"')) ||
          !pageHtml.includes('data-story-slug="' + storyId + '"') ||
          packageFile.path !== storyRoot + (packageFile.path.endsWith("/story.json") ? "story.json" : "data.v2.json")) {
        return reply(400, { error: "مسار صفحة الحكاية أو ربط القارئ لا يطابق القسم ورقم الحكاية." });
      }
      if (quizFile.path !== "stories/quizzes/" + storyId + ".json") {
        return reply(400, { error: "رقم بنك الأسئلة لا يطابق رقم صفحة الحكاية." });
      }
      const incomingIndex = JSON.parse(contentForSafetyScan(indexFile));
      if (!Array.isArray(incomingIndex)) return reply(400, { error: "فهرس الحكايات يجب أن يكون مصفوفة." });
      const normalizedStoryRoot = storyRoot.replace(/\/$/, "");
      const priorPath = String(review.static_story_path ?? "").split("/").filter(Boolean).join("/");
      const priorId = String(review.static_story_id ?? "").trim();
      if ((priorPath && priorPath !== normalizedStoryRoot) ||
          (priorId && priorId.padStart(3, "0") !== storyId)) {
        return reply(409, { error: "مسار أو رقم الحكاية لا يطابق سجل المعاينة المعتمد؛ لا يمكن استبدال صفحة أخرى." });
      }
      const indexEntry = incomingIndex.find((entry: any) =>
        String(entry.id ?? "").padStart(3, "0") === storyId &&
        String(entry.path ?? "").split("/").filter(Boolean).join("/") === normalizedStoryRoot
      );
      if (!indexEntry || indexEntry.section !== storySection ||
          indexEntry.title !== packageData.i18n?.ar?.title ||
          indexEntry.person !== (packageData.i18n?.ar?.figure_name || packageData.i18n?.ar?.person || packageData.i18n?.ar?.title) ||
          ["en", "fr", "it", "de"].some((lang) =>
            indexEntry.i18n?.[lang]?.title !== packageData.i18n?.[lang]?.title ||
            indexEntry.i18n?.[lang]?.person !== (packageData.i18n?.[lang]?.figure_name || packageData.i18n?.[lang]?.person || packageData.i18n?.[lang]?.title)
          )) {
        return reply(400, { error: "عنصر فهرس الحكايات لا يطابق الحزمة المعتمدة." });
      }
      const quiz = JSON.parse(contentForSafetyScan(quizFile));
      if (!Array.isArray(quiz.questions) || quiz.questions.length !== packageData.quiz.length) {
        return reply(400, { error: "بنك الأسئلة لا يطابق عدد أسئلة الحزمة المعتمدة." });
      }
      for (let i = 0; i < packageData.quiz.length; i++) {
        const source = packageData.quiz[i], output = quiz.questions[i];
        if (output.a !== source.correct_option || output.q !== source.i18n?.ar?.question ||
            stableJson(output.o) !== stableJson(source.i18n?.ar?.options) ||
            output.e !== source.i18n?.ar?.explanation ||
            !output.i18n || ["en", "fr", "it", "de"].some((lang) =>
              output.i18n[lang]?.q !== source.i18n?.[lang]?.question ||
              stableJson(output.i18n[lang]?.o) !== stableJson(source.i18n?.[lang]?.options) ||
              output.i18n[lang]?.e !== source.i18n?.[lang]?.explanation
            )) {
          return reply(400, { error: "بنك الأسئلة أو إحدى ترجماته لا تطابق الحزمة المعتمدة." });
        }
      }
      const incomingPlaces = JSON.parse(contentForSafetyScan(placesFile));
      if (!incomingPlaces || typeof incomingPlaces !== "object" || Array.isArray(incomingPlaces) ||
          !Object.prototype.hasOwnProperty.call(incomingPlaces, storyId)) {
        return reply(400, { error: "ملف الخريطة لا يحتوي قرار موقع الحكاية." });
      }
      const place = incomingPlaces[storyId];
      if (packageData.map_location === null && place !== null) {
        return reply(400, { error: "الحكاية بلا موقع موثق؛ يجب أن تكون علامة الخريطة null." });
      }
      if (packageData.map_location && (!place || Number(place.lat) !== packageData.map_location.lat ||
          Number(place.lng) !== packageData.map_location.lng ||
          stableJson(place.place) !== stableJson(packageData.map_location.place) ||
          stableJson(place.place_label ?? null) !== stableJson(packageData.map_location.place_label ?? null) ||
          Boolean(place.approximate) !== Boolean(packageData.map_location.approximate) ||
          place.source_url !== packageData.map_location.source_url ||
          stableJson(place.source_name) !== stableJson(packageData.map_location.source_name))) {
        return reply(400, { error: "موقع الخريطة لا يطابق الموقع الموثق داخل الحزمة." });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      return reply(400, { error: "تعذر التحقق من الحزمة قبل إنشاء طلب المراجعة.", detail: detail.slice(0, 400) });
    }
  } else if (hasStoryArtifacts) {
    return reply(409, { error: "ملفات القالب الموحد لا يمكن إرسالها من سجل لا يحمل حزمة معتمدة." });
  } else if (submittedStorySection && submittedStorySection !== "october") {
    return reply(409, { error: "مسار النشر القديم متاح لقسم أكتوبر فقط؛ يجب إعادة تجهيز الحكايات الأخرى بحزمة KHALEDOON_STORY المعتمدة." });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "نشر حكاية جديدة — خالدون عبر التاريخ";
  const description = typeof body.body === "string" ? body.body.slice(0, 5000) : "راجع الملفات ومعاينة GitHub Pages قبل الدمج. لم يتم النشر على main.";
  let storyLockBranchForCleanup = "";
  async function releaseStoryLock() {
    const lockBranch = storyLockBranchForCleanup;
    if (!lockBranch || !githubToken) return;
    storyLockBranchForCleanup = "";
    try {
      await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${lockBranch}`, githubToken, { method: "DELETE" });
    } catch { /* lock cleanup is best effort; never hide the original publish result */ }
  }
  try {
    // Serialize publishes with an atomic repository lock before reading the main base.
    const initialRef = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${BASE}`, githubToken);
    const lockBranch = "khaledoon/publish-main-lock";
    try {
      await github(`/repos/${OWNER}/${REPO}/git/refs`, githubToken, {
        method: "POST",
        body: JSON.stringify({ ref: "refs/heads/" + lockBranch, sha: initialRef.object.sha }),
      });
      storyLockBranchForCleanup = lockBranch;
    } catch (lockError) {
      const lockDetail = lockError instanceof Error ? lockError.message : "";
      if (lockDetail.includes("GitHub API 422") || lockDetail.includes("Reference already exists")) {
        return reply(409, { success: false, error: "يوجد نشر آخر جارٍ الآن؛ انتظر قليلًا ثم أعد المحاولة. لم تتغير الملفات المنشورة." });
      }
      throw lockError;
    }
    const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${BASE}`, githubToken);
    const baseSha = ref.object.sha;
    const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`, githubToken);
    const treeEntries = [];
    const storyPage = body.files.find((file: any) => /^stories\/[a-z0-9-]+\/[0-9]{3}\/index\.html$/.test(file.path));
    if (!storyPage) throw new Error('Missing generated story page index.html.');
    const pathMatch = storyPage.path.match(/^stories\/([a-z0-9-]+)\/([0-9]{3})\/index\.html$/);
    const storySection = pathMatch[1], storyId = pathMatch[2], storyRoot = 'stories/' + storySection + '/' + storyId + '/';
    for (const file of body.files) {
      if (file.path !== 'stories/index.json' && file.path !== 'stories/places.json' && file.path !== ('stories/quizzes/' + storyId + '.json') && !file.path.startsWith(storyRoot)) {
        throw new Error('A file is outside the selected story folder; refusing to modify unrelated stories.');
      }
    }
    const incomingIndexFile = body.files.find((file: any) => file.path === 'stories/index.json');
    if (!incomingIndexFile) throw new Error('Missing stories/index.json.');
    const currentIndexResponse = await github('/repos/' + OWNER + '/' + REPO + '/contents/stories/index.json?ref=' + baseSha, githubToken);
    const currentIndexBytes = Uint8Array.from(atob(currentIndexResponse.content.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    const currentIndex = JSON.parse(new TextDecoder().decode(currentIndexBytes));
    const incomingIndex = JSON.parse(incomingIndexFile.content);
    if (!Array.isArray(currentIndex) || !Array.isArray(incomingIndex)) throw new Error('Story index JSON must be arrays.');
    const normalizedRoot = storyRoot.replace(/\/$/, '');
    const incomingEntry = incomingIndex.find((entry: any) => String(entry.id ?? '').padStart(3, '0') === storyId && String(entry.path ?? '').split('/').filter(Boolean).join('/') === normalizedRoot);
    if (!incomingEntry) throw new Error('Generated index does not contain the generated story path.');
    const norm = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    const duplicate = currentIndex.find((entry: any) =>
      String(entry.id ?? '').padStart(3, '0') !== storyId &&
      norm(entry.title) !== '' && norm(entry.person) !== '' &&
      norm(entry.title) === norm(incomingEntry.title) &&
      norm(entry.person) === norm(incomingEntry.person)
    );
    if (duplicate) {
      throw new Error(`A published story with the same title and person already exists (ID ${String(duplicate.id).padStart(3, '0')}); refusing to publish a duplicate.`);
    }
    const matchingIndices = currentIndex.map((entry: any, index: number) =>
      String(entry.id ?? '').padStart(3, '0') === storyId ? index : -1
    ).filter((index: number) => index >= 0);
    if (matchingIndices.length > 1) throw new Error('Story ID appears more than once in the current index; refusing an ambiguous move.');
    const existingIndex = matchingIndices[0] ?? -1;
    let previousRoot = '';
    if (existingIndex >= 0) {
      const previousPath = String(currentIndex[existingIndex].path ?? '').split('/').filter(Boolean).join('/');
      if (previousPath !== normalizedRoot) {
        if (!/^stories\/[a-z0-9-]+\/[0-9]{3}$/.test(previousPath) ||
            previousPath.split('/').pop() !== storyId) {
          throw new Error('Existing story path is not a safe same-ID story folder; refusing to move it.');
        }
        previousRoot = previousPath + '/';
      }
    }
    if (existingIndex < 0 || previousRoot) {
      let existingStoryPage: any = null;
      try {
        existingStoryPage = await github(`/repos/${OWNER}/${REPO}/contents/${storyRoot}index.html?ref=${baseSha}`, githubToken);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        if (!detail.startsWith("GitHub API 404:")) throw error;
      }
      if (existingStoryPage) {
        throw new Error(previousRoot
          ? "Destination story page already exists outside the index; refusing to overwrite it during a move."
          : "Story page path already exists on main but is missing from stories/index.json; refusing to overwrite it.");
      }
    }
    if (existingIndex >= 0) currentIndex[existingIndex] = incomingEntry; else currentIndex.push(incomingEntry);
    // Keep the interactive map synchronized on every publish; merge into the latest main file.
    const incomingPlacesFile = body.files.find((file: any) => file.path === 'stories/places.json');
    if (!incomingPlacesFile) {
      throw new Error('stories/places.json is required so publishing can synchronize the interactive map automatically.');
    }
    let incomingPlaces: any;
    try { incomingPlaces = JSON.parse(incomingPlacesFile.content); }
    catch { throw new Error('stories/places.json must contain valid JSON.'); }
    if (!incomingPlaces || typeof incomingPlaces !== 'object' || Array.isArray(incomingPlaces)) {
      throw new Error('stories/places.json must contain a JSON object keyed by story ID.');
    }
    const hasStoryPlace = Object.prototype.hasOwnProperty.call(incomingPlaces, storyId);
    const place = hasStoryPlace ? incomingPlaces[storyId] : undefined;
    if (existingIndex < 0 && (!hasStoryPlace || place === null)) {
      throw new Error('New stories must include a verified, sourced map location so the globe marker is created automatically; do not invent coordinates.');
    }
    const currentPlacesResponse = await github('/repos/' + OWNER + '/' + REPO + '/contents/stories/places.json?ref=' + baseSha, githubToken);
    const currentPlacesBytes = Uint8Array.from(atob(currentPlacesResponse.content.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    const currentPlaces = JSON.parse(new TextDecoder().decode(currentPlacesBytes));
    if (!currentPlaces || typeof currentPlaces !== 'object' || Array.isArray(currentPlaces)) {
      throw new Error('Current stories/places.json must be an object.');
    }
    let mapMarkerAdded = false;
    if (hasStoryPlace && place === null) {
      // Explicit null means the story has no verified location; remove a stale marker.
      delete currentPlaces[storyId];
    } else if (hasStoryPlace) {
      if (!place || typeof place !== 'object' || Array.isArray(place)) {
        throw new Error('Map location must be a verified object or explicit null when no verified location exists.');
      }
      const lat = place.lat, lng = place.lng;
      if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
          typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new Error('Map coordinates must be numeric and within valid latitude/longitude ranges.');
      }
      if (!place.place || typeof place.place !== 'object' ||
          ['ar','en','fr','it','de'].some((locale) => typeof place.place[locale] !== 'string' || !place.place[locale].trim() || (locale !== 'ar' && /[\u0600-\u06FF]/.test(place.place[locale])))) {
        throw new Error('Map place names must be provided in all five languages: ar/en/fr/it/de.');
      }
      if (place.place_label !== undefined && place.place_label !== null &&
          (!place.place_label || typeof place.place_label !== 'object' || Array.isArray(place.place_label) ||
           ['ar','en','fr','it','de'].some((locale) => typeof place.place_label[locale] !== 'string' ||
             !place.place_label[locale].trim() || (locale !== 'ar' && /[؀-ۿ]/.test(place.place_label[locale]))))) {
        throw new Error('Map place labels, when provided, must be translated into all five languages without Arabic leftovers.');
      }
      const previousPlace = currentPlaces[storyId];
      const unchangedLegacyPlace = !!previousPlace &&
        Number(previousPlace.lat) === lat && Number(previousPlace.lng) === lng &&
        JSON.stringify(previousPlace.place) === JSON.stringify(place.place) &&
        Boolean(previousPlace.approximate) === Boolean(place.approximate) &&
        !String(place.source_name || '').trim() && !String(place.source_url || '').trim();
      const sourceNameIsLocalized = place.source_name && typeof place.source_name === 'object' &&
        ['ar','en','fr','it','de'].every((locale) => typeof place.source_name[locale] === 'string' && place.source_name[locale].trim()) &&
        ['en','fr','it','de'].every((locale) => !/[\u0600-\u06FF]/.test(place.source_name[locale]));
      if (!unchangedLegacyPlace &&
          (!sourceNameIsLocalized || typeof place.source_url !== 'string' || !/^https:\/\//i.test(place.source_url.trim()))) {
        throw new Error('Map location must include source_name translated to ar/en/fr/it/de and an HTTPS source URL unless preserving an unchanged legacy map entry.');
      }
      if (place.approximate !== undefined && typeof place.approximate !== 'boolean') {
        throw new Error('Map approximate flag must be boolean when provided.');
      }
      currentPlaces[storyId] = { ...place, lat, lng };
      mapMarkerAdded = true;
    } else {
      // Older records without map metadata preserve any existing verified marker.
      mapMarkerAdded = !!currentPlaces[storyId];
    }
    const mergedPlacesContent = JSON.stringify(currentPlaces, null, 2) + '\n';
    const safeFiles = body.files.map((file: any) => {
      if (file.path === 'stories/index.json') return { ...file, content: JSON.stringify(currentIndex, null, 2) + '\n' };
      if (file.path === 'stories/places.json') return { ...file, content: mergedPlacesContent };
      return file;
    });
    // A section move updates the index and removes the previous story assets in the same review PR.
    // Keep the old index URL as a redirect so saved links/QR codes do not immediately break.
    if (previousRoot) {
      const oldTree = await github(`/repos/${OWNER}/${REPO}/git/trees/${baseCommit.tree.sha}?recursive=1`, githubToken);
      if (oldTree.truncated) throw new Error('Repository tree is truncated; refusing an incomplete story move.');
      const oldIndexPath = previousRoot + 'index.html';
      const oldFiles = (oldTree.tree ?? []).filter((entry: any) =>
        typeof entry.path === 'string' && entry.path.startsWith(previousRoot) && entry.type === 'blob'
      );
      if (!oldFiles.some((entry: any) => entry.path === oldIndexPath)) {
        throw new Error('The previous story index.html was not found; refusing to move a story with an incomplete old path.');
      }
      for (const entry of oldFiles) {
        if (entry.path !== oldIndexPath) treeEntries.push({ path: entry.path, mode: '100644', type: 'blob', sha: null });
      }
      const relativeNewPath = normalizedRoot.replace(/^stories\//, '');
      const redirectHtml = '<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../../' +
        relativeNewPath +
        '/"><link rel="canonical" href="../../' + relativeNewPath +
        '/"><title>Story moved</title><body><p>This story has moved. <a href="../../' +
        relativeNewPath + '/">Open the updated story</a>.</p><script>location.replace("../../' +
        relativeNewPath + '/"+location.search+location.hash)</script></body></html>\n';
      const redirectBlob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, githubToken, {
        method: 'POST', body: JSON.stringify({ content: redirectHtml, encoding: 'utf-8' }),
      });
      treeEntries.push({ path: oldIndexPath, mode: '100644', type: 'blob', sha: redirectBlob.sha });
    }
    // Build one atomic commit from the validated current main tree.
    for (const file of safeFiles) {
      const blob = await github('/repos/' + OWNER + '/' + REPO + '/git/blobs', githubToken, {
        method: 'POST', body: JSON.stringify({ content: file.content, encoding: file.encoding === 'base64' ? 'base64' : 'utf-8' }),
      });
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await github(`/repos/${OWNER}/${REPO}/git/trees`, githubToken, {
      method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
    });
    const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, githubToken, {
      method: "POST", body: JSON.stringify({ message: `Publish approved story: ${title}`, tree: tree.sha, parents: [baseSha] }),
    });
    const latestRef = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${BASE}`, githubToken);
    if (latestRef.object.sha !== baseSha) throw new Error("تغير main أثناء تجهيز الحكاية؛ أوقفت النشر لتجنب استبدال تحديث أحدث. أعد المحاولة.");
    await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${BASE}`, githubToken, {
      method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    await releaseStoryLock();
    return reply(200, {
      success: true, published_to_main: true, commit_sha: commit.sha, story_id: storyId, story_path: normalizedRoot,
      map_linked: mapMarkerAdded, map_marker_added: mapMarkerAdded,
      map_message: mapMarkerAdded ? "تم نشر الحكاية وتحديث علامة الخريطة مباشرة في main." : "تم نشر الحكاية مباشرة في main دون إضافة علامة خريطة لعدم توفر موقع موثق.",
      message: "تم تسجيل الحكاية مباشرة في main؛ بدأ GitHub Pages عملية النشر تلقائيًا."
    });
  } catch (error) {
    await releaseStoryLock();
    const detail = error instanceof Error ? error.message : "Unknown error";
    return reply(502, {
      error: "تعذر نشر الحكاية مباشرة إلى main؛ لم تُسجّل كحكاية منشورة.",
      detail: detail.slice(0, 500),
    });
  }
});
