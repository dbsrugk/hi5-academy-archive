/* 학원 아카이브 API 어댑터 (Supabase 버전)
 * 화면 컴포넌트의 fetch("/api/...") 호출을 가로채 Supabase 서버 함수(archive-api)로 처리한다.
 * 서버는 인증키 로그인·권한·파일 서명을 맡고, 검색·정리 로직은 여기서 처리한다. */

type Role = "staff" | "admin";
type Json = Record<string, any>;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const FN = `${SUPABASE_URL}/functions/v1/archive-api/api`;

const TOKEN_KEY = "hi5-archive-token";
const COOKIE = "ha_s";
const storage = {
  get(key: string, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } },
  set(key: string, value: string | null, session = false) { try { const s = session ? sessionStorage : localStorage; if (value) s.setItem(key, value); else s.removeItem(key); } catch { /* 저장 불가 브라우저 */ } },
};
export type Me = { id: string; campus: string; title: string; name: string; isAdmin: boolean };
function payload(token: string | null): (Me & { exp: number }) | null {
  if (!token || !token.includes(".")) return null;
  try {
    const b = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
    return { id: p.id, campus: p.c, name: p.n, title: p.t, isAdmin: Boolean(p.a), exp: p.exp };
  } catch { return null; }
}
const tokenExpired = (token: string | null) => { const p = payload(token); return !p || p.exp * 1000 < Date.now(); };
let currentMe: Me | null = null;
export function getMe() { return currentMe; }
function saveToken(token: string | null) {
  storage.set(TOKEN_KEY, token);
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = token ? `${COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax${secure}` : `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
function signOut() { saveToken(null); currentMe = null; currentRole = null; }

let currentRole: Role | null = null;
const fileCache = new Map<string, { url: string; at: number }>();

// ---------- 응답 헬퍼 ----------
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const unauthorized = () => json({ error: "인증이 필요합니다." }, 401);
const forbidden = () => json({ error: "본사 관리자 권한이 필요합니다." }, 403);
const bad = (error = "필수 항목을 확인해 주세요.") => json({ error }, 400);
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).trim().slice(0, max));
const int = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : d; };
const like = (hay: unknown, q: string) => String(hay ?? "").toLocaleLowerCase("ko-KR").includes(q.toLocaleLowerCase("ko-KR"));
const normalizeTag = (v: string) => v.replace(/^#+/, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");

class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

// ---------- 서버 호출 ----------
async function call(path: string, body: Json = {}) {
  const token = storage.get(TOKEN_KEY);
  const response = await fetchNative(`${FN}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      ...(token ? { "x-archive-token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || data.logout) signOut();
    throw new ApiError(response.status, data.error ?? "요청을 처리하지 못했습니다.");
  }
  return data;
}
function dbError(error: any) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error("[archive api]", error);
  return json({ error: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
}

// ---------- 알림 ----------
export type NotificationItem = { id: string; kind: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null };
export type NotificationState = { items: NotificationItem[]; unread: number; badges: { requests?: number; members?: number }; devices: number; vapidKey: string | null };
export const notifyApi = {
  list: () => call("notify/list") as Promise<NotificationState>,
  read: (ids: string[] | "all") => call("notify/read", ids === "all" ? { all: true } : { ids }),
  subscribe: (subscription: PushSubscriptionJSON) => call("push/subscribe", { subscription, ua: navigator.userAgent }),
  unsubscribe: (endpoint: string) => call("push/unsubscribe", { endpoint }),
  test: () => call("push/test"),
};
export type Profile = { ok: boolean; msg?: string; email: string; emailOn: boolean; mailReady: boolean };
export const profileApi = {
  get: () => call("me/profile") as Promise<Profile>,
  save: (email: string, emailOn: boolean) => call("me/profile", { set: true, email, emailOn }) as Promise<Profile>,
  testMail: () => call("mail/test") as Promise<{ ok: boolean; msg?: string }>,
};

// ---------- DB 헬퍼 ----------
async function all(collection: string): Promise<Json[]> { return (await call("db/list", { collection })).docs ?? []; }
async function getDoc(collection: string, id: string): Promise<Json | null> { return (await call("db/get", { collection, id })).doc ?? null; }
async function setDoc(collection: string, id: string, data: Json) { const { id: _omit, ...body } = data; await call("db/set", { collection, id, data: JSON.parse(JSON.stringify(body)) }); }
async function updateDoc(collection: string, id: string, data: Json) { await call("db/update", { collection, id, data: JSON.parse(JSON.stringify(data)) }); }
async function deleteDoc(collection: string, id: string) { await call("db/delete", { collection, id }); }

// ---------- 파일 ----------
const isStatic = (key: string) => key.startsWith("./") || key.startsWith("/");
export function fileUrl(key: string | null | undefined, download = false) {
  if (!key) return null;
  if (isStatic(key)) return key; // 사이트에 함께 올라간 기존 자료 사진 (로그인 쿠키로 보호)
  const hit = fileCache.get(key);
  if (!hit) return null;
  return download && hit.url.startsWith("http") ? `${hit.url}&download=` : hit.url;
}
async function ensureBlobs(keys: Array<string | null | undefined>) {
  const fresh = Date.now() - 3 * 60 * 60 * 1000;
  const missing = [...new Set(keys.filter((k): k is string => !!k && !isStatic(k) && !((fileCache.get(k)?.at ?? 0) > fresh)))];
  if (!missing.length) return;
  const { urls } = await call("files/sign-read", { keys: missing });
  for (const [key, url] of Object.entries(urls ?? {})) fileCache.set(key, { url: String(url), at: Date.now() });
}

async function handleUpload(form: FormData) {
  const file = form.get("file");
  const purpose = form.get("purpose") === "source" ? "source" : form.get("purpose") === "certificate" ? "certificate" : "preview";
  if (!(file instanceof File) || file.size === 0) return bad("업로드할 파일을 선택해 주세요.");
  try {
    const signed = await call("files/sign-upload", { name: file.name, type: file.type, size: file.size, purpose });
    const put = await fetchNative(signed.signedUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
    if (!put.ok) throw new ApiError(put.status, "파일 업로드에 실패했습니다.");
    fileCache.set(signed.key, { url: URL.createObjectURL(file), at: Date.now() });
    return json({ key: signed.key, name: file.name, url: fileUrl(signed.key) }, 201);
  } catch (error) { return dbError(error); }
}

// ---------- 공통 ----------
function tagSummary(records: Json[]) {
  const grouped = new Map<string, { name: string; count: number; lastUsedAt: string }>();
  for (const record of records) for (const name of (record.tags ?? []) as string[]) {
    const cur = grouped.get(name);
    const at = String(record.updatedAt ?? "");
    if (cur) { cur.count += 1; if (at > cur.lastUsedAt) cur.lastUsedAt = at; }
    else grouped.set(name, { name, count: 1, lastUsedAt: at });
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt) || a.name.localeCompare(b.name, "ko")).slice(0, 100);
}
function cleanTags(value: unknown) {
  const list = Array.isArray(value) ? value.map((v) => str(v, 40)).filter(Boolean).slice(0, 8) : [];
  return [...new Map(list.map((name) => [normalizeTag(name), name.replace(/^#+/, "").trim()])).entries()].filter(([n]) => n).map(([, name]) => name);
}
function hasAllTags(record: Json, selected: string[]) {
  if (!selected.length) return true;
  const names = new Set(((record.tags ?? []) as string[]).map(normalizeTag));
  return selected.every((t) => names.has(t));
}
const byDesc = (field: string) => (a: Json, b: Json) => String(b[field] ?? "").localeCompare(String(a[field] ?? ""));
function imagesOf(value: unknown, max: number) {
  return (Array.isArray(value) ? value : []).filter((i) => i && i.key).slice(0, max).map((i: any) => ({ key: str(i.key, 160), name: str(i.name, 255) }));
}

// ---------- 이벤트 ----------
async function eventsGet(params: URLSearchParams, role: Role) {
  const q = params.get("q")?.trim() ?? "";
  const branch = params.get("branch")?.trim() ?? "";
  const audience = params.get("audience")?.trim() ?? "";
  const budget = params.get("budget") ?? "";
  const tags = (params.get("tags") ?? "").split(",").map(normalizeTag).filter(Boolean).slice(0, 8);
  const rows = (await all("events"))
    .filter((e) => role === "admin" || e.status === "published")
    .filter((e) => !branch || e.branch === branch)
    .filter((e) => !audience || (e.audiences ?? []).includes(audience))
    .filter((e) => budget !== "under50" || (e.budget != null && e.budget <= 500000))
    .filter((e) => budget !== "over50" || (e.budget != null && e.budget > 500000))
    .filter((e) => !q || [e.title, e.summary, e.branch, e.eventType].some((f) => like(f, q)))
    .filter((e) => hasAllTags(e, tags))
    .sort((a, b) => byDesc("updatedAt")(a, b) || b.id.localeCompare(a.id))
    .slice(0, 24);
  await ensureBlobs(rows.flatMap((e) => [e.coverKey, ...(e.images ?? []).map((i: Json) => i.key)]));
  return json({
    events: rows.map((e) => {
      const gallery = (e.images ?? []).map((i: Json) => ({ src: fileUrl(i.key), alt: `${e.title} 행사 사진`, caption: i.name }));
      const photos = gallery.length ? gallery : e.coverKey ? [{ src: fileUrl(e.coverKey), alt: `${e.title} 행사 사진`, caption: e.coverName ?? "행사 사진" }] : [];
      const { images: _i, ...rest } = e;
      return { ...rest, imageUrl: photos[0]?.src ?? null, galleryImages: photos, tags: e.tags ?? [], programs: e.programs ?? [] };
    }),
    nextCursor: null,
  });
}
async function eventsPost(body: Json) {
  const audiences = Array.isArray(body.audiences) ? body.audiences.map((v: unknown) => str(v, 50)).filter(Boolean).slice(0, 12) : [];
  const title = str(body.title, 160), branch = str(body.branch, 80), startDate = str(body.startDate, 20), eventType = str(body.eventType, 80);
  if (!title || !branch || startDate.length < 8 || !eventType || !audiences.length) return bad();
  const images = imagesOf(body.images, 20);
  const cover = images[0] ?? (body.coverKey && body.coverName ? { key: str(body.coverKey), name: str(body.coverName) } : null);
  const programs = (Array.isArray(body.programs) ? body.programs : []).slice(0, 30).filter((p: Json) => str(p?.name)).map((p: Json, index: number) => ({
    id: uid(), name: str(p.name, 120), audience: str(p.audience, 80), schedule: str(p.schedule, 120), instructors: str(p.instructors, 160), description: str(p.description, 1200), sortOrder: index,
  }));
  const id = uid(), at = now();
  const status = body.status === "published" ? "published" : "draft";
  await setDoc("events", id, {
    title, branch, startDate, endDate: str(body.endDate, 20) || null, venue: str(body.venue, 160), audiences, eventType,
    participantCount: int(body.participantCount), externalCount: int(body.externalCount), budget: body.budget == null || body.budget === "" ? null : int(body.budget),
    summary: str(body.summary), review: str(body.review), sourceUrl: str(body.sourceUrl, 1000), sourceDate: str(body.sourceDate, 20), sourceAuthor: str(body.sourceAuthor, 120),
    status, coverKey: cover?.key ?? null, coverName: cover?.name ?? null, images, programs, tags: cleanTags(body.tags), createdAt: at, updatedAt: at,
  });
  return json({ id, status }, 201);
}

// ---------- 마케팅 ----------
async function marketingGet(params: URLSearchParams, role: Role) {
  const q = params.get("q")?.trim() ?? "";
  const branch = params.get("branch")?.trim() ?? "";
  const target = params.get("target")?.trim() ?? "";
  const kind = params.get("kind")?.trim() ?? "";
  const rows = (await all("marketing"))
    .filter((a) => role === "admin" || a.status === "published")
    .filter((a) => !branch || a.branch === branch)
    .filter((a) => !target || a.target === target)
    .filter((a) => !kind || a.assetType === kind)
    .filter((a) => !q || [a.title, a.assetType, a.channel, a.notes].some((f) => like(f, q)))
    .sort((a, b) => byDesc("updatedAt")(a, b) || b.id.localeCompare(a.id))
    .slice(0, 24);
  await ensureBlobs(rows.flatMap((a) => [a.previewKey, a.sourceKey]));
  return json({ assets: rows.map((a) => ({ ...a, previewUrl: fileUrl(a.previewKey), sourceUrl: fileUrl(a.sourceKey, true) })), nextCursor: null });
}
async function marketingPost(body: Json) {
  const title = str(body.title, 160), createdDate = str(body.createdDate, 20), assetType = str(body.assetType, 80), target = str(body.target, 80);
  const campaignYear = Number(body.campaignYear);
  const driveUrl = str(body.driveUrl, 500);
  if (!title || createdDate.length < 8 || !assetType || !target || !(campaignYear >= 2000 && campaignYear <= 2200)) return bad();
  if (driveUrl && !/^https?:\/\//.test(driveUrl)) return bad("Google Drive 링크 형식을 확인해 주세요.");
  const id = uid(), at = now();
  const status = body.status === "published" ? "published" : "draft";
  await setDoc("marketing", id, {
    title, branch: str(body.branch, 80) || "본사 공통", createdDate, assetType, target, channel: str(body.channel, 100), campaignYear,
    fileFormat: str(body.fileFormat, 80), specifications: str(body.specifications, 500), quantity: int(body.quantity), driveUrl, notes: str(body.notes),
    relatedEventId: str(body.relatedEventId, 100) || null, previewKey: str(body.previewKey, 160) || null, previewName: str(body.previewName, 255) || null,
    sourceKey: str(body.sourceKey, 160) || null, sourceName: str(body.sourceName, 255) || null, status, createdAt: at, updatedAt: at,
  });
  return json({ id, status }, 201);
}

// ---------- 회의록 ----------
const meetingFields = ["title", "organization", "participants", "purpose", "summary", "discussion", "decisions", "actionItems"];
async function meetingsGet(params: URLSearchParams, role: Role) {
  const q = params.get("q")?.trim() ?? "";
  const organization = params.get("organization")?.trim() ?? "";
  const tags = (params.get("tags") ?? "").split(",").map(normalizeTag).filter(Boolean).slice(0, 8);
  const rows = (await all("meetings"))
    .filter((m) => role === "admin" || m.status === "published")
    .filter((m) => !organization || m.organization === organization)
    .filter((m) => !q || meetingFields.some((f) => like(m[f], q)))
    .filter((m) => hasAllTags(m, tags))
    .sort((a, b) => byDesc("meetingDate")(a, b) || byDesc("updatedAt")(a, b) || b.id.localeCompare(a.id))
    .slice(0, 24);
  return json({ meetings: rows.map((m) => ({ ...m, tags: m.tags ?? [] })), nextCursor: null });
}
async function meetingsPost(body: Json) {
  const title = str(body.title, 160), meetingDate = str(body.meetingDate, 20);
  if (!title || meetingDate.length < 8) return bad();
  const id = uid(), at = now();
  const status = body.status === "published" ? "published" : "draft";
  await setDoc("meetings", id, {
    title, meetingDate, organization: str(body.organization, 120), location: str(body.location, 160), participants: str(body.participants, 2000),
    attendeeCount: int(body.attendeeCount), purpose: str(body.purpose, 2000), summary: str(body.summary), discussion: str(body.discussion, 12000),
    decisions: str(body.decisions, 12000), actionItems: str(body.actionItems, 12000), source: str(body.source, 500), status, tags: cleanTags(body.tags), createdAt: at, updatedAt: at,
  });
  return json({ id, status }, 201);
}

// ---------- 홍보 ----------
async function promotionsGet(params: URLSearchParams, role: Role) {
  const q = params.get("q")?.trim() ?? "";
  const rows = (await all("promotions"))
    .filter((p) => role === "admin" || p.visibility === "published")
    .filter((p) => !q || [p.title, p.branch, p.manager, p.promotionType].some((f) => like(f, q)))
    .sort((a, b) => byDesc("activityDate")(a, b) || byDesc("updatedAt")(a, b))
    .slice(0, 100);
  await ensureBlobs(rows.flatMap((p) => [p.imageKey, ...(p.images ?? []).map((i: Json) => i.key)]));
  return json({
    campaigns: rows.map((p) => {
      const { images, ...rest } = p;
      return { ...rest, imageUrl: fileUrl(p.imageKey), galleryImages: (images ?? []).map((i: Json) => ({ src: fileUrl(i.key), name: i.name })), locations: p.locations ?? [] };
    }),
  });
}
async function promotionsPost(body: Json, role: Role) {
  const title = str(body.title, 160), activityDate = str(body.activityDate, 20), promotionType = str(body.promotionType, 80);
  const locations = (Array.isArray(body.locations) ? body.locations : []).slice(0, 30).filter((l: Json) => str(l?.school)).map((l: Json, index: number) => ({
    id: uid(), school: str(l.school, 120), schoolLevel: str(l.schoolLevel, 30) || "기타", activityTime: str(l.activityTime, 80), quantity: int(l.quantity), method: str(l.method, 80), notes: str(l.notes, 1000), sortOrder: index,
  }));
  if (!title || activityDate.length < 8 || !promotionType || !locations.length) return bad();
  const images = imagesOf(body.images, 12);
  const id = uid(), at = now();
  await setDoc("promotions", id, {
    title, branch: str(body.branch, 80), activityDate, channel: body.channel === "online" ? "online" : "offline", promotionType, manager: str(body.manager, 120),
    expense: body.expense == null || body.expense === "" ? null : int(body.expense), activityCount: Math.max(1, int(body.activityCount, 1)), platform: str(body.platform, 80),
    campaignStart: str(body.campaignStart, 20), campaignEnd: str(body.campaignEnd, 20), impressions: int(body.impressions), clicks: int(body.clicks), inquiries: int(body.inquiries),
    status: body.status === "completed" ? "completed" : "planned", notes: str(body.notes), imageKey: str(body.imageKey, 160) || images[0]?.key || null,
    imageName: str(body.imageName, 255) || images[0]?.name || null, images, visibility: role === "admin" && body.visibility === "published" ? "published" : "draft",
    locations, createdAt: at, updatedAt: at,
  });
  return json({ id }, 201);
}

// ---------- 제작 요청 ----------
const requestStatuses = ["approval_pending", "producing", "reviewing", "delayed", "completed"];
async function requestsGet() {
  const rows = (await all("productionRequests")).sort((a, b) => byDesc("updatedAt")(a, b) || b.id.localeCompare(a.id)).slice(0, 100);
  await ensureBlobs(rows.flatMap((r) => (r.references ?? []).map((i: Json) => i.key)));
  return json({ requests: rows.map((r) => { const { references, ...rest } = r; return { ...rest, referenceImages: (references ?? []).map((i: Json) => ({ src: fileUrl(i.key), name: i.name })) }; }) });
}
async function requestsPost(body: Json) {
  const title = str(body.title, 160), branch = str(body.branch, 80), requester = str(body.requester, 80), assetType = str(body.assetType, 80);
  const requestedDate = str(body.requestedDate, 20), desiredDate = str(body.desiredDate, 20), driveUrl = str(body.driveUrl, 500);
  if (!title || !branch || !requester || !assetType || requestedDate.length < 8 || desiredDate.length < 8) return bad();
  if (driveUrl && !/^https?:\/\//.test(driveUrl)) return bad("Drive 링크 형식을 확인해 주세요.");
  const id = uid(), at = now();
  await setDoc("productionRequests", id, {
    title, branch, requester, assetType, purpose: str(body.purpose, 2000), specifications: str(body.specifications, 2000), requiredCopy: str(body.requiredCopy),
    requestedDate, desiredDate, driveUrl, notes: str(body.notes), references: imagesOf(body.references, 10), status: "approval_pending", progressPercent: 0,
    assignee: "", delayedReason: "", revisedDueDate: "", resultAssetId: null, createdBy: whoAmI(), history: [{ status: "approval_pending", at, by: whoAmI(), note: "요청 등록" }], createdAt: at, updatedAt: at,
  });
  return json({ id }, 201);
}
function whoAmI() { const me = getMe(); return me ? `${me.campus === "전체" ? "이사" : me.campus} ${me.name}` : ""; }
async function requestsPatch(id: string, body: Json) {
  if (!requestStatuses.includes(body?.status)) return bad("변경 내용을 확인해 주세요.");
  const at = now();
  const patch: Json = { status: body.status, updatedAt: at };
  const existing = await getDoc("productionRequests", id);
  if (!existing) return json({ error: "요청을 찾을 수 없습니다." }, 404);
  if (existing.status !== body.status) {
    const history = Array.isArray(existing.history) ? existing.history.slice(-30) : [];
    patch.history = [...history, { status: body.status, at, by: whoAmI(), note: body.status === "delayed" ? str(body.delayedReason, 200) : "" }];
    if (body.status === "producing" && !existing.approvedAt) { patch.approvedAt = at; patch.approvedBy = whoAmI(); }
    if (body.status === "completed") patch.completedAt = at;
  }
  if (body.assignee !== undefined) patch.assignee = str(body.assignee, 80);
  if (body.progressPercent !== undefined) patch.progressPercent = Math.min(100, int(body.progressPercent));
  if (body.driveUrl !== undefined) patch.driveUrl = str(body.driveUrl, 500);
  if (body.delayedReason !== undefined) patch.delayedReason = str(body.delayedReason, 1000);
  if (body.revisedDueDate !== undefined) patch.revisedDueDate = str(body.revisedDueDate, 20);
  if (body.notes !== undefined) patch.notes = str(body.notes);
  if (body.resultAssetId !== undefined) patch.resultAssetId = body.resultAssetId ? str(body.resultAssetId, 80) : null;
  await updateDoc("productionRequests", id, patch);
  return json({ id, ...patch });
}
function scheduleBody(body: Json) {
  const title = str(body.title, 160), branch = str(body.branch, 80), scheduleDate = str(body.scheduleDate, 20);
  if (!title || !branch || scheduleDate.length < 8) return null;
  return {
    title, branch, scheduleDate, assetType: str(body.assetType, 80), manager: str(body.manager, 80),
    status: requestStatuses.includes(body.status) ? body.status : "approval_pending", notes: str(body.notes), delayedReason: str(body.delayedReason, 1000),
    revisedDueDate: str(body.revisedDueDate, 20), linkedRequestId: str(body.linkedRequestId, 100) || null,
  };
}

// ---------- 연간 이수 관리 ----------
async function complianceGet(role: Role) {
  const [requirements, submissionsAll, logs] = await Promise.all([all("complianceRequirements"), all("complianceSubmissions"), role === "admin" ? all("complianceLogs") : Promise.resolve([])]);
  requirements.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || String(a.dueDate).localeCompare(String(b.dueDate)));
  const active = submissionsAll.filter((s) => !s.deletedAt).sort(byDesc("updatedAt"));
  const trashed = role === "admin" ? submissionsAll.filter((s) => s.deletedAt).sort(byDesc("deletedAt")) : [];
  await ensureBlobs([...active, ...trashed].flatMap((s) => [s.certificateKey, ...(s.participants ?? []).map((p: Json) => p.certificateKey)]));
  const shape = (s: Json) => ({ ...s, certificateUrl: fileUrl(s.certificateKey), participants: (s.participants ?? []).map((p: Json) => ({ ...p, certificateUrl: fileUrl(p.certificateKey) })) });
  return json({ requirements, submissions: active.map(shape), trashed: trashed.map(shape), logs: logs.sort(byDesc("createdAt")).slice(0, 50) });
}
async function compliancePost(body: Json, role: Role) {
  const at = now();
  if (body?.kind === "requirement") {
    if (role !== "admin") return forbidden();
    const year = int(body.year), title = str(body.title, 160), category = str(body.category, 80), dueDate = str(body.dueDate, 20);
    if (!(year >= 2020 && year <= 2100) || !title || !category || dueDate.length < 8 || !["campus", "individual"].includes(body.scope)) return bad();
    const id = uid();
    await setDoc("complianceRequirements", id, {
      year, title, category, scope: body.scope, dueDate, description: str(body.description, 2000), target: str(body.target, 500), frequency: str(body.frequency, 80) || "연 1회",
      officialUrl: str(body.officialUrl, 1000), courseUrl: str(body.courseUrl, 1000), sourceName: str(body.sourceName, 120), officialCheckedAt: str(body.officialCheckedAt, 20),
      noticeType: ["안내", "신규", "변경", "마감 임박"].includes(body.noticeType) ? body.noticeType : "안내", mandatory: body.mandatory !== false, createdAt: at, updatedAt: at,
    });
    return json({ id }, 201);
  }
  const requirementId = str(body?.requirementId, 100), branch = str(body?.branch, 80), completionDate = str(body?.completionDate, 20), submittedBy = str(body?.submittedBy, 100);
  if (!requirementId || !["센텀캠퍼스", "김해캠퍼스", "명지캠퍼스"].includes(branch) || completionDate.length < 8 || !submittedBy) return bad();
  if (!body.certificateKey || !body.certificateName) return bad("완료 처리를 위해 이수증 파일이 필요합니다.");
  const participants = (Array.isArray(body.participants) ? body.participants : []).slice(0, 100).filter((p: Json) => str(p?.name)).map((p: Json, index: number) => ({
    id: uid(), name: str(p.name, 80), position: str(p.position, 80), completedAt: str(p.completedAt, 20), certificateKey: str(p.certificateKey, 160) || null, certificateName: str(p.certificateName, 255) || null, sortOrder: index,
  }));
  const id = uid();
  await setDoc("complianceSubmissions", id, {
    requirementId, branch, completionDate, status: "completed", notes: str(body.notes), submittedBy, certificateKey: str(body.certificateKey, 160), certificateName: str(body.certificateName, 255),
    participants, deletedAt: null, deletedBy: null, createdAt: at, updatedAt: at,
  });
  await setDoc("complianceLogs", uid(), { submissionId: id, action: "created", actor: submittedBy, detail: `${branch} · ${str(body.certificateName, 255) || "이수증"}`, createdAt: at });
  return json({ id }, 201);
}

// ---------- 제작실 기금 ----------
// 잔액은 저장하지 않고 날짜 순서대로 매번 계산한다 (수정·삭제해도 항상 맞게)
export type FundRow = { id: string; transactionDate: string; category: string; description: string; income: number; expense: number; memo: string; receiptKey: string | null; createdAt: string };
const kstMonth = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
async function fundGet() {
  const [{ accountLabel }, rows] = await Promise.all([call("fund/config"), all("fund")]);
  const asc = rows.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(String(t.transactionDate ?? ""))).sort((a, b) => String(a.transactionDate).localeCompare(String(b.transactionDate)) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || String(a.id).localeCompare(String(b.id)));
  await ensureBlobs(asc.map((t) => t.receiptKey));
  let balance = 0;
  const transactions = asc.map((t) => {
    const income = Number(t.income ?? 0) || 0, expense = Number(t.expense ?? 0) || 0;
    balance += income - expense;
    return { id: t.id, transactionDate: String(t.transactionDate), category: t.category ?? "", description: t.description ?? "", memo: t.memo ?? "", income, expense, balance, receiptKey: t.receiptKey ?? null, receiptUrl: fileUrl(t.receiptKey), createdAt: t.createdAt ?? "" };
  }).reverse();
  const month = kstMonth();
  const monthly = transactions.filter((t) => t.transactionDate.startsWith(month));
  return json({ accountLabel, currentBalance: balance, month, monthlyIncome: monthly.filter((t) => !t.category.startsWith("이월")).reduce((s, t) => s + t.income, 0), monthlyExpense: monthly.reduce((s, t) => s + t.expense, 0), transactions, demo: false });
}
async function sha(text: string) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).slice(0, 20); }
function hex(buf: ArrayBuffer) { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
const cleanFund = (r: Partial<FundRow>) => ({
  transactionDate: String(r.transactionDate ?? ""), category: String(r.category ?? "기타").slice(0, 30), description: String(r.description ?? "").slice(0, 200),
  income: Math.max(0, Math.round(Number(r.income) || 0)), expense: Math.max(0, Math.round(Number(r.expense) || 0)), memo: String(r.memo ?? "").slice(0, 300), receiptKey: r.receiptKey ?? null,
});
export const fundApi = {
  /** 업로드한 줄들의 고유번호 — 같은 파일을 두 번 올려도 중복 등록되지 않게 */
  async importIds(rows: Partial<FundRow>[]) {
    const seen = new Map<string, number>();
    const ids: string[] = [];
    for (const r of rows) {
      const c = cleanFund(r);
      const base = [c.transactionDate, c.category, c.description, c.income, c.expense].join("|");
      const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
      ids.push("fu-" + await sha(`${base}|${n}`));
    }
    return ids;
  },
  async importRows(rows: (Partial<FundRow> & { id: string })[], onProgress?: (done: number) => void) {
    let done = 0;
    const at = now();
    const queue = [...rows];
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        await setDoc("fund", r.id, { ...cleanFund(r), source: "upload", createdAt: at, createdBy: whoAmI() });
        onProgress?.(++done);
      }
    }));
  },
  async save(row: Partial<FundRow>) {
    if (row.id) { await updateDoc("fund", row.id, { ...cleanFund(row), updatedAt: now(), updatedBy: whoAmI() }); return row.id; }
    const id = "fm-" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    await setDoc("fund", id, { ...cleanFund(row), source: "manual", createdAt: now(), createdBy: whoAmI() });
    return id;
  },
  remove: (id: string) => deleteDoc("fund", id),
  async uploadReceipt(file: File) {
    const signed = await call("files/sign-upload", { name: file.name, type: file.type, size: file.size, purpose: "certificate" });
    const put = await fetchNative(signed.signedUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
    if (!put.ok) throw new ApiError(put.status, "영수증을 올리지 못했습니다.");
    fileCache.set(signed.key, { url: URL.createObjectURL(file), at: Date.now() });
    return String(signed.key);
  },
};

// ---------- 전국 Hi5 소식 (밴드 소식·양식 모음) ----------
export type NewsFile = { key: string; name: string; size?: number; url?: string | null };
export type NewsItem = { id: string; title: string; body: string; category: string; author: string; postedAt: string; deadline: string | null; files: NewsFile[]; bandUrl: string; photos: number; source: string };
export const newsApi = {
  async list(): Promise<NewsItem[]> {
    const rows = await all("nationalNews");
    await ensureBlobs(rows.flatMap((r) => (Array.isArray(r.files) ? r.files.map((f: Json) => f.key) : [])));
    return rows.map((r) => ({
      id: r.id, title: String(r.title ?? ""), body: String(r.body ?? ""), category: String(r.category ?? "공지"), author: String(r.author ?? ""),
      postedAt: String(r.postedAt ?? r.createdAt ?? ""), deadline: r.deadline || null, bandUrl: String(r.bandUrl ?? ""), photos: Number(r.photos ?? 0) || 0, source: String(r.source ?? "manual"),
      files: (Array.isArray(r.files) ? r.files : []).map((f: Json) => ({ key: String(f.key), name: String(f.name ?? f.key), size: Number(f.size ?? 0) || undefined, url: fileUrl(String(f.key)) })),
    })).sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  },
  async save(item: Partial<NewsItem>) {
    const data = {
      title: String(item.title ?? "").trim().slice(0, 200), body: String(item.body ?? "").slice(0, 20000), category: String(item.category ?? "공지").slice(0, 20), author: String(item.author ?? "").slice(0, 60),
      postedAt: String(item.postedAt ?? now()), deadline: item.deadline || null, bandUrl: String(item.bandUrl ?? "").slice(0, 300), photos: Number(item.photos ?? 0) || 0,
      files: (item.files ?? []).map((f) => ({ key: f.key, name: f.name, size: f.size ?? null })),
    };
    if (item.id) { await updateDoc("nationalNews", item.id, { ...data, updatedAt: now(), updatedBy: whoAmI() }); return item.id; }
    const id = "nn-" + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    await setDoc("nationalNews", id, { ...data, source: "manual", createdAt: now(), createdBy: whoAmI() });
    return id;
  },
  remove: (id: string) => deleteDoc("nationalNews", id),
  uploadFile: (file: File) => fundApi.uploadReceipt(file),
  /** 원래 파일 이름으로 내려받는 주소 */
  downloadUrl(f: NewsFile) {
    const url = fileUrl(f.key);
    if (!url || !url.startsWith("http")) return url;
    return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(f.name)}`;
  },
};

// ---------- 라우터 ----------
const archiveCollections: Record<string, string> = { events: "events", marketing: "marketing", meetings: "meetings" };

async function route(method: string, path: string, params: URLSearchParams, init?: RequestInit): Promise<Response> {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const [head, id] = parts;
  const readBody = async () => { try { return typeof init?.body === "string" ? JSON.parse(init.body) : {}; } catch { return {}; } };

  try {
    if (head === "auth") {
      if (id === "login") {
        const b = await readBody();
        const data = await call("auth/login", { campus: b.campus, name: b.name, pin: b.pin });
        if (!data.ok) return json({ error: data.msg ?? "로그인하지 못했습니다." }, 401);
        saveToken(data.token); currentMe = data.me; currentRole = data.me.isAdmin ? "admin" : "staff";
        return json({ role: currentRole, me: currentMe });
      }
      if (id === "apply") {
        const data = await call("auth/apply", await readBody());
        return json(data.ok ? { ok: true } : { error: data.msg ?? "신청하지 못했습니다." }, data.ok ? 200 : 400);
      }
      if (id === "logout") { signOut(); return json({ ok: true }); }
      if (id === "session") {
        if (tokenExpired(storage.get(TOKEN_KEY))) { signOut(); return json({ authenticated: false, role: null, demo: false }); }
        const data = await call("auth/session");
        if (!data.authenticated) { signOut(); return json({ authenticated: false, role: null, demo: false }); }
        currentMe = data.me; currentRole = data.role;
        saveToken(storage.get(TOKEN_KEY));
        return json(data);
      }
    }
    if (!currentRole) {
      if (tokenExpired(storage.get(TOKEN_KEY))) return unauthorized();
      const data = await call("auth/session");
      if (!data.authenticated) return unauthorized();
      currentMe = data.me; currentRole = data.role;
    }
    const role: Role = currentRole!;

    if (head === "ping") { await call("ping", await readBody()); return json({ ok: true }); }
    if (head === "admin") {
      const data = await call(`admin/${id}`, await readBody());
      return json(data, data.ok === false ? 400 : 200);
    }

    if (head === "fund") {
      if (id === "session") return json({ authenticated: Boolean((await call("fund/session")).authenticated) });
      if (id === "login" || id === "logout") return json({ authenticated: currentMe?.title === "원장" || currentMe?.title === "이사" });
      return await fundGet();
    }

    if (head === "uploads" && method === "POST") return await handleUpload(init?.body as FormData);

    if (head === "tags") {
      const scope = params.get("scope") === "meetings" ? "meetings" : "events";
      return json({ tags: tagSummary(await all(scope)) });
    }

    if (archiveCollections[head]) {
      const collection = archiveCollections[head];
      if (!id && method === "GET") return head === "events" ? await eventsGet(params, role) : head === "marketing" ? await marketingGet(params, role) : await meetingsGet(params, role);
      if (role !== "admin") return forbidden();
      if (!id && method === "POST") { const b = await readBody(); return head === "events" ? await eventsPost(b) : head === "marketing" ? await marketingPost(b) : await meetingsPost(b); }
      if (id && method === "PATCH") {
        const b = await readBody();
        if (b.status !== "draft" && b.status !== "published") return bad("상태값이 올바르지 않습니다.");
        await updateDoc(collection, id, { status: b.status, updatedAt: now() });
        return json({ id, status: b.status });
      }
      if (id && method === "DELETE") { await deleteDoc(collection, id); return json({ id, deleted: true }); }
    }

    if (head === "promotions") {
      if (!id && method === "GET") return await promotionsGet(params, role);
      if (!id && method === "POST") return await promotionsPost(await readBody(), role);
      if (role !== "admin") return forbidden();
      if (id && method === "PATCH") {
        const b = await readBody();
        if (b.visibility !== "draft" && b.visibility !== "published") return bad("공개 상태를 확인해 주세요.");
        await updateDoc("promotions", id, { visibility: b.visibility, updatedAt: now() });
        return json({ ok: true });
      }
      if (id && method === "DELETE") { await deleteDoc("promotions", id); return json({ ok: true }); }
    }

    if (head === "production-requests") {
      if (!id && method === "GET") return await requestsGet();
      if (!id && method === "POST") return await requestsPost(await readBody());
      if (role !== "admin") return forbidden();
      if (id && method === "PATCH") return await requestsPatch(id, await readBody());
      if (id && method === "DELETE") { await deleteDoc("productionRequests", id); return json({ id }); }
    }

    if (head === "production-schedules") {
      if (!id && method === "GET") return json({ schedules: (await all("productionSchedules")).sort((a, b) => byDesc("scheduleDate")(a, b) || byDesc("updatedAt")(a, b)) });
      if (role !== "admin") return forbidden();
      if (method === "DELETE" && id) { await deleteDoc("productionSchedules", id); return json({ id }); }
      const data = scheduleBody(await readBody());
      if (!data) return bad("일정 내용을 확인해 주세요.");
      const at = now();
      if (!id && method === "POST") { const newId = uid(); await setDoc("productionSchedules", newId, { ...data, createdAt: at, updatedAt: at }); return json({ id: newId }, 201); }
      if (id && method === "PATCH") { await updateDoc("productionSchedules", id, { ...data, updatedAt: at }); return json({ id, ...data }); }
    }

    if (head === "production-priority") {
      if (method === "GET") return json({ overrides: (await all("productionPriority")).map((o) => ({ monthKey: o.id, branch: o.branch, updatedAt: o.updatedAt })).sort((a, b) => a.monthKey.localeCompare(b.monthKey)) });
      if (role !== "admin") return forbidden();
      const b = await readBody();
      if (!/^\d{4}-\d{2}$/.test(String(b.monthKey)) || !["김해캠퍼스", "센텀캠퍼스", "명지캠퍼스"].includes(b.branch)) return bad("월과 캠퍼스를 확인해 주세요.");
      await setDoc("productionPriority", b.monthKey, { branch: b.branch, updatedAt: now() });
      return json({ monthKey: b.monthKey, branch: b.branch });
    }

    if (head === "compliance") {
      if (!id && method === "GET") return await complianceGet(role);
      if (!id && method === "POST") return await compliancePost(await readBody(), role);
      if (role !== "admin") return forbidden();
      const at = now();
      if (id && method === "PATCH") {
        await updateDoc("complianceSubmissions", id, { deletedAt: null, deletedBy: null, updatedAt: at });
        await setDoc("complianceLogs", uid(), { submissionId: id, action: "restored", actor: "관리자", detail: "휴지통에서 복원", createdAt: at });
        return json({ ok: true });
      }
      if (id && method === "DELETE") {
        if (params.get("permanent") === "true") {
          await setDoc("complianceLogs", uid(), { submissionId: id, action: "permanently_deleted", actor: "관리자", detail: "휴지통에서 영구 삭제", createdAt: at });
          await deleteDoc("complianceSubmissions", id);
        } else {
          await updateDoc("complianceSubmissions", id, { deletedAt: at, deletedBy: "관리자", updatedAt: at });
          await setDoc("complianceLogs", uid(), { submissionId: id, action: "trashed", actor: "관리자", detail: "이수증을 휴지통으로 이동", createdAt: at });
        }
        return json({ ok: true });
      }
    }
  } catch (error) {
    return dbError(error);
  }
  return json({ error: "찾을 수 없는 요청입니다." }, 404);
}

const fetchNative = window.fetch.bind(window);
export function installArchiveApi() {
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return fetchNative(input as RequestInfo, init);
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    return route(method, url.pathname, url.searchParams, init);
  };
}
