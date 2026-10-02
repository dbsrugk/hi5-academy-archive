// 학원 아카이브 서버 함수 (Supabase Edge Function)
// 역할: 교직원 가입 신청·승인·로그인, 컬렉션별 권한 확인, 파일 서명, 접속 기록, 관리자 회원 관리
import { createClient } from "npm:@supabase/supabase-js@2";

type Role = "staff" | "admin";
type Json = Record<string, any>;
type Member = { id: string; campus: string; title: string; name: string; status: string; is_admin: boolean };

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "archive-files";
const CAMPUSES = ["센텀", "김해", "명지"];
const TITLES = ["원장", "전임", "행정"];
const SESSION_DAYS = 14;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-archive-token",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const now = () => new Date().toISOString();

// 컬렉션 규칙
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
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode((await config()).signing_secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
const b64url = (s: string) => btoa(String.fromCharCode(...enc.encode(s))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)));
async function issue(m: Member) {
  const body = b64url(JSON.stringify({ id: m.id, c: m.campus, n: m.name, t: m.title, a: m.is_admin, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 }));
  return `${body}.${await hmac(body)}`;
}
async function readToken(token: string | null) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if ((await hmac(body)) !== sig) return null;
  try { const p = JSON.parse(unb64url(body)); return p.exp > Date.now() / 1000 ? p : null; } catch { return null; }
}
async function pinHash(pin: string, salt: string) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(`${salt}:${pin}:${(await config()).signing_secret}`)));
}

// 회원 상태는 매 요청 DB에서 확인 (정지·관리자 해제가 즉시 반영되도록, 20초 캐시)
const memberCache = new Map<string, { at: number; m: Member | null }>();
async function currentMember(token: string | null): Promise<Member | null> {
  const p = await readToken(token);
  if (!p) return null;
  const hit = memberCache.get(p.id);
  if (hit && Date.now() - hit.at < 20_000) return hit.m;
  const { data } = await supabase.from("members").select("id,campus,title,name,status,is_admin").eq("id", p.id).maybeSingle();
  const m = data && data.status === "approved" ? (data as Member) : null;
  memberCache.set(p.id, { at: Date.now(), m });
  return m;
}
const meOf = (m: Member) => ({ id: m.id, campus: m.campus, title: m.title, name: m.name, isAdmin: m.is_admin });

async function log(member: { id?: string; name?: string } | null, action: string, path: string | null, ip: string) {
  await supabase.from("access_logs").insert({ member_id: member?.id ?? null, name: member?.name ?? null, action, path: path?.slice(0, 200) ?? null, ip });
}

// ---------- 가입·로그인 ----------
async function apply(body: Json, ip: string) {
  const campus = String(body.campus ?? ""), title = String(body.title ?? ""), name = String(body.name ?? "").trim().slice(0, 20), pin = String(body.pin ?? "");
  if (!CAMPUSES.includes(campus) || !TITLES.includes(title) || name.length < 2) return json({ ok: false, msg: "캠퍼스·직책·이름을 확인해 주세요." });
  if (!/^[0-9]{4}$/.test(pin)) return json({ ok: false, msg: "비밀번호는 숫자 4자리로 입력해 주세요." });
  if (body.agree !== true) return json({ ok: false, msg: "보안서약에 동의해 주세요." });
  const { data: exists } = await supabase.from("members").select("id,status").eq("campus", campus).eq("name", name).maybeSingle();
  if (exists) return json({ ok: false, msg: exists.status === "pending" ? "이미 신청되어 승인을 기다리고 있어요." : "같은 캠퍼스에 같은 이름이 이미 등록되어 있어요. 관리자에게 문의해 주세요." });
  const salt = crypto.randomUUID();
  const { data, error } = await supabase.from("members").insert({ campus, title, name, pin_salt: salt, pin_hash: await pinHash(pin, salt), pledge_at: now() }).select("id").single();
  if (error) throw error;
  await log({ id: data.id, name }, "apply", `${campus} ${title}`, ip);
  return json({ ok: true });
}
async function login(body: Json, ip: string) {
  const campus = String(body.campus ?? ""), name = String(body.name ?? "").trim(), pin = String(body.pin ?? "");
  const { data: m } = await supabase.from("members").select("*").eq("campus", campus).eq("name", name).maybeSingle();
  const fail = (msg = "캠퍼스·이름·비밀번호를 확인해 주세요.") => json({ ok: false, msg });
  if (!m) { await log({ name: `${campus} ${name}` }, "login_fail", "미등록", ip); return fail(); }
  if (m.locked_until && new Date(m.locked_until).getTime() > Date.now()) return fail("비밀번호를 여러 번 틀려 10분간 로그인이 잠겼어요.");
  if ((await pinHash(pin, m.pin_salt)) !== m.pin_hash) {
    const failed = (m.failed_count ?? 0) + 1;
    await supabase.from("members").update({ failed_count: failed >= 5 ? 0 : failed, locked_until: failed >= 5 ? new Date(Date.now() + 10 * 60000).toISOString() : null }).eq("id", m.id);
    await log(m, "login_fail", "비밀번호 오류", ip);
    return fail(failed >= 5 ? "비밀번호를 여러 번 틀려 10분간 로그인이 잠겼어요." : undefined);
  }
  if (m.status === "pending") return fail("아직 관리자 승인 전이에요. 승인 후 로그인할 수 있어요.");
  if (m.status !== "approved") return fail("사용할 수 없는 계정이에요. 관리자에게 문의해 주세요.");
  await supabase.from("members").update({ failed_count: 0, locked_until: null, last_seen: now() }).eq("id", m.id);
  memberCache.delete(m.id);
  await log(m, "login", null, ip);
  return json({ ok: true, token: await issue(m), me: meOf(m) });
}

