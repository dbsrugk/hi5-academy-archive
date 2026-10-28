// 업데이트 소식 메일 (Supabase Edge Function)
// 1) 자동: GitHub에 main 푸시가 올라오면 Action이 이 주소를 호출 → 공개 저장소의 새 커밋을 읽어 메일 1통으로 발송.
//    (호출에 비밀값이 필요 없다: 받는 사람은 DB 설정으로 고정, 이미 보낸 커밋은 다시 보내지 않는다)
// 2) 수동: Claude가 쉬운 말로 쓴 소식 → 헤더 x-release-key(DB 설정)가 맞을 때만 발송.
// 받는 사람·키·마지막 발송 커밋은 DB app_config (release_mail_to / release_mail_key / release_mail_last_sha).
import { createClient } from "npm:@supabase/supabase-js@2";

const REPO = "dbsrugk/hi5-academy-archive";
const SITE = "https://hi5-academy-archive.vercel.app";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-release-key" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function config() {
  const { data, error } = await supabase.from("app_config").select("key,value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
}
async function setConfig(key: string, value: string) {
  await supabase.from("app_config").upsert({ key, value }, { onConflict: "key" });
}
function html(heading: string, items: { title: string; body?: string }[]) {
  const rows = items.map((it) => `<tr><td style="padding:12px 16px;border-bottom:1px solid #eef0f4"><div style="font-size:15px;font-weight:700;color:#111827">${esc(it.title)}</div>${it.body ? `<div style="margin-top:4px;font-size:13px;color:#6b7280;line-height:1.5">${esc(it.body)}</div>` : ""}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#1e3a8a;padding:16px 20px;color:#fff;font-size:13px">하이파이브 아카이브 · 업데이트 소식</td></tr>
<tr><td style="padding:18px 16px 6px;font-size:17px;font-weight:800;color:#111827">${esc(heading)}</td></tr>${rows}
<tr><td align="center" style="padding:20px"><a href="${SITE}" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:10px">사이트 열기</a></td></tr>
</table></td></tr></table></body></html>`;
}
async function send(c: Record<string, string>, subject: string, body: string) {
  if (!c.mail_relay_url || !c.mail_relay_secret || !c.release_mail_to) return { ok: false, reason: "not-configured" };
  const r = await fetch(c.mail_relay_url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify({ secret: c.mail_relay_secret, to: c.release_mail_to, subject, html: body }), redirect: "follow", signal: AbortSignal.timeout(20_000) });
  try { return JSON.parse(await r.text()); } catch { return { ok: false, reason: `HTTP ${r.status}` }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const c = await config();
  let body: any = {};
  try { body = await req.json(); } catch { /* 빈 호출 = 자동 모드 */ }

  // 수동: 쉬운 말로 쓴 소식
  if (body.manual) {
    if (!c.release_mail_key || req.headers.get("x-release-key") !== c.release_mail_key) return json({ ok: false, error: "forbidden" }, 403);
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 20).map((i: any) => ({ title: String(i.title ?? "").slice(0, 120), body: String(i.body ?? "").slice(0, 400) }));
    const title = String(body.title ?? "업데이트 소식").slice(0, 100);
    return json(await send(c, `[아카이브] ${title}`, html(title, items)));
  }

  // 자동: 새 커밋 모아서 1통
  const r = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=main&per_page=30`, { headers: { "user-agent": "hi5-release-mail", accept: "application/vnd.github+json" } });
  if (!r.ok) return json({ ok: false, error: `github ${r.status}` });
  const commits = (await r.json()) as { sha: string; commit: { message: string; author: { date: string } } }[];
  if (!commits.length) return json({ ok: true, sent: 0 });
  const head = commits[0].sha;
  const last = c.release_mail_last_sha;
  if (!last) { await setConfig("release_mail_last_sha", head); return json({ ok: true, initialized: head.slice(0, 7) }); }
  if (last === head) return json({ ok: true, sent: 0 });
  const idx = commits.findIndex((x) => x.sha === last);
  const fresh = (idx === -1 ? commits.slice(0, 10) : commits.slice(0, idx)).filter((x) => !/^CLAUDE\.md:/.test(x.commit.message));
  await setConfig("release_mail_last_sha", head); // 먼저 기록해서 중복 발송 방지
  if (!fresh.length) return json({ ok: true, sent: 0, note: "문서만 바뀜" });
  const items = fresh.reverse().map((x) => {
    const [first, ...rest] = x.commit.message.split("\n").filter((l) => l.trim() && !/^(Co-Authored-By|Claude-Session):/i.test(l));
    return { title: first.slice(0, 120), body: rest.join(" ").slice(0, 200) };
  });
  const out = await send(c, `[아카이브] 업데이트 ${items.length}건`, html(`🛠 사이트가 업데이트됐어요 (${items.length}건)`, items));
  return json({ ...out, sent: items.length });
});
