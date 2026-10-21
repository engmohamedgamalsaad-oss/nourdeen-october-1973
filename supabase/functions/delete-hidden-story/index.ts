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
  const id = String(body?.story_id ?? "");
  if (!/^[0-9]{3}$/.test(id)) return reply(400, { error: "رقم الحكاية غير صالح." });

  const { data: hiddenRow, error: hiddenError } = await supabase
    .from("story_visibility").select("story_id").eq("story_id", id).maybeSingle();
  if (hiddenError) return reply(500, { error: "تعذر التأكد من أن الحكاية مخفية؛ لم يُحذف شيء." });
  if (!hiddenRow) return reply(409, { error: "يمكن حذف الحكايات المخفية فقط. أخفِ الحكاية أولًا." });

  try {
    const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${BASE}`, githubToken);
    const baseSha = ref.object.sha;
    const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`, githubToken);
    const tree = await github(`/repos/${OWNER}/${REPO}/git/trees/${baseCommit.tree.sha}?recursive=1`, githubToken);
    if (tree.truncated) throw new Error("GitHub returned an incomplete file tree; refusing to delete anything.");
    const contents = await github(`/repos/${OWNER}/${REPO}/contents/stories/index.json?ref=${BASE}`, githubToken);
    const indexBytes = Uint8Array.from(atob(String(contents.content).replace(/\s/g, "")), (c) => c.charCodeAt(0));
    const index = JSON.parse(new TextDecoder().decode(indexBytes));
    if (!Array.isArray(index)) throw new Error("Story index is not an array.");
    const entryIndex = index.findIndex((entry: any) => String(entry?.id ?? "").padStart(3, "0") === id);
    if (entryIndex < 0) return reply(404, { error: "الحكاية غير موجودة في فهرس الموقع؛ لم يُحذف شيء." });
    const entry = index[entryIndex];
    const path = String(entry.path ?? "").replace(/\/$/, "");
    if (!new RegExp(`^stories/[a-z0-9-]+/${id}$`).test(path) || entry.published === false) {
      throw new Error("The indexed story path is not an eligible published story; refusing deletion.");
    }
    const storyFiles = tree.tree.filter((item: any) => item.type === "blob" && item.path.startsWith(path + "/"));
    const quizPath = `stories/quizzes/${id}.json`;
    const quizExists = tree.tree.some((item: any) => item.type === "blob" && item.path === quizPath);
    if (!storyFiles.some((item: any) => item.path === path + "/index.html")) {
      throw new Error("The story page file is missing; refusing a partial deletion.");
    }
    const deletions = storyFiles.map((item: any) => ({ path: item.path, mode: item.mode || "100644", type: "blob", sha: null }));
    if (quizExists) deletions.push({ path: quizPath, mode: "100644", type: "blob", sha: null });
    index.splice(entryIndex, 1);
    const indexBlob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, githubToken, {
      method: "POST",
      body: JSON.stringify({ content: JSON.stringify(index, null, 2) + "\n", encoding: "utf-8" }),
    });
    deletions.push({ path: "stories/index.json", mode: "100644", type: "blob", sha: indexBlob.sha });
    const newTree = await github(`/repos/${OWNER}/${REPO}/git/trees`, githubToken, {
      method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: deletions }),
    });
    const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, githubToken, {
      method: "POST",
      body: JSON.stringify({ message: `Delete hidden story ${id}: ${String(entry.title ?? "").slice(0, 100)}`, tree: newTree.sha, parents: [baseSha] }),
    });
    await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${BASE}`, githubToken, {
      method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    const { error: visibilityDeleteError } = await supabase.from("story_visibility").delete().eq("story_id", id);
    return reply(200, {
      success: true, story_id: id, deleted_files: storyFiles.length + (quizExists ? 1 : 0),
      commit_sha: commit.sha,
      warning: visibilityDeleteError ? "تم حذف ملفات الموقع، لكن تعذر تنظيف سجل الإخفاء؛ حدّث اللوحة وأعد المحاولة بعد مراجعة الحالة." : undefined,
      message: "تم حذف صفحة الحكاية وملفاتها من الموقع وإزالتها من الفهرس."
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return reply(502, { error: "تعذر حذف الحكاية من GitHub؛ لم نعرض العملية كنجاح.", detail: detail.slice(0, 400) });
  }
});