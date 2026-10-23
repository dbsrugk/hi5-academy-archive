// 노트 제작 서버 함수 (Supabase Edge Function)
// 역할: '노트 제작' 화면의 구성 공유·코멘트·공유 이미지를 docs 테이블에 저장한다.
// 로그인·회원 확인은 archive-api와 같은 토큰(x-archive-token)을 쓴다. archive-api는 건드리지 않는다.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Json = Record<string, any>;
type Member = { id: string; campus: string; title: string; name: string; status: string; is_admin: boolean };

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-archive-token, x-cron-secret, x-fund-token",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const now = () => new Date().toISOString();
const slot = (minutes: number) => Math.floor(Date.now() / (minutes * 60_000));
const isProducer = (t: string) => t === "제작실장";
// 「이 구성으로 저장하기」(noteBooks의 <노트>:main · <노트>:h:…): 관리자·제작실장 + 노트별로 지정한 캠퍼스의 원장.
// 새 노트를 추가하면 여기에도 한 줄 추가 (public/notes/editor.html 의 BOOKS.savers 와 같게).
const SAVERS: Record<string, string[]> = { "spring-mid": ["센텀"], "spring-elem": ["센텀"] };
const canSaveBook = (me: Member, id: string) => me.is_admin || isProducer(me.title) || (me.title === "원장" && (SAVERS[id.split(":")[0]] ?? []).includes(me.campus));

// 노트 컬렉션: noteBooks(구성·공유 기록) · noteComments(포스트잇·답글·스티커) · noteImages(공유 이미지, 한 장씩 읽기만)
const COLLECTIONS = new Set(["noteBooks", "noteComments", "noteImages"]);
const LIST_OK = new Set(["noteBooks", "noteComments"]);
const ID_RE = /^[A-Za-z0-9_.:-]{1,120}$/;
const RESOLVE_FIELDS = ["resolved", "resolvedBy", "resolvedAt"];

// ---------- 설정·토큰 (archive-api와 같은 방식) ----------
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
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)));
async function readToken(token: string | null) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if ((await hmac(body)) !== sig) return null;
  try { const p = JSON.parse(unb64url(body)); return p.exp > Date.now() / 1000 ? p : null; } catch { return null; }
}
// 회원 상태는 매 요청 DB에서 확인 (정지·관리자 해제가 바로 반영되도록, 20초 캐시)
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

