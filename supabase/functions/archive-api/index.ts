// 학원 아카이브 서버 함수 (Supabase Edge Function)
// 역할: 교직원 가입 신청·승인·로그인, 컬렉션별 권한 확인, 파일 서명, 접속 기록, 관리자 회원 관리
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Role = "staff" | "admin";
type Json = Record<string, any>;
type Member = { id: string; campus: string; title: string; name: string; status: string; is_admin: boolean };

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "archive-files";
const CAMPUSES = ["센텀", "김해", "명지"];
const TITLES = ["원장", "전임", "행정", "이사"];
const ALL_CAMPUS = "전체"; // 이사는 특정 캠퍼스 소속이 아님
const isPrincipal = (t: string) => t === "원장" || t === "이사";
const SESSION_DAYS = 14;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-archive-token, x-cron-secret",
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

// ---------- 알림 (알림함 + 휴대폰 웹 푸시) ----------
type Note = { kind: string; title: string; body?: string; link?: string; ref?: string; mail?: boolean };
const SITE = "https://hi5-academy-archive.vercel.app/";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
let vapidReady = false;
async function setupVapid() {
  if (vapidReady) return true;
  const c = await config();
  if (!c.vapid_public || !c.vapid_private) return false;
  webpush.setVapidDetails(c.vapid_subject || "https://hi5-academy-archive.vercel.app", c.vapid_public, c.vapid_private);
  vapidReady = true;
  return true;
}
function background(p: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  const safe = p.catch((e) => console.error("[notify]", e));
  if (rt?.waitUntil) rt.waitUntil(safe); else return safe;
}
async function adminIds(except?: string) {
  const { data } = await supabase.from("members").select("id").eq("is_admin", true).eq("status", "approved");
  return (data ?? []).map((r) => r.id).filter((id) => id !== except);
}
async function sendPush(memberIds: string[], n: Note) {
  if (!memberIds.length || !(await setupVapid())) return;
  const { data: subs } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("member_id", memberIds);
  const payload = JSON.stringify({ title: n.title, body: n.body ?? "", link: n.link ?? "/", tag: n.ref ?? n.kind });
  await Promise.allSettled((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" });
      await supabase.from("push_subscriptions").update({ last_ok_at: now() }).eq("id", s.id);
    } catch (e) {
      const code = (e as any)?.statusCode;
      if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("[push]", code, (e as any)?.body ?? e);
    }
  }));
}
// ---------- 메일 (구글 Apps Script 중계) ----------
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
function mailHtml(heading: string, items: { title: string; body?: string }[], link = "") {
  const url = SITE + (link.startsWith("#") ? link : "");
  const rows = items.map((it) => `<tr><td style="padding:14px 16px;border-bottom:1px solid #eef0f4"><div style="font-size:15px;font-weight:700;color:#111827">${esc(it.title)}</div>${it.body ? `<div style="margin-top:4px;font-size:14px;color:#4b5563;line-height:1.5">${esc(it.body)}</div>` : ""}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#1e3a8a;padding:16px 20px;color:#fff;font-size:13px;letter-spacing:.3px">하이파이브 아카이브 · 알림</td></tr>
<tr><td style="padding:18px 16px 6px;font-size:17px;font-weight:800;color:#111827">${esc(heading)}</td></tr>
${rows}
<tr><td align="center" style="padding:20px"><a href="${url}" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:10px">사이트에서 보기</a></td></tr>
<tr><td style="padding:0 20px 18px;font-size:12px;color:#9ca3af;line-height:1.5">이 메일은 아카이브 '내 정보'에서 메일 알림을 켜 두셔서 보내 드렸어요. 끄려면 사이트 왼쪽 아래 내 이름을 눌러 주세요.</td></tr>
</table></td></tr></table></body></html>`;
}
async function relay(to: string, subject: string, html: string) {
  const c = await config();
  if (!c.mail_relay_url || !c.mail_relay_secret) return { ok: false, reason: "not-configured" };
  const r = await fetch(c.mail_relay_url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify({ secret: c.mail_relay_secret, to, subject, html }), redirect: "follow", signal: AbortSignal.timeout(20_000) });
  const text = await r.text();
  let out: Json = {};
  try { out = JSON.parse(text); } catch { out = { ok: false, reason: `HTTP ${r.status}` }; }
  if (!out.ok) console.error("[mail]", r.status, text.slice(0, 200));
  return out;
}
async function mailTargets(memberIds: string[]) {
  if (!memberIds.length) return [];
  const { data } = await supabase.from("members").select("id,email").in("id", memberIds).eq("email_on", true).eq("status", "approved").not("email", "is", null);
  return (data ?? []) as { id: string; email: string }[];
}
async function sendMail(memberIds: string[], n: Note) {
  const c = await config();
  if (!c.mail_relay_url) return;
  for (const t of await mailTargets(memberIds)) await relay(t.email, `[아카이브] ${n.title.replace(/^\S+\s/, "")}`, mailHtml(n.title, [{ title: n.title, body: n.body }], n.link)).catch((e) => console.error("[mail]", e));
}

