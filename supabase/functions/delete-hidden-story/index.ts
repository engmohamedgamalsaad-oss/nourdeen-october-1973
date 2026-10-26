import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
  if (!githubToken) return reply(503, { error: "سر GITHUB_PUBLISH_TOKEN غير مضبوط في Supabase." });

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
    return reply(200, { success: true, deletion_mode: "draft_pr", version: "2026-10-26-delete-pr-v1", writes_main_directly: false });
  }
  const id = String(body?.story_id ?? "");
  if (body?.action !== "delete_or_verify" || !/^[0-9]{3}$/.test(id)) {
    return reply(400, { error: "طلب الحذف أو رقم الحكاية غير صالح." });
  }

  const { data: hiddenRow, error: hiddenError } = await supabase
    .from("story_visibility").select("story_id").eq("story_id", id).maybeSingle();
  if (hiddenError) return reply(500, { error: "تعذر التأكد من أن الحكاية مخفية؛ لم يُحذف شيء." });
  if (!hiddenRow) return reply(409, { error: "يمكن حذف الحكايات المخفية فقط. أخفِ الحكاية أولًا." });

  let branchNameForRecovery = "";
  try {
    const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${BASE}`, githubToken);
    const baseSha = ref.object.sha;
    const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`, githubToken);
    const tree = await github(`/repos/${OWNER}/${REPO}/git/trees/${baseCommit.tree.sha}?recursive=1`, githubToken);
    if (tree.truncated) throw new Error("GitHub returned an incomplete file tree; refusing to delete anything.");
    const contents = await github(`/repos/${OWNER}/${REPO}/contents/stories/index.json?ref=${baseSha}`, githubToken);
    const indexBytes = Uint8Array.from(atob(String(contents.content).replace(/\\s/g, "")), (c) => c.charCodeAt(0));
    const index = JSON.parse(new TextDecoder().decode(indexBytes));
    if (!Array.isArray(index)) throw new Error("Story index is not an array.");
    const entryIndex = index.findIndex((entry: any) => String(entry?.id ?? "").padStart(3, "0") === id);
    const openPulls = await github(`/repos/${OWNER}/${REPO}/pulls?state=open&base=${BASE}&per_page=100`, githubToken);

    if (entryIndex < 0) {
      const closedPulls = await github(`/repos/${OWNER}/${REPO}/pulls?state=closed&base=${BASE}&per_page=100`, githubToken);
      const markerPrefix = `<!-- khaledoon-delete-story:${id}:`;
      const mergedPull = Array.isArray(closedPulls)
        ? closedPulls.find((pull: any) => String(pull.body ?? "").includes(markerPrefix) &&
            pull.head?.repo?.full_name === OWNER + "/" + REPO &&
            (pull.merged === true || Boolean(pull.merged_at)))
        : null;
      if (!mergedPull) return reply(404, { error: "الحكاية غير موجودة في الفهرس ولا يوجد طلب حذف مدموج يمكن التحقق منه؛ لم يُحذف سجل الإخفاء." });
      const markerMatch = String(mergedPull.body ?? "").match(new RegExp("<!-- khaledoon-delete-story:" + id + ":(stories/[a-z0-9-]+/" + id + ") -->"));
      if (!markerMatch) throw new Error("Merged deletion PR has no valid story-path marker; refusing to clean up visibility state.");
      const deletedPath = markerMatch[1];
      const remainingStoryFiles = tree.tree.some((item: any) => item.type === "blob" && item.path.startsWith(deletedPath + "/"));
      const quizPath = `stories/quizzes/${id}.json`;
      const quizStillExists = tree.tree.some((item: any) => item.type === "blob" && item.path === quizPath);
      const placesContents = await github(`/repos/${OWNER}/${REPO}/contents/stories/places.json?ref=${baseSha}`, githubToken);
      const placesBytes = Uint8Array.from(atob(String(placesContents.content).replace(/\\s/g, "")), (c) => c.charCodeAt(0));
      const places = JSON.parse(new TextDecoder().decode(placesBytes));
      if (!places || typeof places !== "object" || Array.isArray(places)) throw new Error("Current stories/places.json must be an object.");
      if (remainingStoryFiles || quizStillExists || Object.prototype.hasOwnProperty.call(places, id)) {
        throw new Error("The merged deletion PR did not remove the story folder, quiz, and map marker completely; visibility remains hidden.");
      }
      const { error: visibilityDeleteError } = await supabase.from("story_visibility").delete().eq("story_id", id);
      return reply(200, {
        success: true,
        deleted: true,
        story_id: id,
        pull_request_url: mergedPull.html_url,
        warning: visibilityDeleteError ? "تم التحقق من حذف الملفات من main، لكن تعذر تنظيف سجل الإخفاء؛ حدّث اللوحة وراجع سجل الإدارة." : undefined,
        message: "تم التحقق من دمج طلب الحذف واختفاء صفحة الحكاية وبنك الأسئلة وعلامة الخريطة؛ أُزيل سجل الإخفاء."
      });
    }

    const entry = index[entryIndex];
    const storyPath = String(entry.path ?? "").replace(/\\/$/, "");
    if (!new RegExp(`^stories/[a-z0-9-]+/${id}$`).test(storyPath) || entry.published === false) {
      throw new Error("The indexed story path is not an eligible published story; refusing deletion.");
    }
    const marker = `<!-- khaledoon-delete-story:${id}:${storyPath} -->`;
    const existingPull = Array.isArray(openPulls)
      ? openPulls.find((pull: any) => String(pull.body ?? "").includes(marker) && pull.head?.repo?.full_name === OWNER + "/" + REPO)
      : null;
    if (existingPull) {
      return reply(200, {
        success: true, pending: true, deleted: false, story_id: id,
        pull_request_url: existingPull.html_url, pull_request_number: existingPull.number,
        branch: existingPull.head?.ref ?? null, story_path: storyPath,
        message: "يوجد طلب حذف Draft مفتوح بالفعل. لا تزال الحكاية مخفية ولم تتغير ملفات main؛ راجع الطلب وادمجه فقط بعد مراجعة الفحوصات."
      });
    }

    const storyFiles = tree.tree.filter((item: any) => item.type === "blob" && item.path.startsWith(storyPath + "/"));
    const quizPath = `stories/quizzes/${id}.json`;
    const quizExists = tree.tree.some((item: any) => item.type === "blob" && item.path === quizPath);
    if (!storyFiles.some((item: any) => item.path === storyPath + "/index.html")) {
      throw new Error("The story page file is missing; refusing a partial deletion.");
    }
    const placesContents = await github(`/repos/${OWNER}/${REPO}/contents/stories/places.json?ref=${baseSha}`, githubToken);
    const placesBytes = Uint8Array.from(atob(String(placesContents.content).replace(/\\s/g, "")), (c) => c.charCodeAt(0));
    const places = JSON.parse(new TextDecoder().decode(placesBytes));
    if (!places || typeof places !== "object" || Array.isArray(places)) throw new Error("Current stories/places.json must be an object.");
    const deletions = storyFiles.map((item: any) => ({ path: item.path, mode: item.mode || "100644", type: "blob", sha: null }));
    if (quizExists) deletions.push({ path: quizPath, mode: "100644", type: "blob", sha: null });
    index.splice(entryIndex, 1);
    delete places[id];
    const indexBlob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, githubToken, {
      method: "POST",
      body: JSON.stringify({ content: JSON.stringify(index, null, 2) + "\\n", encoding: "utf-8" }),
    });
    const placesBlob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, githubToken, {
      method: "POST",
      body: JSON.stringify({ content: JSON.stringify(places, null, 2) + "\\n", encoding: "utf-8" }),
    });
    deletions.push({ path: "stories/index.json", mode: "100644", type: "blob", sha: indexBlob.sha });
    deletions.push({ path: "stories/places.json", mode: "100644", type: "blob", sha: placesBlob.sha });
    const newTree = await github(`/repos/${OWNER}/${REPO}/git/trees`, githubToken, {
      method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: deletions }),
    });
    const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, githubToken, {
      method: "POST",
      body: JSON.stringify({ message: `Prepare hidden-story deletion for review: ${id}`, tree: newTree.sha, parents: [baseSha] }),
    });
    const branchSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const branchName = `khaledoon/delete-story-${id}-${branchSuffix}`;
    branchNameForRecovery = branchName;
    await github(`/repos/${OWNER}/${REPO}/git/refs`, githubToken, {
      method: "POST",
      body: JSON.stringify({ ref: "refs/heads/" + branchName, sha: commit.sha }),
    });
    const description = `<!-- khaledoon-delete-story:${id}:${storyPath} -->\\n\\n` +
      `Draft deletion request for hidden story ${id}: ${String(entry.title ?? "").slice(0, 100)}.\\n\\n` +
      "- This request removes the story folder, quiz file, index entry, and map marker.\\n" +
      "- The story remains hidden while this draft is reviewed.\\n" +
      "- No files or database visibility rows are deleted until a human reviews and merges the PR, then confirms deletion in the admin.";
    const pull = await github(`/repos/${OWNER}/${REPO}/pulls`, githubToken, {
      method: "POST",
      body: JSON.stringify({ title: `حذف حكاية مخفية ${id}: ${String(entry.title ?? "").slice(0, 80)}`, head: branchName, base: BASE, body: description, draft: true }),
    });
    return reply(201, {
      success: true, pending: true, deleted: false, story_id: id,
      pull_request_url: pull.html_url, pull_request_number: pull.number,
      branch: branchName, story_path: storyPath, deleted_files: storyFiles.length + (quizExists ? 1 : 0),
      message: "تم إنشاء طلب حذف Draft. الحكاية ما زالت مخفية، ولم تتغير ملفات الموقع أو سجل الإخفاء؛ راجع الطلب وادمجه بعد نجاح الفحوصات."
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return reply(502, { error: "تعذر إنشاء أو التحقق من طلب حذف الحكاية؛ لم تُكتب ملفات الحكاية إلى main.", detail: detail.slice(0, 500), branch: branchNameForRecovery || null });
  }
});