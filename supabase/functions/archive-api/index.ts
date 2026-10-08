// 학원 아카이브 서버 함수 (Supabase Edge Function)
// 역할: 교직원 가입 신청·승인·로그인, 컬렉션별 권한 확인, 파일 서명, 접속 기록, 관리자 회원 관리
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "npm:@simplewebauthn/server@13.1.1";

type Role = "staff" | "admin";
type Json = Record<string, any>;
type Member = { id: string; campus: string; title: string; name: string; status: string; is_admin: boolean };

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "archive-files";
const CAMPUSES = ["센텀", "김해", "명지"];
const TITLES = ["원장", "전임", "행정", "이사"];
const ALL_CAMPUS = "전체"; // 이사는 특정 캠퍼스 소속이 아님
const isPrincipal = (t: string) => t === "원장" || t === "이사";
const SESSION_HOURS = 12; // 열 때마다 로그인 (화면에서 창을 닫으면 지워짐) + 최대 12시간
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-archive-token, x-cron-secret",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const now = () => new Date().toISOString();

// 컬렉션 규칙
const COLLECTIONS = new Set(["events", "marketing", "meetings", "promotions", "productionRequests", "productionSchedules", "productionPriority", "complianceRequirements", "complianceSubmissions", "complianceLogs", "fund", "nationalNews"]);
const STAFF_CREATE = new Set(["promotions", "productionRequests", "complianceSubmissions", "complianceLogs"]);
const ADMIN_READ = new Set(["complianceLogs"]);
const READ_TRACKED = new Set(["events", "marketing", "meetings", "promotions", "nationalNews", "productionRequests"]);
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
  const body = b64url(JSON.stringify({ id: m.id, c: m.campus, n: m.name, t: m.title, a: m.is_admin, exp: Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600 }));
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
// 여러 건이 연달아 올라오면 한 줄로 묶는다 ("… 외 N건"). 휴대폰·메일은 첫 건만.
async function notifyGrouped(memberIds: string[], n: Note & { ref: string }) {
  const ids = [...new Set(memberIds.filter(Boolean))];
  const fresh: string[] = [];
  for (const member_id of ids) {
    const { error } = await supabase.from("notifications").insert({ member_id, kind: n.kind, title: n.title.slice(0, 120), body: (n.body ?? "").slice(0, 400), link: n.link ?? null, ref: n.ref, count: 1 });
    if (!error) { fresh.push(member_id); continue; }
    if (error.code !== "23505") { console.error("[notify]", error); continue; }
    const { data: row } = await supabase.from("notifications").select("id,count,title").eq("member_id", member_id).eq("ref", n.ref).maybeSingle();
    if (!row) continue;
    const count = (row.count ?? 1) + 1;
    await supabase.from("notifications").update({ count, body: `${(n.body ?? "").slice(0, 300)}${n.body ? " · " : ""}외 ${count - 1}건 더`, read_at: null, created_at: now() }).eq("id", row.id);
  }
  await sendPush(fresh, n);
  if (n.mail) await sendMail(fresh, n);
}
async function memberIds(filter: (m: { id: string; title: string; is_admin: boolean }) => boolean, except?: string) {
  const { data } = await supabase.from("members").select("id,title,is_admin").eq("status", "approved");
  return (data ?? []).filter((m) => m.id !== except && filter(m as any)).map((m) => m.id);
}
const summaryOf = (d: Json) => String(d.summary ?? d.description ?? d.body ?? d.purpose ?? d.notes ?? d.content ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
const slot = (minutes: number) => Math.floor(Date.now() / (minutes * 60_000));
// 모든 메뉴의 새 글·공개를 알림함으로 (카테고리 = kind)
const BROADCAST: Record<string, { kind: string; emoji: string; label: string; link: string }> = {
  events: { kind: "events", emoji: "🎉", label: "이벤트", link: "#events" },
  marketing: { kind: "marketing", emoji: "🖼️", label: "마케팅 제작물", link: "#marketing" },
  meetings: { kind: "meetings", emoji: "📝", label: "회의록", link: "#meetings" },
  promotions: { kind: "promotions", emoji: "📣", label: "홍보", link: "#promotions" },
};
async function contentNotify(collection: string, id: string, prev: Json | undefined, next: Json, me: Member, role: Role) {
  const who = `${me.campus === ALL_CAMPUS ? "이사" : me.campus} ${me.name}`;
  const b = BROADCAST[collection];
  if (b) {
    const field = DRAFT_FIELD[collection];
    const nowPublished = next[field] === "published" && (!prev || prev[field] !== "published");
    if (nowPublished) {
      const ids = await memberIds(() => true, me.id);
      await notifyGrouped(ids, { kind: b.kind, title: `${b.emoji} 새 ${b.label} · ${String(next.title ?? "").slice(0, 60)}`, body: [shortCampus(next.branch), summaryOf(next)].filter(Boolean).join(" · ") || `${who}님이 올렸어요`, link: b.link, ref: `${collection}-${me.id}-${slot(10)}` });
    } else if (!prev && role !== "admin" && collection === "promotions") {
      await notifyGrouped(await adminIds(me.id), { kind: "promotions", title: `📣 홍보 기록 검토 요청 · ${String(next.title ?? "").slice(0, 60)}`, body: `${who} · 공개 전 검토해 주세요`, link: "#promotions", ref: `promo-review-${me.id}-${slot(30)}` });
    }
    return;
  }
  if (collection === "nationalNews" && !prev) {
    const ids = await memberIds((m) => m.is_admin || isPrincipal(m.title), me.id);
    const files = Array.isArray(next.files) ? next.files.length : 0;
    const extra = [files ? `📎 첨부 ${files}개` : "", next.deadline ? `마감 ${String(next.deadline).slice(5).replace("-", "/")}` : ""].filter(Boolean).join(" · ");
    await notifyGrouped(ids, { kind: "national", title: `📰 전국 소식 · ${String(next.title ?? "").slice(0, 70)}`, body: [summaryOf(next).slice(0, 110), extra].filter(Boolean).join(" · "), link: `#national?open=${id}`, ref: `national-${me.id}-${slot(10)}`, mail: true });
    return;
  }
  if (collection === "complianceRequirements" && !prev) {
    await notifyGrouped(await memberIds(() => true, me.id), { kind: "compliance", title: `✅ 연간 이수 항목 추가 · ${String(next.title ?? next.name ?? "").slice(0, 60)}`, body: summaryOf(next) || "이수 기한과 대상을 확인해 주세요", link: "#compliance", ref: `compreq-${me.id}-${slot(10)}` });
    return;
  }
  if (collection === "complianceSubmissions" && !prev && role !== "admin") {
    await notifyGrouped(await adminIds(me.id), { kind: "compliance", title: `📄 이수증이 제출됐어요`, body: `${who}${next.title || next.requirementTitle ? ` · ${next.title ?? next.requirementTitle}` : ""}`, link: "#compliance", ref: `compsub-${me.id}-${slot(30)}` });
    return;
  }
  if (collection === "fund") {
    const ids = await memberIds((m) => isPrincipal(m.title), me.id);
    const amount = Number(next.income || 0) ? `입금 ${Number(next.income).toLocaleString("ko-KR")}원` : Number(next.expense || 0) ? `지출 ${Number(next.expense).toLocaleString("ko-KR")}원` : "";
    await notifyGrouped(ids, { kind: "fund", title: prev ? "💰 제작실 기금 내역이 수정됐어요" : "💰 제작실 기금 내역이 추가됐어요", body: [who, next.description, amount].filter(Boolean).join(" · "), link: "#fund", ref: `fund-${me.id}-${slot(60)}` });
  }
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
  const { data: items } = await supabase.from("notifications").select("id,kind,title,body,link,created_at,read_at,count").eq("member_id", me.id).order("created_at", { ascending: false }).limit(80);
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

// ---------- 지문(패스키) 로그인 ----------
const PASSKEY_ORIGINS = ["https://hi5-academy-archive.vercel.app", "http://localhost:4177"];
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
function rpOf(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  if (!PASSKEY_ORIGINS.includes(origin)) return null;
  return { origin, rpID: new URL(origin).hostname };
}
async function signState(state: Json) { const body = b64url(JSON.stringify({ ...state, exp: Date.now() + 5 * 60_000 })); return `${body}.${await hmac("pk:" + body)}`; }
async function readState(token: unknown) {
  const [body, sig] = String(token ?? "").split(".");
  if (!body || !sig || (await hmac("pk:" + body)) !== sig) return null;
  try { const s = JSON.parse(unb64url(body)); return s.exp > Date.now() ? s : null; } catch { return null; }
}
async function passkeyRegisterOptions(req: Request, me: Member) {
  const rp = rpOf(req); if (!rp) return json({ ok: false, msg: "이 주소에서는 지문 로그인을 쓸 수 없어요." }, 400);
  const { data: existing } = await supabase.from("passkeys").select("credential_id,transports").eq("member_id", me.id);
  const options = await generateRegistrationOptions({
    rpName: "하이파이브 아카이브", rpID: rp.rpID, userName: `${me.campus === ALL_CAMPUS ? "이사" : me.campus} ${me.name}`, userDisplayName: `${me.name} ${me.title}`,
    userID: enc.encode(me.id), attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({ id: c.credential_id, transports: c.transports as any })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  return json({ ok: true, options, state: await signState({ c: options.challenge, u: me.id, o: rp.origin }) });
}
async function passkeyRegisterVerify(req: Request, body: Json, me: Member, ip: string) {
  const st = await readState(body.state); const rp = rpOf(req);
  if (!st || st.u !== me.id || !rp || st.o !== rp.origin) return json({ ok: false, msg: "시간이 지났어요. 다시 시도해 주세요." });
  try {
    const v = await verifyRegistrationResponse({ response: body.response, expectedChallenge: st.c, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true });
    if (!v.verified || !v.registrationInfo) return json({ ok: false, msg: "등록을 확인하지 못했어요." });
    const c = v.registrationInfo.credential;
    const { error } = await supabase.from("passkeys").insert({ member_id: me.id, credential_id: c.id, public_key: b64u(c.publicKey), counter: c.counter, transports: c.transports ?? [], device: String(body.device ?? "").slice(0, 60) || null });
    if (error) throw error;
    await log(me, "passkey", "지문 로그인 등록", ip);
    return json({ ok: true });
  } catch (e) { console.error("[passkey]", e); return json({ ok: false, msg: "등록하지 못했어요. 다시 시도해 주세요." }); }
}
async function passkeyLoginOptions(req: Request) {
  const rp = rpOf(req); if (!rp) return json({ ok: false, msg: "이 주소에서는 지문 로그인을 쓸 수 없어요." }, 400);
  const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required", allowCredentials: [] });
  return json({ ok: true, options, state: await signState({ c: options.challenge, o: rp.origin }) });
}
async function passkeyLoginVerify(req: Request, body: Json, ip: string) {
  const st = await readState(body.state); const rp = rpOf(req);
  if (!st || !rp || st.o !== rp.origin) return json({ ok: false, msg: "시간이 지났어요. 다시 눌러 주세요." });
  const credId = String(body.response?.id ?? "");
  const { data: pk } = await supabase.from("passkeys").select("id,member_id,public_key,counter,transports").eq("credential_id", credId).maybeSingle();
  if (!pk) return json({ ok: false, msg: "등록되지 않은 지문이에요. 비밀번호로 로그인한 뒤 다시 등록해 주세요." });
  try {
    const v = await verifyAuthenticationResponse({ response: body.response, expectedChallenge: st.c, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true, credential: { id: credId, publicKey: unb64u(pk.public_key), counter: Number(pk.counter), transports: pk.transports as any } });
    if (!v.verified) return json({ ok: false, msg: "지문을 확인하지 못했어요." });
    await supabase.from("passkeys").update({ counter: v.authenticationInfo.newCounter, last_used_at: now() }).eq("id", pk.id);
  } catch (e) { console.error("[passkey]", e); return json({ ok: false, msg: "지문을 확인하지 못했어요." }); }
  const { data: m } = await supabase.from("members").select("*").eq("id", pk.member_id).maybeSingle();
  if (!m || m.status !== "approved") return json({ ok: false, msg: "사용할 수 없는 계정이에요. 관리자에게 문의해 주세요." });
  await supabase.from("members").update({ failed_count: 0, locked_until: null, last_seen: now() }).eq("id", m.id);
  memberCache.delete(m.id);
  await log(m, "login", "지문", ip);
  return json({ ok: true, token: await issue(m), me: meOf(m) });
}

// ---------- 관리자 ----------
async function adminList() {
  const { data: members, error } = await supabase.from("members").select("id,campus,title,name,status,is_admin,pledge_at,last_seen,created_at,email,email_on").order("created_at", { ascending: false });
  if (error) throw error;
  const { data: pks } = await supabase.from("passkeys").select("member_id");
  const counts = new Map<string, number>(); for (const p of pks ?? []) counts.set(p.member_id, (counts.get(p.member_id) ?? 0) + 1);
  return json({ ok: true, members: (members ?? []).map((m) => ({ ...m, passkeys: counts.get(m.id) ?? 0 })) });
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
  if (collection === "nationalNews") return principal || role === "admin"; // 전국 Hi5 소식: 원장·이사·관리자
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
  if (collection !== "productionRequests") background(contentNotify(collection, id, existing?.data as Json | undefined, next, me, role));
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
    if (path === "passkey/login-options") return await passkeyLoginOptions(req);
    if (path === "passkey/login-verify") return await passkeyLoginVerify(req, body, ip);
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

    if (path === "passkey/register-options") return await passkeyRegisterOptions(req, me);
    if (path === "passkey/register-verify") return await passkeyRegisterVerify(req, body, me, ip);
    if (path === "passkey/list") {
      const { data } = await supabase.from("passkeys").select("id,device,created_at,last_used_at").eq("member_id", me.id).order("created_at", { ascending: false });
      return json({ ok: true, items: data ?? [] });
    }
    if (path === "passkey/delete") {
      await supabase.from("passkeys").delete().eq("member_id", me.id).eq("id", String(body.id ?? ""));
      return json({ ok: true });
    }
    if (path === "admin/passkey-clear") {
      if (!me.is_admin) return json({ ok: false, msg: "관리자만 사용할 수 있어요." }, 403);
      await supabase.from("passkeys").delete().eq("member_id", String(body.id ?? ""));
      await log(me, "admin", `지문 로그인 해제 ${String(body.id ?? "").slice(0, 8)}`, ip);
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

    // 읽음 확인 (누가 몇 명 확인했는지)
    if (path === "reads/mark" || path === "reads/counts" || path === "reads/list") {
      const collection = String(body.collection ?? "");
      if (!READ_TRACKED.has(collection) || !canRead(collection, role, principal)) return json({ ok: false }, 400);
      if (path === "reads/mark") {
        const id = String(body.id ?? "").slice(0, 120);
        if (!id) return json({ ok: false }, 400);
        const { error } = await supabase.from("post_reads").upsert({ collection, doc_id: id, member_id: me.id, last_at: now() }, { onConflict: "collection,doc_id,member_id", ignoreDuplicates: false });
        if (error) throw error;
        return json({ ok: true });
      }
      if (path === "reads/counts") {
        const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 300);
        if (!ids.length) return json({ ok: true, counts: {}, mine: [] });
        const { data } = await supabase.from("post_reads").select("doc_id,member_id").eq("collection", collection).in("doc_id", ids);
        const counts: Record<string, number> = {}; const mine: string[] = [];
        for (const r of data ?? []) { counts[r.doc_id] = (counts[r.doc_id] ?? 0) + 1; if (r.member_id === me.id) mine.push(r.doc_id); }
        return json({ ok: true, counts, mine });
      }
      const id = String(body.id ?? "");
      const { data: rows } = await supabase.from("post_reads").select("member_id,first_at").eq("collection", collection).eq("doc_id", id).order("first_at", { ascending: true });
      const { data: people } = await supabase.from("members").select("id,campus,title,name,status,is_admin");
      const byId = new Map((people ?? []).map((m) => [m.id, m]));
      const label = (m: Json) => ({ name: m.name, campus: m.campus === ALL_CAMPUS ? "이사" : m.campus, title: m.title });
      const readers = (rows ?? []).filter((r) => byId.has(r.member_id)).map((r) => ({ ...label(byId.get(r.member_id)!), at: r.first_at }));
      let unread: Json[] | undefined;
      if (me.is_admin) {
        const seen = new Set((rows ?? []).map((r) => r.member_id));
        unread = (people ?? []).filter((m) => m.status === "approved" && !seen.has(m.id) && canRead(collection, m.is_admin ? "admin" : "staff", isPrincipal(m.title))).map(label);
      }
      return json({ ok: true, readers, unread });
    }

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