// 알림함에 기록하고 휴대폰·메일로도 보낸다. ref가 같으면 한 번만.
async function notify(memberIds: string[], n: Note): Promise<string[]> {
  const ids = [...new Set(memberIds.filter(Boolean))];
  if (!ids.length) return [];
  const sent: string[] = [];
  for (const member_id of ids) {
    const { error } = await supabase.from("notifications").insert({ member_id, kind: n.kind, title: n.title.slice(0, 120), body: (n.body ?? "").slice(0, 400), link: n.link ?? null, ref: n.ref ?? null });
    if (!error) sent.push(member_id);
    else if (error.code !== "23505") console.error("[notify]", error);
  }
  await sendPush(sent, n);
  if (n.mail !== false) await sendMail(sent, n);
  return sent;
}
const shortCampus = (b: string) => String(b ?? "").replace("캠퍼스", "");
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 86400_000).toISOString().slice(0, 10);
const REQUEST_NOTES: Record<string, (r: Json) => Note> = {
  producing: (r) => ({ kind: "request", title: "✅ 제작 요청이 승인됐어요", body: `'${r.title}' 제작을 시작했어요${r.assignee ? ` · 담당 ${r.assignee}` : ""}`, link: "#requests" }),
  reviewing: (r) => ({ kind: "request", title: "👀 시안이 나왔어요", body: `'${r.title}' 시안을 확인해 주세요`, link: "#requests" }),
  delayed: (r) => ({ kind: "request", title: "⏰ 제작이 지연되고 있어요", body: `'${r.title}' · ${r.delayedReason || "사유 미입력"}${r.revisedDueDate ? ` · 변경 완료일 ${r.revisedDueDate}` : ""}`, link: "#requests" }),
  completed: (r) => ({ kind: "request", title: "🎉 제작이 완료됐어요", body: `'${r.title}'${r.driveUrl ? " · Drive에서 확인하세요" : ""}`, link: "#requests" }),
};
// 매일 오전 9시: 마감 임박인데 승인 대기 / 마감 지난 진행 중 요청
async function dailyCheck() {
  const { data } = await supabase.from("docs").select("id,data").eq("collection", "productionRequests");
  const today = kstToday(), soon = addDays(today, 2);
  const admins = await adminIds();
  let count = 0;
  const digest = new Map<string, { title: string; body?: string }[]>();
  const add = (ids: string[], n: Note) => ids.forEach((id) => digest.set(id, [...(digest.get(id) ?? []), { title: n.title, body: n.body }]));
  for (const row of data ?? []) {
    const r = row.data as Json;
    const due = r.revisedDueDate || r.desiredDate;
    if (!due || r.status === "completed") continue;
    if (r.status === "approval_pending" && due <= soon) {
      const n: Note = { kind: "deadline", title: "⏰ 마감이 가까운데 아직 승인 대기예요", body: `${shortCampus(r.branch)} · '${r.title}' · 마감 ${due}`, link: "#requests", ref: `pending-${row.id}-${today}`, mail: false };
      add(await notify(admins, n), n); count++;
    } else if (r.status !== "approval_pending" && due < today) {
      const n: Note = { kind: "deadline", title: "🚨 마감일이 지났어요", body: `${shortCampus(r.branch)} · '${r.title}' · 마감 ${due} · ${r.assignee || "담당 미정"}`, link: "#requests", ref: `late-${row.id}-${today}`, mail: false };
      add(await notify([...admins, r.createdById].filter(Boolean), n), n); count++;
    }
  }
  // 메일은 사람마다 한 통으로 묶어서
  if ((await config()).mail_relay_url) {
    for (const t of await mailTargets([...digest.keys()])) {
      const items = digest.get(t.id)!;
      await relay(t.email, `[아카이브] 오늘 확인할 제작 요청 ${items.length}건`, mailHtml(`📋 오늘 확인할 제작 요청 ${items.length}건`, items, "#requests")).catch((e) => console.error("[mail]", e));
    }
  }
  return count;
}
async function notifyList(me: Member) {
  const { data: items } = await supabase.from("notifications").select("id,kind,title,body,link,created_at,read_at").eq("member_id", me.id).order("created_at", { ascending: false }).limit(40);
  const { count: unread } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("member_id", me.id).is("read_at", null);
  const badges: Json = {};
  if (me.is_admin) {
    const { count: requests } = await supabase.from("docs").select("id", { count: "exact", head: true }).eq("collection", "productionRequests").eq("data->>status", "approval_pending");
    const { count: members } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "pending");
    badges.requests = requests ?? 0; badges.members = members ?? 0;
  }
  const { count: devices } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("member_id", me.id);
  return json({ items: items ?? [], unread: unread ?? 0, badges, devices: devices ?? 0, vapidKey: (await config()).vapid_public ?? null });
}

