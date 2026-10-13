"use client";

// 📥 자료함 — 대화창처럼: 누구나 파일을 보내기만 하면 끝, 관리자가 확인 도장·반응·정리 표시
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Download, ExternalLink, FileArchive, FileImage, FileText, FileVideo, FolderOpen, LoaderCircle, Paperclip, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { getMe, inboxApi, type InboxFile, type InboxItem } from "@/archive-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { campusColor } from "@/lib/campus";

const REACTIONS = ["👍", "❤️", "🙏", "🎉", "😂"];
const MAX = 10 * 1024 * 1024 * 1024; // 구글 드라이브로 바로 가니 10GB까지

const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
const timeText = (iso: string) => { const d = new Date(iso); const h = d.getHours(); return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`; };
const dayText = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${"일월화수목금토"[d.getDay()]}요일`; };
const isImage = (f: { type: string; name: string }) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name);
function FileIcon({ f }: { f: { type: string; name: string } }) {
  if (isImage(f)) return <FileImage className="size-5" />;
  if (f.type.startsWith("video/")) return <FileVideo className="size-5" />;
  if (/\.(zip|7z|rar|psd|ai)$/i.test(f.name)) return <FileArchive className="size-5" />;
  return <FileText className="size-5" />;
}

export function InboxSection({ role }: { role: "staff" | "admin" }) {
  const admin = role === "admin";
  const me = getMe();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<InboxFile | null>(null);
  const [doneFor, setDoneFor] = useState<InboxItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (scroll = false) => {
    try { const list = await inboxApi.list(); setItems(list); if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60); }
    catch { setItems((cur) => cur ?? []); }
  }, []);
  useEffect(() => { void load(true); const t = setInterval(() => void load(), 30_000); return () => clearInterval(t); }, [load]);

  function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    const big = files.filter((f) => f.size > MAX);
    if (big.length) toast.error(`10GB가 넘는 파일 ${big.length}개는 뺐어요.`);
    setPicked((cur) => [...cur, ...files.filter((f) => f.size <= MAX)].slice(0, 50));
  }
  // 캡처한 이미지 붙여넣기(Ctrl+V)도 받기
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { const fs = Array.from(e.clipboardData?.files ?? []); if (fs.length) { e.preventDefault(); addFiles(fs); } };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function send() {
    if (!picked.length) { fileRef.current?.click(); return; }
    setSending({ done: 0, total: picked.length, pct: 0 });
    try {
      // 구글 드라이브로 바로: 첫 파일이 폴더를 만들고, 나머지는 같은 폴더에 3개씩 동시에
      const uploaded: InboxFile[] = new Array(picked.length);
      const total = picked.reduce((sum, f) => sum + f.size, 0) || 1;
      const sent = new Array(picked.length).fill(0);
      let done = 0;
      const tick = () => setSending({ done, total: picked.length, pct: Math.round((sent.reduce((a, b) => a + b, 0) / total) * 100) });
      const first = await inboxApi.upload(picked[0], null, (pct) => { sent[0] = (picked[0].size * pct) / 100; tick(); });
      uploaded[0] = first; done = 1; tick();
      let next = 1;
      await Promise.all(Array.from({ length: Math.min(3, picked.length - 1) }, async () => {
        for (let i = next++; i < picked.length; i = next++) {
          uploaded[i] = await inboxApi.upload(picked[i], first.folderId, (pct) => { sent[i] = (picked[i].size * pct) / 100; tick(); });
          sent[i] = picked[i].size; done++; tick();
        }
      }));
      await inboxApi.send(uploaded, memo, first.folderUrl);
      setPicked([]); setMemo("");
      toast.success(admin ? "📨 자료함에 올렸어요." : "📨 보냈어요! 관리자에게 알림이 갔어요.");
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "보내지 못했어요. 다시 시도해 주세요."); }
    finally { setSending(null); }
  }

  // 같은 묶음에 대한 저장은 순서대로 (빠르게 연달아 눌러도 안전)
  const queue = useRef(new Map<string, Promise<unknown>>());
  function check(item: InboxItem, reaction: string | null) {
    const checkedAt = item.checkedAt ?? new Date().toISOString(), checkedBy = item.checkedBy ?? me?.name ?? "";
    setItems((cur) => cur?.map((x) => x.id === item.id ? { ...x, checkedAt, checkedBy, reaction } : x) ?? cur);
    const prev = queue.current.get(item.id) ?? Promise.resolve();
    const run = prev.then(() => inboxApi.check(item.id, reaction, checkedAt, checkedBy)).catch(() => { toast.error("저장하지 못했어요."); void load(); });
    queue.current.set(item.id, run);
  }
  async function remove(item: InboxItem) {
    if (!confirmDelete(item)) return;
    try { await inboxApi.remove(item.id); setItems((cur) => cur?.filter((x) => x.id !== item.id) ?? cur); toast.success("지웠어요."); }
    catch { toast.error("지우지 못했어요."); }
  }
  async function markDone(item: InboxItem, note: string) {
    try {
      await (queue.current.get(item.id) ?? Promise.resolve());
      await inboxApi.done(item.id, note); setDoneFor(null);
      setItems((cur) => cur?.map((x) => x.id === item.id ? { ...x, status: "done", doneNote: note, doneAt: new Date().toISOString(), fileNames: x.files.map((f) => f.name), files: x.files.filter((f) => f.driveId) } : x) ?? cur);
      toast.success("✅ 정리 완료 도장을 찍었어요."); void load();
    }
    catch { toast.error("정리 표시를 하지 못했어요."); }
  }
  function downloadAll(item: InboxItem) {
    if (item.folderUrl) { window.open(item.folderUrl, "_blank", "noopener"); return; }
    item.files.forEach((f, i) => setTimeout(() => { const url = inboxApi.downloadUrl(f); if (!url) return; const a = document.createElement("a"); a.href = url; a.download = f.name; a.rel = "noreferrer"; document.body.appendChild(a); a.click(); a.remove(); }, i * 700));
    toast.info(`${item.files.length}개 내려받기를 시작했어요. 브라우저가 '여러 파일 다운로드'를 물으면 허용해 주세요.`);
  }

  const unchecked = useMemo(() => (items ?? []).filter((x) => !x.checkedAt && x.status !== "done" && x.createdById !== me?.id).length, [items, me?.id]);
  const waiting = useMemo(() => (items ?? []).filter((x) => x.status !== "done").length, [items]);
  let lastDay = "";

  return <div className="flex h-[calc(100dvh-210px)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#bacee0]/35 shadow-[0_10px_35px_rgba(38,33,28,0.06)] dark:bg-muted/30"
    onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
    {/* 머리 */}
    <div className="flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl">📥</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">자료함</p>
        <p className="truncate text-xs text-muted-foreground">{admin ? `정리 기다리는 묶음 ${waiting}개${unchecked ? ` · 아직 안 본 것 ${unchecked}개` : ""}` : "파일만 보내 주세요. 정리는 관리자가 해요 🙌"}</p>
      </div>
      {admin && unchecked > 0 && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">새 자료 {unchecked}</span>}
    </div>

    {/* 대화 */}
    <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
      {items === null && <p className="py-16 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />불러오는 중…</p>}
      {items?.length === 0 && <div className="mx-auto mt-10 max-w-xs rounded-2xl bg-card/90 p-5 text-center text-sm leading-6 text-muted-foreground shadow-xs">
        <p className="text-3xl">📮</p>
        <p className="mt-2 font-medium text-foreground">아직 올라온 자료가 없어요</p>
        <p>행사 사진, 시안, 양식… 무엇이든<br />아래 📎를 눌러 보내 주세요.<br />파일을 이 창에 끌어다 놓아도 돼요.</p>
      </div>}
      {items?.map((item) => {
        const mine = item.createdById === me?.id;
        const day = dayText(item.createdAt);
        const showDay = day !== lastDay; lastDay = day;
        // 예전(사이트 저장) 사진만 미리보기, 드라이브로 간 파일은 이름·크기 기록 + 드라이브 링크
        const images = item.files.filter((f) => f.key && isImage(f)), others = item.files.filter((f) => !(f.key && isImage(f)));
        const done = item.status === "done";
        return <div key={item.id}>
          {showDay && <div className="my-3 flex justify-center"><span className="rounded-full bg-black/10 px-3 py-1 text-[11px] text-foreground/70 dark:bg-white/10">{day}</span></div>}
          <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            {!mine && <span className="mb-5 grid size-9 shrink-0 place-items-center self-start rounded-2xl text-sm font-bold text-white" style={{ background: campusColor(item.campus) }}>{item.uploader.slice(-2)}</span>}
            <div className={`flex max-w-[86%] flex-col sm:max-w-[420px] ${mine ? "items-end" : "items-start"}`}>
              {!mine && <span className="mb-1 ml-1 text-xs text-foreground/70">{item.campus} {item.uploader}</span>}
              <div className="flex items-end gap-1.5">
                {/* 말풍선 옆 상태 (카톡처럼 노란 1 → 확인) */}
                <div className={`${mine ? "" : "order-last"} flex shrink-0 flex-col pb-0.5 text-[10px] text-foreground/60 ${mine ? "items-end" : "items-start"}`}>
                  {!item.checkedAt && !done && <b className="text-[11px] text-amber-500">1</b>}
                  <span>{timeText(item.createdAt)}</span>
                </div>
                <div className={`relative overflow-hidden rounded-2xl shadow-xs ${mine ? "rounded-br-md bg-[#fee500] text-[#191919]" : "rounded-bl-md bg-card"}`}>
                  {/* 도장 */}
                  {(done || item.checkedAt) && <span aria-label={done ? "정리 완료" : "확인함"} className={`pointer-events-none absolute top-2 right-2 z-10 rotate-[-12deg] rounded-full border-[3px] px-2 py-0.5 text-[11px] font-black tracking-tight backdrop-blur-[1px] animate-in zoom-in-150 fade-in duration-300 ${done ? "border-emerald-600/80 text-emerald-700 bg-white/70" : "border-rose-500/80 text-rose-600 bg-white/70"}`}>{done ? "정리 완료 ✓" : `확인 👀${item.reaction ? ` ${item.reaction}` : ""}`}</span>}
                  <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold opacity-60"><FolderOpen className="mr-1 inline size-3.5 align-[-2px]" />{item.title}</div>
                  {item.memo && <p className="px-3 pb-2 text-sm leading-6 whitespace-pre-wrap break-words">{item.memo}</p>}
                  {!done && images.length > 0 && <div className={`grid gap-0.5 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {images.slice(0, 9).map((f, i) => <button key={f.key} type="button" onClick={() => setViewer(f)} className="relative block aspect-square w-full min-w-24 overflow-hidden bg-muted sm:min-w-32">
                      {f.url ? <img src={f.url} alt={f.name} loading="lazy" className="h-full w-full object-cover" /> : <FileImage className="m-auto size-6 opacity-40" />}
                      {i === 8 && images.length > 9 && <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-bold text-white">+{images.length - 9}</span>}
                    </button>)}
                  </div>}
                  {others.length > 0 && <div className={`space-y-1 p-2 ${done ? "opacity-70" : ""}`}>{others.slice(0, done ? 3 : 50).map((f, n) => { const href = f.driveId ? (admin ? f.url : null) : inboxApi.downloadUrl(f); const body = <><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/70 text-foreground/70"><FileIcon f={f} /></span><span className="min-w-0 flex-1"><span className="block truncate">{f.name}</span><span className="block text-[11px] opacity-60">{sizeText(f.size)}{f.driveId ? " · 구글 드라이브" : ""}</span></span>{href && (f.driveId ? <ExternalLink className="size-4 shrink-0 opacity-60" /> : <Download className="size-4 shrink-0 opacity-60" />)}</>; const cls = `flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm ${mine ? "bg-black/5" : "bg-muted/60"} ${href ? (mine ? "hover:bg-black/10" : "hover:bg-muted") : ""}`; return href ? <a key={`${f.driveId ?? f.key}-${n}`} href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a> : <div key={`${f.driveId ?? f.key}-${n}`} className={cls}>{body}</div>; })}{done && others.length > 3 && <p className="px-1 text-[11px] opacity-60">외 {others.length - 3}개</p>}</div>}
                  {done && <p className="px-3 pb-2.5 text-sm leading-6 opacity-80">📦 파일 {item.fileNames?.length ?? 0}개 정리 완료.{item.doneNote ? <><br /><b>→ {item.doneNote}</b></> : null}</p>}
                  <div className="px-3 pb-2 text-[10px] opacity-50">{done ? `정리 ${item.doneAt ? dayText(item.doneAt) : ""}` : `파일 ${item.files.length}개 · ${sizeText(item.files.reduce((s, f) => s + f.size, 0))}`}{item.checkedBy && !done ? ` · ${item.checkedBy} 확인` : ""}</div>
                </div>
              </div>
              {/* 관리자 손잡이 */}
              {admin && !done && <div className={`mt-1.5 flex flex-wrap items-center gap-1 ${mine ? "justify-end" : ""}`}>
                {!item.checkedAt && <button type="button" onClick={() => check(item, item.reaction ?? null)} className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-primary shadow-xs hover:bg-primary hover:text-primary-foreground">👀 확인</button>}
                {REACTIONS.map((r) => <button key={r} type="button" aria-label={`${r} 반응`} onClick={() => check(item, item.reaction === r ? null : r)} className={`grid size-7 place-items-center rounded-full text-sm shadow-xs transition hover:scale-125 ${item.reaction === r ? "bg-amber-200 ring-2 ring-amber-400" : "bg-card"}`}>{r}</button>)}
                {item.files.length > 0 && <button type="button" onClick={() => downloadAll(item)} className="rounded-full bg-card px-2.5 py-1 text-xs shadow-xs hover:bg-muted">{item.folderUrl ? <><FolderOpen className="mr-0.5 inline size-3.5" />드라이브 폴더 열기</> : <><Download className="mr-0.5 inline size-3.5" />모두 받기</>}</button>}
                <button type="button" onClick={() => setDoneFor(item)} className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"><CheckCheck className="mr-0.5 inline size-3.5" />정리 완료</button>
                <button type="button" aria-label="지우기" onClick={() => void remove(item)} className="grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-xs hover:text-rose-600"><Trash2 className="size-3.5" /></button>
              </div>}
              {!admin && mine && !done && !item.checkedAt && <button type="button" onClick={() => void remove(item)} className="mt-1 text-[11px] text-foreground/50 hover:text-rose-600">잘못 보냈어요 · 지우기</button>}
            </div>
          </div>
        </div>;
      })}
      <div ref={bottomRef} />
      {dragging && <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-4 border-dashed border-primary bg-primary/10 text-lg font-bold text-primary backdrop-blur-sm">여기에 놓으면 보낼 준비가 돼요 📎</div>}
    </div>

    {/* 입력창 */}
    <div className="border-t bg-card px-3 py-2.5 sm:px-4">
      {picked.length > 0 && <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">{picked.map((f, i) => <span key={`${f.name}-${i}`} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-muted px-2 py-1 text-xs">
        {isImage(f) ? <img src={URL.createObjectURL(f)} alt="" className="size-8 rounded-md object-cover" /> : <FileIcon f={f} />}
        <span className="max-w-32 truncate">{f.name}</span><span className="opacity-50">{sizeText(f.size)}</span>
        {!sending && <button type="button" aria-label="빼기" onClick={() => setPicked((cur) => cur.filter((_, j) => j !== i))}><X className="size-3.5" /></button>}
      </span>)}</div>}
      {sending && <div className="mb-2"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>보내는 중… {sending.done}/{sending.total}</span><span>{sending.pct}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${sending.pct}%` }} /></div></div>}
      <div className="flex items-end gap-2">
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" disabled={!!sending} onClick={() => fileRef.current?.click()} aria-label="파일 첨부"><Paperclip className="size-5" /></Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={1} maxLength={500} disabled={!!sending} placeholder={picked.length ? "한마디 남기기 (안 써도 돼요)" : "📎를 눌러 파일을 고르거나, 여기에 끌어다 놓으세요"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
        <Button type="button" className="size-11 shrink-0 rounded-full p-0" disabled={!!sending} onClick={() => void send()} aria-label="보내기">{sending ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}</Button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">사진·영상·PSD·PDF 무엇이든 · 큰 파일도 OK (구글 드라이브로 바로 저장) · 캡처는 Ctrl+V</p>
    </div>

    {viewer && <Dialog open onOpenChange={(open) => !open && setViewer(null)}><DialogContent className="sm:max-w-4xl"><DialogHeader className="text-left"><DialogTitle className="truncate pr-6">{viewer.name}</DialogTitle><DialogDescription>{sizeText(viewer.size)}</DialogDescription></DialogHeader>{viewer.url && <img src={viewer.url} alt={viewer.name} className="max-h-[72vh] w-full rounded-lg object-contain" />}<a href={inboxApi.downloadUrl(viewer) ?? undefined} className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm hover:bg-muted"><Download className="size-4" />원본 내려받기</a></DialogContent></Dialog>}
    {doneFor && <DoneDialog item={doneFor} onClose={() => setDoneFor(null)} onDone={(note) => void markDone(doneFor, note)} />}
  </div>;
}

function confirmDelete(item: InboxItem) {
  return window.confirm(`'${item.title}' 기록을 지울까요?\n${item.files.some((f) => f.driveId) ? "구글 드라이브의 원본은 그대로 남아요." : `사이트에 올라온 파일 ${item.files.length}개도 함께 지워져요.`}`);
}

function DoneDialog({ item, onClose, onDone }: { item: InboxItem; onClose: () => void; onDone: (note: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent className="sm:max-w-md">
    <DialogHeader className="text-left"><DialogTitle>✅ 정리 완료로 표시할까요?</DialogTitle><DialogDescription>대화에 '정리 완료' 도장과 한마디가 남아요. 원본은 구글 드라이브에 그대로 있어요.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-1.5">{["이벤트에 올렸어요", "마케팅 제작물에 올렸어요", "드라이브에 보관했어요", "회의록에 올렸어요"].map((t) => <button key={t} type="button" onClick={() => setNote(t)} className={`rounded-full border px-2.5 py-1 text-xs ${note === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t}</button>)}</div>
    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="어디로 옮겼는지 한마디 (선택)" className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary" />
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>취소</Button><Button disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setBusy(true); onDone(note.trim()); }}>{busy ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}정리 완료</Button></div>
  </DialogContent></Dialog>;
}