// ---------- 알림 (알림함 + 휴대폰 웹 푸시, archive-api와 같은 표) ----------
type Note = { kind: string; title: string; body?: string; link?: string; ref?: string };
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
async function prodManagerIds(except?: string) {
  const { data } = await supabase.from("members").select("id,title,is_admin").eq("status", "approved");
  return (data ?? []).filter((m) => m.is_admin || isProducer(m.title)).map((m) => m.id).filter((id) => id !== except);
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
async function notify(memberIds: string[], n: Note) {
  const ids = [...new Set(memberIds.filter(Boolean))];
  const sent: string[] = [];
  for (const member_id of ids) {
    const { error } = await supabase.from("notifications").insert({ member_id, kind: n.kind, title: n.title.slice(0, 120), body: (n.body ?? "").slice(0, 400), link: n.link ?? null, ref: n.ref ?? null });
    if (!error) sent.push(member_id);
    else if (error.code !== "23505") console.error("[notify]", error);
  }
  await sendPush(sent, n);
}
// 연달아 올라오면 한 줄로 묶는다 ("… 외 N건"). 휴대폰은 첫 건만.
async function notifyGrouped(memberIds: string[], n: Note & { ref: string }) {
  const ids = [...new Set(memberIds.filter(Boolean))];
  const fresh: string[] = [];
  for (const member_id of ids) {
    const { error } = await supabase.from("notifications").insert({ member_id, kind: n.kind, title: n.title.slice(0, 120), body: (n.body ?? "").slice(0, 400), link: n.link ?? null, ref: n.ref, count: 1 });
    if (!error) { fresh.push(member_id); continue; }
    if (error.code !== "23505") { console.error("[notify]", error); continue; }
    const { data: row } = await supabase.from("notifications").select("id,count").eq("member_id", member_id).eq("ref", n.ref).maybeSingle();
    if (!row) continue;
    const count = (row.count ?? 1) + 1;
    await supabase.from("notifications").update({ count, body: `${(n.body ?? "").slice(0, 300)}${n.body ? " · " : ""}외 ${count - 1}건 더`, read_at: null, created_at: now() }).eq("id", row.id);
  }
  await sendPush(fresh, n);
}

// ---------- 읽기 ----------
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
async function list(body: Json) {
  const collection = String(body.collection ?? "");
  if (!LIST_OK.has(collection)) return json({ docs: [] });
  const prefix = clip(body.prefix, 120);
  const { data, error } = await supabase.from("docs").select("id,data").eq("collection", collection).order("updated_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return json({ docs: (data ?? []).filter((r) => !prefix || String(r.id).startsWith(prefix)).map((r) => ({ ...(r.data as Json), id: r.id })) });
}
async function get(body: Json) {
  const collection = String(body.collection ?? ""), id = String(body.id ?? "");
  if (!COLLECTIONS.has(collection) || !ID_RE.test(id)) return json({ doc: null });
  const { data, error } = await supabase.from("docs").select("id,data").eq("collection", collection).eq("id", id).maybeSingle();
  if (error) throw error;
  return json({ doc: data ? { ...(data.data as Json), id: data.id } : null });
}

// ---------- 쓰기 ----------
async function write(op: string, body: Json, me: Member) {
  const collection = String(body.collection ?? ""), id = String(body.id ?? "");
  if (!COLLECTIONS.has(collection) || !ID_RE.test(id)) return json({ error: "잘못된 요청입니다." }, 400);
  const manager = me.is_admin || isProducer(me.title);
  if (collection === "noteBooks" && !canSaveBook(me, id)) return json({ error: "이 노트의 구성 저장은 관리자·제작실장·지정된 캠퍼스 원장만 할 수 있어요." }, 403);
  const { data: row, error: readError } = await supabase.from("docs").select("data").eq("collection", collection).eq("id", id).maybeSingle();
  if (readError) throw readError;
  const existing = (row?.data ?? null) as Json | null;

  if (op === "delete") {
    if (!existing) return json({ ok: true });
    if (collection === "noteImages" && !manager) return json({ error: "공유 이미지는 관리자만 지울 수 있어요." }, 403);
    if (collection === "noteBooks" && id.endsWith(":main") && !manager) return json({ error: "저장된 구성은 지울 수 없어요." }, 403);
    if (collection === "noteComments" && !manager && existing.createdById !== me.id) return json({ error: "다른 사람의 코멘트는 지울 수 없어요." }, 403);
    const { error } = await supabase.from("docs").delete().eq("collection", collection).eq("id", id);
    if (error) throw error;
    return json({ ok: true });
  }

  const input: Json = typeof body.data === "object" && body.data ? { ...body.data } : {};
  delete input.id;
  if (op === "update" && !existing) return json({ error: "기록을 찾을 수 없습니다." }, 404);
  if (collection === "noteImages" && existing) return json({ ok: true }); // 공유 이미지는 한 번 올리면 바꾸지 않는다

  let next: Json;
  if (existing && collection === "noteComments" && !manager && existing.createdById !== me.id) {
    // 남의 코멘트는 '반영 완료' 표시만 바꿀 수 있다
    next = { ...existing };
    for (const k of RESOLVE_FIELDS) if (k in input) next[k] = input[k];
  } else {
    next = op === "update" ? { ...existing, ...input } : input;
  }
  // 누가 썼는지는 서버가 정한다 (화면에서 보낸 값은 믿지 않는다)
  next.createdById = existing?.createdById ?? me.id;
  next.createdByName = existing?.createdByName ?? me.name;
  next.createdByCampus = existing?.createdByCampus ?? (me.campus === "전체" ? "이사" : me.campus);
  next.updatedById = me.id;
  next.updatedByName = me.name;
  if (JSON.stringify(next).length > 400_000) return json({ error: "기록이 너무 큽니다." }, 400);
  const { error } = await supabase.from("docs").upsert({ collection, id, data: next, updated_at: now() });
  if (error) throw error;
  background(notifyAfterWrite(collection, id, existing, next, me));
  return json({ ok: true });
}

const who = (me: Member) => `${me.campus === "전체" ? "이사" : me.campus} ${me.name}`;
async function notifyAfterWrite(collection: string, id: string, prev: Json | null, next: Json, me: Member) {
  if (collection === "noteComments") {
    const kind = id.includes(":n:") ? "note" : id.includes(":r:") ? "reply" : "";
    const title = clip(next.bookTitle, 40) || "노트";
    if (kind === "note" && !prev && !next.resolved) {
      const ids = await prodManagerIds(me.id);
      await notifyGrouped(ids, { kind: "notes", title: `📝 노트 코멘트 · ${title}`, body: `${who(me)}: ${clip(next.text, 80) || "그림으로 표시했어요"}${next.where ? ` · ${clip(next.where, 30)}` : ""}`, link: "#notes", ref: `notes-new-${me.id}-${slot(10)}` });
    } else if (kind === "note" && prev && !prev.resolved && next.resolved && next.createdById !== me.id) {
      await notify([next.createdById], { kind: "notes", title: "✅ 내 코멘트가 반영 완료됐어요", body: `${clip(next.text, 80)}${next.where ? ` · ${clip(next.where, 30)}` : ""}`, link: "#notes", ref: `notes-done-${id}` });
    } else if (kind === "reply" && !prev && next.note) {
      const { data: parent } = await supabase.from("docs").select("data").eq("collection", "noteComments").eq("id", String(next.note)).maybeSingle();
      const owner = (parent?.data as Json | undefined)?.createdById;
      if (owner && owner !== me.id) await notify([owner], { kind: "notes", title: "💬 내 코멘트에 답글이 달렸어요", body: `${who(me)}: ${clip(next.text, 80)}`, link: "#notes", ref: `notes-reply-${id}` });
    }
  } else if (collection === "noteBooks" && id.endsWith(":main") && next.layout) {
    const ids = await prodManagerIds(me.id);
    await notifyGrouped(ids, { kind: "notes", title: "📚 노트 구성이 저장됐어요", body: `${who(me)}님이 구성을 저장했어요`, link: "#notes", ref: `notes-share-${me.id}-${slot(10)}` });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const path = new URL(req.url).pathname.match(/\/api\/(.*)$/)?.[1] ?? "";
  let body: Json = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch { body = {}; }
  try {
    const me = await currentMember(req.headers.get("x-archive-token"));
    if (!me) return json({ error: "인증이 필요합니다.", logout: true }, 401);
    if (path === "list") return await list(body);
    if (path === "get") return await get(body);
    if (path === "set" || path === "update" || path === "delete") return await write(path, body, me);
    return json({ error: "없는 요청입니다." }, 404);
  } catch (error) {
    console.error("[archive-notes]", error);
    return json({ error: "서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