// ---------- 가입·로그인 ----------
async function apply(body: Json, ip: string) {
  const title = String(body.title ?? ""), name = String(body.name ?? "").trim().slice(0, 20), pin = String(body.pin ?? "");
  const campus = title === "이사" ? ALL_CAMPUS : String(body.campus ?? "");
  if (!(CAMPUSES.includes(campus) || campus === ALL_CAMPUS) || !TITLES.includes(title) || name.length < 2) return json({ ok: false, msg: "캠퍼스·직책·이름을 확인해 주세요." });
  if (!/^[0-9]{4}$/.test(pin)) return json({ ok: false, msg: "비밀번호는 숫자 4자리로 입력해 주세요." });
  if (body.agree !== true) return json({ ok: false, msg: "보안서약에 동의해 주세요." });
  const email = String(body.email ?? "").trim().slice(0, 120);
  if (email && !EMAIL_RE.test(email)) return json({ ok: false, msg: "메일 주소 형식을 확인해 주세요." });
  const { data: exists } = await supabase.from("members").select("id,status").eq("campus", campus).eq("name", name).maybeSingle();
  if (exists) return json({ ok: false, msg: exists.status === "pending" ? "이미 신청되어 승인을 기다리고 있어요." : "같은 캠퍼스에 같은 이름이 이미 등록되어 있어요. 관리자에게 문의해 주세요." });
  const salt = crypto.randomUUID();
  const { data, error } = await supabase.from("members").insert({ campus, title, name, pin_salt: salt, pin_hash: await pinHash(pin, salt), pledge_at: now(), email: email || null, email_on: !!email }).select("id").single();
  if (error) throw error;
  await log({ id: data.id, name }, "apply", `${campus} ${title}`, ip);
  background(adminIds().then((ids) => notify(ids, { kind: "member", title: "🙋 새 가입 신청이 있어요", body: `${campus} ${title} ${name} · 회원 관리에서 승인해 주세요`, link: "#admin", ref: `apply-${data.id}` })));
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
async function adminList() {
  const { data: members, error } = await supabase.from("members").select("id,campus,title,name,status,is_admin,pledge_at,last_seen,created_at,email,email_on").order("created_at", { ascending: false });
  if (error) throw error;
  return json({ ok: true, members });
}
// 접속 기록 검색: 검색어(이름·내용·IP) · 구분 · 캠퍼스 · 사람 · 기간 · 페이지
async function adminLogs(body: Json) {
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 5000);
  const offset = Math.max(Number(body.offset) || 0, 0);
  let q = supabase.from("access_logs").select("id,member_id,name,action,path,ip,at", { count: "exact" }).order("at", { ascending: false }).range(offset, offset + limit - 1);
  if (body.member) q = q.eq("member_id", String(body.member));
  if (body.action) q = q.eq("action", String(body.action));
  if (body.from) q = q.gte("at", String(body.from));
  if (body.to) q = q.lt("at", String(body.to));
  if (body.campus && CAMPUSES.includes(String(body.campus))) {
    const { data: ids } = await supabase.from("members").select("id").eq("campus", String(body.campus));
    const list = (ids ?? []).map((r) => r.id);
    if (!list.length) return json({ ok: true, logs: [], total: 0 });
    q = q.in("member_id", list);
  }
  const term = String(body.q ?? "").trim().replace(/[,%()*\\]/g, " ").slice(0, 60);
  if (term) q = q.or(`name.ilike.%${term}%,path.ilike.%${term}%,ip.ilike.%${term}%`);
  const { data: logs, error, count } = await q;
  if (error) throw error;
  return json({ ok: true, logs, total: count ?? 0 });
}
async function adminSet(body: Json, me: Member, ip: string) {
  const id = String(body.id ?? "");
  const patch: Json = {};
  if (body.status) { if (!["approved", "rejected", "suspended", "pending"].includes(body.status)) return json({ ok: false, msg: "잘못된 상태예요." }); patch.status = body.status; }
  if (typeof body.is_admin === "boolean") patch.is_admin = body.is_admin;
  if (typeof body.title === "string") { if (!TITLES.includes(body.title)) return json({ ok: false, msg: "잘못된 직책이에요." }); patch.title = body.title; }
  if (typeof body.campus === "string") { if (!CAMPUSES.includes(body.campus)) return json({ ok: false, msg: "잘못된 캠퍼스예요." }); patch.campus = body.campus; }
  if (patch.title || patch.campus) {
    // 이사 ⇔ 캠퍼스 '전체' 를 항상 맞춘다
    const { data: cur } = await supabase.from("members").select("title,campus").eq("id", id).maybeSingle();
    const nextTitle = patch.title ?? cur?.title;
    if (nextTitle === "이사") patch.campus = ALL_CAMPUS;
    else if ((patch.campus ?? cur?.campus) === ALL_CAMPUS) return json({ ok: false, msg: "이사가 아닌 직책은 캠퍼스를 먼저 정해 주세요." });
  }
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
async function dbWrite(op: string, body: Json, role: Role, principal: boolean, me: Member) {
  const collection = String(body.collection ?? ""), id = String(body.id ?? "");
  if (!COLLECTIONS.has(collection) || !/^[A-Za-z0-9_.:-]{1,120}$/.test(id)) return json({ error: "잘못된 요청입니다." }, 400);
  if (collection === "fund" && !principal) return json({ error: "제작실 기금은 원장·이사만 관리할 수 있습니다." }, 403);
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
  if (role !== "admin" && collection === "productionRequests") {
    // 직원이 올린 요청은 항상 '승인 대기'로 시작 — 진행 상태는 관리자만 바꾼다
    Object.assign(next, { status: "approval_pending", progressPercent: 0, assignee: "", delayedReason: "", revisedDueDate: "", resultAssetId: null });
    delete next.approvedAt; delete next.approvedBy; delete next.completedAt;
    next.history = Array.isArray(next.history) ? next.history.slice(0, 1).map((h: Json) => ({ ...h, status: "approval_pending" })) : [];
  }
  if (collection === "productionRequests" && !existing) next.createdById = me.id;
  if (collection === "productionRequests" && existing) next.createdById = (existing.data as Json).createdById ?? null;
  if (JSON.stringify(next).length > 400_000) return json({ error: "기록이 너무 큽니다." }, 400);
  const { error } = await supabase.from("docs").upsert({ collection, id, data: next, updated_at: now() });
  if (error) throw error;
  if (collection === "productionRequests") {
    const prev = existing?.data as Json | undefined;
    if (!prev) {
      background(adminIds(me.id).then((ids) => notify(ids, { kind: "request", title: "📮 새 제작 요청이 들어왔어요", body: `${shortCampus(next.branch)} · ${next.requester || me.name} · '${next.title}'${next.desiredDate ? ` · 마감 ${next.desiredDate}` : ""}`, link: "#requests", ref: `new-${id}` })));
    } else if (prev.status !== next.status && REQUEST_NOTES[next.status] && next.createdById && next.createdById !== me.id) {
      background(notify([next.createdById], { ...REQUEST_NOTES[next.status](next), ref: `st-${id}-${next.status}-${Date.now()}` }));
    }
  }
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
    if (path === "cron/daily") {
      const secret = (await config()).cron_secret;
      if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "forbidden" }, 403);
      return json({ ok: true, sent: await dailyCheck() });
    }

    const me = await currentMember(req.headers.get("x-archive-token"));
    if (path === "auth/session") return json(me ? { authenticated: true, role: me.is_admin ? "admin" : "staff", demo: false, me: meOf(me) } : { authenticated: false, role: null, demo: false, logout: true });
    if (!me) return json({ error: "인증이 필요합니다.", logout: true }, 401);
    const role: Role = me.is_admin ? "admin" : "staff";
    const principal = isPrincipal(me.title);

    if (path === "ping") {
      await supabase.from("members").update({ last_seen: now() }).eq("id", me.id);
      if (body.path) await log(me, body.kind === "open" ? "open" : "view", String(body.path), ip);
      return json({ ok: true });
    }

    if (path === "admin/list" || path === "admin/logs" || path === "admin/set" || path === "admin/delete") {
      if (!me.is_admin) return json({ ok: false, msg: "관리자만 사용할 수 있어요." }, 403);
      if (path === "admin/list") return await adminList();
      if (path === "admin/logs") return await adminLogs(body);
      if (path === "admin/set") return await adminSet(body, me, ip);
      return await adminDelete(body, me, ip);
    }

    if (path === "fund/session") return json({ authenticated: principal });
    if (path === "fund/config") return principal ? json({ accountLabel: (await config()).fund_account_label ?? "제작실 공동계좌" }) : json({ error: "제작실 기금은 원장·이사만 열람할 수 있습니다." }, 403);

    if (path === "files/sign-upload") return await signUpload(body, role);
    if (path === "files/sign-read") return await signRead(body.keys);

    if (path === "db/list") return COLLECTIONS.has(body.collection) ? await dbList(body.collection, role, principal) : json({ docs: [] });
    if (path === "db/get") return COLLECTIONS.has(body.collection) ? await dbGet(body.collection, String(body.id ?? ""), role, principal) : json({ doc: null });
    if (path === "db/set" || path === "db/update" || path === "db/delete") return await dbWrite(path.slice(3), body, role, principal, me);

    // 알림
    if (path === "notify/list") return await notifyList(me);
    if (path === "notify/read") {
      let q = supabase.from("notifications").update({ read_at: now() }).eq("member_id", me.id).is("read_at", null);
      if (!body.all) q = q.in("id", (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 100));
      await q;
      return json({ ok: true });
    }
    if (path === "push/subscribe") {
      const sub = body.subscription ?? {};
      if (!/^https:\/\//.test(String(sub.endpoint ?? "")) || !sub.keys?.p256dh || !sub.keys?.auth) return json({ error: "알림 등록 정보를 확인해 주세요." }, 400);
      const { error } = await supabase.from("push_subscriptions").upsert({ member_id: me.id, endpoint: String(sub.endpoint), p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth), ua: String(body.ua ?? "").slice(0, 200) }, { onConflict: "endpoint" });
      if (error) throw error;
      return json({ ok: true });
    }
    if (path === "push/unsubscribe") {
      await supabase.from("push_subscriptions").delete().eq("member_id", me.id).eq("endpoint", String(body.endpoint ?? ""));
      return json({ ok: true });
    }
    if (path === "me/profile") {
      if (body.set) {
        const email = String(body.email ?? "").trim().slice(0, 120);
        if (email && !EMAIL_RE.test(email)) return json({ ok: false, msg: "메일 주소 형식을 확인해 주세요." });
        const { error } = await supabase.from("members").update({ email: email || null, email_on: !!email && body.emailOn === true }).eq("id", me.id);
        if (error) throw error;
      }
      const { data } = await supabase.from("members").select("email,email_on").eq("id", me.id).single();
      return json({ ok: true, email: data?.email ?? "", emailOn: !!data?.email_on, mailReady: !!(await config()).mail_relay_url });
    }
    if (path === "mail/test") {
      const { data } = await supabase.from("members").select("email").eq("id", me.id).single();
      if (!data?.email) return json({ ok: false, msg: "먼저 메일 주소를 저장해 주세요." });
      if (!(await config()).mail_relay_url) return json({ ok: false, msg: "메일 발송 연결이 아직 안 됐어요. 관리자에게 알려 주세요." });
      const r = await relay(data.email, "[아카이브] 메일 알림이 잘 와요!", mailHtml("📬 메일 알림이 잘 와요!", [{ title: `${me.name} 선생님, 연결 완료!`, body: "앞으로 제작 요청·승인·마감 소식을 이 메일로도 알려드릴게요." }], "#requests"));
      return json(r.ok ? { ok: true } : { ok: false, msg: "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." });
    }
    if (path === "push/test") {
      await notify([me.id], { kind: "test", title: "🔔 알림이 잘 와요!", body: "앞으로 제작 요청·승인 소식을 이렇게 알려드릴게요.", link: "#requests" });
      return json({ ok: true });
    }
  } catch (error) {
    console.error("[archive-api]", error);
    return json({ error: "요청을 처리하지 못했습니다." }, 500);
  }
  return json({ error: "찾을 수 없는 요청입니다." }, 404);
});