// ---------- 관리자 ----------
async function adminList(body: Json) {
  const { data: members, error } = await supabase.from("members").select("id,campus,title,name,status,is_admin,pledge_at,last_seen,created_at").order("created_at", { ascending: false });
  if (error) throw error;
  let q = supabase.from("access_logs").select("id,member_id,name,action,path,ip,at").order("at", { ascending: false }).limit(Math.min(Number(body.limit) || 500, 1000));
  if (body.member) q = q.eq("member_id", String(body.member));
  const { data: logs, error: logError } = await q;
  if (logError) throw logError;
  return json({ ok: true, members, logs });
}
async function adminSet(body: Json, me: Member, ip: string) {
  const id = String(body.id ?? "");
  const patch: Json = {};
  if (body.status) { if (!["approved", "rejected", "suspended", "pending"].includes(body.status)) return json({ ok: false, msg: "잘못된 상태예요." }); patch.status = body.status; }
  if (typeof body.is_admin === "boolean") patch.is_admin = body.is_admin;
  if (typeof body.title === "string") { if (!TITLES.includes(body.title)) return json({ ok: false, msg: "잘못된 직책이에요." }); patch.title = body.title; }
  if (id === me.id && (patch.status && patch.status !== "approved" || patch.is_admin === false)) return json({ ok: false, msg: "본인 계정은 정지하거나 관리자 해제할 수 없어요." });
  if (!Object.keys(patch).length) return json({ ok: false, msg: "변경할 내용이 없어요." });
  const { data: target, error } = await supabase.from("members").update(patch).eq("id", id).select("campus,name").maybeSingle();
  if (error) throw error;
  memberCache.delete(id);
  await log(me, "admin", `${target?.campus ?? ""} ${target?.name ?? ""} → ${JSON.stringify(patch)}`, ip);
  return json({ ok: true });
}
async function adminDelete(body: Json, me: Member, ip: string) {
  const id = String(body.id ?? "");
  if (id === me.id) return json({ ok: false, msg: "본인 계정은 삭제할 수 없어요." });
  const { data: target } = await supabase.from("members").select("campus,name,status").eq("id", id).maybeSingle();
  if (!target) return json({ ok: false, msg: "회원을 찾을 수 없어요." });
  if (target.status === "approved") return json({ ok: false, msg: "승인된 회원은 먼저 정지한 뒤 삭제해 주세요." });
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) throw error;
  memberCache.delete(id);
  await log(me, "admin", `${target.campus} ${target.name} 삭제`, ip);
  return json({ ok: true });
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
// 제작실 기금은 직책이 '원장'인 회원만
function canRead(collection: string, role: Role, principal: boolean) {
  if (collection === "fund") return principal;
  if (ADMIN_READ.has(collection)) return role === "admin";
  return true;
}
function hideDraft(collection: string, role: Role, doc: Json) {
  const field = DRAFT_FIELD[collection];
  return role !== "admin" && field && doc[field] !== "published";
}
async function dbList(collection: string, role: Role, principal: boolean) {
  if (!canRead(collection, role, principal)) return json({ docs: [] });
  const { data, error } = await supabase.from("docs").select("id,data").eq("collection", collection).order("updated_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return json({ docs: (data ?? []).map((r) => ({ ...(r.data as Json), id: r.id })).filter((d) => !hideDraft(collection, role, d)) });
}
async function dbGet(collection: string, id: string, role: Role, principal: boolean) {
  if (!canRead(collection, role, principal)) return json({ doc: null });
  const { data, error } = await supabase.from("docs").select("id,data").eq("collection", collection).eq("id", id).maybeSingle();
  if (error) throw error;
  const doc = data ? { ...(data.data as Json), id: data.id } : null;
  return json({ doc: doc && !hideDraft(collection, role, doc) ? doc : null });
}
async function dbWrite(op: string, body: Json, role: Role, principal: boolean) {
  const collection = String(body.collection ?? ""), id = String(body.id ?? "");
  if (!COLLECTIONS.has(collection) || !/^[A-Za-z0-9_.:-]{1,120}$/.test(id)) return json({ error: "잘못된 요청입니다." }, 400);
  if (collection === "fund" && !principal) return json({ error: "제작실 기금은 원장만 관리할 수 있습니다." }, 403);
  const { data: existing, error: readError } = await supabase.from("docs").select("data").eq("collection", collection).eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (role !== "admin" && !(collection === "fund" && principal)) {
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
  if (JSON.stringify(next).length > 400_000) return json({ error: "기록이 너무 큽니다." }, 400);
  const { error } = await supabase.from("docs").upsert({ collection, id, data: next, updated_at: now() });
  if (error) throw error;
  return json({ ok: true });
}

// ---------- 라우터 ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const path = new URL(req.url).pathname.match(/\/api\/(.*)$/)?.[1] ?? "";
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  let body: Json = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch { body = {}; }
  try {
    if (path === "auth/apply") return await apply(body, ip);
    if (path === "auth/login") return await login(body, ip);

    const me = await currentMember(req.headers.get("x-archive-token"));
    if (path === "auth/session") return json(me ? { authenticated: true, role: me.is_admin ? "admin" : "staff", demo: false, me: meOf(me) } : { authenticated: false, role: null, demo: false, logout: true });
    if (!me) return json({ error: "인증이 필요합니다.", logout: true }, 401);
    const role: Role = me.is_admin ? "admin" : "staff";
    const principal = me.title === "원장";

    if (path === "ping") {
      await supabase.from("members").update({ last_seen: now() }).eq("id", me.id);
      if (body.path) await log(me, body.kind === "open" ? "open" : "view", String(body.path), ip);
      return json({ ok: true });
    }

    if (path === "admin/list" || path === "admin/set" || path === "admin/delete") {
      if (!me.is_admin) return json({ ok: false, msg: "관리자만 사용할 수 있어요." }, 403);
      if (path === "admin/list") return await adminList(body);
      if (path === "admin/set") return await adminSet(body, me, ip);
      return await adminDelete(body, me, ip);
    }

    if (path === "fund/session") return json({ authenticated: principal });
    if (path === "fund/config") return principal ? json({ accountLabel: (await config()).fund_account_label ?? "제작실 공동계좌" }) : json({ error: "제작실 기금은 원장만 열람할 수 있습니다." }, 403);

    if (path === "files/sign-upload") return await signUpload(body, role);
    if (path === "files/sign-read") return await signRead(body.keys);

    if (path === "db/list") return COLLECTIONS.has(body.collection) ? await dbList(body.collection, role, principal) : json({ docs: [] });
    if (path === "db/get") return COLLECTIONS.has(body.collection) ? await dbGet(body.collection, String(body.id ?? ""), role, principal) : json({ doc: null });
    if (path === "db/set" || path === "db/update" || path === "db/delete") return await dbWrite(path.slice(3), body, role, principal);
  } catch (error) {
    console.error("[archive-api]", error);
    return json({ error: "요청을 처리하지 못했습니다." }, 500);
  }
  return json({ error: "찾을 수 없는 요청입니다." }, 404);
});
