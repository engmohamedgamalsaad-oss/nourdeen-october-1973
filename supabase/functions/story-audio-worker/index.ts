import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (typeof keys.default === "string") return keys.default;
  } catch { /* use legacy variable below */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const SERVICE_KEY = secretKey();
const BUCKET = "khaledoon-audio-review";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-khaledoon-worker-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(500, { error: "Server credentials are not configured." });
  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (req.method === "GET") {
    const { data, error } = await service.from("story_audio_worker_credentials")
      .select("last_seen_at").eq("name", "colab-omnivoice-worker").eq("active", true).limit(1).maybeSingle();
    if (error) return reply(500, { error: "Unable to read worker status." });
    const lastSeenAt = data?.last_seen_at ?? null;
    const ageMs = lastSeenAt ? Date.now() - Date.parse(lastSeenAt) : Number.POSITIVE_INFINITY;
    return reply(200, { online: ageMs >= 0 && ageMs <= 90000, last_seen_at: lastSeenAt });
  }
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const supplied = req.headers.get("x-khaledoon-worker-token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(supplied)) return reply(401, { error: "Worker authentication required." });
  const suppliedHash = await sha256(new TextEncoder().encode(supplied));
  const { data: credentials, error: credentialError } = await service
    .from("story_audio_worker_credentials")
    .select("id")
    .eq("name", "colab-omnivoice-worker")
    .eq("token_sha256", suppliedHash)
    .eq("active", true)
    .limit(1);
  if (credentialError) return reply(500, { error: "Unable to verify worker credential." });
  if (!credentials?.length) return reply(401, { error: "Worker credential is invalid or revoked." });
  const presence = await service.from("story_audio_worker_credentials")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("name", "colab-omnivoice-worker").eq("active", true);
  if (presence.error) return reply(500, { error: "Unable to update worker presence." });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON body." }); }
  const action = body?.action;
  const workerId = typeof body?.worker_id === "string" ? body.worker_id.slice(0, 120) : "colab-omnivoice";
  if (!["claim", "heartbeat", "complete", "fail"].includes(action)) {
    return reply(400, { error: "Unsupported worker action." });
  }

  if (action === "claim") {
    const lease = Math.max(180, Math.min(1800, Number(body.lease_seconds) || 900));

    // Optional exact-ID claim for controlled one-clip pilots. The conditional
    // update makes the claim single-winner without invoking the general queue RPC.
    if (body.job_id !== undefined) {
      if (!validUuid(body.job_id)) return reply(400, { error: "A valid target job_id is required." });
      const { data: candidate, error: candidateError } = await service
        .from("story_audio_generation_queue")
        .select("id,status,attempts,max_attempts,available_at")
        .eq("id", body.job_id)
        .maybeSingle();
      if (candidateError) return reply(500, { error: "Unable to read target queue item.", detail: candidateError.message });
      if (!candidate || candidate.status !== "pending" ||
          Number(candidate.attempts) >= Number(candidate.max_attempts) ||
          Date.parse(candidate.available_at) > Date.now()) {
        return reply(200, { success: true, job: null, idle: true, target_unavailable: true });
      }
      const now = new Date().toISOString();
      const lockToken = crypto.randomUUID();
      const { data: exactJob, error: exactClaimError } = await service
        .from("story_audio_generation_queue")
        .update({
          status: "processing",
          attempts: Number(candidate.attempts) + 1,
          locked_at: now,
          lock_token: lockToken,
          worker_id: workerId,
          updated_at: now,
          last_error: null,
        })
        .eq("id", body.job_id)
        .eq("status", "pending")
        .eq("attempts", Number(candidate.attempts))
        .lte("available_at", now)
        .select("*")
        .maybeSingle();
      if (exactClaimError) return reply(500, { error: "Unable to claim exact queue item.", detail: exactClaimError.message });
      return reply(200, { success: true, job: exactJob ?? null, idle: !exactJob });
    }

    const { data, error } = await service.rpc("claim_story_audio_generation_job", {
      p_worker_id: workerId,
      p_lease_seconds: lease,
    });
    if (error) return reply(500, { error: "Unable to claim queue item.", detail: error.message });
    const job = Array.isArray(data) ? (data[0] ?? null) : data;
    return reply(200, { success: true, job, idle: !job });
  }

  const jobId = body?.job_id;
  const lockToken = body?.lock_token;
  if (!validUuid(jobId) || !validUuid(lockToken)) return reply(400, { error: "A valid job_id and lock_token are required." });
  const { data: job, error: readError } = await service.from("story_audio_generation_queue")
    .select("id,section,slug,language,block_index,speaker,engine,payload,source_text_hash,status,lock_token,attempts,max_attempts")
    .eq("id", jobId).eq("status", "processing").eq("lock_token", lockToken).maybeSingle();
  if (readError) return reply(500, { error: "Unable to read claimed queue item.", detail: readError.message });
  if (!job) return reply(409, { error: "This job lease is no longer owned by this worker." });

  if (action === "heartbeat") {
    const { data, error } = await service.from("story_audio_generation_queue")
      .update({ locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", jobId).eq("status", "processing").eq("lock_token", lockToken)
      .select("id").maybeSingle();
    if (error) return reply(500, { error: "Unable to renew job lease.", detail: error.message });
    if (!data) return reply(409, { error: "Job lease expired or was reclaimed." });
    return reply(200, { success: true, renewed: true });
  }

  if (action === "fail") {
    const message = String(body.error ?? "Worker failed without a reason").slice(0, 2000);
    const terminal = Number(job.attempts) >= Number(job.max_attempts);
    const availableAt = new Date(Date.now() + Math.min(300, Math.max(10, Number(job.attempts) * 10)) * 1000).toISOString();
    const { data, error } = await service.from("story_audio_generation_queue")
      .update({
        status: terminal ? "failed" : "pending",
        available_at: availableAt,
        locked_at: null,
        lock_token: null,
        worker_id: null,
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId).eq("status", "processing").eq("lock_token", lockToken)
      .select("id,status").maybeSingle();
    if (error) return reply(500, { error: "Unable to record worker failure.", detail: error.message });
    if (!data) return reply(409, { error: "Job lease expired or was reclaimed." });
    return reply(200, { success: true, status: data.status });
  }

  if (!["ar", "en"].includes(job.language)) return reply(422, { error: "Only Arabic and English are enabled in this rollout." });
  if (!["narrator", "karma"].includes(job.speaker)) return reply(422, { error: "Unknown speaker." });
  const audioBase64 = body.audio_base64;
  if (typeof audioBase64 !== "string" || audioBase64.length < 100 || audioBase64.length > 18_000_000) {
    return reply(400, { error: "Audio payload is missing or exceeds the 13.5 MB limit." });
  }
  const extension = body.extension === "wav" ? "wav" : body.extension === "mp3" ? "mp3" : "";
  const contentType = extension === "wav" ? "audio/wav" : extension === "mp3" ? "audio/mpeg" : "";
  if (!extension || body.content_type !== contentType) return reply(400, { error: "Audio extension and content type do not match." });

  let bytes: Uint8Array;
  try { bytes = decodeBase64(audioBase64); } catch { return reply(400, { error: "Audio payload is not valid base64." }); }
  if (!bytes.length || bytes.length > 13_500_000) return reply(413, { error: "Audio file exceeds the allowed size." });
  const digest = await sha256(bytes);
  if (typeof body.sha256 === "string" && body.sha256.toLowerCase() !== digest) {
    return reply(422, { error: "Audio SHA-256 does not match the uploaded bytes." });
  }
  const safeIndex = String(job.block_index).padStart(4, "0");
  const path = [job.section, job.slug, job.language, "block-" + safeIndex + "-" + digest.slice(0, 16) + "." + extension].join("/");
  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: "60",
  });
  if (uploadError) return reply(500, { error: "Unable to store generated audio privately.", detail: uploadError.message });

  const manifestPath = [job.section, job.slug, job.language, "manifest.json"].join("/");
  let manifest: any = { version: 1, section: job.section, story: job.slug, language: job.language, provider: "omnivoice", model: "VoiceTut Egyptian Tashkeel", segments: [] };
  const { data: oldManifestFile } = await service.storage.from(BUCKET).download(manifestPath);
  if (oldManifestFile) {
    try {
      const oldManifest = JSON.parse(await oldManifestFile.text());
      if (oldManifest?.version === 1 && oldManifest.section === job.section && oldManifest.story === job.slug &&
          oldManifest.language === job.language && Array.isArray(oldManifest.segments)) manifest = oldManifest;
    } catch { /* start a fresh manifest if the old one is malformed */ }
  }
  const segmentName = path.split("/").pop()!;
  const voiceName = job.speaker === "karma" ? "omnivoice-karma-reference" : "omnivoice-narrator-reference";
  const segment = {
    src: segmentName,
    block_index: job.block_index,
    chunk_index: 0,
    speaker: job.speaker,
    text: String(job.payload?.text ?? ""),
    provider: "omnivoice",
    model: "VoiceTut Egyptian Tashkeel",
    voice: voiceName,
    audio_sha256: digest,
  };
  manifest.segments = manifest.segments.filter((item: any) => !(Number(item.block_index) === Number(job.block_index) && Number(item.chunk_index || 0) === 0));
  manifest.segments.push(segment);
  manifest.segments.sort((a: any, b: any) => Number(a.block_index) - Number(b.block_index));
  manifest.provider = "omnivoice";
  manifest.model = "VoiceTut Egyptian Tashkeel";
  const manifestUpload = await service.storage.from(BUCKET).upload(manifestPath, new TextEncoder().encode(JSON.stringify(manifest)), {
    contentType: "application/json", upsert: true, cacheControl: "60",
  });
  if (manifestUpload.error) {
    await service.storage.from(BUCKET).remove([path]);
    return reply(500, { error: "Unable to update the private story manifest.", detail: manifestUpload.error.message });
  }
  const result = {
    bucket: BUCKET,
    path,
    sha256: digest,
    content_type: contentType,
    bytes: bytes.length,
    engine: job.engine,
    language: job.language,
    block_index: job.block_index,
    speaker: job.speaker,
  };
  const { data: completed, error: completeError } = await service.from("story_audio_generation_queue")
    .update({
      status: "completed",
      result,
      completed_at: new Date().toISOString(),
      locked_at: null,
      lock_token: null,
      worker_id: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId).eq("status", "processing").eq("lock_token", lockToken)
    .select("id,status,result").maybeSingle();
  if (completeError || !completed) {
    await service.storage.from(BUCKET).remove([path]);
    return reply(completeError ? 500 : 409, { error: "Could not finalize this job; its lease may have expired.", detail: completeError?.message });
  }
  return reply(200, { success: true, job_id: completed.id, status: completed.status, result: completed.result });
});
