// 학원 아카이브 서버 함수 (Supabase Edge Function)
// 역할: 인증키 로그인, 컬렉션별 읽기·쓰기 권한 확인, 파일 업로드·조회 서명, 제작실 기금 잠금
import { createClient } from "npm:@supabase/supabase-js@2";

type Role = "staff" | "admin";
type Json = Record<string, any>;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "archive-files";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-archive-token, x-fund-token",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const now = () => new Date().toISOString();

// 컬렉션 규칙: 직원이 새로 등록할 수 있는 곳 / 관리자 전용 열람 / 직원에게 초안을 숨길 필드
const COLLECTIONS = new Set(["events", "marketing", "meetings", "promotions", "productionRequests", "productionSchedules", "productionPriority", "complianceRequirements", "complianceSubmissions", "complianceLogs", "fund"]);
const STAFF_CREATE = new Set(["promotions", "productionRequests", "complianceSubmissions", "complianceLogs"]);
const ADMIN_READ = new Set(["complianceLogs"]);
const DRAFT_FIELD: Record<string, string> = { events: "status", marketing: "status", meetings: "status", promotions: "visibility" };

// ---------- 설정·토큰 ----------
let configCache: { at: number; values: Record<string, string> } | null = null;
async function config() {
  if (configCache && Date.now() - configCache.at < 60_000) return configCache.values;
  const { data, error } = await supabase.from("app_config").select("key,value");
  if (error) throw error;
  configCache = { at: Date.now(), values: Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) };
  return configCache.values;
}
const enc = new TextEncoder();
async function sha256(value: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(payload: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode((await config()).signing_secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return btoa(String.fromCharCode(...sig)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
async function issue(scope: string, seconds: number) {
  const payload = `${scope}.${Math.floor(Date.now() / 1000) + seconds}`;
  return `${payload}.${await hmac(payload)}`;
}
async function verify(token: string | null, scopes: string[]) {
  if (!token) return null;
  const [scope, exp, sig] = token.split(".");
  if (!scopes.includes(scope) || !exp || !sig || Number(exp) <= Date.now() / 1000) return null;
  return (await hmac(`${scope}.${exp}`)) === sig ? scope : null;
}

// ---------- 파일 ----------
const previewTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
async function signUpload(body: Json, role: Role) {
  const purpose = body.purpose === "source" ? "source" : body.purpose === "certificate" ? "certificate" : "preview";
  if (purpose === "source" && role !== "admin") return json({ error: "본사 관리자 권한이 필요합니다." }, 403);
  const name = String(body.name ?? "").slice(0, 255), type = String(body.type ?? ""), size = Number(body.size ?? 0);
  if (!name || !size) return json({ error: "업로드할 파일을 선택해 주세요." }, 400);
  if (purpose === "preview" && !previewTypes.has(type)) return json({ error: "이미지 파일(JPG·PNG·WEBP·GIF)만 올릴 수 있습니다." }, 400);
  if (size > (purpose === "preview" ? 15 : 50) * 1024 * 1024) return json({ error: "파일 크기가 너무 큽니다." }, 400);
  const ext = (name.includes(".") ? name.split(".").pop()! : "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const key = `${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(key);
  if (error) throw error;
  return json({ key, name, token: data.token, signedUrl: data.signedUrl }, 201);
}
async function signRead(keys: unknown) {
  const list = [...new Set((Array.isArray(keys) ? keys : []).filter((k): k is string => typeof k === "string" && /^[a-f0-9-]+\.[a-z0-9]{1,8}$/.test(k)))].slice(0, 500);
  if (!list.length) return json({ urls: {} });
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(list, 60 * 60 * 6);
  if (error) throw error;
  return json({ urls: Object.fromEntries((data ?? []).filter((i) => i.path && i.signedUrl).map((i) => [i.path, i.signedUrl])) });
}

// ---------- 문서 ----------
function canRead(collection: string, role: Role, fundOk: boolean) {
  if (collection === "fund") return role === "admin" && fundOk;
  if (ADMIN_READ.has(collection)) return role === "admin";
  return true;
}
function hideDraft(collection: string, role: Role, doc: Json) {
  const field = DRAFT_FIELD[collection];
  return role !== "admin" && field && doc[field] !== "published";
}
async function dbList(collection: string, role: Role, fundOk: boolean) {
  if (!canRead(collection, role, fundOk)) return json({ docs: [] });
  const { data, error } = await supabase.from("docs").select("id,data").eq("collection", collection).order("updated_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return json({ docs: (data ?? []).map((r) => ({ ...(r.data as Json), id: r.id })).filter((d) => !hideDraft(collection, role, d)) });
}
async function dbGet(collection: string, id: string, role: Role, fundOk: boolean) {
  if (!canRead(collection, role, fundOk)) return json({ doc: null });
  const { data, error } = await supabase.from("docs").select("id,data").eq("collection", collection).eq("id", id).maybeSingle();
  if (error) throw error;
  const doc = data ? { ...(data.data as Json), id: data.id } : null;
  return json({ doc: doc && !hideDraft(collection, role, doc) ? doc : null });
}
async function dbWrite(op: string, body: Json, role: Role) {
  const collection = String(body.collection ?? ""), id = String(body.id ?? "");
  if (!COLLECTIONS.has(collection) || !/^[A-Za-z0-9_.:-]{1,120}$/.test(id)) return json({ error: "잘못된 요청입니다." }, 400);
  const { data: existing, error: readError } = await supabase.from("docs").select("data").eq("collection", collection).eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (role !== "admin") {
    // 직원은 허용된 컬렉션에 "새 기록 등록"만 가능 (수정·삭제는 관리자)
    if (op !== "set" || !STAFF_CREATE.has(collection) || existing) return json({ error: "본사 관리자 권한이 필요합니다." }, 403);
  }
  if (op === "delete") {
    const { error } = await supabase.from("docs").delete().eq("collection", collection).eq("id", id);
    if (error) throw error;
    return json({ ok: true });
  }
  let next: Json = typeof body.data === "object" && body.data ? { ...body.data } : {};
  delete next.id;
  if (op === "update") {
    if (!existing) return json({ error: "기록을 찾을 수 없습니다." }, 404);
    next = { ...(existing.data as Json), ...next };
  }
  if (role !== "admin" && collection === "promotions") next.visibility = "draft";
  const size = JSON.stringify(next).length;
  if (size > 400_000) return json({ error: "기록이 너무 큽니다." }, 400);
  const { error } = await supabase.from("docs").upsert({ collection, id, data: next, updated_at: now() });
  if (error) throw error;
  return json({ ok: true });
}

// ---------- 라우터 ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const path = new URL(req.url).pathname.match(/\/api\/(.*)$/)?.[1] ?? "";
  let body: Json = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch { body = {}; }
  try {
    if (path === "auth/login") {
      const key = String(body.key ?? "").trim().slice(0, 200);
      const cfg = await config();
      const hash = key ? await sha256(key) : "";
      const role: Role | null = hash && hash === cfg.admin_key_hash ? "admin" : hash && hash === cfg.staff_key_hash ? "staff" : null;
      if (!role) return json({ error: "인증키가 올바르지 않습니다." }, 401);
      return json({ role, token: await issue(role, 60 * 60 * 12) });
    }
    const role = (await verify(req.headers.get("x-archive-token"), ["staff", "admin"])) as Role | null;
    if (path === "auth/session") return json({ authenticated: Boolean(role), role, demo: false });
    if (!role) return json({ error: "인증이 필요합니다." }, 401);
    const fundOk = role === "admin" && Boolean(await verify(req.headers.get("x-fund-token"), ["fund"]));

    if (path === "fund/login") {
      if (role !== "admin") return json({ error: "제작실 기금은 본사 관리자만 열람할 수 있습니다." }, 403);
      const password = String(body.password ?? "").trim().slice(0, 200);
      if (!password || (await sha256(password)) !== (await config()).fund_password_hash) return json({ error: "비밀번호가 올바르지 않습니다." }, 401);
      return json({ authenticated: true, token: await issue("fund", 60 * 30) });
    }
    if (path === "fund/session") return json({ authenticated: fundOk });
    if (path === "fund/config") return fundOk ? json({ accountLabel: (await config()).fund_account_label ?? "제작실 공동계좌" }) : json({ error: "인증이 필요합니다." }, 401);

    if (path === "files/sign-upload") return await signUpload(body, role);
    if (path === "files/sign-read") return await signRead(body.keys);

    if (path === "db/list") return COLLECTIONS.has(body.collection) ? await dbList(body.collection, role, fundOk) : json({ docs: [] });
    if (path === "db/get") return COLLECTIONS.has(body.collection) ? await dbGet(body.collection, String(body.id ?? ""), role, fundOk) : json({ doc: null });
    if (path === "db/set" || path === "db/update" || path === "db/delete") return await dbWrite(path.slice(3), body, role);
  } catch (error) {
    console.error("[archive-api]", error);
    return json({ error: "요청을 처리하지 못했습니다." }, 500);
  }
  return json({ error: "찾을 수 없는 요청입니다." }, 404);
});
