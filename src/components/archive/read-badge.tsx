"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Eye, LoaderCircle } from "lucide-react";

import { readsApi, type Reader } from "@/archive-api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// 글마다 "👁 N명 확인" — 목록 화면에서 여러 개를 한 번에 묶어서 불러온다
const counts = new Map<string, number>(); // "collection:id" → 수
const listeners = new Set<() => void>();
const pending = new Map<string, Set<string>>();
let timer: number | null = null;
let version = 0;
const emit = () => { version++; listeners.forEach((l) => l()); };
function request(collection: string, id: string) {
  if (counts.has(`${collection}:${id}`) || !id || id.startsWith("demo")) return;
  if (!pending.has(collection)) pending.set(collection, new Set());
  pending.get(collection)!.add(id);
  if (timer) return;
  timer = window.setTimeout(async () => {
    timer = null;
    const batch = [...pending.entries()]; pending.clear();
    await Promise.all(batch.map(async ([col, ids]) => {
      try {
        const r = await readsApi.counts(col, [...ids]);
        ids.forEach((i) => counts.set(`${col}:${i}`, r.counts[i] ?? 0));
      } catch { ids.forEach((i) => counts.set(`${col}:${i}`, 0)); }
    }));
    emit();
  }, 60);
}
/** 상세를 열 때 호출: 내 확인을 기록하고 숫자를 새로 고친다 */
export async function markRead(collection: string, id: string) {
  if (!id || id.startsWith("demo")) return;
  try { await readsApi.mark(collection, id); counts.delete(`${collection}:${id}`); request(collection, id); } catch { /* 무시 */ }
}
function useCount(collection: string, id: string) {
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version, () => version);
  useEffect(() => { request(collection, id); }, [collection, id]);
  return counts.get(`${collection}:${id}`);
}

export function ReadBadge({ collection, id, className = "", tone = "light", interactive = true }: { collection: string; id: string; className?: string; tone?: "light" | "dark"; interactive?: boolean }) {
  const n = useCount(collection, id);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ readers: Reader[]; unread?: Reader[] } | null>(null);
  useEffect(() => { if (open) { setData(null); readsApi.list(collection, id).then(setData).catch(() => setData({ readers: [] })); } }, [open, collection, id]);
  if (!id || id.startsWith("demo")) return null;
  const chipClass = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone === "dark" ? "bg-black/55 text-white" : "bg-muted text-muted-foreground"} ${className}`;
  if (!interactive) return <span className={chipClass} title="확인한 사람 수 (글을 열면 명단을 볼 수 있어요)"><Eye className="size-3.5" />{n === undefined ? "…" : `${n}명 확인`}</span>;
  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  return <>
    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }} title="확인한 사람 보기" className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone === "dark" ? "bg-black/55 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"} ${className}`}>
      <Eye className="size-3.5" />{n === undefined ? "…" : `${n}명 확인`}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80dvh] max-w-sm overflow-y-auto rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="text-left"><DialogTitle className="flex items-center gap-2"><Eye className="size-5" />확인한 사람 {data ? data.readers.length : n ?? ""}명</DialogTitle><DialogDescription>글을 열어서 본 사람이에요. 처음 본 시각 순서예요.</DialogDescription></DialogHeader>
        {!data ? <p className="py-6 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />불러오는 중…</p> : <>
          {data.readers.length ? <ul className="divide-y">{data.readers.map((r, i) => <li key={i} className="flex items-center justify-between gap-2 py-2.5 text-sm"><span><b>{r.name}</b> <span className="text-muted-foreground">{r.campus} · {r.title}</span></span><span className="shrink-0 text-xs text-muted-foreground">{fmt(r.at)}</span></li>)}</ul> : <p className="py-4 text-center text-sm text-muted-foreground">아직 확인한 사람이 없어요.</p>}
          {data.unread && <div className="mt-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><p className="text-sm font-semibold text-amber-800 dark:text-amber-200">아직 안 본 사람 {data.unread.length}명 <span className="font-normal">(관리자에게만 보여요)</span></p>{data.unread.length ? <p className="mt-1.5 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">{data.unread.map((u) => `${u.campus} ${u.name} ${u.title}`).join(" · ")}</p> : <p className="mt-1 text-sm text-amber-900/80">모두 확인했어요 🎉</p>}</div>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
