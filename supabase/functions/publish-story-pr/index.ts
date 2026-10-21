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

function allowedPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length > 240 || path.startsWith("/") ||
      path.includes("\\") || path.split("/").includes("..")) return false;
  if (path === "stories/index.json") return true;
  if (/^stories\/quizzes\/[0-9]{3}\.json$/.test(path)) return true;
  if (!/^stories\/[a-z0-9-]+\/[0-9]{3}\/[A-Za-z0-9._/-]+$/.test(path)) return false;
  return ["html","json","css","js","svg","png","jpg","jpeg","webp","avif","woff2"].includes(path.split(".").pop()?.toLowerCase() ?? "");
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

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "نشر حكاية جديدة — خالدون عبر التاريخ";
  const description = typeof body.body === "string" ? body.body.slice(0, 5000) : "راجع الملفات ومعاينة GitHub Pages قبل الدمج. لم يتم النشر على main.";
  try {
    // Read the latest main commit. The final non-force ref update protects against concurrent changes.
    const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${BASE}`, githubToken);
    const baseSha = ref.object.sha;
    const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`, githubToken);
    const treeEntries = [];
    const storyPage = body.files.find((file: any) => /^stories\/[a-z0-9-]+\/[0-9]{3}\/index\.html$/.test(file.path));
    if (!storyPage) throw new Error('Missing generated story page index.html.');
    const pathMatch = storyPage.path.match(/^stories\/([a-z0-9-]+)\/([0-9]{3})\/index\.html$/);
    const storySection = pathMatch[1], storyId = pathMatch[2], storyRoot = 'stories/' + storySection + '/' + storyId + '/';
    for (const file of body.files) {
      if (file.path !== 'stories/index.json' && file.path !== ('stories/quizzes/' + storyId + '.json') && !file.path.startsWith(storyRoot)) {
        throw new Error('A file is outside the selected story folder; refusing to modify unrelated stories.');
      }
    }
    const incomingIndexFile = body.files.find((file: any) => file.path === 'stories/index.json');
    if (!incomingIndexFile) throw new Error('Missing stories/index.json.');
    const currentIndexResponse = await github('/repos/' + OWNER + '/' + REPO + '/contents/stories/index.json?ref=' + BASE, githubToken);
    const currentIndexBytes = Uint8Array.from(atob(currentIndexResponse.content.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    const currentIndex = JSON.parse(new TextDecoder().decode(currentIndexBytes));
    const incomingIndex = JSON.parse(incomingIndexFile.content);
    if (!Array.isArray(currentIndex) || !Array.isArray(incomingIndex)) throw new Error('Story index JSON must be arrays.');
    const normalizedRoot = storyRoot.replace(/\/$/, '');
    const incomingEntry = incomingIndex.find((entry: any) => String(entry.id ?? '').padStart(3, '0') === storyId && String(entry.path ?? '').split('/').filter(Boolean).join('/') === normalizedRoot);
    if (!incomingEntry) throw new Error('Generated index does not contain the generated story path.');
    const existingIndex = currentIndex.findIndex((entry: any) => String(entry.id ?? '').padStart(3, '0') === storyId);
    if (existingIndex >= 0 && String(currentIndex[existingIndex].path ?? '').split('/').filter(Boolean).join('/') !== normalizedRoot) {
      throw new Error('Story ID is already assigned to a different path; refusing to overwrite it.');
    }
    if (existingIndex >= 0) currentIndex[existingIndex] = incomingEntry; else currentIndex.push(incomingEntry);
    const safeFiles = body.files.map((file: any) => file.path === 'stories/index.json' ? { ...file, content: JSON.stringify(currentIndex, null, 2) + '\n' } : file);
    for (const file of safeFiles) {
      const blob = await github('/repos/' + OWNER + '/' + REPO + '/git/blobs', githubToken, {
        method: 'POST',
        body: JSON.stringify({ content: file.content, encoding: file.encoding === 'base64' ? 'base64' : 'utf-8' }),
      });
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await github(`/repos/${OWNER}/${REPO}/git/trees`, githubToken, {
      method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
    });
    const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, githubToken, {
      method: "POST", body: JSON.stringify({ message: `Publish approved story: ${title}`, tree: tree.sha, parents: [baseSha] }),
    });
    // Push straight to main, without a PR. force=false prevents overwriting concurrent main changes.
    await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${BASE}`, githubToken, {
      method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    const pageUrl = ALLOWED_ORIGIN + '/' + REPO + '/' + storyRoot;
    return reply(201, {
      success: true, published_to_main: true, commit_sha: commit.sha,
      story_id: storyId, story_path: normalizedRoot, page_url: pageUrl,
      message: "تم رفع ملفات الحكاية مباشرة إلى main؛ جارٍ التحقق من ظهورها على الموقع."
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return reply(502, { error: "تعذر إنشاء طلب الدمج على GitHub.", detail: detail.slice(0, 500) });
  }
});