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
  const karma: number[] = [];
  const narrator: number[] = [];
  blocks.forEach((block: any, index: number) => {
    if (block?.speaker === "karma") karma.push(index);
    else if (block?.speaker === "narrator") narrator.push(index);
  });
  const targetSpeaker = blocks[targetIndex]?.speaker;
  return targetSpeaker === "karma"
    ? karma.filter((index) => index < targetIndex)
    : karma.concat(narrator.filter((index) => index < targetIndex));
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

  if (body.action === "prepare_speech_text") {
    if (section !== "history" || slug !== "ibn-sina" || language !== "ar") {
      return reply(400, { error: "تجهيز نص القراءة عبر Gemini متاح حاليًا للتجربة العربية في ابن سينا فقط." });
    }
    if (!GEMINI_API_KEY) return reply(503, { error: "مفتاح Gemini غير متاح في أسرار دالة Supabase؛ لم يُرسل أي نص." });
    let source;
    try { source = await ibnSinaArabicBlock(Number(body.block_index)); }
    catch (error) { return reply(400, { error: error instanceof Error ? error.message : "تعذر تحديد المقطع." }); }
    const index = Number(body.block_index);
    const { data: progressRow, error: progressError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (progressError) return reply(500, { error: "تعذر قراءة ترتيب مراجعة المقاطع.", detail: progressError.message });
    const accepted = acceptedArabicBlockIndexes(progressRow?.audio_review);
    if (accepted.has(index) || requiredEarlierIbnSinaBlocks(source.blocks, index).some((prior) => !accepted.has(prior))) {
      return reply(409, { error: "هذا المقطع لم يحن دوره بعد؛ أكمل اعتماد مقاطع كارما بالترتيب، ثم مقاطع الراوي." });
    }
    const previous = index > 0 ? source.blocks[index - 1] : null;
    const next = index + 1 < source.blocks.length ? source.blocks[index + 1] : null;
    const speakerName = source.block.speaker === "karma" ? "كارما" : "الراوي";
    const prompt = [
      "جهّز نص قراءة صوتية منفصلًا للمقطع التالي من حكاية ابن سينا.",
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
      "حافظ على كل الحقائق والأسماء والتواريخ والأرقام والعلاقات وتسلسل الأحداث والمعنى. ممنوع الإضافة أو الحذف أو التلخيص أو اختراع حوار.",
      "حسّن فقط قابلية النطق والاستماع، وعلامات الوقف والتنفس، وكتابة الأسماء والألفاظ الصعبة عند الحاجة. إذا كان النص طبيعيًا بالفعل فغيّر أقل قدر ممكن.",
      "إيقاع الجملة إلزامي: حافظ على سرعة وإلقاء متوازنين من أول الجملة إلى آخرها؛ ممنوع تسريع آخر 4 إلى 6 كلمات أو ضغطها في نهاية النفس.",
      "لا تحذف كلمات النهاية ولا تدمجها في تركيب مختصر. ضع علامة وقف طبيعية قبل الجملة الختامية عند الحاجة، وأنهِ كل جملة بعلامة ترقيم واضحة تساعد على وقفة مسموعة.",
      "إذا كانت الجملة طويلة أو تحمل أكثر من فكرة، أعد صياغة ترتيبها إلى جملتين قصيرتين طبيعيتين دون حذف أو إضافة أي معلومة، مع الحفاظ على ترتيب الأحداث والمعنى.",
      "لا تضف نقاطًا متتابعة أو فواصل مصطنعة لمجرد إبطاء القراءة؛ المطلوب صياغة مصرية سلسة تسمح بإلقاء هادئ حتى آخر كلمة.",
      "أعد JSON فقط بالحقول: speech_text, changes_summary, pronunciation_notes, review_flags.",
      "السياق السابق (للفهم فقط، لا تعِد صياغته): " + (previous?.text ?? "لا يوجد"),
      "السياق التالي (للفهم فقط، لا تعِد صياغته): " + (next?.text ?? "لا يوجد"),
      "النص الأصلي المطلوب تجهيزه فقط:\n" + source.sourceText,
    ].join("\n\n");
    const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "أنت محرر ومخرج أداء صوتي متخصص في الحكايات التعليمية المصرية. مهمتك تجهيز نص القراءة فقط، لا توليد الصوت ولا اعتماد النص نيابة عن صاحب المشروع. التزم بالحقائق والمعنى وتسلسل الأحداث. عند تحرير مقاطع كارما، حافظ حرفيًا على هوية الشخصية الثابتة: طفلة مصرية عمرها 12 سنة، ذكية وفضولية وعفوية وودودة، تتحدث بعامية مصرية بيضاء طبيعية، لا كمذيعة أو معلمة أو امرأة بالغة أو طفلة متصنعة. يجب أن يظل أسلوبها واحدًا عبر جميع المقاطع والحكايات؛ لا تغيّر شخصيتها أو درجة نضجها أو طريقة مخاطبتها من مقطع لآخر. لا تختلق تجارب شخصية أو زيارات. اجعل الجمل سهلة النطق وإيقاعها متوازنًا حتى آخر كلمة، من دون تسريع النهايات." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
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
      }),
    });
    if (!geminiResponse.ok) {
      return reply(502, { error: "تعذر الحصول على اقتراح من Gemini.", upstream_status: geminiResponse.status });
    }
    const geminiData = await geminiResponse.json();
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
      model: "gemini-3.8-flash",
    });
  }

  if (body.action === "speech_text_save") {
    if (section !== "history" || slug !== "ibn-sina" || language !== "ar") {
      return reply(400, { error: "حفظ نص القراءة متاح حاليًا للتجربة العربية في ابن سينا فقط." });
    }
    const index = Number(body.block_index);
    const decision = body.decision;
    const speechText = String(body.speech_text ?? "").trim();
    if (!Number.isInteger(index) || index < 0 || index > 16 ||
        !["suggested", "approved"].includes(decision) || !speechText || speechText.length > 6000 ||
        typeof body.source_text_hash !== "string" || !/^[a-f0-9]{64}$/i.test(body.source_text_hash)) {
      return reply(400, { error: "بيانات نص القراءة أو قرار اعتماده غير صالحة." });
    }
    let source;
    try { source = await ibnSinaArabicBlock(index); }
    catch (error) { return reply(400, { error: error instanceof Error ? error.message : "تعذر التحقق من النص الأصلي." }); }
    if (source.sourceTextHash !== body.source_text_hash.toLowerCase()) {
      return reply(409, { error: "تغير النص الأصلي للحكاية؛ أعد تجهيز نص القراءة قبل اعتماده." });
    }
    const { data: progressRow, error: progressError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (progressError) return reply(500, { error: "تعذر قراءة ترتيب اعتماد المقاطع.", detail: progressError.message });
    const accepted = acceptedArabicBlockIndexes(progressRow?.audio_review);
    if (accepted.has(index) || requiredEarlierIbnSinaBlocks(source.blocks, index).some((prior) => !accepted.has(prior))) {
      return reply(409, { error: "لا يمكن اعتماد نص مقطع خارج دوره؛ الترتيب هو مقاطع كارما أولًا ثم مقاطع الراوي." });
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
        if (clip?.lang === "ar" && Number(clip.block_index) === index) delete current.clips[clipKey];
      }
    }
    current.speech_texts = speechTexts;
    const { data: saved, error: saveError } = await service.from("story_audio_reviews")
      .upsert({ section, slug, audio_review: current }, { onConflict: "section,slug" })
      .select("audio_review").single();
    if (saveError) return reply(500, { error: "تعذر حفظ نص القراءة في سجل المراجعة.", detail: saveError.message });
    return reply(200, { success: true, speech_text: speechTexts[key] });
  }

  if (body.action === "generate") {
    if (section !== "history" || slug !== "ibn-sina" || language !== "ar" ||
        !Number.isInteger(body.block_index) || body.block_index < 0 || body.block_index > 16) {
      return reply(400, { error: "التوليد متاح لمقطع عربي واحد محدد من حكاية ابن سينا." });
    }
    let source;
    try { source = await ibnSinaArabicBlock(body.block_index); }
    catch (error) { return reply(400, { error: error instanceof Error ? error.message : "تعذر التحقق من المقطع." }); }
    const { data: reviewRow, error: reviewReadError } = await service.from("story_audio_reviews")
      .select("audio_review").eq("section", section).eq("slug", slug).maybeSingle();
    if (reviewReadError) return reply(500, { error: "تعذر التحقق من اعتماد نص القراءة.", detail: reviewReadError.message });
    const speechRecord = reviewRow?.audio_review?.speech_texts?.["ar:" + body.block_index];
    if (!speechRecord || speechRecord.status !== "approved" ||
        speechRecord.source_text_hash !== source.sourceTextHash ||
        typeof speechRecord.approved_text !== "string" || !speechRecord.approved_text.trim()) {
      return reply(409, { error: "لن يبدأ NAMAA قبل اعتماد نص القراءة لهذا المقطع من صفحة المعاينة." });
    }
    const acceptedBlocks = new Set(
      Object.values(reviewRow?.audio_review?.clips ?? {})
        .filter((clip: any) => clip?.lang === "ar" && clip?.status === "accepted")
        .map((clip: any) => Number(clip.block_index))
    );
    const karmaIndexes = source.blocks.map((item: any, index: number) => item?.speaker === "karma" ? index : -1).filter((index: number) => index >= 0);
    const narratorIndexes = source.blocks.map((item: any, index: number) => item?.speaker === "narrator" ? index : -1).filter((index: number) => index >= 0);
    const targetSpeaker = source.block.speaker;
    const requiredPrior = targetSpeaker === "karma"
      ? karmaIndexes.filter((index: number) => index < body.block_index)
      : karmaIndexes.concat(narratorIndexes.filter((index: number) => index < body.block_index));
    if (requiredPrior.some((index: number) => !acceptedBlocks.has(index))) {
      return reply(409, { error: targetSpeaker === "narrator"
        ? "لا يبدأ الراوي قبل اكتمال اعتماد جميع مقاطع كارما، ثم المقاطع السابقة للراوي."
        : "لا يبدأ مقطع كارما التالي قبل اعتماد مقاطع كارما السابقة." });
    }
    if (!GITHUB_TOKEN) return reply(503, { error: "سر GitHub غير متاح لإطلاق التوليد من صفحة المراجعة." });
    const apiHeaders = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
    const requestId = crypto.randomUUID();
    const dispatchResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/ibn-sina-namaa-cpu-pilot.yml/dispatches`, {
      method: "POST", headers: apiHeaders,
      body: JSON.stringify({
        ref: "main",
        inputs: {
          request_id: requestId,
          block_index: String(body.block_index),
          speech_text_b64: encodeBase64Utf8(speechRecord.approved_text),
        },
      }),
    });
    if (dispatchResponse.status !== 204) {
      const detail = await dispatchResponse.text();
      let reason = "";
      try { reason = String(JSON.parse(detail).message || ""); } catch { reason = detail; }
      reason = reason.replace(/\s+/g, " ").slice(0, 220);
      const retryAfter = dispatchResponse.headers.get("retry-after");
      const rateLimited = dispatchResponse.status === 429 ||
        (dispatchResponse.status === 403 && /rate limit|abuse|too many/i.test(reason));
      let error = "فشل إطلاق Workflow NAMAA من صفحة المراجعة.";
      if (rateLimited) {
        error = "GitHub رفض الطلب مؤقتًا بسبب كثرة الطلبات؛ انتظر دقائق" + (retryAfter ? " (نحو " + retryAfter + " ثانية)" : "") + " ثم أعد المحاولة.";
      } else if (dispatchResponse.status === 403) {
        error = "GitHub رفض الطلب (403) — يلزم أن يملك المفتاح صلاحية Actions: write على هذا الريبو، أو أن يكون الـ Workflow مفعّلًا.";
      } else if (dispatchResponse.status === 401) {
        error = "مفتاح GitHub غير صالح أو منتهي؛ حدّث GITHUB_PUBLISH_TOKEN في أسرار Supabase.";
      } else if (dispatchResponse.status === 404 || dispatchResponse.status === 422) {
        error = "GitHub لم يجد الـ Workflow أو الفرع main أو مدخلاته (" + dispatchResponse.status + ").";
      }
      if (reason) error += " [سبب GitHub: " + reason + "]";
      return reply(dispatchResponse.status === 403 || dispatchResponse.status === 429 ? 503 : 502, {
        error, upstream_status: dispatchResponse.status, detail: detail.slice(0, 500),
      });
    }
    return reply(200, { success: true, request_id: requestId, block_index: body.block_index });
  }

  if (body.action === "generation_status") {
    if (section !== "history" || slug !== "ibn-sina" || language !== "ar" ||
        typeof body.request_id !== "string" || !/^[a-f0-9-]{36}$/.test(body.request_id) ||
        !Number.isInteger(body.block_index) || body.block_index < 0 || body.block_index > 16) {
      return reply(400, { error: "بيانات متابعة طلب التوليد غير صالحة." });
    }
    if (!GITHUB_TOKEN) return reply(503, { error: "سر GitHub غير متاح لمتابعة التوليد." });
    const apiHeaders = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const workflow = "ibn-sina-namaa-cpu-pilot.yml";
    const runsResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=20`, { headers: apiHeaders });
    if (!runsResponse.ok) return reply(502, { error: "تعذر متابعة تشغيل التوليد.", upstream_status: runsResponse.status });
    const runsData = await runsResponse.json();
    const expectedTitle = "ابن سينا audio " + body.request_id + " block " + body.block_index;
    const run = (runsData.workflow_runs ?? []).find((item: any) => item.display_title === expectedTitle);
    if (!run) return reply(200, { success: true, status: "queued" });
    if (run.status !== "completed") return reply(200, { success: true, status: run.status || "in_progress", run_id: run.id });
    if (run.conclusion !== "success") {
      return reply(200, { success: true, status: "completed", conclusion: run.conclusion || "failure", run_id: run.id });
    }
    const artifactsResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts?per_page=100`, { headers: apiHeaders });
    if (!artifactsResponse.ok) return reply(502, { error: "انتهى التوليد لكن تعذر جلب بيانات ملف المراجعة.", upstream_status: artifactsResponse.status });
    const artifactsData = await artifactsResponse.json();
    const artifact = (artifactsData.artifacts ?? []).find((item: any) =>
      item.name === "ibn-sina-arabic-audio-staging" && item.expired !== true
    );
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
    const emptyReview = { version: 1, regen: {}, clips: {}, audio_hashes: {}, speech_texts: {} };
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
    if (isIbnSinaArabic && body.request_id) {
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
    const expectedFishVoices: Record<string, string> = {
      narrator: "a02a8220d6014812aa5ff73434c54cc0",
      karma: "592625f68416462f8b6161ddf5fdbffb",
    };
    const expectedNamaaVoices: Record<string, string> = {
      narrator: "magdi-yacoub-narrator-reference",
      karma: "magdi-yacoub-karma-reference",
    };
    const seen = new Set<string>();
    for (const segment of manifest.segments) {
      const fishOk = segment?.provider === "fish-audio" && segment?.model === "s2.1-pro-free" &&
        segment?.voice === expectedFishVoices[segment?.speaker];
      const namaaOk = segment?.provider === "huggingface-space" &&
        segment?.model === "NAMAA-Space/NAMAA-Egyptian-TTS" &&
        segment?.voice === expectedNamaaVoices[segment?.speaker];
      const engineOk = language === "ar"
        ? fishOk || namaaOk
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
      const { data, error } = await service.storage.from(BUCKET).createSignedUrl(prefix + "/" + segment.src, 3600);
      if (error || !data?.signedUrl) return reply(500, { error: "تعذر إنشاء رابط مؤقت لأحد المقاطع.", file: segment.src });
      signedSources[segment.src] = new URL(data.signedUrl, SUPABASE_URL + "/storage/v1/").href;
    }
    return reply(200, { success: true, manifest, signed_sources: signedSources, expires_in: 3600 });
  }

  return reply(400, { error: "إجراء غير معروف." });
});
