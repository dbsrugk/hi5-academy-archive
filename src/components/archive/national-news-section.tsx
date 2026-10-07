"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, Download, ExternalLink, FileSpreadsheet, FileText, Files, Images, LoaderCircle, Newspaper, Paperclip, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { newsApi, type NewsFile, type NewsItem } from "@/archive-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const NEWS_CATEGORIES = ["공지", "연합시험", "양식·취합", "구매·입금", "행사·시상"] as const;
const TONE: Record<string, string> = {
  공지: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  연합시험: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "양식·취합": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "구매·입금": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "행사·시상": "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const dayDiff = (d: string) => Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(kstToday() + "T00:00:00Z")) / 86400_000);
const fmtDate = (iso: string) => { const [d, t] = iso.split("T"); const [, m, day] = d.split("-"); return `${Number(m)}.${Number(day)}${t ? ` ${t.slice(0, 5)}` : ""}`; };
const isSheet = (name: string) => /\.(xlsx?|csv)$/i.test(name);
const kb = (n?: number) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`) : "");

function DDay({ date, done }: { date: string; done?: boolean }) {
  const d = dayDiff(date);
  if (d < 0 || done) return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">마감</span>;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${d <= 2 ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>{d === 0 ? "오늘 마감" : `D-${d}`}</span>;
}

function FileChip({ file }: { file: NewsFile }) {
  const href = newsApi.downloadUrl(file);
  const Icon = isSheet(file.name) ? FileSpreadsheet : FileText;
  const color = isSheet(file.name) ? "text-emerald-600" : "text-rose-600";
  if (!href) return <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground"><Icon className="size-3.5 shrink-0" /><span className="truncate">{file.name}</span><span className="shrink-0">· 밴드에서</span></span>;
  return <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"><Icon className={`size-3.5 shrink-0 ${color}`} /><span className="truncate">{file.name}</span><Download className="size-3.5 shrink-0 text-muted-foreground" /></a>;
}

function Body({ text }: { text: string }) {
  return <div className="space-y-1 text-[15px] leading-7">{text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} className="h-2" />;
    if (/^(■|\(\d+\)|\[|📢|★)/.test(t)) return <p key={i} className="font-semibold">{t}</p>;
    if (/^(※|\*|✅)/.test(t)) return <p key={i} className="text-[14px] text-muted-foreground">{t}</p>;
    if (/^(-|·|•|①|②|③)/.test(t)) return <p key={i} className="pl-3">{t}</p>;
    return <p key={i}>{t}</p>;
  })}</div>;
}

type Draft = Partial<NewsItem> & { files: NewsFile[] };

export function NationalNewsSection({ role }: { role: "staff" | "admin" }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"news" | "files">("news");
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<NewsItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    let stale = false;
    newsApi.list().then((list) => { if (!stale) setItems(list); }).catch(() => toast.error("전국 소식을 불러오지 못했어요."));
    return () => { stale = true; };
  }, [reload]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => (items ?? []).filter((it) => (category === "전체" || it.category === category) && (!q || `${it.title} ${it.body} ${it.author} ${it.files.map((f) => f.name).join(" ")}`.toLowerCase().includes(q))), [items, category, q]);
  const upcoming = useMemo(() => (items ?? []).filter((it) => it.deadline && dayDiff(it.deadline) >= 0).sort((a, b) => a.deadline!.localeCompare(b.deadline!)), [items]);
  const allFiles = useMemo(() => {
    const seen = new Map<string, { file: NewsFile; item: NewsItem }>();
    for (const it of items ?? []) for (const f of it.files) if (!seen.has(f.name)) seen.set(f.name, { file: f, item: it });
    return [...seen.values()].filter(({ file, item }) => (category === "전체" || item.category === category) && (!q || `${file.name} ${item.title}`.toLowerCase().includes(q)));
  }, [items, category, q]);
  const counts = useMemo(() => Object.fromEntries(NEWS_CATEGORIES.map((c) => [c, (items ?? []).filter((it) => it.category === c).length])), [items]);

  if (!items) return <div className="grid min-h-[360px] place-items-center text-primary"><LoaderCircle className="size-7 animate-spin" /></div>;

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Newspaper className="size-5" /></span><div><p className="font-semibold">Hi5·애니Hi 전국 밴드 소식</p><p className="mt-0.5 text-sm leading-6 text-muted-foreground">연합시험 주제·접수표, 취합 양식, 입금 안내를 한곳에 모았어요. 원장·이사·관리자만 볼 수 있어요.</p></div></div>
      {isAdmin && <Button className="h-10 shrink-0 rounded-xl" onClick={() => setDraft({ category: "공지", postedAt: `${kstToday()}T09:00`, title: "", body: "", author: "", deadline: null, bandUrl: "", photos: 0, files: [] })}><Plus className="size-4" />소식 등록</Button>}
    </div>

    {upcoming.length > 0 && <Card className="rounded-2xl border-rose-200 bg-rose-50/60 py-0 dark:border-rose-900 dark:bg-rose-950/20"><CardContent className="p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300"><AlarmClock className="size-4" />마감이 남은 일</p>
      <ul className="space-y-1.5">{upcoming.map((it) => <li key={it.id}><button type="button" onClick={() => setOpen(it)} className="flex w-full items-center gap-2 text-left text-sm"><DDay date={it.deadline!} /><span className="truncate font-medium">{it.title}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{fmtDate(it.deadline!)}</span></button></li>)}</ul>
    </CardContent></Card>}

    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:w-64">{(["news", "files"] as const).map((k) => <button key={k} type="button" onClick={() => setTab(k)} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{k === "news" ? <><Newspaper className="size-4" />소식 {items.length}</> : <><Files className="size-4" />양식·자료 {new Set(items.flatMap((i) => i.files.map((f) => f.name))).size}</>}</button>)}</div>
        <div className="relative flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·내용·파일 이름으로 찾기 (예: 접수표, 바람막이)" className="h-11 rounded-xl pl-9" />{query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>}</div>
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">{["전체", ...NEWS_CATEGORIES.filter((c) => counts[c] || category === c)].map((c) => <button key={c} type="button" onClick={() => setCategory(c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${category === c ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{c}{c !== "전체" && <span className="ml-1 opacity-70">{counts[c]}</span>}</button>)}</div>
    </div>

    {tab === "news" ? (
      filtered.length ? <ul className="space-y-2.5">{filtered.map((it) => <li key={it.id}>
        <button type="button" onClick={() => setOpen(it)} className="block w-full rounded-2xl border border-border/80 bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span className={`rounded-full px-2 py-0.5 font-semibold ${TONE[it.category] ?? TONE.공지}`}>{it.category}</span>{it.deadline && <DDay date={it.deadline} />}<span>{fmtDate(it.postedAt)}</span><span className="truncate">· {it.author}</span></div>
          <p className="mt-2 text-[16px] leading-6 font-semibold">{it.title}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{it.body.replace(/\n+/g, " ")}</p>
          {(it.files.length > 0 || it.photos > 0) && <div className="mt-3 flex flex-wrap gap-1.5">{it.files.slice(0, 3).map((f) => <FileChip key={f.key + f.name} file={f} />)}{it.files.length > 3 && <span className="self-center text-xs text-muted-foreground">외 {it.files.length - 3}개</span>}{it.photos > 0 && <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"><Images className="size-3.5" />사진 {it.photos}장</span>}</div>}
        </button>
      </li>)}</ul> : <Empty text={items.length ? "조건에 맞는 소식이 없어요." : "아직 등록된 소식이 없어요."} />
    ) : (
      allFiles.length ? <Card className="overflow-hidden rounded-2xl border-border/80 py-0"><ul className="divide-y">{allFiles.map(({ file, item }) => {
        const href = newsApi.downloadUrl(file); const sheet = isSheet(file.name);
        return <li key={file.name} className="flex items-center gap-3 p-3.5">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${sheet ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>{sheet ? <FileSpreadsheet className="size-5" /> : <FileText className="size-5" />}</span>
          <button type="button" onClick={() => setOpen(item)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{file.name}</span><span className="block truncate text-xs text-muted-foreground">{fmtDate(item.postedAt)} · {item.title}{file.size ? ` · ${kb(file.size)}` : ""}</span></button>
          {href ? <Button asChild size="sm" variant="outline" className="h-9 shrink-0 rounded-lg"><a href={href} target="_blank" rel="noreferrer"><Download className="size-4" /><span className="hidden sm:inline">받기</span></a></Button> : item.bandUrl ? <Button asChild size="sm" variant="ghost" className="h-9 shrink-0 rounded-lg text-muted-foreground"><a href={item.bandUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /><span className="hidden sm:inline">밴드</span></a></Button> : null}
        </li>;
      })}</ul></Card> : <Empty text="조건에 맞는 양식·자료가 없어요." />
    )}

    <Detail item={open} isAdmin={isAdmin} onClose={() => setOpen(null)} onEdit={(it) => { setOpen(null); setDraft({ ...it, files: [...it.files] }); }} onDeleted={() => { setOpen(null); setReload((v) => v + 1); }} />
    <Editor draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); setReload((v) => v + 1); }} />
  </div>;
}

function Empty({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">{text}</div>; }

function Detail({ item, isAdmin, onClose, onEdit, onDeleted }: { item: NewsItem | null; isAdmin: boolean; onClose: () => void; onEdit: (it: NewsItem) => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setConfirm(false), [item]);
  if (!item) return <Dialog open={false} />;
  async function remove() {
    if (!item) return;
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try { await newsApi.remove(item.id); toast.success("삭제했어요."); onDeleted(); } catch { toast.error("삭제하지 못했어요."); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-2xl">
      <DialogHeader className="text-left">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span className={`rounded-full px-2 py-0.5 font-semibold ${TONE[item.category] ?? TONE.공지}`}>{item.category}</span>{item.deadline && <><DDay date={item.deadline} /><span>마감 {fmtDate(item.deadline)}</span></>}</div>
        <DialogTitle className="text-xl leading-7">{item.title}</DialogTitle>
        <DialogDescription>{item.author} · {fmtDate(item.postedAt)}</DialogDescription>
      </DialogHeader>
      {item.files.length > 0 && <div className="rounded-xl bg-muted/50 p-3"><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Paperclip className="size-4" />첨부 {item.files.length}개</p><div className="flex flex-wrap gap-1.5">{item.files.map((f) => <FileChip key={f.key + f.name} file={f} />)}</div></div>}
      <Body text={item.body} />
      {item.photos > 0 && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Images className="size-4" />사진 {item.photos}장은 밴드 원글에서 볼 수 있어요.</p>}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
        {isAdmin && <><Button variant="ghost" className={`h-10 rounded-xl ${confirm ? "bg-rose-600 text-white hover:bg-rose-700 hover:text-white" : "text-rose-600"}`} disabled={busy} onClick={remove}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{confirm ? "한 번 더 누르면 삭제" : "삭제"}</Button><Button variant="outline" className="h-10 rounded-xl" onClick={() => onEdit(item)}><Pencil className="size-4" />고치기</Button></>}
        {item.bandUrl && <Button asChild className="h-10 rounded-xl sm:ml-auto"><a href={item.bandUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />밴드 원글 보기</a></Button>}
      </div>
    </DialogContent>
  </Dialog>;
}

function Editor({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Draft | null>(draft);
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setForm(draft), [draft]);
  if (!form) return <Dialog open={false} />;
  const set = (p: Partial<Draft>) => setForm((f) => (f ? { ...f, ...p } : f));
  const date = (form.postedAt ?? "").slice(0, 10), time = (form.postedAt ?? "").slice(11, 16) || "09:00";

  async function addFiles(list: FileList | null) {
    if (fileRef.current) fileRef.current.value = "";
    if (!list?.length) return;
    setBusy("file");
    try {
      const added: NewsFile[] = [];
      for (const file of Array.from(list)) {
        if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name}: 50MB 이하만 올릴 수 있어요.`); continue; }
        added.push({ key: await newsApi.uploadFile(file), name: file.name, size: file.size });
      }
      setForm((f) => (f ? { ...f, files: [...f.files, ...added] } : f));
    } catch { toast.error("파일을 올리지 못했어요."); } finally { setBusy(""); }
  }
  async function save() {
    if (!form) return;
    if (!form.title?.trim()) { toast.error("제목을 적어 주세요."); return; }
    setBusy("save");
    try { await newsApi.save(form); toast.success(form.id ? "고쳤어요." : "등록했어요."); onSaved(); } catch { toast.error("저장하지 못했어요."); } finally { setBusy(""); }
  }

  return <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-2xl">
      <DialogHeader className="text-left"><DialogTitle>{form.id ? "소식 고치기" : "전국 소식 등록"}</DialogTitle><DialogDescription>밴드 글을 복사해 붙여넣고, 첨부 양식을 올려 주세요.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>분류</Label><div className="flex flex-wrap gap-1.5">{NEWS_CATEGORIES.map((c) => <button key={c} type="button" onClick={() => set({ category: c })} className={`rounded-full border px-3 py-1.5 text-sm ${form.category === c ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{c}</button>)}</div></div>
        <div className="space-y-2"><Label htmlFor="nn-title">제목</Label><Input id="nn-title" value={form.title ?? ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder="예) 10월 연합시험 주제 및 접수표" className="h-11 rounded-xl" /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="nn-date">올린 날</Label><Input id="nn-date" type="date" value={date} onChange={(e) => set({ postedAt: `${e.target.value}T${time}` })} className="h-11 rounded-xl" /></div>
          <div className="space-y-2"><Label htmlFor="nn-deadline">마감일 <span className="font-normal text-muted-foreground">(선택)</span></Label><Input id="nn-deadline" type="date" value={form.deadline ?? ""} onChange={(e) => set({ deadline: e.target.value || null })} className="h-11 rounded-xl" /></div>
          <div className="space-y-2"><Label htmlFor="nn-author">올린 사람</Label><Input id="nn-author" value={form.author ?? ""} maxLength={60} onChange={(e) => set({ author: e.target.value })} placeholder="예) 영등포 이희주 원장" className="h-11 rounded-xl" /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="nn-body">내용</Label><Textarea id="nn-body" value={form.body ?? ""} onChange={(e) => set({ body: e.target.value })} placeholder="밴드 글 내용을 그대로 붙여넣으세요" className="min-h-44 rounded-xl" /></div>
        <div className="space-y-2"><Label htmlFor="nn-band">밴드 원글 주소 <span className="font-normal text-muted-foreground">(선택)</span></Label><Input id="nn-band" value={form.bandUrl ?? ""} onChange={(e) => set({ bandUrl: e.target.value })} placeholder="https://band.us/band/84651374/post/…" className="h-11 rounded-xl" /></div>
        <div className="space-y-2"><Label>첨부 양식·자료</Label>
          {form.files.length > 0 && <ul className="space-y-1.5">{form.files.map((f, i) => <li key={f.key + i} className="flex items-center gap-2 rounded-xl border p-2.5 text-sm">{isSheet(f.name) ? <FileSpreadsheet className="size-4 text-emerald-600" /> : <FileText className="size-4 text-rose-600" />}<span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-muted-foreground">{kb(f.size)}</span><Button type="button" size="icon-sm" variant="ghost" aria-label="첨부 빼기" onClick={() => set({ files: form.files.filter((_, j) => j !== i) })}><X className="size-4" /></Button></li>)}</ul>}
          <Button type="button" variant="outline" className="h-11 w-full rounded-xl" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === "file" ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}파일 올리기 (엑셀·PDF·한글 등, 여러 개 가능)</Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </div>
        <div className="flex justify-end pt-1"><Button className="h-11 rounded-xl sm:min-w-32" disabled={!!busy} onClick={save}>{busy === "save" && <LoaderCircle className="size-4 animate-spin" />}{form.id ? "고친 내용 저장" : "등록하기"}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
